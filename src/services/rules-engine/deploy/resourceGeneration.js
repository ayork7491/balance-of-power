/**
 * services/rules-engine/deploy/resourceGeneration.js
 *
 * Pure functions for resource generation during the deploy phase.
 *
 * ─── SPRINT 3A MIGRATION STATUS ──────────────────────────────────────────────
 *
 * ⚠ FLAGGED FOR SPRINT 3B UPDATE:
 *
 * This file previously used V1 resources: brick, lumber, wool, grain, ore.
 * Sprint 3A replaces the canonical resource set with:
 *   gold, iron, timber, stone, food
 *
 * The resource distribution presets in services/maps/mapMetadata.js still
 * reference old keys (brick, lumber, wool, grain, ore). These must be updated
 * in Sprint 3B when resource generation is re-implemented.
 *
 * Current behavior: generation still uses old keys via mapMetadata.js.
 * New PlayerResourceLedger entity uses new keys (gold/iron/timber/stone/food).
 * The two systems are decoupled until Sprint 3B wires them together.
 *
 * Sprint 3B tasks:
 *   1. Update RES presets in mapMetadata.js to use new resource keys
 *   2. Update rollWeightedResource to output new resource keys
 *   3. Update generateResourcesForPlayer return shape
 *   4. Wire output into PlayerResourceLedger instead of DeployIncome.resources_generated
 *
 * ─── ORIGINAL LOGIC DOCS ─────────────────────────────────────────────────────
 *
 * Each owned territory generates exactly 1 resource per deploy round.
 * The resource type is determined by a weighted random roll using the
 * territory's resource_distribution (from services/maps/mapMetadata.js).
 *
 * Determinism:
 *   Seed = `${campaignId}_${playerId}_${territory_id}_r${round}`
 *   This ensures results are reproducible for dispute resolution and replay.
 *
 * NO resource is generated for territories without a resource_distribution.
 */

// Sprint 3A canonical resources — used for new PlayerResourceLedger
// Old V1 keys (brick/lumber/wool/grain/ore) are kept below for backward
// compatibility with existing mapMetadata.js resource_distribution presets.
export const RESOURCE_KEYS = ['gold', 'iron', 'timber', 'stone', 'food'];

// V1 legacy keys — still used by mapMetadata.js distributions (Sprint 3B: remove)
export const V1_RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'];

/**
 * seededRandom
 * FNV-1a variant seedable PRNG. Returns a function that yields [0, 1) values.
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
 * Given a resource distribution with weights summing to 100, and a random
 * value in [0, 1), returns the selected resource key.
 *
 * @param {Object} dist - resource key → weight map
 * @param {number} roll - random value in [0, 1)
 * @returns {string} resource key
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
 * Generates resources for all territories owned by a player this round.
 * Returns an object keyed by the resource types present in the territory
 * resource_distribution (currently V1 keys — Sprint 3B will update to new keys).
 *
 * @param {string} playerId
 * @param {number} round
 * @param {Array} allTerritoryStates
 * @param {Array} mapTerritories
 * @param {string} campaignId
 * @returns {Object} resource totals
 */
export function generateResourcesForPlayer(playerId, round, allTerritoryStates, mapTerritories, campaignId) {
  const ownedStates = allTerritoryStates.filter(s => s.owner_player_id === playerId);
  // Initialize with V1 keys (Sprint 3B: change to new canonical keys)
  const totals = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };

  for (const ts of ownedStates) {
    const def = mapTerritories.find(t => t.territory_id === ts.territory_id);

    if (!def) continue;

    if (!def.resource_distribution) {
      console.warn(`[resourceGen] territory ${ts.territory_id} has no resource_distribution — skipped`);
      continue;
    }

    const seed     = `${campaignId}_${playerId}_${ts.territory_id}_r${round}`;
    const rng      = seededRandom(seed);
    const resource = rollWeightedResource(def.resource_distribution, rng());
    totals[resource] = (totals[resource] || 0) + 1;
  }

  return totals;
}