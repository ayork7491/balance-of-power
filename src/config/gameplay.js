/**
 * Balance of Power — Gameplay Configuration
 * All game balance values live here. Never hardcode these in UI components or rules engine files.
 * Future: these should be overridable per-campaign via admin settings stored in the database.
 */

export const GAMEPLAY_DEFAULTS = {
  // Campaign setup
  minPlayers: 2,
  maxPlayers: 8,
  defaultStartingTroops: 20,
  defaultMaxAttacksPerPhase: 3,
  defaultMaxFortificationsPerPhase: 2,
  defaultDraftPercentage: 0.6, // 60% of territories drafted, rest random

  // Troop generation
  baseTroopsPerTurn: 3,
  minTroopsPerTurn: 3,
  territoriesPerBonusTroop: 3, // 1 bonus troop per N territories owned

  // Attack rules
  minTroopsToAttack: 2,
  minTroopsToLeaveInTerritory: 1,

  // Fortification rules
  maxFortificationDistance: 2, // territories away
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
};

export const REGION_BONUS = {
  // Bonus troops for controlling an entire region
  // These are examples — actual values come from map data
  default: 2,
};

export const CONTINENT_BONUS = {
  // Bonus troops for controlling an entire continent
  // These are examples — actual values come from map data
  default: 5,
};

export const BATTLE_SCALING = {
  // How app troop counts map to tabletop battle sizes
  // scaledPoints = Math.round(totalTroops * scalingFactor * averageBattleSize)
  scalingFactor: 0.5,
  minBattlePoints: 250,
  maxBattlePoints: 3000,
};

export const STRUCTURE_COSTS = {
  // Resource costs per structure type — future expansion
  fortress:      { gold: 5, iron: 3 },
  barracks:      { gold: 3, iron: 1 },
  watchtower:    { gold: 2 },
  supply_depot:  { gold: 3, food: 2 },
  factory:       { gold: 4, iron: 2 },
  shrine:        { gold: 3, mana: 2 },
};