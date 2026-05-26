/**
 * services/maps/mapMetadata.js
 *
 * Backend-safe, pure-JS map metadata helper.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Deno deploy functions cannot import TypeScript files from the frontend
 * (features/maps/mapData.ts). Local imports are also prohibited in Deno deploy.
 * This file mirrors the structural metadata (territories, regions, continents,
 * resource_distribution) that backend income calculations need.
 *
 * SINGLE SOURCE OF TRUTH STRATEGY
 * ─────────────────────────────────
 * The frontend MapDefinition (features/maps/mapData.ts) remains the canonical
 * source for rendering data (polygon points, colors, labels, adjacency).
 * This file is the canonical source for SERVER-SIDE income calculations:
 *   - territory → region_id, continent_id, resource_distribution
 *   - region → continent_id, control_bonus
 *   - continent → control_bonus
 *
 * If you update territories or regions in mapData.ts, update the matching
 * entry here. The two files must stay in sync manually.
 *
 * APPROACH DOCUMENTED
 * ───────────────────
 * Alternative considered: store region/continent/resource_distribution in the
 * MapDefinition database entity. Rejected for V1 because:
 *   1. The entity schema already has regions[] but not territories[].
 *   2. Storing all 36 territories × full resource_distribution in the DB adds
 *      significant write overhead and sync complexity.
 *   3. The V1 map is static — it never changes at runtime.
 *   4. A backend-safe JS module is simpler, easier to review, and fully testable.
 *
 * Future: When multi-map support or custom maps are added, this should be
 * replaced by loading map metadata from the MapDefinition entity + a
 * TerritoryDefinition entity.
 */

// ─── Resource distribution presets (must match mapData.ts RES constants) ──────
// Weights sum to 100. Used for 1-resource-per-territory roll each deploy round.

const RES = {
  mountains: { brick: 10, lumber: 5,  wool: 5,  grain: 10, ore: 70 },
  forest:    { brick: 5,  lumber: 60, wool: 15, grain: 10, ore: 10 },
  swamp:     { brick: 15, lumber: 20, wool: 30, grain: 25, ore: 10 },
  tundra:    { brick: 20, lumber: 10, wool: 15, grain: 15, ore: 40 },
  coastal:   { brick: 10, lumber: 10, wool: 35, grain: 30, ore: 15 },
  desert:    { brick: 30, lumber: 5,  wool: 10, grain: 15, ore: 40 },
  urban:     { brick: 25, lumber: 15, wool: 15, grain: 15, ore: 30 },
  plains:    { brick: 10, lumber: 15, wool: 20, grain: 50, ore: 5  },
};

// ─── V1 Standard Map metadata ──────────────────────────────────────────────────

