/**
 * features/maps — public API.
 *
 * ARCHITECTURE CONSTRAINTS:
 *   1. Map rendering is schema-driven. Shape/position/adjacency/resources come
 *      from mapData.ts (static). Campaign state (owner/troops/structures) lives
 *      in TerritoryState Base44 entities.
 *   2. Canonical territory identifier is territory_id everywhere.
 *      Never use "key" as a territory identifier in new code.
 *   3. No hardcoded SVG paths or coordinates in components.
 *   4. Types are sourced from features/maps/types.ts — not from mapData.ts.
 */

// Types — canonical source of truth
export type {
  MapDefinition,
  TerritoryDefinition,
  TerritoryConnection,
  MapRegion,
  MapContinent,
  ResourceDistribution,
  ResourceType,
  TerrainType,
  TerritoryState,
  MapValidationResult,
  MapValidationError,
} from './types';

// Static map definitions
export { MAP_V1_STANDARD, MAP_REGISTRY, getMap } from './mapData';

// Validation
export { validateMap, assertMapValid } from './mapValidation';

// Pure utilities (adjacency, BFS, geometry, control checks)
export {
  buildAdjacencyMap,
  getNeighbors,
  areAdjacent,
  getFortifiableTargets,
  countOwnedInRegion,
  countOwnedInContinent,
  controlsRegion,
  controlsContinent,
  parsePoints,
  centroid,
} from './mapUtils';

// Hooks
export { useTerritoryState } from './useTerritoryState';