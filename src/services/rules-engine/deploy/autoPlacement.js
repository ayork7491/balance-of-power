/**
 * services/rules-engine/deploy/autoPlacement.js
 *
 * Seeded-random auto-placement of troops across owned territories.
 * Used for:
 *   - Auto-submit when player doesn't lock before phase end
 *   - Filling remaining unallocated troops when player locks with troops_remaining > 0
 *
 * Determinism: seed includes campaign_id + player_id + round + suffix to ensure
 * auto-submit results are reproducible and logged.
 */

import { seededRandom } from './resourceGeneration.js';

/**
 * autoRandomizePlacements
 * Distributes `remaining` troops across `ownedTerritoryIds` using seeded RNG.
 * Returns a placements object { [territory_id]: number } to MERGE with existing placements.
 *
 * @param {string[]} ownedTerritoryIds
 * @param {number} remaining - troops left to place
 * @param {string} seed - unique seed string for this player/round/context
 * @returns {{ [territory_id]: number }}
 */
export function autoRandomizePlacements(ownedTerritoryIds, remaining, seed) {
  if (!ownedTerritoryIds.length || remaining <= 0) return {};
  const rng = seededRandom(seed);
  const additions = {};
  let i = 0;
  while (remaining > 0) {
    const tid = ownedTerritoryIds[Math.floor(rng() * ownedTerritoryIds.length)];
    additions[tid] = (additions[tid] || 0) + 1;
    remaining--;
    if (++i > 100000) break; // safety guard
  }
  return additions;
}

/**
 * mergePlacements
 * Merges additional placements on top of base placements.
 * @param {{ [territory_id]: number }} base
 * @param {{ [territory_id]: number }} additions
 * @returns {{ [territory_id]: number }}
 */
export function mergePlacements(base, additions) {
  const result = { ...base };
  for (const [tid, count] of Object.entries(additions)) {
    result[tid] = (result[tid] || 0) + count;
  }
  return result;
}