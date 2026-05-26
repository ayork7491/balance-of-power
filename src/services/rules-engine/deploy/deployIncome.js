/**
 * services/rules-engine/deploy/deployIncome.js
 *
 * Pure functions for deploy phase income calculation.
 * All formulas are config-driven — no magic numbers.
 * Called by the deployPhase backend function; never directly by UI.
 *
 * ─── INCOME FORMULA ──────────────────────────────────────────────────────────
 *
 * Total Deploy Income = territory_bonus + troop_bonus + region_bonus + continent_bonus
 *
 * territory_bonus:
 *   floor( (territoriesOwned / 3) * (avgBattleSize / 1000) )
 *   minimum: min_troops_per_turn (default 3)
 *   avgBattleSize comes from TabletopGameProfile.average_battle_size
 *
 * troop_bonus:
 *   floor( (totalTroops / 2000) * avgBattleSize )
 *   V1: enabled=false by default (too early-game swingy; can be toggled per-campaign)
 *
 * region_bonus:
 *   sum of region.control_bonus for each fully-controlled region
 *   Region data comes from MAP_V1_METADATA (services/maps/mapMetadata.js)
 *
 * continent_bonus:
 *   sum of continent.control_bonus for each fully-controlled continent
 *   Continent data comes from MAP_V1_METADATA (services/maps/mapMetadata.js)
 *
 * ─── TABLETOP PROFILE INTEGRATION ───────────────────────────────────────────
 *
 * avgBattleSize is a placeholder parameter representing
 * TabletopGameProfile.average_battle_size for the campaign's game profile.
 * In V1: the backend reads this from the TabletopGameProfile entity using
 * campaign.game_profile_id. Default fallback = 1000.
 *
 * ─── NOTES ───────────────────────────────────────────────────────────────────
 *
 * Callers must pass mapTerritories as:
 *   Array<{ territory_id, region_id, continent_id }>
 * Available from getTerritoriesForMap(mapId) in services/maps/mapMetadata.js
 *
 * mapRegions:  Array<{ id, control_bonus }>
 * mapContinents: Array<{ id, control_bonus }>
 * Available from getMapMetadata(mapId).regions / .continents
 */

export const DEPLOY_DEFAULTS = {
  territoriesPerBonusTroop: 3,      // 1 troop per N territories owned
  minTroopsPerTurn: 3,              // floor for territory bonus
  troopBonusDivisor: 2000,          // totalTroops / this × avgBattleSize → troop bonus
  troopBonusEnabled: false,         // V1: disabled by default
  defaultAvgBattleSize: 1000,       // fallback if TabletopGameProfile not loaded
};

/**
 * calculateTerritoryBonus
 * floor((territoriesOwned / perTroop) * (avgBattleSize / 1000)), minimum minTroops.
 *
 * @param {number} territoriesOwned
 * @param {object} settings - campaign.settings overrides
 * @param {number} avgBattleSize - from TabletopGameProfile.average_battle_size
 * @returns {number}
 */
export function calculateTerritoryBonus(territoriesOwned, settings = {}, avgBattleSize = DEPLOY_DEFAULTS.defaultAvgBattleSize) {
  const perTroop  = settings.territories_per_bonus_troop ?? DEPLOY_DEFAULTS.territoriesPerBonusTroop;
  const minTroops = settings.min_troops_per_turn ?? DEPLOY_DEFAULTS.minTroopsPerTurn;
  const raw       = Math.floor((territoriesOwned / perTroop) * (avgBattleSize / 1000));
  return Math.max(minTroops, raw);
}

/**
 * calculateTroopBonus
 * floor((totalTroops / divisor) * avgBattleSize).
 * Disabled in V1 by default (troopBonusEnabled = false).
 *
 * @param {number} totalTroops - player's total troop count across all territories
 * @param {object} settings - campaign.settings overrides
 * @param {number} avgBattleSize - from TabletopGameProfile.average_battle_size
 * @returns {number}
 */
export function calculateTroopBonus(totalTroops, settings = {}, avgBattleSize = DEPLOY_DEFAULTS.defaultAvgBattleSize) {
  const enabled  = settings.troop_bonus_enabled ?? DEPLOY_DEFAULTS.troopBonusEnabled;
  if (!enabled) return 0;
  const divisor  = settings.troop_bonus_divisor ?? DEPLOY_DEFAULTS.troopBonusDivisor;
  return Math.floor((totalTroops / divisor) * avgBattleSize);
}

