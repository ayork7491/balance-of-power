# Balance of Power — Building Model

> Sprint 3A: Definitions and schemas created. Construction gameplay not yet implemented.

---

## Overview

The three-pillar building system replaces the V1 ConstructionProject system (castle/barracks/stables). Buildings are organized by pillar and drive regional power accumulation.

**Legacy V1 buildings** (castle, barracks, stables) remain active in `ConstructionProject` records. They are not removed — flagged for migration in Sprint 3B+.

---

## Three Pillars

### Military Buildings

| Building | Cost | Rounds | Effect |
|---|---|---|---|
| Barracks | gold×2, iron×1 | 1 | +1 troop generation per deploy phase |
| War Council | gold×3, iron×2 | 2 | +1 attack declaration per attack phase |
| Logistics Corps | gold×2, iron×1, timber×1 | 1 | +1 fortification distance |

### Diplomatic Buildings

| Building | Cost | Rounds | Effect |
|---|---|---|---|
| Embassy | gold×2, stone×2 | 2 | Draw 4 objective cards, keep 2 |
| Council Chamber | gold×3, stone×2 | 2 | +1 influence action per fortify phase |
| Foreign Office | gold×2, stone×1, timber×1 | 1 | +1 trade action per fortify phase |

### Economic Buildings

| Building | Cost | Rounds | Effect |
|---|---|---|---|
| Marketplace | gold×2, timber×1 | 1 | Activate +1 Resource Hub connection slot |
| Builders Guild | gold×3, timber×2 | 2 | +1 simultaneous construction project |
| Trade Network | gold×2, timber×2 | 2 | +1 supply caravan per fortify phase |
| Resource Hub | gold×3, timber×1, stone×1 | 2 | Enables up to 3 supply routes within range 3 |
| Supply Route | gold×1, timber×1 | 1 | Extracts 1 resource/round within range 3 |
| Warehouse/Vault | gold×2, stone×1 | 1 | Protects up to 5 resources on territory capture |

---

## TerritoryBuilding Entity

Tracks built and in-progress buildings per territory.

```json
{
  "campaign_id": "...",
  "territory_id": "heartlands",
  "player_id": "...",
  "building_type": "barracks",
  "pillar_type": "military",
  "status": "active",
  "started_round": 2,
  "completed_round": 3,
  "construction_progress": 1,
  "metadata_json": {}
}
```

**Statuses:** `planned` → `under_construction` → `active` → `damaged` → `destroyed`

---

## Building Definitions Registry

`config/buildingDefinitions.ts` is the canonical registry.

```ts
import { getBuildingDefinition, BUILDINGS_BY_PILLAR } from '@/config/buildingDefinitions';

const barracks = getBuildingDefinition('barracks');
// { type: 'barracks', label: 'Barracks', pillar: 'military', cost: { gold: 2, iron: 1 }, rounds: 1, effect: '...' }

const militaryBuildings = BUILDINGS_BY_PILLAR.military;
```

---

## Construction Flow (Sprint 3B)

```
Player selects territory + building type during fortify phase
  → Privately staged in PhaseDecision.data.construction
  → At fortify processPhaseEnd:
      1. Deduct resources from PlayerResourceLedger
      2. Create TerritoryBuilding { status: 'under_construction' }
      3. Each subsequent fortify processPhaseEnd: construction_progress++
      4. When progress >= rounds_required: status → 'active'
      5. Apply building effect going forward
```

---

## Legacy V1 Construction (Still Active)

`ConstructionProject` entity and `fortifyPhase` construction logic remain unchanged. V1 structures (castle/barracks/stables) still function via the old system.

Sprint 3B will introduce parallel TerritoryBuilding construction. Full migration of V1 structures is optional and deferred.

**⚠ Flag locations for Sprint 3B:**
- `functions/fortifyPhase` — STRUCTURE_CONFIG still uses old resource keys
- `components/phases/fortify/ConstructionSelector` — displays old costs (commented)
- `entities/ConstructionProject.json` — total_cost/resources_paid descriptions

---

## Files

| File | Status | Purpose |
|---|---|---|
| `config/buildingDefinitions.ts` | ✅ Created | Full building registry, costs, effects |
| `config/powerConstants.ts` | ✅ Created | Pillar enums, building-to-pillar mapping |
| `entities/TerritoryBuilding.json` | ✅ Created | Building state schema |
| `entities/SupplyRoute.json` | ✅ Created | Supply route schema |
| Sprint 3B: Construction UI | 🔲 Pending | New TerritoryBuilding construction UI |
| Sprint 3B: fortifyPhase extension | 🔲 Pending | TerritoryBuilding creation in backend |