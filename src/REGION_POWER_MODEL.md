# Balance of Power — Region Power Model

> Sprint 3A: Data models created. Calculation engine not yet implemented.

---

## Overview

Every map region can be "controlled" by a player. Unlike V1 where region control was purely territorial (own all territories = control bonus), the three-pillar system determines control via **total regional power** across all three pillars.

This means a player can diplomatically or economically control a region even without holding all its territories militarily.

---

## RegionPowerState

Tracks **each player's** power scores within a specific region.
One record per `(campaign_id, region_id, player_id)`.

```json
{
  "campaign_id": "...",
  "region_id": "north_coast",
  "player_id": "player_c_id",
  "occupancy_power": 20,
  "wealth_power": 20,
  "influence_power": 80,
  "total_power": 120,
  "strongest_power_type": "diplomatic",
  "calculated_at_round": 3,
  "calculated_at_phase": "deploy"
}
```

**Power contribution sources (Sprint 3B implementation):**

| Power Type | Sources |
|---|---|
| `occupancy_power` | Territories held × weight, troop count, military buildings |
| `wealth_power` | Resources generated from region, active supply routes, economic buildings |
| `influence_power` | Influence actions targeting region, embassies in region, completed region objectives |

---

## RegionControlState

Tracks **which player controls** each region and what bonus they receive.
One record per `(campaign_id, region_id)`.

```json
{
  "campaign_id": "...",
  "region_id": "north_coast",
  "controlling_player_id": "player_c_id",
  "controlling_power_type": "diplomatic",
  "total_power": 120,
  "occupancy_power": 20,
  "wealth_power": 20,
  "influence_power": 80,
  "active_bonus_type": "diplomatic",
  "calculated_at_round": 3,
  "calculated_at_phase": "deploy"
}
```

---

## Control Resolution Rules

1. For each region, sum each player's `total_power` from their `RegionPowerState` record.
2. The player with the highest `total_power` controls the region.
3. Ties: no control change (previous controller retains; or no control if first round).
4. The controlling player's `strongest_power_type` determines `active_bonus_type`.

**`strongest_power_type` = whichever of `occupancy_power`, `wealth_power`, `influence_power` is highest for the controlling player in that region.**

If two power types are tied for the controller, `military > economic > diplomatic` as a tiebreaker.

---

## Region Bonus Types (Sprint 3B wiring)

| Bonus Type | What it does |
|---|---|
| `military` | Troop/combat advantage in region battles |
| `economic` | Resource production multiplier for region territories |
| `diplomatic` | Influence generation bonus from region actions |

The specific values are to be defined during Sprint 3B implementation.

---

## Calculation Timing

Region power and control should be recalculated at:
- Start of `deploy` phase (after income is distributed)
- End of `battle` phase (after territory changes applied)
- End of `fortify` phase (after movements and construction applied)

This ensures `RegionControlState` is always current when players make decisions.

---

## Files

| File | Status | Purpose |
|---|---|---|
| `entities/RegionPowerState.json` | ✅ Created | Per-player regional power schema |
| `entities/RegionControlState.json` | ✅ Created | Regional control state schema |
| Sprint 3B: `services/rules-engine/regions/regionPower.js` | 🔲 Pending | Power calculation engine |
| Sprint 3B: `services/rules-engine/regions/regionControl.js` | 🔲 Pending | Control resolution engine |