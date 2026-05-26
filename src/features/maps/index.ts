/**
 * features/maps — public API.
 *
 * ARCHITECTURE CONSTRAINT:
 *   Map rendering is schema-driven. All shape/position/adjacency data comes
 *   from mapData.ts (static definitions). Campaign-specific territory state
 *   (owner, troops, structures) lives in TerritoryState entities.
 *   No hardcoded SVG paths or territory coordinates in components.
 */

// Static map definitions and utilities
export { MAP_V1_STANDARD, MAP_REGISTRY, getMap } from './mapData';
export type { MapDef, TerritoryDef, RegionDef } from './mapData';

// Pure utilities (adjacency, BFS, geometry)
export { buildAdjacencyMap, getNeighbors, getFortifiableTargets, parsePoints, centroid } from './mapUtils';

// Hooks
export { useTerritoryState } from './useTerritoryState';