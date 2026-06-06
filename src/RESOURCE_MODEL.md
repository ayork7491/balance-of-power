# Balance of Power — Resource Model

> Sprint 3B: Resource generation implemented. Territory storage active. Player ledger aggregation active.
> Supply routes, caravans, resource trading: Sprint 3C+.

---

## Canonical Resources (Sprint 3A/3B)

| Resource | Key | Pillar | Purpose |
|---|---|---|---|
| Gold | `gold` | Universal | Construction and building currency across all pillars |
| Iron | `iron` | Military | Specialty military structures |
| Timber | `timber` | Economic | Infrastructure, supply routes, trade networks |
| Stone | `stone` | Diplomatic | Embassies, monuments, diplomatic buildings |
| Food | `food` | Sustain | Troops, population, gold/influence stability |

---

## Territory Resource Types

Each territory has exactly ONE primary resource type. Assignment is terrain/lore-driven and stored in `TerritoryState.resource_type`.

**Canonical source:** `services/maps/mapResourceTypes.js`

### V1 Standard Map (36 territories)
| Continent | Dominant Resource | Notable Territories |
|---|---|---|
| North Coast | mixed | irongate→gold, frost_peak→iron, crow_harbor→gold |
| Western Reaches | food/timber | ashwood→timber, redstone_ridge→iron |
| Heartland | food/gold | golden_citadel→gold, iron_ridge→iron |
| Eastern Shore | iron/stone | blackstone→iron, scalewood→timber |
| Southern Plains | food | sunken_delta→food, sunspire→gold |
| Far South | gold | sea_gate→gold, crimson_shore→gold |

Balance: gold=8, iron=6, timber=5, stone=6, food=11

### Shattered Crown Map (44 territories)
| Continent | Dominant Resource | Notes |
|---|---|---|
| Ironspine | iron/stone | 8 mountain territories, iron-heavy |
| Wild Frontier | timber/food | Forests and plains |
| Fracture Basin | gold/stone | Contested ruins with trade routes |
| Sunfields | food | Agricultural heartland |
| Shattered Coast | gold/stone | Coastal trade and cliffs |

Balance: iron=8, stone=8, timber=6, food=10, gold=11

---

## Resource Generation Flow

```
Deploy Phase Start:
  Admin calls resourcePhase.initResourceTypes (once per campaign)
    → stamps TerritoryState.resource_type from map metadata

During Deploy Phase:
  Player calls resourcePhase.activateTerritory(territory_id)
    → +1 of territory's resource_type placed into TerritoryState.resource_storage
    → Can activate multiple territories per round

OR Admin calls resourcePhase.generateAll
    → Generates +1 for every owned territory automatically

At Deploy Phase End (or any time):
  Player calls resourcePhase.collectResources
    → Sums all TerritoryState.resource_storage for owned territories
    → Adds to PlayerResourceLedger
    → Clears territory storage
```

---

## Territory Resource Storage

`TerritoryState.resource_storage` is a JSON object:
```json
{
  "gold": 0,
  "iron": 2,
  "timber": 0,
  "stone": 0,
  "food": 1
}
```

Resources sit in territory storage until collected by the player. This enables future mechanics:
- Enemy raids intercepting storage
- Warehouse/vault protection (Sprint 3C)
- Supply route extraction (Sprint 3C)

---

## Player Resource Ledger

`PlayerResourceLedger` holds the player's spendable balance after collection.

```json
{
  "campaign_id": "...",
  "player_id": "...",
  "gold": 5,
  "iron": 8,
  "timber": 3,
  "stone": 2,
  "food": 11,
  "updated_at_round": 3,
  "updated_at_phase": "deploy"
}
```

The ledger is cumulative across rounds. Resources are only removed when spent (construction, future: influence actions, supply routes).

---

## Resource Hub (Sprint 3B)

A Resource Hub is a building placed in a territory via `resourcePhase.buildResourceHub`.

**Effect:**
- Sets `TerritoryState.has_resource_hub = true`
- Creates a `TerritoryBuilding` record with `building_type: 'resource_hub'`
- Enables up to 3 supply route connections from this territory (Sprint 3C)

**Cost:** Free in Sprint 3B (no resource cost enforced). Sprint 3C will enforce: `{ gold: 3, timber: 1, stone: 1 }`, 2 rounds.

---

## Backend Function: resourcePhase

| Action | Who | Description |
|---|---|---|
| `initResourceTypes` | Admin | Stamps resource_type on all TerritoryState records. Idempotent. |
| `getResourceState` | Any player | Returns territory list, storage, and ledger for the calling player. |
| `activateTerritory` | Player | Generates +1 of territory's resource into its storage. |
| `generateAll` | Admin | Generates +1 for all owned territories (bulk admin action). |
| `collectResources` | Player | Moves territory storage → PlayerResourceLedger, clears storage. |
| `buildResourceHub` | Player | Marks territory as resource hub, creates TerritoryBuilding record. |
| `getDebugState` | Admin | Full debug snapshot of all territory storage and player ledgers. |

---

## DeployIncome vs PlayerResourceLedger

| Field | DeployIncome | PlayerResourceLedger |
|---|---|---|
| Scope | Per-round snapshot (public) | Cumulative balance (private) |
| Troop income | ✅ | ❌ |
| Resource generation record | ✅ (`resources_generated` — legacy V1 keys, still present) | ❌ |
| Spendable balance | ❌ | ✅ |
| Carry-over | ❌ Per round | ✅ Persists |

---

## Legacy V1 Resources (Status)

Old resources: `brick`, `lumber`, `wool`, `grain`, `ore`

Still referenced in:
- `functions/deployPhase` — `generateResourcesForPlayer` return shape (old keys, writes to `DeployIncome.resources_generated`)
- `services/rules-engine/deploy/resourceGeneration.js` — flagged with Sprint 3B migration note
- `functions/fortifyPhase` — STRUCTURE_CONFIG costs (castle/barracks/stables)
- `components/phases/fortify/ConstructionSelector` — ⚠ comment added

These are NOT removed — they still power the `DeployIncome.resources_generated` field which is a different system. They will be fully replaced in Sprint 3C.

---

## Known Limitations (Sprint 3B)

1. **initResourceTypes must be called manually** by admin after a campaign starts. No automation yet.
2. **No cost enforcement on Resource Hub** — free to build in Sprint 3B.
3. **DeployIncome.resources_generated** still uses legacy keys — parallel system, not yet unified.
4. **No fortify-phase integration** — resource collection is standalone, not auto-triggered.
5. **Supply routes not implemented** — Resource Hub is a placeholder anchor only.