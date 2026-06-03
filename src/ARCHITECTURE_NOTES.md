# Balance of Power — Architecture Notes

Quick reference for all contributors and future AI prompts. Read this before building any feature.

---

## 1. Build Target

- **Stack:** React 18 + Tailwind CSS, compiled by Vite via the `@base44/vite-plugin`
- **No:** Next.js, SSR, custom server, raw Supabase, or any backend outside Base44
- **TypeScript:** Supported natively. `.ts`/`.tsx` for new files. Do not alter `tsconfig.json` or `vite.config` — platform-managed.
- **File structure:** flat source root (`pages/`, `components/`, `config/`, `types/`, `features/`, `lib/`) — no `/src/` prefix

---

## 2. Mobile / Layout Strategy

- Campaign gameplay screens (`/campaigns/:id`) use `CampaignLayout` which routes to a layout component based on `useLayoutMode()`:
  - `portrait` (width < 600px OR portrait orientation) → `PortraitCampaignLayout`
  - `compactLandscape` (600–900px landscape) → `LandscapeCampaignLayout` (compact=true)
  - `landscape` (≥ 900px landscape) → `LandscapeCampaignLayout`
- **Portrait mode is fully supported** — no orientation gate/overlay. The app works in both orientations.
- Portrait uses a tab bar + bottom sheet system (no permanent sidebars).
- Landscape uses a fixed docked panel system (LeftDock, RightDock, BottomRail).
- All other screens (Home, Lobby, History, etc.) are standard responsive web.
- App is published via the **Base44 mobile wrapper** (same React code → iOS/Android).
- Do not add native mobile APIs — target the web layer only.

See `RESPONSIVE_LAYOUT_NOTES.md` for the full portrait/landscape component breakdown.

---

## 3. Backend

- **Only backend:** Base44 SDK entity system via `api/base44Client.js`
- All data reads/writes go through `base44.entities.EntityName.*` methods
- Auth via `base44.auth.*` — no custom JWT logic
- Do **not** make raw REST calls or use `fetch` against external APIs from the frontend (use backend functions for that)
- Files that directly interface with the SDK stay as `.js`: `api/base44Client.js`, `lib/app-params.js`, `lib/query-client.js`

### Backend Functions (Deno)

Each backend function is a single self-contained Deno deploy handler in `functions/`. **No local imports between function files** — Base44 deploys each independently.

| Function | Responsibility |
|---|---|
| `setupPhase` | Faction selection, territory draft, initial deploy |
| `deployPhase` | Deploy troop income + placement + phase advance |
| `attackPhase` | Staged attacks, commitment, phase reveal + battle card generation |
| `battlePhase` | Full battle lifecycle (see §11) |
| `fortifyPhase` | Troop movement, construction staging, phase advance |
| `initialDeploy` | Initial deployment reveal + application |

---

## 4. Rules Engine Separation

- All game logic must live in **feature modules** (`features/phases/`, `features/battles/`) or `services/rules-engine/`
- **Never** put troop math, attack validation, phase advancement, or battle scaling inside:
  - UI components
  - Pages
  - Config files (config holds values, not logic)
- Config files (`config/gameplay.ts`, `config/theme.ts`, `config/battleConstants.js`) are **read-only constants** — no functions that mutate game state

---

## 5. Hidden Information

- `PhaseDecision` records with `is_locked = false` are **private to the owning player**
- Enforcement must happen at the **data-access / query-filter layer**, not just by hiding UI elements
- Pattern: query `PhaseDecision` filtered by `player_id = currentUser.id` OR `is_locked = true`
- Never fetch all decisions for a round and filter client-side — that leaks data over the wire
- Admin Test Mode can override this, but only for users with `role = 'admin'` and only in the test mode page

---

## 6. Map Rendering

- Territory maps are **schema-driven**: all coordinates come from `TerritoryDefinition.x` / `.y` fields
- The map renderer reads `MapDefinition` + `TerritoryDefinition` + `TerritoryConnection` entity records
- **No hardcoded SVG paths, coordinates, or territory names** in React components

---

## 7. Config-Driven Values

- All gameplay balance values → `config/gameplay.ts` (`GAMEPLAY_DEFAULTS`, `BATTLE_SCALING`, `REGION_BONUS`)
- All visual tokens → `config/theme.ts` (`PLAYER_COLORS`, `PHASE_COLORS`, `RESOURCE_TYPES`, etc.)
- All battle type/status/preference constants → `config/battleConstants.js`
- Components import from config — they never hardcode numbers, colors, or string enums
- Per-campaign overrides stored in `Campaign.settings` (a `CampaignSettings` object in the entity)

---

## 8. Type System

