# MAP_NOTES.md — Map System Reference

## Where maps are registered

All static map data lives in **`features/maps/mapData.ts`** (Standard V1) and per-map
sibling files (e.g. `features/maps/mapData.shattered_crown.ts`).

The central registry is:

```ts
// features/maps/mapData.ts
export const MAP_REGISTRY: Record<string, MapDefinition> = {
  [MAP_V1_STANDARD.id]:      MAP_V1_STANDARD,      // 'map_v1_standard'
  [MAP_SHATTERED_CROWN.id]:  MAP_SHATTERED_CROWN,   // 'shattered_crown_v1'
};
```

**To add a new map:**
1. Create `features/maps/mapData.<name>.ts` exporting a `MapDefinition` constant.
2. Import it in `mapData.ts` and add it to `MAP_REGISTRY`.
3. Add it to `AVAILABLE_MAPS` (controls campaign-creation order).

---

## AVAILABLE_MAPS — ordered list for campaign creation

```ts
// features/maps/mapData.ts
export const AVAILABLE_MAPS = [
  MAP_SHATTERED_CROWN,   // default / listed first
  MAP_V1_STANDARD,
] as const;
```

Exported from the public API at **`features/maps/index.ts`** as `AVAILABLE_MAPS`.

---

## How campaign creation reads map options

**`components/campaigns/wizard/StepBasics`** imports `AVAILABLE_MAPS` directly from
`@/features/maps/mapData` and renders a radio-style button for each map.

```tsx
import { AVAILABLE_MAPS } from '@/features/maps/mapData';
// ...
{AVAILABLE_MAPS.map(map => (
  <button key={map.id} onClick={() => setField('map_id', map.id)} ...>
    {map.name} — {map.territories.length} territories
  </button>
))}
```

The selected `map_id` string is stored in the wizard form state and passed to `createCampaign`.

**Default `map_id`** is set in `features/campaigns/types.ts`:
```ts
export const DEFAULT_CAMPAIGN_FORM: CampaignFormData = {
  ...
  map_id: 'shattered_crown_v1',   // ← Shattered Crown is the default
  ...
};
```

The `createCampaign` function in `features/campaigns/useCampaigns.js` saves it:
```js
map_id: formData.map_id || 'shattered_crown_v1',
```

---

## How selected map_id loads map data at runtime

**`ActiveCampaign`** reads `campaign.map_id` from the Campaign entity and calls:

```ts
import { getMap } from '@/features/maps';

const mapDef = useMemo(() => getMap(mapId), [mapId]);
```

`getMap` does a simple registry lookup:
```ts
export function getMap(mapId: string): MapDefinition | null {
  return MAP_REGISTRY[mapId] ?? null;
}
```

All map rendering, adjacency calculation, territory draft, and phase logic then
operates on the returned `MapDefinition` object.

---

## Registered maps

| map_id              | Name               | Territories | Players | Coordinate space |
|---------------------|--------------------|-------------|---------|-----------------|
| `shattered_crown_v1`| The Shattered Crown | 44          | 5–7     | 1000 × 1400     |
| `map_v1_standard`   | Standard V1         | 36          | 2–8     | 1000 × 700      |

---

## Resource compatibility notes (Shattered Crown)

The Shattered Crown source uses `stone` and `relics` resource types not present in
the V1 ResourceDistribution schema. These are translated at import time in
`mapData.shattered_crown.ts`:

- `stone`  → `brick`  (masonry material)
- `relics` → `ore`    (rare high-value material)

Weights are renormalised to sum to 100. Remove these translations when
map-defined resources land.