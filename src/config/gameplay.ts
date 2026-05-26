/**
 * Balance of Power — Gameplay Configuration
 * All game balance values live here. Never hardcode these in UI components or engine files.
 * Future: any of these can be overridden per-campaign via CampaignSettings stored in the database.
 */

export const GAMEPLAY_DEFAULTS = {
  // Campaign setup
  minPlayers: 2,
  maxPlayers: 8,
  defaultStartingTroops: 20,
  defaultMaxAttacksPerPhase: 3,
  defaultMaxFortificationsPerPhase: 3,  // corrected from 2
  defaultDraftPercentage: 0.6,           // 60% of territories assigned by player choice, 40% random

  // Troop generation
  baseTroopsPerTurn: 3,
  minTroopsPerTurn: 3,
  territoriesPerBonusTroop: 3, // 1 bonus troop per N territories owned

  // Attack rules
  minTroopsToAttack: 2,
  minTroopsToLeaveInTerritory: 1,

  // Fortification rules
  maxFortificationDistance: 4,  // corrected from 2 — territories away (graph distance)
  minTroopsToFortify: 1,

  // Battle resolution
  autoResolveDaysAfterBattle: 7,
  forfeitPenaltyTroopLoss: 0.5, // 50% troop loss on forfeit

  // Phase timing (in hours)
  defaultDeployPhaseDuration: 48,
  defaultAttackPhaseDuration: 48,
  defaultBattlePhaseDuration: 168, // 7 days
  defaultFortifyPhaseDuration: 48,

  // Victory conditions
  defaultVictoryTerritoryPercent: 0.75, // own 75% of map to win
  eliminationVictory: true,
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
 * STRUCTURE_COSTS — deliberately omitted from V1.
 *
 * The resource/economy system (brick, lumber, wool, grain, ore) is not implemented yet.
 * Structure costs will be added here once the resource generation and spending loop is designed.
 * Placeholder types live in types/Resources.ts and config/theme.ts for reference.
 */