/**
 * calculateRegionBonus
 * Sum control_bonus for every fully-controlled region.
 *
 * @param {string} playerId
 * @param {TerritoryState[]} allTerritoryStates - all TerritoryState records for campaign
 * @param {Array<{territory_id, region_id}>} mapTerritories - from getTerritoriesForMap()
 * @param {Array<{id, control_bonus}>} mapRegions - from getMapMetadata().regions
 * @returns {number}
 */
export function calculateRegionBonus(playerId, allTerritoryStates, mapTerritories, mapRegions) {
  let bonus = 0;
  for (const region of (mapRegions ?? [])) {
    const regionTerrs = mapTerritories.filter(t => t.region_id === region.id);
    if (!regionTerrs.length) continue;
    const allOwned = regionTerrs.every(t => {
      const state = allTerritoryStates.find(s => s.territory_id === t.territory_id);
      return state?.owner_player_id === playerId;
    });
    if (allOwned) bonus += region.control_bonus ?? 0;
  }
  return bonus;
}

/**
 * calculateContinentBonus
 * Sum control_bonus for every fully-controlled continent.
 *
 * @param {string} playerId
 * @param {TerritoryState[]} allTerritoryStates
 * @param {Array<{territory_id, continent_id}>} mapTerritories - from getTerritoriesForMap()
 * @param {Array<{id, control_bonus}>} mapContinents - from getMapMetadata().continents
 * @returns {number}
 */
export function calculateContinentBonus(playerId, allTerritoryStates, mapTerritories, mapContinents) {
  let bonus = 0;
  for (const continent of (mapContinents ?? [])) {
    const contTerrs = mapTerritories.filter(t => t.continent_id === continent.id);
    if (!contTerrs.length) continue;
    const allOwned = contTerrs.every(t => {
      const state = allTerritoryStates.find(s => s.territory_id === t.territory_id);
      return state?.owner_player_id === playerId;
    });
    if (allOwned) bonus += continent.control_bonus ?? 0;
  }
  return bonus;
}

/**
 * validateDeployPlacements
 * Validates a placements object against player ownership and income limit.
 * Returns { valid: true } or { valid: false, error: string }
 *
 * @param {{ [territory_id]: number }} placements
 * @param {Set<string>} ownedTerritoryIds
 * @param {number} allowedTroops
 */
export function validateDeployPlacements(placements, ownedTerritoryIds, allowedTroops) {
  let totalPlaced = 0;
  for (const [tid, count] of Object.entries(placements)) {
    if (!ownedTerritoryIds.has(tid)) {
      return { valid: false, error: `Territory ${tid} is not owned by you` };
    }
    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
      return { valid: false, error: `Invalid troop count for ${tid}: must be a non-negative integer` };
    }
    totalPlaced += count;
  }
  if (totalPlaced > allowedTroops) {
    return { valid: false, error: `Total placements (${totalPlaced}) exceed income (${allowedTroops})` };
  }
  return { valid: true, totalPlaced };
}

/**
 * calcPlayerDeployIncome
 * Full income calculation for one player. Returns all breakdown fields.
 *
 * @param {string} playerId
 * @param {TerritoryState[]} allTerritoryStates
 * @param {Array} mapTerritories - from getTerritoriesForMap()
 * @param {Array} mapRegions - from getMapMetadata().regions
 * @param {Array} mapContinents - from getMapMetadata().continents
 * @param {object} settings - campaign.settings
 * @param {number} avgBattleSize - from TabletopGameProfile.average_battle_size
 * @returns {{ territory_bonus, troop_bonus, region_bonus, continent_bonus, total }}
 */
export function calcPlayerDeployIncome(
  playerId,
  allTerritoryStates,
  mapTerritories,
  mapRegions,
  mapContinents,
  settings = {},
  avgBattleSize = DEPLOY_DEFAULTS.defaultAvgBattleSize,
) {
  const ownedStates    = allTerritoryStates.filter(s => s.owner_player_id === playerId);
  const territoriesOwned = ownedStates.length;
  const totalTroops    = ownedStates.reduce((sum, s) => sum + (s.troop_count || 0), 0);

  const territory_bonus = calculateTerritoryBonus(territoriesOwned, settings, avgBattleSize);
  const troop_bonus     = calculateTroopBonus(totalTroops, settings, avgBattleSize);
  const region_bonus    = calculateRegionBonus(playerId, allTerritoryStates, mapTerritories, mapRegions);
  const continent_bonus = calculateContinentBonus(playerId, allTerritoryStates, mapTerritories, mapContinents);
  const total           = territory_bonus + troop_bonus + region_bonus + continent_bonus;

  return { territory_bonus, troop_bonus, region_bonus, continent_bonus, total };
}