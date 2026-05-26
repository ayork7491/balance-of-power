# Deploy Phase — Architecture & Rules Reference

## Overview

The Deploy Phase runs at the start of every round (Round 1+). Players secretly
stage troop placements on their owned territories. All placements are hidden until
the admin reveals them simultaneously by advancing the phase.

---

## Deploy Income Formula

```
total = territory_bonus + troop_bonus + region_bonus + continent_bonus
```

### Territory Bonus
```
territory_bonus = max(min_troops_per_turn, floor((territories_owned / per_troop) * (avg_battle_size / 1000)))
```

- `per_troop` — from `campaign.settings.territories_per_bonus_troop`, default `3`
- `min_troops_per_turn` — from `campaign.settings.min_troops_per_turn`, default `3`
- `avg_battle_size` — from `TabletopGameProfile.average_battle_size`, default `1000`

**Example:** 12 territories, avg_battle_size=1000 → `max(3, floor(12/3 × 1.0))` = `4`

### Troop Bonus
```
troop_bonus = floor((total_troops / troop_bonus_divisor) * avg_battle_size)
```

- **V1 default: disabled** (`troop_bonus_enabled = false`)
- Toggle: `campaign.settings.troop_bonus_enabled = true`
- `troop_bonus_divisor` — from `campaign.settings.troop_bonus_divisor`, default `2000`

### Region Bonus
```
region_bonus = sum(region.control_bonus) for each fully-controlled region
```

Regions (V1 Standard Map):
| Region | Continent | Bonus |
|---|---|---|
| North Coast | Northlands | +2 |
| Western Reaches | Northlands | +2 |
| The Heartland | Northlands | +3 |
| Eastern Shore | Northlands | +2 |
| Southern Plains | Southlands | +3 |
| The Far South | Southlands | +2 |

### Continent Bonus
```
continent_bonus = sum(continent.control_bonus) for each fully-controlled continent
```

Continents (V1 Standard Map):
| Continent | Bonus |
|---|---|
| The Northlands (29 territories) | +7 |
| The Southlands (8 territories) | +9 |

---

## Resource Generation Logic

Each owned territory generates **exactly 1 resource** per deploy round.

**V1 Resources:** `brick`, `lumber`, `wool`, `grain`, `ore`

**Roll mechanism:**
1. Generate seeded RNG: `seed = "${campaignId}_${playerId}_${territory_id}_r${round}"`
2. Roll `[0, 1)` from RNG
3. Select resource by cumulative weight from `resource_distribution`
4. Store in `DeployIncome.resources_generated: { brick, lumber, wool, grain, ore }`

**Terrain presets** (weights sum to 100):
| Terrain | Brick | Lumber | Wool | Grain | Ore |
|---|---|---|---|---|---|
| mountains | 10 | 5 | 5 | 10 | 70 |
| forest | 5 | 60 | 15 | 10 | 10 |
| swamp | 15 | 20 | 30 | 25 | 10 |
| tundra | 20 | 10 | 15 | 15 | 40 |
| coastal | 10 | 10 | 35 | 30 | 15 |
| desert | 30 | 5 | 10 | 15 | 40 |
| urban | 25 | 15 | 15 | 15 | 30 |
| plains | 10 | 15 | 20 | 50 | 5 |

**Determinism:** The same campaign + player + territory + round always produces the
same resource roll. This allows dispute resolution and replay.

---

## Map Data Source

### Why a separate backend-safe file?

Deno deploy functions **cannot import local TypeScript files**. The canonical
frontend map (`features/maps/mapData.ts`) uses TypeScript types and cannot be
inlined into a Deno function.

### Solution: `services/maps/mapMetadata.js`

A backend-safe pure-JS mirror of the structural map metadata needed for income
calculations:
- `territory_id → { region_id, continent_id, resource_distribution }`
- `regions[] → { id, continent_id, control_bonus }`
- `continents[] → { id, control_bonus }`

**Single source of truth per layer:**
- **Rendering data** (polygons, colors, labels, adjacency): `features/maps/mapData.ts`
- **Income/resource calc data** (regions, continents, distributions): `services/maps/mapMetadata.js`

If you update territory terrain or region assignments in `mapData.ts`, you **must**
update `mapMetadata.js` to match.

### Why not the MapDefinition entity?

The `MapDefinition` entity stores `regions[]` and `continents[]` but **not**
`territories[]` (only territory states are stored in `TerritoryState`). Adding
all 36 territories × resource distributions to the entity schema was rejected for V1:
1. Static map — never changes at runtime
2. Adds significant entity write overhead
3. A JS module is simpler, testable, and reviewable
4. Future: when custom maps are supported, switch to `TerritoryDefinition` entity

---

## Privacy Model

### Before Reveal (during staging)