- All domain types in `types/` — import via `@/types`
- Use `interface` for entity-shaped objects, `type` for unions and aliases
- No TypeScript `enum` — use string literal unions for JSON compatibility
- Type unions (e.g. `ResourceType`, `StructureType`) must stay in sync with their array counterparts in `config/theme.ts`

---

## 9. Feature Modules

| Folder | Owns |
|---|---|
| `features/auth` | Auth flows, session, ProtectedRoute |
| `features/profiles` | TabletopGameProfile CRUD |
| `features/campaigns` | Campaign creation, joining, lobby, status |
| `features/maps` | MapDefinition, TerritoryDefinition, map renderer |
| `features/phases` | Phase decisions, locking, phase engine |
| `features/battles` | BattleCard generation, result flow, scaling engine |
| `features/history` | Phase snapshots, audit log |
| `features/adminTestMode` | Solo sim, perspective switching, debug overlay |

---

## 10. Key Constraints (Base44 Platform)

- Cannot run server-side TypeScript at runtime — all TS is compile-time only
- Backend functions run as Deno deploy handlers in `functions/` — **each file is independent, no cross-file imports**
- No file system access in the browser — all persistence via Base44 entities
- Entity field size limit: do not store large blobs (map SVGs, base64 images) in entity fields — use file upload URLs
- No WebSockets natively — use Base44 entity subscriptions (`base44.entities.X.subscribe()`) for real-time updates

---

## 11. Battle Phase Module — Authoritative Engine

> The authoritative battle resolution engine is `functions/battlePhase`.

Because Base44 backend functions cannot import from local files, all battle logic is inlined in one Deno handler. It is organized into clearly-labelled internal sections:

### Internal sections of `functions/battlePhase`

| Section | Responsibility |
|---|---|
| **Pure helpers** | `scaleBackSurvivors`, `seededRandom`, `getParticipantIds`, `getWinnerCommittedTroops`, `winnerCommittedTabletop`, `buildSides` |
| **Auto-resolve** | `autoResolveBattle()` — seeded RNG, per-type logic (siege, double siege, bloodbath, capture objectives) |
| **Territory updates** | `buildTerritoryUpdates()` — computes territory changes without DB access |
| **Recovery siege** | `buildTerritoryUpdatesWithRecovery()` — wraps territory updates with bloodbath origin-capture check + Recovery Siege card creation |
| **DB application** | `applyTerritoryUpdates()` — persists changes via Base44 SDK |
| **Locked territory refresh** | `refreshLockedTerritories()` — recomputes Campaign.locked_territory_ids from open carryover cards |
| **Audit log** | `log()` — writes SetupLog entries |
| **Actions** | `getBattleCards`, `setPreference`, `closeBattleVoting`, `submitResult`, `approveResult`, `adminOverride`, `autoResolve`, `setDelayed`, `setForfeited`, `tallyAllCards`, `processPhaseEnd` |

### Frontend-side constants

Shared enums for battle types, statuses, preferences, and tally outcomes live in `config/battleConstants.js`.
These are the single source of truth for documentation. The backend inlines the same string values.

### Deprecated / archived

`services/rules-engine/battle/battleResolution.js` — **DEPRECATED**. Old frontend-side resolution prototype. Do not import or modify. See header comment in that file.

`services/rules-engine/battle/battleClassification.js` — **ACTIVE**. Still used by `attackPhase` for battle card generation (classifyBattle, calcBattleScaling, scaleBackSurvivors).

---

## 12. Combat State Machine

```
[pending / awaiting_result]
  │
  ├─ unanimous auto_resolve  ──→ auto_resolved ──→ result_applied
  ├─ unanimous delay         ──→ delayed
  ├─ forfeit(s) tallied      ──→ forfeited ──→ result_applied
  │
  ├─ admin submits result    ──→ result_submitted
  │     └─ participants approve ──→ resolved ──→ result_applied
  │     └─ participant flags ──→ awaiting_approval
  │           └─ admin override ──→ resolved ──→ result_applied
  │
  └─ processPhaseEnd (force) ──→ auto_resolved ──→ result_applied

[delayed] ──→ processPhaseEnd ──→ active_carryover (next round)
[active_carryover]
  ├─ result submitted        ──→ pending_approval
  │     └─ approved          ──→ resolved ──→ result_applied (resolved_in_battle_round = N)
  └─ processPhaseEnd         ──→ auto_resolved ──→ result_applied
```

### Recovery Siege

When a bloodbath winner has nowhere to place survivors (origin captured by a third party AND loser held their territory), a new `BattleCard` is created:
- `status: active_carryover`
- `round: round + 1`
- `battle_type: siege`
- `result.recovery_siege: true`

This ensures survivors are never silently lost.