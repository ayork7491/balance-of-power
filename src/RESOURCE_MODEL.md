# Balance of Power — Resource Model

> Sprint 3A: Canonical resources defined. Generation not yet implemented.

---

## Canonical Resources (Sprint 3A)

| Resource | Key | Pillar | Purpose |
|---|---|---|---|
| Gold | `gold` | Universal | Construction and building currency across all pillars |
| Iron | `iron` | Military | Specialty military structures |
| Timber | `timber` | Economic | Infrastructure, supply routes, trade networks |
| Stone | `stone` | Diplomatic | Embassies, monuments, diplomatic buildings |
| Food | `food` | Sustain | Troops, population, gold/influence stability |

**Food** is the only non-pillar-specific resource. It acts as a cross-cutting maintenance resource that will later affect troop upkeep, population growth, and stability of gold/influence income.

---

## Resource Generation (Sprint 3B)

Each owned territory generates resources per deploy round based on its terrain type. A territory's `resource_distribution` (from `mapMetadata.js`) provides weighted probabilities.

**Sprint 3A status:** `mapMetadata.js` still uses old V1 keys (brick/lumber/wool/grain/ore). These distributions must be remapped to new keys in Sprint 3B.

**Target mapping (terrain → primary resource):**

| Terrain | Primary Resource | Secondary |
|---|---|---|
| Mountains | Iron | Stone |
| Forest | Timber | Food |
| Plains | Food | Timber |
| Coastal | Gold (trade) | Food |
| Urban | Gold | Stone |
| Desert | Stone | Gold |
| Swamp | Food | Timber |
| Tundra | Iron | Stone |

---

## PlayerResourceLedger

Entity: `PlayerResourceLedger`

One record per player per campaign. Persists cumulatively across rounds.

```json
{
  "campaign_id": "...",
  "player_id": "...",
  "gold": 12,
  "iron": 4,
  "timber": 7,
  "stone": 2,
  "food": 9,
  "updated_at_round": 3,
  "updated_at_phase": "deploy"
}
```

**Sprint 3A:** Schema only. Balance initialized to 0. Generation and spending not wired.

**Sprint 3B:** `deployPhase.startDeploy` will create/update ledger with generated resources. `fortifyPhase.processPhaseEnd` will deduct from ledger for building construction.

---

## DeployIncome vs PlayerResourceLedger

| Field | DeployIncome | PlayerResourceLedger |
|---|---|---|
| Scope | Per-round snapshot (public) | Cumulative balance (private) |
| Purpose | Troop income + resource generation record | Spendable resource wallet |
| Troop income | ✅ | ❌ |
| Resource generation record | ✅ (via `resources_generated`) | ❌ |
| Spendable balance | ❌ | ✅ |
| Carry-over | ❌ Per round only | ✅ Persists |

`DeployIncome.resources_generated` remains as the public audit record of what was generated. `PlayerResourceLedger` holds the spendable balance after deductions.

---

## Legacy V1 Resources (Deprecated)

Old resources: `brick`, `lumber`, `wool`, `grain`, `ore`

**Still referenced in (flagged for Sprint 3B removal):**
- `services/maps/mapMetadata.js` — RES preset distributions
- `services/rules-engine/deploy/resourceGeneration.js` — return shape
- `functions/fortifyPhase` — STRUCTURE_CONFIG costs (castle/barracks/stables)
- `components/phases/fortify/ConstructionSelector` — cost display (commented with ⚠ flag)
- `entities/ConstructionProject.json` — `total_cost` / `resources_paid` descriptions

**Do not remove old references until Sprint 3B fully wires new resource generation.**