# Balance of Power — Architecture Notes

Quick reference for all contributors and future AI prompts. Read this before building any feature.

---

## 1. Build Target

- **Stack:** React 18 + Tailwind CSS, compiled by Vite via the `@base44/vite-plugin`
- **No:** Next.js, SSR, custom server, raw Supabase, or any backend outside Base44
- **TypeScript:** Supported natively. `.ts`/`.tsx` for new files. Do not alter `tsconfig.json` or `vite.config` — platform-managed.
- **File structure:** flat source root (`pages/`, `components/`, `config/`, `types/`, `features/`, `lib/`) — no `/src/` prefix

---

## 2. Mobile Strategy

- Campaign gameplay screens (`/campaigns/:id`) use `CampaignLayout` which:
  - Enforces **landscape-only** on mobile via CSS `@media (orientation: portrait)` overlay
  - Uses a fixed, full-screen docked panel system (TopBar, LeftDock, RightDock, BottomRail)
- All other screens are standard responsive web
- App is published via the **Base44 mobile wrapper** (same React code → iOS/Android)
- Do not add native mobile APIs — target the web layer only

---

## 3. Backend

- **Only backend:** Base44 SDK entity system via `api/base44Client.js`
- All data reads/writes go through `base44.entities.EntityName.*` methods
- Auth via `base44.auth.*` — no custom JWT logic
- Do **not** make raw REST calls or use `fetch` against external APIs from the frontend (use backend functions for that)
- Files that directly interface with the SDK stay as `.js`: `api/base44Client.js`, `lib/app-params.js`, `lib/query-client.js`

---

## 4. Rules Engine Separation

- All game logic must live in **feature modules** (`features/phases/`, `features/battles/`) or a future `engine/` directory
- **Never** put troop math, attack validation, phase advancement, or battle scaling inside:
  - UI components
  - Pages
  - Config files (config holds values, not logic)
- Config files (`config/gameplay.ts`, `config/theme.ts`) are **read-only constants** — no functions that mutate game state

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
- Future: the `MapRenderer` component in `features/maps/` will accept entity data as props and build the SVG dynamically

---

## 7. Config-Driven Values

- All gameplay balance values → `config/gameplay.ts` (`GAMEPLAY_DEFAULTS`, `BATTLE_SCALING`, `REGION_BONUS`)
- All visual tokens → `config/theme.ts` (`PLAYER_COLORS`, `PHASE_COLORS`, `RESOURCE_TYPES`, etc.)
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
- Backend functions run as Deno deploy handlers in `functions/` — separate from the React app
- No file system access in the browser — all persistence via Base44 entities
- Entity field size limit: do not store large blobs (map SVGs, base64 images) in entity fields — use file upload URLs
- No WebSockets natively — use Base44 entity subscriptions (`base44.entities.X.subscribe()`) for real-time updates