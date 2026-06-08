/**
 * shared/maps/shatteredCrownConfig.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CANONICAL SOURCE OF TRUTH — The Shattered Crown map configuration.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This file is the single source of truth for all Shattered Crown territory
 * metadata and adjacency data. It is pure data — no framework dependencies,
 * no side effects, safe to import from any frontend file.
 *
 * CONSUMERS:
 *   Frontend:  Import directly. Use SC_TERRITORIES, SC_ADJACENCY, SC_TERRITORY_BY_ID.
 *   Backend:   Cannot import (Deno deploy prohibits local imports). Inline blocks
 *              in backend functions are mechanically derived from this file and
 *              annotated with "SOURCE OF TRUTH: shared/maps/shatteredCrownConfig.ts".
 *              Do not edit backend inline blocks manually — update here first,
 *              then propagate to: attackPhase, fortifyPhase, resourcePhase.
 *
 * CAPACITY RULE:
 *   Every territory must satisfy: resources_count + structure_slots.length === 4
 *   where resources_count = 1 (primary) + (secondary ? 1 : 0) + (tertiary ? 1 : 0).
 *   So: 1 resource → 3 slots, 2 resources → 2 slots, 3 resources → 1 slot.
 *
 * NOT IMPLEMENTED YET (Sprint 4A — data foundation only):
 *   - Secondary/tertiary resource generation
 *   - Structure slot enforcement
 *   - Food bonus generation
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SCResourceType = 'gold' | 'iron' | 'timber' | 'stone' | 'food';
export type SCSlotType     = 'military' | 'economic' | 'diplomatic' | 'omni';
export type SCAdjacencyType = 'land' | 'maritime' | 'river_crossing';

export interface SCTerritoryConfig {
  territory_id:        string;
  name:                string;
  continent_id:        string;
  region_id:           string;
  primary_resource:    SCResourceType;
  secondary_resource?: SCResourceType;
  tertiary_resource?:  SCResourceType;
  /** Structure slot types available in this territory */
  structure_slots:     SCSlotType[];
  /** Extra food income bonus (future mechanic — not active in Sprint 4A) */
  food_bonus:          number;
}

export interface SCTypedAdjacency {
  from: string;
  to:   string;
  type: SCAdjacencyType;
}

// ─── Territory Definitions ────────────────────────────────────────────────────
// 44 territories across 5 continents / 11 regions.
// Capacity rule: primary(1) + secondary(0|1) + tertiary(0|1) + slots.length === 4

