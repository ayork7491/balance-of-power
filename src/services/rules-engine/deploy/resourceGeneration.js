/**
 * services/rules-engine/deploy/resourceGeneration.js
 *
 * Pure functions for resource generation during the deploy phase.
 *
 * ─── RESOURCE GENERATION LOGIC ───────────────────────────────────────────────
 *
 * Each owned territory generates exactly 1 resource per deploy round.
 * The resource type is determined by a weighted random roll using the
 * territory's resource_distribution (from services/maps/mapMetadata.js).
 *
 * V1 resources: brick, lumber, wool, grain, ore
 * Weights are terrain-biased presets defined in mapMetadata.js, summing to 100.
 *
 * Example: mountains territory → { brick:10, lumber:5, wool:5, grain:10, ore:70 }
 * → a roll of 0.80 → ore (cumulative 10+5+5+10=30, then ore at 70 puts us at 100)
 *
 * Determinism:
 *   Seed = `${campaignId}_${playerId}_${territory_id}_r${round}`
 *   This ensures results are reproducible for dispute resolution and replay.
 *
 * NO resource is generated for territories without a resource_distribution.
 * This should never occur with V1 territories (all have distributions defined).
 */

// V1 default resources (all territories must yield one of these)
export const V1_RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];

/**
 * seededRandom
 * FNV-1a variant seedable PRNG. Returns a function that yields [0, 1) values.
 * Same algorithm used in autoPlacement.js for consistency.
 *
 * @param {string} seed
 * @returns {() => number}
 */
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
 * rollWeightedResource
 * Given a resource distribution { brick, lumber, wool, grain, ore } with weights
 * summing to 100, and a random value in [0, 1), returns the selected resource key.
 *
 * @param {{ brick: number, lumber: number, wool: number, grain: number, ore: number }} dist
 * @param {number} roll - random value in [0, 1)
 * @returns {string} one of V1_RESOURCES
 */
export function rollWeightedResource(dist, roll) {
  const roll100   = roll * 100;
  let cumulative  = 0;
  for (const [resource, weight] of Object.entries(dist)) {
    cumulative += weight;
    if (roll100 < cumulative) return resource;
  }
  // Floating-point edge — return last key
  return Object.keys(dist).at(-1);
}

/**
 * generateResourcesForPlayer
 * Generates V1 resources for all territories owned by a player this round.
 * Returns { brick: n, lumber: n, wool: n, grain: n, ore: n }.
 *
 * Territories without a resource_distribution are skipped (logged as a warning
 * since this should not happen in V1 maps — all territories have distributions).
 *
 * @param {string} playerId
 * @param {number} round
 * @param {TerritoryState[]} allTerritoryStates - all TerritoryState for campaign
 * @param {Array<{territory_id: string, resource_distribution: object}>} mapTerritories
 *   — from getTerritoriesForMap(mapId) in services/maps/mapMetadata.js
 * @param {string} campaignId
 * @returns {{ brick: number, lumber: number, wool: number, grain: number, ore: number }}
 */
export function generateResourcesForPlayer(playerId, round, allTerritoryStates, mapTerritories, campaignId) {
  const ownedStates = allTerritoryStates.filter(s => s.owner_player_id === playerId);
  const totals      = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };

  for (const ts of ownedStates) {
    const def = mapTerritories.find(t => t.territory_id === ts.territory_id);

    if (!def) {
      // Territory exists in state but not in map schema — skip silently
      // (can happen if map_id mismatch; should be caught at campaign creation)
      continue;
    }

    if (!def.resource_distribution) {
      // All V1 territories should have distributions. Log a warning but don't crash.
      console.warn(`[resourceGen] territory ${ts.territory_id} has no resource_distribution — skipped`);
      continue;
    }

    // Seed: campaign + player + territory + round — deterministic per roll
    const seed     = `${campaignId}_${playerId}_${ts.territory_id}_r${round}`;
    const rng      = seededRandom(seed);
    const resource = rollWeightedResource(def.resource_distribution, rng());
    totals[resource] = (totals[resource] || 0) + 1;
  }

  return totals;
}