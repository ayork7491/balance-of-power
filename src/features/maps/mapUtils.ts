/**
 * features/maps/mapUtils.ts
 *
 * Pure utility functions for map/territory operations.
 * No React, no side effects.
 */
import type { MapDef, TerritoryDef } from './mapData';

/** Build an adjacency lookup: { key: Set<key> } */
export function buildAdjacencyMap(mapDef: MapDef): Record<string, Set<string>> {
  const adj: Record<string, Set<string>> = {};
  for (const t of mapDef.territories) adj[t.key] = new Set();
  for (const [a, b] of mapDef.adjacency) {
    adj[a]?.add(b);
    adj[b]?.add(a);
  }
  return adj;
}

/** Get all territory keys adjacent to a given territory */
export function getNeighbors(key: string, adj: Record<string, Set<string>>): string[] {
  return Array.from(adj[key] ?? []);
}

/** BFS to find all reachable territories within `maxDist` steps owned by the same player */
export function getFortifiableTargets(
  originKey: string,
  ownerPlayerId: string,
  stateByKey: Record<string, { owner_player_id?: string | null }>,
  adj: Record<string, Set<string>>,
  maxDist: number,
): string[] {
  const visited = new Set<string>([originKey]);
  const queue: [string, number][] = [[originKey, 0]];
  const result: string[] = [];

  while (queue.length > 0) {
    const [current, dist] = queue.shift()!;
    if (dist > 0 && stateByKey[current]?.owner_player_id === ownerPlayerId) {
      result.push(current);
    }
    if (dist < maxDist) {
      for (const neighbor of (adj[current] ?? [])) {
        if (!visited.has(neighbor) && stateByKey[neighbor]?.owner_player_id === ownerPlayerId) {
          visited.add(neighbor);
          queue.push([neighbor, dist + 1]);
        }
      }
    }
  }

  return result;
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