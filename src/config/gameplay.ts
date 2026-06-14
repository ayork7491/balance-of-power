/**
 * Balance of Power — Gameplay Configuration
 * All game balance values live here. Never hardcode these in UI components or engine files.
 * Future: any of these can be overridden per-campaign via CampaignSettings stored in the database.
 */

/**
 * GAMEPLAY_DEFAULTS — internal engine constants used by game logic modules.
 *
 * These are NOT campaign-level settings (those live in CampaignSettings in
 * features/campaigns/types.ts and are stored per-campaign on the entity).
 *
 * Naming: camelCase is fine here because these are internal engine constants,
 * not database field names. Do not use these directly in UI — read from
 * campaign.settings instead.
 */
export const GAMEPLAY_DEFAULTS = {
  // Draft phase
  draftPercentage: 0.6,           // 60% of territories assigned by player choice, 40% random

  // Troop generation
  baseTroopsPerTurn: 3,
  minTroopsPerTurn: 3,
  territoriesPerBonusTroop: 3,   // 1 bonus troop per N territories owned

  // Attack rules
  minTroopsToAttack: 2,
  minTroopsToLeaveInTerritory: 1,

  // Fortification rules
  minTroopsToFortify: 1,

  // Battle resolution
  autoResolveDaysAfterBattle: 7,
  forfeitPenaltyTroopLoss: 0.5,  // 50% troop loss on forfeit
} as const;

export const REGION_BONUS = {
  // Bonus troops for controlling an entire region.
  // Actual per-region values come from MapRegion.control_bonus in the MapDefinition entity.
  default: 2,
} as const;

export const BATTLE_SCALING = {
  /**
   * How app troop counts scale to tabletop battle points.
   *
   * IMPORTANT: tabletopAverageBattleSize is NOT stored here.
   * It comes from TabletopGameProfile.average_battle_points for the active campaign.
   *
   * Forward scaling (app → tabletop):
   *   scaled_points = round((attacker_troops + defender_troops) * scalingFactor * avg_battle_points)
   *   Result is clamped to [minBattlePoints, maxBattlePoints].
   *
   * Reverse scaling (tabletop → app):
   *   app_troop_loss = round(tabletop_troop_loss / scalingFactor)
   *   Uses the same scalingFactor so the math is symmetric.
   *
   * The actual scaling engine lives in features/battles/ — do not implement it here.
   */
  scalingFactor: 0.5,
  minBattlePoints: 250,
  maxBattlePoints: 3000,
} as const;

/**
 * STRUCTURE_COSTS — see config/buildingDefinitions.ts for current building costs.
 * Resources: gold, iron, timber, stone, food (canonical Sprint 3B+ names).
 */