export const SC_TERRITORIES: SCTerritoryConfig[] = [

  // ── IRONSPINE ─────────────────────────────────────────────────────────────
  // Continent: ironspine | Regions: outer_passes (I1,I2,I3,I6), high_crown (I4,I5,I7,I8)
  // Ironspine is iron/stone dominant — mountain peaks and coastal cliffs.

  // outer_passes
  {
    territory_id: 'I1', name: 'Frostgate',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'I2', name: 'Northpass',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'iron', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'I3', name: 'Cliffwatch',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'I6', name: 'Ridgefall',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'stone', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },

  // high_crown
  {
    territory_id: 'I4', name: 'Greyhold',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'I5', name: 'Crownforge',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'iron', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'I7', name: 'Basinwatch',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'I8', name: 'Eastspire',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'stone', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },

  // ── WILD FRONTIER ─────────────────────────────────────────────────────────
  // Continent: wild_frontier | Regions: northern_wilds (W1,W2,W3,W6), deepwoods (W4,W5,W7,W8,W9)
  // Timber dominant. W9 is a trade ford (gold primary).

  // northern_wilds
  {
    territory_id: 'W1', name: 'Thornwood Edge',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'W2', name: 'Greenmarch',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'timber',
    structure_slots: ['economic', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'W3', name: 'Broken Pines',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'W6', name: 'Emberwood',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'timber',
    structure_slots: ['economic', 'omni'],
    food_bonus: 1,
  },

  // deepwoods
  {
    territory_id: 'W4', name: 'Mossfen',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'food', secondary_resource: 'timber',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'W5', name: 'Wildcross',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'timber', secondary_resource: 'food',
    structure_slots: ['military', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'W7', name: 'Lowbranch',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'food', secondary_resource: 'timber',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'W8', name: 'Riverholt',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'food', secondary_resource: 'timber',
    structure_slots: ['economic', 'omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'W9', name: 'Ashen Ford',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'gold', secondary_resource: 'timber',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },

  // ── FRACTURE BASIN ────────────────────────────────────────────────────────
  // Continent: fracture_basin | Regions: northern_ruins (B1,B2,B3), central_crossroads (B4,B5,B6,B7), southern_ruins (B8,B9,B10)
  // Most contested — mixed resources.

  // northern_ruins
  {
    territory_id: 'B1', name: 'North Ruin Gate',
    continent_id: 'fracture_basin', region_id: 'northern_ruins',
    primary_resource: 'stone', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B2', name: 'Old Bastion',
    continent_id: 'fracture_basin', region_id: 'northern_ruins',
    primary_resource: 'stone', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B3', name: 'Highbridge',
    continent_id: 'fracture_basin', region_id: 'northern_ruins',
    primary_resource: 'gold', secondary_resource: 'stone',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },

  // central_crossroads
  {
    territory_id: 'B4', name: 'East Rupture',
    continent_id: 'fracture_basin', region_id: 'central_crossroads',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B5', name: 'West Crucible',
    continent_id: 'fracture_basin', region_id: 'central_crossroads',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B6', name: 'Crownbreak',
    continent_id: 'fracture_basin', region_id: 'central_crossroads',
    primary_resource: 'gold', secondary_resource: 'iron',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B7', name: 'Glass Rift',
    continent_id: 'fracture_basin', region_id: 'central_crossroads',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 0,
  },

  // southern_ruins
  {
    territory_id: 'B8', name: 'Southwatch Ruins',
    continent_id: 'fracture_basin', region_id: 'southern_ruins',
    primary_resource: 'food', secondary_resource: 'stone',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'B9', name: 'Golden Causeway',
    continent_id: 'fracture_basin', region_id: 'southern_ruins',
    primary_resource: 'gold', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B10', name: 'Riftmarket',
    continent_id: 'fracture_basin', region_id: 'southern_ruins',
    primary_resource: 'gold', secondary_resource: 'stone',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },

  // ── SUNFIELDS ─────────────────────────────────────────────────────────────
  // Continent: sunfields | Regions: western_plains (S1,S2,S3,S4), eastern_granaries (S5,S6,S7,S8,S9)
  // Food dominant — grain breadbasket of the map.

  // western_plains
  {
    territory_id: 'S1', name: 'Westmeadow',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'food', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'S2', name: 'Sunroad',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'food', secondary_resource: 'gold',
    structure_slots: ['economic', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'S3', name: 'Harvest Ford',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'food', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'S4', name: 'Amberhold',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'food', secondary_resource: 'food',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 2,
  },

  // eastern_granaries
  {
    territory_id: 'S5', name: 'Granary Cross',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'food', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'S6', name: 'Dawnmarch',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'gold', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'S7', name: 'South Orchard',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'food', secondary_resource: 'food',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'S8', name: 'Lowgold',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'gold', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'S9', name: 'Coastward Fields',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'gold', secondary_resource: 'food',
    structure_slots: ['economic', 'omni'],
    food_bonus: 1,
  },

  // ── SHATTERED COAST ───────────────────────────────────────────────────────
  // Continent: shattered_coast | Regions: northern_isles (C1,C2,C3), southern_fractures (C4,C5,C6,C7,C8)
  // Gold/stone coastal — maritime trade and cliffs.

  // northern_isles
  {
    territory_id: 'C1', name: 'Northcliff',
    continent_id: 'shattered_coast', region_id: 'northern_isles',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'C2', name: 'Saltwind Pass',
    continent_id: 'shattered_coast', region_id: 'northern_isles',
    primary_resource: 'gold', secondary_resource: 'stone',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'C3', name: 'Broken Harbor',
    continent_id: 'shattered_coast', region_id: 'northern_isles',
    primary_resource: 'gold', secondary_resource: 'iron',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },

  // southern_fractures
  {
    territory_id: 'C4', name: 'Blacktide Gate',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'C5', name: 'Shardport',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'gold', secondary_resource: 'stone',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'C6', name: 'Mirror Cape',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'timber', secondary_resource: 'gold',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'C7', name: 'Tidebreak',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'food', secondary_resource: 'gold',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 1,
  },
  {
    territory_id: 'C8', name: 'Southwake',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
];

// ─── Typed Adjacency List ─────────────────────────────────────────────────────
// Every edge is listed once. The helper functions in mapAdjacency.js treat all
// edges as bidirectional (A→B implies B→A).
//
// Types:
//   land           — standard ground movement
//   maritime       — coastal/sea crossing (no restriction in Sprint 4A)
//   river_crossing — single river ford (exactly 1 in this map: B10↔S3)
//
// Sprint 4A: all types are traversable for combat and fortification.
// Future sprints may restrict maritime/river_crossing based on unit type.

export const SC_ADJACENCY: SCTypedAdjacency[] = [
  // ── IRONSPINE internal ───────────────────────────────────────────────────
  { from:'I1', to:'I2', type:'land' },
  { from:'I1', to:'I4', type:'land' },
  { from:'I2', to:'I3', type:'land' },
  { from:'I2', to:'I5', type:'land' },
  { from:'I3', to:'I6', type:'land' },
  { from:'I4', to:'I5', type:'land' },
  { from:'I4', to:'I7', type:'land' },
  { from:'I5', to:'I6', type:'land' },
  { from:'I5', to:'I7', type:'land' },
  { from:'I6', to:'I8', type:'land' },
  { from:'I7', to:'I8', type:'land' },

  // ── IRONSPINE ↔ WILD FRONTIER ─────────────────────────────────────────
  { from:'I1', to:'W1', type:'land' },
  { from:'I4', to:'W2', type:'land' },

  // ── IRONSPINE ↔ FRACTURE BASIN ────────────────────────────────────────
  { from:'I2', to:'B1', type:'land' },
  { from:'I5', to:'B2', type:'land' },
  { from:'I7', to:'B3', type:'land' },
  { from:'I8', to:'B4', type:'land' },

  // ── IRONSPINE ↔ SHATTERED COAST ───────────────────────────────────────
  { from:'I3', to:'C1', type:'maritime' },
  { from:'I6', to:'C2', type:'maritime' },
  { from:'I8', to:'C3', type:'maritime' },

  // ── WILD FRONTIER internal ────────────────────────────────────────────
  { from:'W1', to:'W2', type:'land' },
  { from:'W1', to:'W4', type:'land' },
  { from:'W2', to:'W3', type:'land' },
  { from:'W2', to:'W5', type:'land' },
  { from:'W3', to:'W6', type:'land' },
  { from:'W4', to:'W5', type:'land' },
  { from:'W4', to:'W7', type:'land' },
  { from:'W5', to:'W6', type:'land' },
  { from:'W5', to:'W8', type:'land' },
  { from:'W6', to:'W9', type:'land' },
  { from:'W7', to:'W8', type:'land' },
  { from:'W8', to:'W9', type:'land' },

  // ── WILD FRONTIER ↔ FRACTURE BASIN ────────────────────────────────────
  { from:'W3', to:'B1', type:'land' },
  { from:'W5', to:'B2', type:'land' },
  { from:'W6', to:'B5', type:'land' },
  { from:'W9', to:'B6', type:'land' },

  // ── WILD FRONTIER ↔ SUNFIELDS ─────────────────────────────────────────
  { from:'W7', to:'S1', type:'land' },
  { from:'W8', to:'S2', type:'land' },
  { from:'W9', to:'S3', type:'land' },

  // ── FRACTURE BASIN internal ───────────────────────────────────────────
  { from:'B1', to:'B2', type:'land' },
  { from:'B1', to:'B5', type:'land' },
  { from:'B2', to:'B3', type:'land' },
  { from:'B2', to:'B5', type:'land' },
  { from:'B3', to:'B4', type:'land' },
  { from:'B3', to:'B6', type:'land' },
  { from:'B4', to:'B7', type:'land' },
  { from:'B5', to:'B6', type:'land' },
  { from:'B5', to:'B8', type:'land' },
  { from:'B6', to:'B7', type:'land' },
  { from:'B6', to:'B9', type:'land' },
  { from:'B7', to:'B10', type:'land' },
  { from:'B8', to:'B9', type:'land' },
  { from:'B9', to:'B10', type:'land' },

  // ── FRACTURE BASIN ↔ SHATTERED COAST ──────────────────────────────────
  { from:'B4', to:'C3', type:'maritime' },
  { from:'B7', to:'C4', type:'maritime' },
  { from:'B10', to:'C6', type:'maritime' },

  // ── FRACTURE BASIN ↔ SUNFIELDS ────────────────────────────────────────
  { from:'B8', to:'S3', type:'river_crossing' },  // The single river crossing
  { from:'B9', to:'S5', type:'land' },
  { from:'B10', to:'S6', type:'land' },

  // ── SUNFIELDS internal ────────────────────────────────────────────────
  { from:'S1', to:'S2', type:'land' },
  { from:'S1', to:'S4', type:'land' },
  { from:'S2', to:'S3', type:'land' },
  { from:'S2', to:'S5', type:'land' },
  { from:'S3', to:'S6', type:'land' },
  { from:'S4', to:'S5', type:'land' },
  { from:'S4', to:'S7', type:'land' },
  { from:'S5', to:'S6', type:'land' },
  { from:'S5', to:'S8', type:'land' },
  { from:'S6', to:'S9', type:'land' },
  { from:'S7', to:'S8', type:'land' },
  { from:'S8', to:'S9', type:'land' },

  // ── SHATTERED COAST internal ──────────────────────────────────────────
  { from:'C1', to:'C2', type:'maritime' },
  { from:'C1', to:'C4', type:'maritime' },
  { from:'C2', to:'C3', type:'maritime' },
  { from:'C2', to:'C5', type:'maritime' },
  { from:'C3', to:'C5', type:'maritime' },
  { from:'C4', to:'C5', type:'maritime' },
  { from:'C4', to:'C6', type:'maritime' },
  { from:'C5', to:'C6', type:'maritime' },
  { from:'C5', to:'C7', type:'maritime' },
  { from:'C6', to:'C7', type:'maritime' },
  { from:'C6', to:'C8', type:'maritime' },
  { from:'C7', to:'C8', type:'maritime' },

  // ── SHATTERED COAST ↔ SUNFIELDS ───────────────────────────────────────
  { from:'C8', to:'S9', type:'maritime' },
];

// ─── Lookup Maps ──────────────────────────────────────────────────────────────

/** territory_id → SCTerritoryConfig. O(1) lookup. */
export const SC_TERRITORY_BY_ID: Readonly<Record<string, SCTerritoryConfig>> =
  Object.freeze(Object.fromEntries(SC_TERRITORIES.map(t => [t.territory_id, t])));

/** territory_id → primary_resource. Convenience for resource generation. */
export const SC_PRIMARY_RESOURCE_BY_ID: Readonly<Record<string, SCResourceType>> =
  Object.freeze(Object.fromEntries(SC_TERRITORIES.map(t => [t.territory_id, t.primary_resource])));

/** All valid territory IDs as a Set for fast membership checks. */
export const SC_TERRITORY_ID_SET: ReadonlySet<string> =
  Object.freeze(new Set(SC_TERRITORIES.map(t => t.territory_id)));

/**
 * SC_PRIMARY_RESOURCES_FLAT
 * Plain object of territory_id → primary_resource.
 * Used by backend inline blocks — copy this object verbatim into backend functions.
 *
 * ─── BACKEND INLINE BLOCK ────────────────────────────────────────────────────
 * SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_PRIMARY_RESOURCES_FLAT
 * Do not edit backend inline blocks manually. Update here, then propagate.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SC_PRIMARY_RESOURCES_FLAT: Record<string, SCResourceType> = {
  I1:'iron',  I2:'iron',  I3:'stone', I4:'iron',  I5:'iron',
  I6:'stone', I7:'iron',  I8:'stone',
  W1:'timber',W2:'timber',W3:'timber',W4:'food',  W5:'timber',
  W6:'timber',W7:'food',  W8:'food',  W9:'gold',
  B1:'stone', B2:'stone', B3:'gold',  B4:'iron',  B5:'iron',
  B6:'gold',  B7:'stone', B8:'food',  B9:'gold',  B10:'gold',
  S1:'food',  S2:'food',  S3:'food',  S4:'food',  S5:'food',
  S6:'gold',  S7:'food',  S8:'gold',  S9:'gold',
  C1:'stone', C2:'gold',  C3:'gold',  C4:'iron',  C5:'gold',
  C6:'timber',C7:'food',  C8:'stone',
};

// ─── Validation Helpers ───────────────────────────────────────────────────────

/** Returns all valid territory IDs as an array (for iteration). */
export function getAllTerritoryIds(): string[] {
  return SC_TERRITORIES.map(t => t.territory_id);
}

/** Returns all territory configs for a given region. */
export function getTerritoriesByRegion(regionId: string): SCTerritoryConfig[] {
  return SC_TERRITORIES.filter(t => t.region_id === regionId);
}

/** Returns all territory configs for a given continent. */
export function getTerritoriesByContinent(continentId: string): SCTerritoryConfig[] {
  return SC_TERRITORIES.filter(t => t.continent_id === continentId);
}

/**
 * capacityPointsFor
 * Returns the capacity point total for a territory (should equal 4).
 * resources = 1 (primary) + (secondary ? 1 : 0) + (tertiary ? 1 : 0)
 * capacity  = resources + structure_slots.length
 */
export function capacityPointsFor(t: SCTerritoryConfig): number {
  const resourceCount = 1
    + (t.secondary_resource != null ? 1 : 0)
    + (t.tertiary_resource  != null ? 1 : 0);
  return resourceCount + t.structure_slots.length;
}