export const MAP_V1_METADATA = {
  id: 'map_v1_standard',

  continents: [
    { id: 'northlands', control_bonus: 7 },
    { id: 'southlands', control_bonus: 9 },
  ],

  regions: [
    { id: 'north_coast',  continent_id: 'northlands', control_bonus: 2 },
    { id: 'west_reach',   continent_id: 'northlands', control_bonus: 2 },
    { id: 'heartland',    continent_id: 'northlands', control_bonus: 3 },
    { id: 'east_shore',   continent_id: 'northlands', control_bonus: 2 },
    { id: 'south_plains', continent_id: 'southlands', control_bonus: 3 },
    { id: 'far_south',    continent_id: 'southlands', control_bonus: 2 },
  ],

  // territory_id → { region_id, continent_id, resource_distribution }
  territories: {
    // North Coast
    frost_peak:     { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.mountains },
    irongate:       { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.urban     },
    tundra_flats:   { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.tundra   },
    glacier_pass:   { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.tundra   },
    stormwatch:     { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.coastal  },
    crow_harbor:    { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.coastal  },
    pale_cliffs:    { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.coastal  },
    veil_crossing:  { region_id: 'north_coast',  continent_id: 'northlands', resource_distribution: RES.plains   },

    // Western Reaches
    ashwood:          { region_id: 'west_reach', continent_id: 'northlands', resource_distribution: RES.forest    },
    redstone_ridge:   { region_id: 'west_reach', continent_id: 'northlands', resource_distribution: RES.mountains },
    dustmarsh:        { region_id: 'west_reach', continent_id: 'northlands', resource_distribution: RES.swamp     },
    saltfen:          { region_id: 'west_reach', continent_id: 'northlands', resource_distribution: RES.swamp     },
    verdant_vale:     { region_id: 'west_reach', continent_id: 'northlands', resource_distribution: RES.plains    },
    greywood:         { region_id: 'west_reach', continent_id: 'northlands', resource_distribution: RES.forest    },

    // Heartland
    heartlands:       { region_id: 'heartland',  continent_id: 'northlands', resource_distribution: RES.plains    },
    golden_citadel:   { region_id: 'heartland',  continent_id: 'northlands', resource_distribution: RES.urban     },
    iron_ridge:       { region_id: 'heartland',  continent_id: 'northlands', resource_distribution: RES.mountains },
    stonefield:       { region_id: 'heartland',  continent_id: 'northlands', resource_distribution: RES.plains    },
    the_crossing:     { region_id: 'heartland',  continent_id: 'northlands', resource_distribution: RES.plains    },
    ember_vale:       { region_id: 'heartland',  continent_id: 'northlands', resource_distribution: RES.plains    },
    deepstone:        { region_id: 'heartland',  continent_id: 'northlands', resource_distribution: RES.mountains },

    // Eastern Shore
    ember_coast:      { region_id: 'east_shore', continent_id: 'northlands', resource_distribution: RES.coastal   },
    blackstone:       { region_id: 'east_shore', continent_id: 'northlands', resource_distribution: RES.mountains },
    iron_coast:       { region_id: 'east_shore', continent_id: 'northlands', resource_distribution: RES.coastal   },
    scalewood:        { region_id: 'east_shore', continent_id: 'northlands', resource_distribution: RES.forest    },
    the_bastion:      { region_id: 'east_shore', continent_id: 'northlands', resource_distribution: RES.urban     },
    ashfen_coast:     { region_id: 'east_shore', continent_id: 'northlands', resource_distribution: RES.coastal   },
    ridgeline:        { region_id: 'east_shore', continent_id: 'northlands', resource_distribution: RES.mountains },

    // Southern Plains
    sunken_delta:     { region_id: 'south_plains', continent_id: 'southlands', resource_distribution: RES.swamp  },
    dustplains:       { region_id: 'south_plains', continent_id: 'southlands', resource_distribution: RES.desert },
    amber_fields:     { region_id: 'south_plains', continent_id: 'southlands', resource_distribution: RES.plains },
    sunspire:         { region_id: 'south_plains', continent_id: 'southlands', resource_distribution: RES.desert },
    verdant_basin:    { region_id: 'south_plains', continent_id: 'southlands', resource_distribution: RES.plains },

    // Far South
    sea_gate:         { region_id: 'far_south', continent_id: 'southlands', resource_distribution: RES.coastal },
    crimson_shore:    { region_id: 'far_south', continent_id: 'southlands', resource_distribution: RES.coastal },
    southern_reach:   { region_id: 'far_south', continent_id: 'southlands', resource_distribution: RES.plains  },
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const MAP_METADATA_REGISTRY = {
  [MAP_V1_METADATA.id]: MAP_V1_METADATA,
};

/**
 * getMapMetadata
 * Returns the backend-safe map metadata for a given map ID.
 * Returns null if map is not registered.
 * @param {string} mapId
 * @returns {object|null}
 */
export function getMapMetadata(mapId) {
  return MAP_METADATA_REGISTRY[mapId] ?? null;
}

/**
 * getTerritoriesForMap
 * Returns an array of { territory_id, region_id, continent_id, resource_distribution }
 * suitable for income/resource calculation functions.
 * @param {string} mapId
 * @returns {Array}
 */
export function getTerritoriesForMap(mapId) {
  const meta = getMapMetadata(mapId);
  if (!meta) return [];
  return Object.entries(meta.territories).map(([tid, data]) => ({
    territory_id: tid,
    ...data,
  }));
}