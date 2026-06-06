# Balance of Power — Three-Pillar Architecture

> Sprint 3A: Foundation established. No gameplay implemented yet.
> All entities, constants, and configs are created. Implementation begins Sprint 3B.

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

### Economic — Own the World
- **Power type:** `economic` / `wealth_power`
- **Win condition:** `own_the_world`
- **Driven by:** resource production, supply routes, trade networks, economic buildings
- **Region bonus when controlling via economic:** resource production multiplier

### Diplomatic — Lead the World
- **Power type:** `diplomatic` / `influence_power`
- **Win condition:** `lead_the_world`
- **Driven by:** influence actions, completed objective cards, embassy presence
- **Region bonus when controlling via diplomatic:** influence generation bonus

---

## Region Power & Control

Each region has a **controlling player** — the player with the highest combined regional power across all three pillars.

The **bonus type** received depends on the controller's **strongest pillar in that region**, not their overall strongest pillar.

**Example:**
- Player C in North Coast: military=20, economic=20, diplomatic=80 → total=120
- Player A in North Coast: military=60, economic=30, diplomatic=10 → total=100
- **Player C controls North Coast and receives the diplomatic region bonus.**

See `REGION_POWER_MODEL.md` for full details.

---

## Victory Tracking

VictoryTracker records per-player scores across all three conditions. When a player reaches the threshold for any active win condition, they win.

Multiple win conditions can be enabled simultaneously — players race on parallel paths.

See `VICTORY_MODEL.md` for full details.

---

## Data Models Created (Sprint 3A)

| Entity | Purpose |
|---|---|
| `RegionPowerState` | Per-player power scores per region |
| `RegionControlState` | Who controls each region and how |
| `PlayerResourceLedger` | Cumulative resource balances (gold/iron/timber/stone/food) |
| `PlayerInfluenceLedger` | Diplomatic influence and objective card state |
| `VictoryTracker` | Per-player victory condition progress |
| `TerritoryBuilding` | Three-pillar buildings in territories |
| `SupplyRoute` | Resource extraction routes from hubs |
| `SecretObjectiveCard` | Objective card definitions |

---

## Constants & Configs Created (Sprint 3A)

| File | Purpose |
|---|---|
| `config/powerConstants.ts` | Power types, win conditions, building-to-pillar mapping |
| `config/buildingDefinitions.ts` | Full building definition registry (11 buildings) |
| `types/Resources.ts` | Canonical ResourceType, PowerType, WinCondition, BuildingType |
| `config/theme.ts` | Updated RESOURCE_TYPES, POWER_TYPE_CONFIG, WIN_CONDITION_CONFIG |

---

## Sprint 3B Implementation Path

See bottom of this file and `SYSTEM_ARCHITECTURE.md §5` for sequencing.

**Recommended Sprint 3B order:**

1. **Resource generation** — update `mapMetadata.js` resource distributions to new keys, wire `generateResourcesForPlayer` into `PlayerResourceLedger`
2. **Region power calculation** — implement `calculateRegionPower` function, call at deploy phase start
3. **Region control resolution** — implement `resolveRegionControl`, write `RegionControlState`
4. **VictoryTracker updates** — wire score updates at each phase boundary
5. **Building construction UI** — `TerritoryBuilding` creation via fortify phase
6. **Supply routes** — `SupplyRoute` creation and extraction
7. **Influence actions** — `PlayerInfluenceLedger` updates, objective card drawing