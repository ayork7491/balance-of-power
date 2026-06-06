# Balance of Power — Three-Pillar Architecture

> Sprint 3B: Resource generation active. Territory storage active. Player ledger aggregation active.
> Region power/control, buildings, influence, victory scoring: Sprint 3C+.

---

## Overview

Balance of Power supports three distinct paths to victory. Each player may pursue one, two, or all three paths simultaneously. The active win conditions are configured per campaign.

```
┌──────────────────────────────────────────────────────────────────┐
│                  THREE PATHS TO VICTORY                          │
├──────────────────┬───────────────────┬───────────────────────────┤
│  ⚔️ Military      │  💰 Economic       │  🕊️ Diplomatic             │
│  Rule the World  │  Own the World    │  Lead the World           │
│                  │                  │                            │
│  occupancy_power │  wealth_power     │  influence_power           │
│                  │                  │                            │
│  Territories     │  Resources &      │  Influence &               │
│  Troops          │  Trade Networks   │  Objective Cards           │
│  Military        │  Economic         │  Diplomatic                │
│  Buildings       │  Buildings        │  Buildings                 │
└──────────────────┴───────────────────┴───────────────────────────┘
```

---

## Pillars

### Military — Rule the World
- **Power type:** `military` / `occupancy_power`
- **Win condition:** `rule_the_world`
- **Driven by:** territory count, troop strength, military buildings (Barracks, War Council, Logistics Corps)
- **Region bonus when controlling via military:** troop/combat bonus
- **Status:** Partially active (territory + troop mechanics work; buildings Sprint 3C)

### Economic — Own the World
- **Power type:** `economic` / `wealth_power`
- **Win condition:** `own_the_world`
- **Driven by:** resource generation (✅ Sprint 3B), supply routes (Sprint 3C), trade networks (Sprint 3C)
- **Region bonus when controlling via economic:** resource production multiplier
- **Status:** Resource generation active (Sprint 3B). Supply routes / trade Sprint 3C.

### Diplomatic — Lead the World
- **Power type:** `diplomatic` / `influence_power`
- **Win condition:** `lead_the_world`
- **Driven by:** influence actions, objective cards, embassy presence
- **Region bonus when controlling via diplomatic:** influence generation bonus
- **Status:** Schema only (Sprint 3A). Implementation Sprint 3C+.

---

## Resource System (Sprint 3B — Active)

Resources flow through three layers:

```
Map metadata → TerritoryState.resource_type (stamped by initResourceTypes)
                      ↓
              Player activates territory
                      ↓
         TerritoryState.resource_storage (+1 per activation)
                      ↓
           Player calls collectResources
                      ↓
           PlayerResourceLedger (cumulative wallet)
```

**Resource types:** gold | iron | timber | stone | food

**Territory resource assignments:** `services/maps/mapResourceTypes.js`

**Backend function:** `functions/resourcePhase`

See `RESOURCE_MODEL.md` for full details.

---

## Resource Hub (Sprint 3B — Active)

The Resource Hub is the first economic building implemented.

- Placed via `resourcePhase.buildResourceHub(territory_id)`
- Sets `TerritoryState.has_resource_hub = true`
- Creates `TerritoryBuilding` record
- Enables up to 3 supply route connections (Sprint 3C)
- No cost enforced in Sprint 3B

---

## Region Power & Control (Sprint 3A schema — Sprint 3C implementation)

Each region has a **controlling player** — the player with the highest combined regional power across all three pillars.

The **bonus type** received depends on the controller's **strongest pillar in that region**.

See `REGION_POWER_MODEL.md` for full schema documentation.

---

## Victory Tracking (Sprint 3A schema — Sprint 3C implementation)

`VictoryTracker` records per-player scores. Win conditions are configured at campaign creation via `Campaign.settings.active_win_conditions`. The wizard `StepSettings` UI has multi-select checkboxes.

See `VICTORY_MODEL.md` for full details.

---

## Data Models

### Sprint 3A (Schema only)
| Entity | Status |
|---|---|
| `RegionPowerState` | ✅ Schema created |
| `RegionControlState` | ✅ Schema created |
| `PlayerResourceLedger` | ✅ Active (Sprint 3B) |
| `PlayerInfluenceLedger` | ✅ Schema created |
| `VictoryTracker` | ✅ Schema created |
| `TerritoryBuilding` | ✅ Active (Sprint 3B — Resource Hub) |
| `SupplyRoute` | ✅ Schema created |
| `SecretObjectiveCard` | ✅ Schema created |

### Sprint 3B (Active)
| Change | Status |
|---|---|
| `TerritoryState.resource_type` | ✅ Field added |
| `TerritoryState.resource_storage` | ✅ Field added |
| `TerritoryState.has_resource_hub` | ✅ Field added |
| `functions/resourcePhase` | ✅ Created (7 actions) |
| `services/maps/mapResourceTypes.js` | ✅ Created (80 territory assignments) |
| `components/phases/resource/ResourcePhasePanel.jsx` | ✅ Created |
| `components/phases/resource/ResourceDebugPanel.jsx` | ✅ Created |

---

## Sprint 3C Recommended Implementation Path

1. **Resource costs enforcement** — wire `PlayerResourceLedger` deduction on construction
2. **mapMetadata.js update** — remap resource_distribution presets to new resource keys
3. **Supply routes** — `SupplyRoute` creation, extraction into territory storage
4. **Region power calculation** — implement `regionPower.js` + `regionControl.js`
5. **RegionControlState updates** at phase boundaries
6. **VictoryTracker score updates** at phase boundaries
7. **Diplomatic system** — influence actions, objective card drawing
8. **Building effects** — wire barracks (+1 income), castle (combat bonus), stables (range)