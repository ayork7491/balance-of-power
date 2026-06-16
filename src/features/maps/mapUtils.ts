/**
 * features/maps/mapUtils.ts
 *
 * Pure utility functions for map/territory operations.
 * No React, no side effects.
 *
 * Canonical identifier: territory_id
 */
import type { MapDefinition } from './types';

/** Build adjacency lookup: { territory_id → Set<territory_id> }
 *  Reads from typed_adjacency first (Shattered Crown), falls back to legacy flat adjacency.
 *  All edge types (land, maritime, river_crossing) are included.
 */
export function buildAdjacencyMap(mapDef: MapDefinition): Record<string, Set<string>> {
  const adj: Record<string, Set<string>> = {};
  for (const t of mapDef.territories) adj[t.territory_id] = new Set();

  if (mapDef.typed_adjacency && mapDef.typed_adjacency.length > 0) {
    // Typed adjacency — Shattered Crown: all edge types traversable
    for (const edge of mapDef.typed_adjacency) {
      if (!adj[edge.from]) adj[edge.from] = new Set();
      if (!adj[edge.to])   adj[edge.to]   = new Set();
      adj[edge.from].add(edge.to);
      adj[edge.to].add(edge.from);
    }
  } else {
    // Legacy flat adjacency — V1 Standard map
    for (const [a, b] of mapDef.adjacency) {
      adj[a]?.add(b);
      adj[b]?.add(a);
    }
  }
  return adj;
}

/**
 * Build a typed adjacency lookup: { territory_id → { id: string, type: string }[] }
 * Returns the edge type ('land', 'maritime', 'river_crossing') for each neighbor.
 * Falls back to 'land' for maps without typed_adjacency.
 */
export function buildTypedAdjacencyMap(mapDef: MapDefinition): Record<string, { id: string; type: string }[]> {
  const adj: Record<string, { id: string; type: string }[]> = {};
  for (const t of mapDef.territories) adj[t.territory_id] = [];

  if (mapDef.typed_adjacency && mapDef.typed_adjacency.length > 0) {
    for (const edge of mapDef.typed_adjacency) {
      if (!adj[edge.from]) adj[edge.from] = [];
      if (!adj[edge.to])   adj[edge.to]   = [];
      adj[edge.from].push({ id: edge.to,   type: edge.type });
      adj[edge.to].push(  { id: edge.from, type: edge.type });
    }
  } else {
    for (const [a, b] of mapDef.adjacency) {
      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];
      adj[a].push({ id: b, type: 'land' });
      adj[b].push({ id: a, type: 'land' });
    }
  }
  return adj;
}

/** Get all territory_ids adjacent to a given territory */
export function getNeighbors(territoryId: string, adj: Record<string, Set<string>>): string[] {
  return Array.from(adj[territoryId] ?? []);
}

/** Check if two territories are directly adjacent */
export function areAdjacent(
  a: string,
  b: string,
  adj: Record<string, Set<string>>,
): boolean {
  return adj[a]?.has(b) ?? false;
}

/** BFS: find all territories reachable within maxDist steps owned by the same player */
export function getFortifiableTargets(
  originId: string,
  ownerPlayerId: string,
  stateById: Record<string, { owner_player_id?: string | null }>,
  adj: Record<string, Set<string>>,
  maxDist: number,
): string[] {
  const visited = new Set<string>([originId]);
  const queue: [string, number][] = [[originId, 0]];
  const result: string[] = [];

  while (queue.length > 0) {
    const [current, dist] = queue.shift()!;
    if (dist > 0 && stateById[current]?.owner_player_id === ownerPlayerId) {
      result.push(current);
    }
    if (dist < maxDist) {
      for (const neighbor of (adj[current] ?? [])) {
        if (!visited.has(neighbor) && stateById[neighbor]?.owner_player_id === ownerPlayerId) {
          visited.add(neighbor);
          queue.push([neighbor, dist + 1]);
        }
      }
    }
  }

  return result;
}

/** Count territories owned by a player in a given region */
export function countOwnedInRegion(
  regionId: string,
  playerId: string,
  mapDef: MapDefinition,
  stateById: Record<string, { owner_player_id?: string | null }>,
): number {
  return mapDef.territories.filter(
    t => t.region_id === regionId && stateById[t.territory_id]?.owner_player_id === playerId
  ).length;
}

/** Count territories owned by a player in a given continent */
export function countOwnedInContinent(
  continentId: string,
  playerId: string,
  mapDef: MapDefinition,
  stateById: Record<string, { owner_player_id?: string | null }>,
): number {
  return mapDef.territories.filter(
    t => t.continent_id === continentId && stateById[t.territory_id]?.owner_player_id === playerId
  ).length;
}

/** Check if a player controls an entire region */
export function controlsRegion(
  regionId: string,
  playerId: string,
  mapDef: MapDefinition,
  stateById: Record<string, { owner_player_id?: string | null }>,
): boolean {
  const inRegion = mapDef.territories.filter(t => t.region_id === regionId);
  return inRegion.length > 0 &&
    inRegion.every(t => stateById[t.territory_id]?.owner_player_id === playerId);
}

/** Check if a player controls an entire continent */
export function controlsContinent(
  continentId: string,
  playerId: string,
  mapDef: MapDefinition,
  stateById: Record<string, { owner_player_id?: string | null }>,
): boolean {
  const inContinent = mapDef.territories.filter(t => t.continent_id === continentId);
  return inContinent.length > 0 &&
    inContinent.every(t => stateById[t.territory_id]?.owner_player_id === playerId);
}

/** Parse "x1,y1 x2,y2 ..." polygon points string into coordinate pairs */
export function parsePoints(points: string): [number, number][] {
  return points.trim().split(/\s+/).map(p => {
    const [x, y] = p.split(',').map(Number);
    return [x, y];
  });
}

/** Compute the centroid of a polygon (fallback if cx/cy not set) */
export function centroid(points: [number, number][]): [number, number] {
  const x = points.reduce((s, p) => s + p[0], 0) / points.length;
  const y = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [x, y];
}