| Data | Visibility |
|---|---|
| `DeployIncome.total` | **Public** — all players see each other's income |
| `DeployIncome.resources_generated` | **Public** — resource totals visible to all |
| `PhaseDecision.is_locked` | **Public** — via `getDeployLockStatus` (strips `data` field) |
| `PhaseDecision.data.placements` | **Private** — server enforces; never sent to any client |
| Auto-submit events | **Private** — `is_public: false` in SetupLog |
| Troop staged events | **Private** — `is_public: false` in SetupLog |

### After Reveal (`processPhaseEnd`)

| Data | Visibility |
|---|---|
| `TerritoryState.troop_count` | **Public** — updated with all placements |
| `PhaseSnapshot` (phase_end) | **Public** — records final territory + standing snapshot |
| `SetupLog` (phase_advanced) | **Public** — reveals which players were auto-submitted |

### How placements stay private

1. `stageTroops` uses **user-scoped SDK** (`base44.entities`) — only the calling player's
   own `PhaseDecision` is readable/writable
2. `getDeployLockStatus` uses `asServiceRole` to read all decisions but **strips the
   `data` field** before returning — only `{ player_id, is_locked }` is sent
3. `processPhaseEnd` is **admin-only** and uses `asServiceRole` — regular players
   cannot call it
4. The frontend hooks (`useDeployPhase`, `useDeployPhaseLockStatus`) never request
   other players' decision data

---

## Lock Status Model

`getDeployLockStatus` is a shared backend function used by both `initial_deploy` and
`deploy` phases. It accepts:
- `campaign_id` (required)
- `phase` (default: `initial_deploy`)
- `round` (default: `0`)

Returns: `Array<{ player_id: string, is_locked: boolean }>`

The `data` (placement) field is always stripped. This is the **only** safe way for
any client to query lock status without leaking placement data.

---

## Auto-Submit Behavior

When `processPhaseEnd` is called:

1. Any player without a locked `PhaseDecision` is auto-submitted
2. Remaining troops (income − already placed) are distributed via seeded RNG:
   `seed = "${campaignId}_${playerId}_r${round}_auto_phase_end"`
3. Auto-submit is logged as `event_type: 'auto_submitted'` with `is_public: false`
4. The public reveal log (`phase_advanced`) lists which players were auto-submitted

---

## Reveal Behavior

`processPhaseEnd` performs the simultaneous reveal:

1. All `PhaseDecision.data.placements` are applied to `TerritoryState.troop_count`
2. A `PhaseSnapshot` (`phase_end`) captures the final map state
3. A public `SetupLog` entry records the reveal event
4. `Campaign.current_phase` advances to `attack`

After reveal:
- `TerritoryState.troop_count` is public and reflects all placed troops
- The `PhaseDecision.data` records remain in the DB but are never exposed to clients
- The `PhaseSnapshot` provides an immutable audit record

---

## Tabletop Profile Integration

`avg_battle_size` scales troop income to match the tabletop game system:

- Loaded from `TabletopGameProfile.average_battle_size` via `campaign.game_profile_id`
- Default fallback: `1000`
- A Warhammer 40K campaign with `average_battle_size = 2000` generates 2× the
  territory income compared to the default

To override income scaling per-campaign, use `campaign.settings` overrides
(`territories_per_bonus_troop`, `min_troops_per_turn`, etc.).

---

## Known Base44 Limitations

1. **No local imports in Deno functions** — all helpers from `services/` must be
   inlined in the function file. The `services/rules-engine/deploy/` files are the
   canonical documented versions; `deployPhase.js` contains inlined copies.

2. **No TypeScript in Deno functions** — frontend TypeScript types (`types/`) are
   not available server-side. Type comments (JSDoc) are used instead.

3. **No TerritoryDefinition entity** — territory metadata (terrain, resource
   distribution, region/continent membership) is not stored in the database.
   It lives in `services/maps/mapMetadata.js` (backend) and `features/maps/mapData.ts`
   (frontend). These must be kept in sync manually.

4. **MapDefinition entity does not include territories[]** — it stores regions and
   continents but not individual territory definitions. The entity `regions` array
   is available server-side but is currently only used for display; income calcs use
   the inline `V1_MAP_META` in `deployPhase.js`.

5. **No real-time subscription in backend functions** — phase advancement requires
   polling or manual refresh on the frontend.

---

## Files Changed in Deploy Phase Correction Pass

```
functions/
  deployPhase.js               ← Rewrote: real income formula, proper resources, no hardcoded lookups

services/
  maps/
    mapMetadata.js             ← NEW: backend-safe mirror of map structural data
  rules-engine/deploy/
    deployIncome.js            ← Rewrote: all 4 bonus helpers + calcPlayerDeployIncome
    resourceGeneration.js      ← Rewrote: no null resource_distribution, rollWeightedResource renamed
    autoPlacement.js           ← Unchanged (correct)

DEPLOY_NOTES.md                ← NEW: this file
``