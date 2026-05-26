# Map System Notes

## Overview

Balance of Power uses a schema-driven map architecture. The map is treated as a data graph, not a static image. The renderer reads territory coordinates, adjacency, and region/continent membership from a static data definition and renders SVG polygons. Campaign-specific territory state is stored separately as dynamic Base44 entity records.

---

## Schema-Driven Map Rendering

All map rendering logic reads from `features/maps/mapData.ts`. The renderer (`components/map/MapRenderer.jsx`) never hardcodes:

- Territory names or boundaries
- Adjacency relationships
- Region or continent structure
- Resource distributions

If you need to change the map, edit `mapData.ts`. The renderer reflects changes automatically.

---

## Canonical Territory Identifier

**`territory_id`** is the one and only canonical identifier for a territory throughout the codebase.

- It is a stable, lowercase snake_case string (e.g. `iron_ridge`, `frost_peak`)
- It is the field name in `TerritoryDefinition` (static schema)
- It is the FK field name in `TerritoryState` (dynamic entity)
- It is used as the lookup key in `useTerritoryState` (`stateById[territory_id]`)
- It is used in all adjacency arrays (`[territory_id_a, territory_id_b]`)

**Do NOT use:**
- `key` — this was the old name, fully replaced
- `territory_key` — also old, replaced
- Any numeric index as an identifier

All adjacency lookups, BFS traversal, and renderer state lookups use `territory_id`.

---

## Region vs Continent

These are two distinct, hierarchical groupings. A territory belongs to exactly one region and one continent.

| Level | Field | Description | Control Bonus |
|---|---|---|---|
| **Region** | `region_id` | Smaller strategic group (4–8 territories) | Smaller bonus (2–3 troops) |
| **Continent** | `continent_id` | Larger strategic group (15–20 territories) | Larger bonus (7–9 troops) |

**Example (V1 Standard Map):**
```
Continents (2):  The Northlands, The Southlands
Regions (6):     North Coast, Western Reaches, The Heartland, Eastern Shore, Southern Plains, The Far South
```

Each region belongs to exactly one continent (`MapRegion.continent_id`).
Each territory belongs to exactly one region and one continent.

Controlling a region grants its `control_bonus` troops per round.
Controlling an entire continent grants an additional `control_bonus` on top of region bonuses.

---

## Base Map Data vs Campaign Territory State

This separation is the most important architectural constraint:

### Base Map Data (static)
- **Source:** `features/maps/mapData.ts`
- **Type:** `MapDefinition` → `TerritoryDefinition[]`
- **Contains:** shape (SVG polygon points), center coords, terrain, region/continent membership, resource distribution, adjacency
- **When it changes:** Never at runtime. Only changes when you edit the map definition file.
- **Renderer access:** Direct import — no network call needed

### Campaign Territory State (dynamic)
- **Source:** `TerritoryState` Base44 entity, filtered by `campaign_id`
- **Type:** `TerritoryState` (Base44 entity record)
- **Contains:** `owner_player_id`, `troop_count`, `structures[]`
- **When it changes:** Every time a player deploys, attacks, fortifies, or builds
- **Renderer access:** Via `useTerritoryState(campaignId)` hook → returns `stateById[territory_id]`

The renderer joins these two at render time using `territory_id` as the foreign key.

---

## Resource Distribution

Every territory has a `resource_distribution` object with exactly five fields:

```ts
{
  brick:  number, // 0–100
  lumber: number,
  wool:   number,
  grain:  number,
  ore:    number,
  // Invariant: brick + lumber + wool + grain + ore === 100
}
```

- Weights are relative (not percentages of production), but must total exactly 100
- They indicate which resource a territory is *most likely* to produce in a given turn
- Terrain-biased presets are defined in `mapData.ts` (e.g. mountains → ore-heavy, forests → lumber-heavy)
- The `validateMap()` utility rejects any territory whose distribution does not total 100

---

## Validation Rules

`features/maps/mapValidation.ts` exports `validateMap(map)` and `assertMapValid(map)`.

Rules enforced:

| Code | Rule |
|---|---|
| `MISSING_ID` | Every territory must have a non-empty `territory_id` |
| `DUPLICATE_ID` | All `territory_id` values must be unique within the map |
| `MISSING_REGION` | Every territory must have a `region_id` |
| `INVALID_REGION` | `region_id` must reference an existing region |
| `MISSING_CONTINENT` | Every territory must have a `continent_id` |
| `INVALID_CONTINENT` | `continent_id` must reference an existing continent |
| `REGION_MISSING_CONTINENT` | Every region must have a `continent_id` |
| `REGION_INVALID_CONTINENT` | Region's `continent_id` must reference an existing continent |
| `MISSING_POINTS` | Every territory must have a non-empty SVG `points` string |
| `MISSING_CENTER` | Every territory must have `cx` and `cy` center coordinates |
| `MISSING_RESOURCES` | Every territory must have a `resource_distribution` object |
| `INVALID_RESOURCE_TOTAL` | Resource distribution must total exactly 100 |
| `INVALID_RESOURCE_VALUE` | Each resource field must be ≥ 0 |
| `INVALID_ADJACENCY` | All territory IDs in adjacency edges must exist |
| `SELF_ADJACENCY` | A territory cannot be adjacent to itself |
| `DUPLICATE_EDGE` | No duplicate adjacency edges |
| `INVALID_DIMENSIONS` | Map `width` and `height` must be > 0 |

Run `validateMap(MAP_V1_STANDARD)` in tests or the dev console to verify the map before shipping changes.

---

## V1 Standard Map Summary

```
Map ID:       map_v1_standard
Dimensions:   1000 × 700 logical units
Continents:   2 (The Northlands, The Southlands)
Regions:      6 (North Coast, Western Reaches, The Heartland, Eastern Shore, Southern Plains, The Far South)
Territories:  36
Adjacency:    ~65 edges
```

---

## Known Platform Limitations

- **Base44 entity filtering**: `TerritoryState.filter({ campaign_id })` returns all records at once. For large maps (100+ territories) this may need pagination or a backend function.
- **Real-time subscription**: The `TerritoryState` subscription filters by `campaign_id` client-side. All state change events are received regardless of which territory changed.
- **No server-side validation**: Resource distribution totals, adjacency integrity, and territory uniqueness are validated in `mapValidation.ts` at definition time. There is no backend enforcement.

---

## What Is Intentionally Not Implemented Yet

- **Draft phase territory assignment** — allocating starting territories to players
- **Procedural map generation** — all maps are hand-authored data objects
- **Additional static maps** — only `map_v1_standard` exists in V1
- **Map selection UI** — campaign creation currently defaults to `map_v1_standard`
- **Region/continent visual boundary overlays** — regions are color-tinted on polygons but no explicit boundary lines are drawn
- **Resource production engine** — `resource_distribution` data is stored but not yet used to generate resources each round
- **Traversal cost** — `TerritoryConnection.traversal_cost` field is defined but not yet applied to attack or fortification range calculations
- **Physical map export** — print-ready PDF/image map export is deferred
- **Community maps** — user-uploaded or editor-built maps are not yet supported