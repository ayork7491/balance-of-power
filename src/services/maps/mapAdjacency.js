/**
 * services/maps/mapAdjacency.js
 *
 * Frontend adjacency query helpers for the Shattered Crown map.
 * Wraps SC_ADJACENCY from the canonical config with convenient query methods.
 *
 * SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_ADJACENCY
 *
 * All edges are treated as bidirectional (A→B implies B→A).
 * Adjacency types: 'land' | 'maritime' | 'river_crossing'
 *
 * Sprint 4A: all types are traversable by default. Future sprints may
 * restrict by type based on unit/phase rules.
 */

import { SC_ADJACENCY } from '@/shared/maps/shatteredCrownConfig';

/** Default: all adjacency types are traversable. */
const ALL_TYPES = ['land', 'maritime', 'river_crossing'];

/**
 * buildAdjacencyIndex
 * Builds a Map<territoryId, { neighborId, type }[]> for O(1) neighbor lookups.
 * @param {string[]} allowedTypes — adjacency types to include (default: all)
 * @returns {Map<string, {id: string, type: string}[]>}
 */
function buildAdjacencyIndex(allowedTypes = ALL_TYPES) {
  const allowed = new Set(allowedTypes);
  const index = new Map();

  for (const { from, to, type } of SC_ADJACENCY) {
    if (!allowed.has(type)) continue;
    if (!index.has(from)) index.set(from, []);
    if (!index.has(to))   index.set(to,   []);
    index.get(from).push({ id: to,   type });
    index.get(to).push(  { id: from, type });
  }

  return index;
}

// Pre-built index for default (all types) — used by most callers.
const _defaultIndex = buildAdjacencyIndex(ALL_TYPES);

/**
 * getAdjacentTerritories
 * Returns an array of adjacent territory IDs for the given territory.
 *
 * @param {string} territoryId
 * @param {string[]} [types] — adjacency types to include (default: all)
 * @returns {string[]} array of adjacent territory IDs
 *
 * @example
 * getAdjacentTerritories('I1')               // all neighbors
 * getAdjacentTerritories('I3', ['maritime']) // maritime neighbors only
 */
export function getAdjacentTerritories(territoryId, types = ALL_TYPES) {
  // Fast path for default case
  if (types === ALL_TYPES || (types.length === 3 && ALL_TYPES.every(t => types.includes(t)))) {
    return (_defaultIndex.get(territoryId) ?? []).map(n => n.id);
  }
  const index = buildAdjacencyIndex(types);
  return (index.get(territoryId) ?? []).map(n => n.id);
}

/**
 * getAdjacentTerritoriesWithType
 * Like getAdjacentTerritories but returns { id, type } objects so callers
 * can inspect the edge type (e.g. to render river crossings differently).
 *
 * @param {string} territoryId
 * @param {string[]} [types] — adjacency types to include (default: all)
 * @returns {{ id: string, type: string }[]}
 */
export function getAdjacentTerritoriesWithType(territoryId, types = ALL_TYPES) {
  if (types === ALL_TYPES || (types.length === 3 && ALL_TYPES.every(t => types.includes(t)))) {
    return _defaultIndex.get(territoryId) ?? [];
  }
  const index = buildAdjacencyIndex(types);
  return index.get(territoryId) ?? [];
}

/**
 * areAdjacent
 * Returns true if two territories share an adjacency edge of the requested types.
 *
 * @param {string} a
 * @param {string} b
 * @param {string[]} [types] — adjacency types to check (default: all)
 * @returns {boolean}
 *
 * @example
 * areAdjacent('I1', 'I2')                       // true (land)
 * areAdjacent('I3', 'C1', ['maritime'])          // true (maritime)
 * areAdjacent('I3', 'C1', ['land'])              // false
 * areAdjacent('B8', 'S3', ['river_crossing'])    // true (the ford)
 */
export function areAdjacent(a, b, types = ALL_TYPES) {
  const neighbors = getAdjacentTerritories(a, types);
  return neighbors.includes(b);
}

/**
 * getAdjacencyType
 * Returns the adjacency type between two territories, or null if not adjacent.
 *
 * @param {string} a
 * @param {string} b
 * @returns {'land'|'maritime'|'river_crossing'|null}
 */
export function getAdjacencyType(a, b) {
  const neighbors = _defaultIndex.get(a) ?? [];
  const edge = neighbors.find(n => n.id === b);
  return edge ? edge.type : null;
}

/**
 * getLandAdjacentTerritories
 * Convenience: returns only land-adjacent territory IDs.
 */
export function getLandAdjacentTerritories(territoryId) {
  return getAdjacentTerritories(territoryId, ['land']);
}

/**
 * getMaritimeAdjacentTerritories
 * Convenience: returns only maritime-adjacent territory IDs.
 */
export function getMaritimeAdjacentTerritories(territoryId) {
  return getAdjacentTerritories(territoryId, ['maritime']);
}

/**
 * buildFlatAdjacencySet
 * Builds a plain adjacency object { territoryId: Set<neighborId> } for use
 * in BFS/pathfinding algorithms (same shape as existing backend buildAdjacency).
 *
 * @param {string[]} [types] — adjacency types to include (default: all)
 * @returns {Object.<string, Set<string>>}
 */
export function buildFlatAdjacencySet(types = ALL_TYPES) {
  const adj = {};
  const allowed = new Set(types);
  for (const { from, to, type } of SC_ADJACENCY) {
    if (!allowed.has(type)) continue;
    if (!adj[from]) adj[from] = new Set();
    if (!adj[to])   adj[to]   = new Set();
    adj[from].add(to);
    adj[to].add(from);
  }
  return adj;
}