/**
 * services/rules-engine/deploy/deployIncome.js
 *
 * Pure functions for deploy phase income calculation.
 * All formulas are config-driven — no magic numbers here.
 * Called by the deployPhase backend function, never directly by UI.
 *
 * Spec formulas (from Gameplay Rules doc):
 *   Territory Bonus: floor(territoriesOwned / territoriesPerBonusTroop) × avgBattleSize/1000
 *     → simplified default: floor(territoriesOwned / 3), minimum 3
 *   Region Bonus:    sum of region.control_bonus for each fully-controlled region
 *   Continent Bonus: sum of continent.control_bonus for each fully-controlled continent
 *   Troop Bonus:     floor(totalTroops / 2000 × avgBattleSize)  [future, off in V1]
 *
 * All constants come from campaign.settings or DEPLOY_DEFAULTS below.
 */

export const DEPLOY_DEFAULTS = {
  territoriesPerBonusTroop: 3,   // 1 troop per N territories owned
  minTroopsPerTurn: 3,           // floor for territory bonus
  troopBonusDivisor: 2000,       // totalTroops / this × avgBattleSize → troop bonus
  troopBonusEnabled: false,      // V1: disabled — territory bonus only
};

/**
 * calcTerritoryBonus
 * Returns the troop bonus from territory ownership.
 * @param {number} territoriesOwned
 * @param {object} settings - campaign.settings
 * @returns {number}
 */
export function calcTerritoryBonus(territoriesOwned, settings = {}) {
  const perTroop = settings.territories_per_bonus_troop ?? DEPLOY_DEFAULTS.territoriesPerBonusTroop;
  const minTroops = settings.min_troops_per_turn ?? DEPLOY_DEFAULTS.minTroopsPerTurn;
  return Math.max(minTroops, Math.floor(territoriesOwned / perTroop));
}

/**
 * calcRegionBonus
 * Returns troop bonus from fully controlled regions.
 * @param {string} playerId
 * @param {TerritoryState[]} allTerritoryStates - all territory states for the campaign
 * @param {MapDefinition} mapDef
 * @returns {number}
 */
export function calcRegionBonus(playerId, allTerritoryStates, mapDef) {
  let bonus = 0;
  for (const region of (mapDef.regions ?? [])) {
    const regionTerritories = mapDef.territories.filter(t => t.region_id === region.id);
    if (regionTerritories.length === 0) continue;
    const allOwned = regionTerritories.every(t => {
      const state = allTerritoryStates.find(s => s.territory_id === t.territory_id);
      return state?.owner_player_id === playerId;
    });
    if (allOwned) bonus += region.control_bonus ?? 0;
  }
  return bonus;
}

/**
 * calcContinentBonus
 * Returns troop bonus from fully controlled continents.
 * @param {string} playerId
 * @param {TerritoryState[]} allTerritoryStates
 * @param {MapDefinition} mapDef
 * @returns {number}
 */
export function calcContinentBonus(playerId, allTerritoryStates, mapDef) {
  let bonus = 0;
  for (const continent of (mapDef.continents ?? [])) {
    const contTerritories = mapDef.territories.filter(t => t.continent_id === continent.id);
    if (contTerritories.length === 0) continue;
    const allOwned = contTerritories.every(t => {
      const state = allTerritoryStates.find(s => s.territory_id === t.territory_id);
      return state?.owner_player_id === playerId;
    });
    if (allOwned) bonus += continent.control_bonus ?? 0;
  }
  return bonus;
}

/**
 * calcPlayerDeployIncome
 * Full income calculation for one player.
 * Returns { territory_bonus, region_bonus, continent_bonus, total }
 *
 * @param {string} playerId
 * @param {TerritoryState[]} allTerritoryStates
 * @param {MapDefinition} mapDef
 * @param {object} settings - campaign.settings
 */
export function calcPlayerDeployIncome(playerId, allTerritoryStates, mapDef, settings = {}) {
  const ownedCount     = allTerritoryStates.filter(s => s.owner_player_id === playerId).length;
  const territoryBonus = calcTerritoryBonus(ownedCount, settings);
  const regionBonus    = calcRegionBonus(playerId, allTerritoryStates, mapDef);
  const continentBonus = calcContinentBonus(playerId, allTerritoryStates, mapDef);
  const total          = territoryBonus + regionBonus + continentBonus;
  return { territory_bonus: territoryBonus, region_bonus: regionBonus, continent_bonus: continentBonus, total };
}