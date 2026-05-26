/**
 * MapDefinition — describes a campaign map schema.
 * Maps are schema-driven: no hardcoded SVG paths in components.
 * The map renderer reads TerritoryDefinition + TerritoryConnection data and builds the visual.
 */
export interface MapDefinition {
  id: string;
  name: string;
  description?: string;
  /** Width of the logical coordinate space (e.g. 1000) */
  width: number;
  /** Height of the logical coordinate space (e.g. 700) */
  height: number;
  /** Named regions / continents on this map */
  regions: MapRegion[];
  /** URL to an optional background image for the map */
  background_image_url?: string;
  /** Minimum number of players this map supports */
  min_players: number;
  /** Maximum number of players this map supports */
  max_players: number;
  created_date?: string;
  updated_date?: string;
}

export interface MapRegion {
  id: string;
  name: string;
  /** Bonus troops awarded for controlling all territories in this region */
  control_bonus: number;
  /** Optional display color (hex) for the region boundary */
  color?: string;
}