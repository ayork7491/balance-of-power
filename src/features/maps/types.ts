/**
 * features/maps/types.ts
 *
 * Canonical TypeScript types for the map system.
 * Single source of truth — all map components, hooks, and utilities import from here.
 *
 * Separation of concerns:
 *   MapDefinition  — static, per-map schema: shape, adjacency, regions, continents
 *   TerritoryState — dynamic, per-campaign: owner, troops, structures
 *
 * Canonical territory identifier: territory_id (snake_case stable string key)
 */

// ─── Terrain ──────────────────────────────────────────────────────────────────

export type TerrainType =
  | 'plains'
  | 'mountains'
  | 'forest'
  | 'desert'
  | 'coastal'
  | 'urban'
  | 'tundra'
  | 'swamp';

// ─── Resources ────────────────────────────────────────────────────────────────

/** V1 canonical resources. Must stay in sync with types/Resources.ts and config/theme.ts */
export type ResourceType = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';

/**
 * Resource distribution for a territory.
 * Weights are arbitrary relative numbers that must total exactly 100.
 * Used to determine which resource a territory produces each turn (future).
 */
export interface ResourceDistribution {
  brick:  number; // 0–100
  lumber: number;
  wool:   number;
  grain:  number;
  ore:    number;
  // Invariant: brick + lumber + wool + grain + ore === 100
}

// ─── Map Structure ────────────────────────────────────────────────────────────

/**
 * MapRegion — a smaller bonus group within a continent.
 * Controlling all territories in a region grants control_bonus troops.
 */
export interface MapRegion {
  id: string;
  name: string;
  continent_id: string; // which continent this region belongs to
  control_bonus: number;
  color: string; // hex fill tint used by the renderer
}

/**
 * MapContinent — a larger strategic bonus group made up of regions.
 * Controlling all territories in a continent grants control_bonus troops
 * in addition to any region bonuses.
 */
export interface MapContinent {
  id: string;
  name: string;
  control_bonus: number;
  color: string; // hex border/label color used by the renderer
}

/**
 * TerritoryDefinition — a single territory node in the static map schema.
 * This is NEVER mutated at runtime. Campaign-specific state lives in TerritoryState.
 *
 * Canonical identifier: territory_id
 */
export interface TerritoryDefinition {
  /** Stable snake_case string — canonical foreign key for TerritoryState.territory_id */
  territory_id: string;
  name: string;
  region_id: string;
  continent_id: string;
  /** SVG polygon points string: "x1,y1 x2,y2 ..." in logical coordinate space */
  points: string;
  /** Center anchor X — geometric center of the territory */
  cx: number;
  /** Center anchor Y — geometric center of the territory */
  cy: number;
  /** Troop badge anchor X (defaults to cx if not specified) */
  troop_x?: number;
  /** Troop badge anchor Y (defaults to cy if not specified) */
  troop_y?: number;
  /** Label anchor X (defaults to cx if not specified) */
  label_x?: number;
  /** Label anchor Y (defaults to cy if not specified) */
  label_y?: number;
  terrain: TerrainType;
  resource_distribution: ResourceDistribution;
}

/**
 * TerritoryConnection — bidirectional adjacency edge.
 * A single record represents an undirected connection between two territories.
 */
export interface TerritoryConnection {
  territory_a_id: string;
  territory_b_id: string;
  /** Optional crossing cost modifier for future rule extensions */
  traversal_cost?: number;
}

/**
 * MapDefinition — the complete static schema for a map.
 * Stored in mapData.ts as a plain object. Also has a matching Base44 entity
 * (MapDefinition) for persistence, but the renderer reads from mapData.ts directly.
 */
export interface MapDefinition {
  id: string;
  name: string;
  description?: string;
  /** Width of the logical SVG coordinate space */
  width: number;
  /** Height of the logical SVG coordinate space */
  height: number;
  continents: MapContinent[];
  regions: MapRegion[];
  territories: TerritoryDefinition[];
  /** Adjacency edges as [territory_id_a, territory_id_b] pairs — bidirectional */
  adjacency: [string, string][];
  min_players: number;
  max_players: number;
  /** Ocean background SVG URL */
  ocean_background_url?: string;
  /** Landmass underlay SVG URL */
  underlay_url?: string;
  /** Geography detail SVG URL */
  geography_detail_url?: string;
  /** Atlas labels SVG URL */
  atlas_labels_url?: string;
  /** Atmosphere/vignette effects SVG URL */
  atmosphere_url?: string;
  /** Continent label anchors: continent_id → {x, y} in logical coordinate space */
  continent_label_anchors?: Record<string, { x: number; y: number }>;
  /** World title label anchor in logical coordinate space */
  world_title_anchor?: { x: number; y: number };
}

// ─── Campaign Territory State (dynamic) ──────────────────────────────────────

/**
 * TerritoryState — campaign-specific runtime state for one territory.
 * Stored as a Base44 entity, keyed by territory_id.
 * Completely separate from TerritoryDefinition.
 */
export interface TerritoryState {
  id: string;               // Base44 entity id
  campaign_id: string;
  map_id: string;
  territory_id: string;     // FK → TerritoryDefinition.territory_id
  owner_player_id: string | null;
  troop_count: number;
  structures: string[];     // StructureType[]
  created_date?: string;
  updated_date?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface MapValidationError {
  code: string;
  message: string;
  territory_id?: string;
}

export interface MapValidationResult {
  valid: boolean;
  errors: MapValidationError[];
}