/**
 * TerritoryDefinition — a single territory node on the campaign map.
 * Stored as a Base44 entity per campaign instance.
 * Rendering is driven by these coordinates — no hardcoded SVG.
 */
import type { StructureType } from './Resources';

export interface TerritoryDefinition {
  id: string;
  campaign_id: string;
  map_id: string;
  /** Human-readable name (e.g. "Iron Ridge") */
  name: string;
  /** Region/continent this territory belongs to */
  region_id: string;
  /** Logical X coordinate in the map's coordinate space */
  x: number;
  /** Logical Y coordinate in the map's coordinate space */
  y: number;
  /** Optional terrain type for future rule modifiers */
  terrain?: string;
  /** Player ID of current owner (null = unoccupied) */
  owner_player_id?: string | null;
  /** Current troop count on this territory */
  troop_count: number;
  /** Structures built on this territory */
  structures: StructureType[];
  created_date?: string;
  updated_date?: string;
}

/**
 * TerritoryConnection — an adjacency edge between two territories.
 * Bidirectional: a single record represents an undirected edge.
 * Used by the rules engine to validate attacks and fortification moves.
 */
export interface TerritoryConnection {
  id: string;
  campaign_id: string;
  territory_a_id: string;
  territory_b_id: string;
  /** Optional: crossing cost modifier for future rule extensions */
  traversal_cost?: number;
  created_date?: string;
  updated_date?: string;
}