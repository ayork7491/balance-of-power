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

/** V1 legacy resources (brick/lumber/etc.) — kept for V1 Standard map backward compat. */
export type LegacyResourceType = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore';

/**
 * Canonical Sprint 3B+ resources — gold, iron, timber, stone, food.
 * Used by Shattered Crown and all future maps.
 * Re-exported here for convenience; canonical definition lives in shared/maps/shatteredCrownConfig.ts
 */
export type CanonicalResourceType = 'gold' | 'iron' | 'timber' | 'stone' | 'food';

/** Union of both resource type sets — use when the map is unknown. */
export type ResourceType = LegacyResourceType | CanonicalResourceType;

/**
 * Adjacency type for typed adjacency edges.
 * land           — standard ground movement
 * maritime       — coastal/sea crossing
 * river_crossing — river ford (restricted crossing)
 */
export type AdjacencyType = 'land' | 'maritime' | 'river_crossing';

/**
 * TypedAdjacency — a directed adjacency edge with a terrain type.
 * All edges are treated as bidirectional: A→B implies B→A.
 */
export interface TypedAdjacency {
  from: string;
  to:   string;
  type: AdjacencyType;
}

/**
 * Structure slot type — determines which pillar of buildings can go in this slot.
 * omni — accepts any pillar type.
 */
export type SlotType = 'military' | 'economic' | 'diplomatic' | 'omni';

/**
 * Resource distribution for a territory (V1 Legacy format).
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
 *
 * Sprint 4A additions:
 *   primary_resource / secondary_resource / tertiary_resource — canonical Sprint 3B+ resources
 *   structure_slots — building slot types available in this territory
 *   food_bonus      — extra food income (future mechanic, not active in Sprint 4A)
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
  /** V1 legacy resource distribution weights (V1 Standard map only). */
  resource_distribution: ResourceDistribution;
  /** Sprint 3B+ canonical primary resource. Present on all Shattered Crown territories. */
  primary_resource?:    CanonicalResourceType;
  /** Secondary resource (future — not generated in Sprint 4A). */
  secondary_resource?:  CanonicalResourceType;
  /** Tertiary resource (future — not generated in Sprint 4A). */
  tertiary_resource?:   CanonicalResourceType;
  /** Building slot types. Capacity rule: resources + slots === 4 (Shattered Crown). */
  structure_slots?:     SlotType[];
  /** Extra food income bonus (future — not active in Sprint 4A). */
  food_bonus?:          number;
}

/**
 * TerritoryConnection — bidirectional adjacency edge (legacy flat format).
 * A single record represents an undirected connection between two territories.
 * @deprecated Use TypedAdjacency for new maps. Retained for V1 Standard map.
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
  /**
   * Legacy flat adjacency edges as [territory_id_a, territory_id_b] pairs — bidirectional.
   * Used by V1 Standard map. Shattered Crown uses typed_adjacency instead.
   */
  adjacency: [string, string][];
  /**
   * Typed adjacency edges with terrain classification.
   * SOURCE OF TRUTH for Shattered Crown: shared/maps/shatteredCrownConfig.ts
   * Sprint 4A: all types (land, maritime, river_crossing) are traversable for combat.
   */
  typed_adjacency?: TypedAdjacency[];
  min_players: number;
  max_players: number;
  /** Single background image URL (PNG/SVG). Rendered at full width×height. */
  background_image_url?: string;
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