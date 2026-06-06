# Balance of Power — Victory Model

> Sprint 3A: Models and campaign config created. Scoring logic not yet implemented.

---

## Overview

Three win conditions can be configured per campaign. Any combination can be active simultaneously. Players race on parallel paths and the first to reach any active condition's threshold wins.

---

## Win Conditions

| Condition | Key | Pillar | Description |
|---|---|---|---|
| Rule the World | `rule_the_world` | Military | Territorial domination — hold territories, control regions militarily |
| Own the World | `own_the_world` | Economic | Economic supremacy — resource wealth, trade network reach |
| Lead the World | `lead_the_world` | Diplomatic | Diplomatic leadership — influence accumulation, objective card completion |

---

## Campaign Configuration

Win conditions are configured at campaign creation via `Campaign.settings.active_win_conditions` (an array).

```json
{
  "settings": {
    "active_win_conditions": ["rule_the_world", "lead_the_world"]
  }
}
```

The wizard `StepSettings` UI now has checkboxes for all three conditions. At least one must always be active.

The legacy `victory_condition` field (`domination`/`score`) is preserved for backward compat with existing campaigns.

---

## VictoryTracker Entity

One record per player per campaign. Recalculated at phase boundaries.

```json
{
  "campaign_id": "...",
  "player_id": "...",
  "occupancy_score": 45,
  "wealth_score": 12,
  "influence_score": 88,
  "active_win_conditions_json": {
    "rule_the_world": { "score": 45, "threshold": 100, "met": false },
    "lead_the_world": { "score": 88, "threshold": 100, "met": true }
  },
  "has_won": true,
  "winning_condition": "lead_the_world",
  "updated_at_round": 5,
  "updated_at_phase": "battle"
}
```

---

## Score Composition (Sprint 3B implementation)

### occupancy_score (Rule the World)
```
territories_held × 2
+ regions_controlled_via_military × 10
+ total_troop_strength / 10
```

### wealth_score (Own the World)
```
total_resources_in_ledger × 1
+ active_supply_routes × 3
+ economic_regions_controlled × 10
+ trade_network_buildings × 5
```

### influence_score (Lead the World)
```
PlayerInfluenceLedger.global_influence × 1
+ completed_objective_cards × 15
+ diplomatic_regions_controlled × 10
```

---

## Victory Check Timing

Currently victory is checked inline in `battlePhase.processPhaseEnd` (domination only). Sprint 3B will:

1. Move victory check into a separate `checkVictory()` helper
2. Call it at end of `battlePhase.processPhaseEnd` (after eliminations)
3. Call it at end of `fortifyPhase.processPhaseEnd` (after construction/movement)
4. Check all active win conditions (not just domination)
5. Write `VictoryTracker.has_won` and `winning_condition`
6. Advance campaign to `complete` on any win

---

## Legacy Domination Victory (Still Active)

The existing `battlePhase.processPhaseEnd` domination check (last player with territories wins) remains unchanged. It will continue to fire as a safety net even in multi-condition campaigns.

---

## Files

| File | Status | Purpose |
|---|---|---|
| `entities/VictoryTracker.json` | ✅ Created | Victory score tracking schema |
| `entities/Campaign.json` | ✅ Updated | `settings.active_win_conditions` array added |
| `components/campaigns/wizard/StepSettings` | ✅ Updated | Win condition checkbox UI |
| `config/powerConstants.ts` | ✅ Created | WIN_CONDITIONS enum |
| Sprint 3B: `services/rules-engine/victory/victoryCheck.js` | 🔲 Pending | Score calculation + win condition evaluation |