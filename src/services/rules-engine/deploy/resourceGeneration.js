/**
 * services/rules-engine/deploy/resourceGeneration.js
 *
 * Pure functions for resource generation during deploy phase.
 * Each owned territory produces 1 resource per round via weighted random roll.
 * Randomness is seedable for deterministic replay.
 *
 * Spec (Gameplay Rules doc):
 *   - 1 resource per controlled territory per round
 *   - Territories have weighted resource distributions (brick/lumber/wool/grain/ore)
 *   - Roll 1–100, select resource by cumulative weight
 */

/** Seedable RNG (same algorithm used in deploy backend for consistency) */
export function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * rollResource
 * Given a resource distribution and a random value [0,1), return resource type.
 * @param {{ brick, lumber, wool, grain, ore }} dist - weights summing to 100
 * @param {number} roll - random value in [0, 1)
 * @returns {string} resource key
 */
export function rollResource(dist, roll) {
  const roll100 = roll * 100;
  let cumulative = 0;
  for (const [resource, weight] of Object.entries(dist)) {
    cumulative += weight;
    if (roll100 < cumulative) return resource;
  }
  // Fallback to last key in case of floating-point edge
  return Object.keys(dist).at(-1);
}

/**
 * generateResourcesForPlayer
 * Generates resources for all territories owned by a player this round.
 * Returns { brick: n, lumber: n, wool: n, grain: n, ore: n }
 *
 * @param {string} playerId
 * @param {number} round
 * @param {TerritoryState[]} allTerritoryStates
 * @param {TerritoryDefinition[]} mapTerritories - from MapDefinition.territories
 * @param {string} campaignId
 */
export function generateResourcesForPlayer(playerId, round, allTerritoryStates, mapTerritories, campaignId) {
  const ownedStates = allTerritoryStates.filter(s => s.owner_player_id === playerId);
  const totals = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };

  for (const ts of ownedStates) {
    const def = mapTerritories.find(t => t.territory_id === ts.territory_id);
    if (!def?.resource_distribution) continue;
    // Seed: campaign + player + territory + round — deterministic per roll
    const seed = `${campaignId}_${playerId}_${ts.territory_id}_r${round}`;
    const rng  = seededRandom(seed);
    const resource = rollResource(def.resource_distribution, rng());
    totals[resource] = (totals[resource] || 0) + 1;
  }

  return totals;
}