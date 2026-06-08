/**
 * shared/maps/shatteredCrownConfig.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CANONICAL SOURCE OF TRUTH — The Shattered Crown map configuration.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Sprint 4A.1: Fully reconciled against "Shattered Crown Territory Dataset v1.0"
 * (approved source-of-truth). All territory metadata, region assignments,
 * resources, structure slots, food bonuses, and adjacency edges replaced.
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
 * RESOURCE GENERATION CHANCES:
 *   primary:   1.0  (always generated)
 *   secondary: 0.4  (40% chance per round)
 *   tertiary:  0.1  (10% chance per round)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SCResourceType   = 'gold' | 'iron' | 'timber' | 'stone' | 'food';
export type SCSlotType       = 'military' | 'economic' | 'diplomatic' | 'omni';
export type SCAdjacencyType  = 'land' | 'maritime' | 'river_crossing';

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

/** Resource generation probability per tier. */
export const SC_RESOURCE_GENERATION_CHANCE = {
  primary:   1.0,
  secondary: 0.4,
  tertiary:  0.1,
} as const;

// ─── Territory Definitions ────────────────────────────────────────────────────
// 44 territories across 5 continents / 11 regions.
// Capacity rule: primary(1) + secondary(0|1) + tertiary(0|1) + slots.length === 4

export const SC_TERRITORIES: SCTerritoryConfig[] = [

  // ── IRONSPINE ─────────────────────────────────────────────────────────────
  // Continent: ironspine
  // Regions: outer_passes (I8,I4,I6,I7), high_crown (I1,I2,I3,I5)

  // outer_passes
  {
    territory_id: 'I8', name: 'Eastspire',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'iron', secondary_resource: 'iron', tertiary_resource: 'iron',
    structure_slots: ['military'],
    food_bonus: 0,
  },
  {
    territory_id: 'I4', name: 'Greyhold',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'iron', secondary_resource: 'gold',
    structure_slots: ['military', 'economic'],
    food_bonus: 0,
  },
  {
    territory_id: 'I6', name: 'Ridgefall',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'timber', secondary_resource: 'stone',
    structure_slots: ['economic', 'military'],
    food_bonus: 0,
  },
  {
    territory_id: 'I7', name: 'Basinwatch',
    continent_id: 'ironspine', region_id: 'outer_passes',
    primary_resource: 'timber', secondary_resource: 'gold',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 0,
  },

  // high_crown
  {
    territory_id: 'I1', name: 'Frostgate',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'iron', secondary_resource: 'iron', tertiary_resource: 'stone',
    structure_slots: ['military'],
    food_bonus: 0,
  },
  {
    territory_id: 'I2', name: 'Northpass',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'I3', name: 'Cliffwatch',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'stone', secondary_resource: 'stone',
    structure_slots: ['diplomatic', 'diplomatic'],
    food_bonus: 0,
  },
  {
    territory_id: 'I5', name: 'Crownforge',
    continent_id: 'ironspine', region_id: 'high_crown',
    primary_resource: 'stone', secondary_resource: 'iron',
    structure_slots: ['diplomatic', 'military'],
    food_bonus: 0,
  },

  // ── WILD FRONTIER ─────────────────────────────────────────────────────────
  // Continent: wild_frontier
  // Regions: northern_wilds (W1,W2,W3,W4,W5), deepwoods (W6,W7,W8,W9)

  // northern_wilds
  {
    territory_id: 'W1', name: 'Thornwood Edge',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'timber',
    structure_slots: ['military', 'military'],
    food_bonus: 0,
  },
  {
    territory_id: 'W2', name: 'Greenmarch',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'stone', secondary_resource: 'timber',
    structure_slots: ['diplomatic', 'economic'],
    food_bonus: 0,
  },
  {
    territory_id: 'W3', name: 'Broken Pines',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'timber', tertiary_resource: 'gold',
    structure_slots: ['economic'],
    food_bonus: 0,
  },
  {
    territory_id: 'W4', name: 'Mossfen',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'stone',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 0,
  },
  {
    territory_id: 'W5', name: 'Wildcross',
    continent_id: 'wild_frontier', region_id: 'northern_wilds',
    primary_resource: 'timber', secondary_resource: 'timber', tertiary_resource: 'timber',
    structure_slots: ['omni'],
    food_bonus: 0,
  },

  // deepwoods
  {
    territory_id: 'W6', name: 'Emberwood',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'timber', secondary_resource: 'stone',
    structure_slots: ['economic', 'economic'],
    food_bonus: 0,
  },
  {
    territory_id: 'W7', name: 'Lowbranch',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'gold', secondary_resource: 'timber',
    structure_slots: ['economic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'W8', name: 'Riverholt',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'gold', secondary_resource: 'timber',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 0,
  },
  {
    territory_id: 'W9', name: 'Ashen Ford',
    continent_id: 'wild_frontier', region_id: 'deepwoods',
    primary_resource: 'iron', secondary_resource: 'timber',
    structure_slots: ['military', 'economic'],
    food_bonus: 0,
  },

  // ── FRACTURE BASIN ────────────────────────────────────────────────────────
  // Continent: fracture_basin
  // Regions: northern_ruins (B1,B3,B2,B4), central_crossroads (B5,B6,B7), southern_ruins (B8,B9,B10)

  // northern_ruins
  {
    territory_id: 'B1', name: 'North Ruin Gate',
    continent_id: 'fracture_basin', region_id: 'northern_ruins',
    primary_resource: 'stone', secondary_resource: 'iron',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 0,
  },
  {
    territory_id: 'B3', name: 'Highbridge',
    continent_id: 'fracture_basin', region_id: 'northern_ruins',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B2', name: 'Old Bastion',
    continent_id: 'fracture_basin', region_id: 'northern_ruins',
    primary_resource: 'stone',
    structure_slots: ['diplomatic', 'diplomatic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B4', name: 'East Rupture',
    continent_id: 'fracture_basin', region_id: 'northern_ruins',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 0,
  },

  // central_crossroads
  {
    territory_id: 'B5', name: 'West Crucible',
    continent_id: 'fracture_basin', region_id: 'central_crossroads',
    primary_resource: 'iron', secondary_resource: 'stone',
    structure_slots: ['military', 'military'],
    food_bonus: 0,
  },
  {
    territory_id: 'B6', name: 'Crownbreak',
    continent_id: 'fracture_basin', region_id: 'central_crossroads',
    primary_resource: 'stone',
    structure_slots: ['diplomatic', 'diplomatic', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'B7', name: 'Glass Rift',
    continent_id: 'fracture_basin', region_id: 'central_crossroads',
    primary_resource: 'stone', secondary_resource: 'iron',
    structure_slots: ['military', 'economic'],
    food_bonus: 0,
  },

  // southern_ruins
  {
    territory_id: 'B8', name: 'Southwatch Ruins',
    continent_id: 'fracture_basin', region_id: 'southern_ruins',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['diplomatic', 'military'],
    food_bonus: 0,
  },
  {
    territory_id: 'B9', name: 'Golden Causeway',
    continent_id: 'fracture_basin', region_id: 'southern_ruins',
    primary_resource: 'iron', secondary_resource: 'gold',
    structure_slots: ['military', 'economic'],
    food_bonus: 0,
  },
  {
    territory_id: 'B10', name: 'Riftmarket',
    continent_id: 'fracture_basin', region_id: 'southern_ruins',
    primary_resource: 'gold', secondary_resource: 'gold', tertiary_resource: 'stone',
    structure_slots: ['omni'],
    food_bonus: 0,
  },

  // ── SUNFIELDS ─────────────────────────────────────────────────────────────
  // Continent: sunfields
  // Regions: western_plains (S1,S4,S7,S2), eastern_granaries (S5,S8,S3,S6,S9)

  // western_plains
  {
    territory_id: 'S1', name: 'Westmeadow',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'timber', secondary_resource: 'gold',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 1,
  },
  {
    territory_id: 'S4', name: 'Amberhold',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'gold', secondary_resource: 'timber',
    structure_slots: ['economic', 'economic'],
    food_bonus: 1,
  },
  {
    territory_id: 'S7', name: 'South Orchard',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'timber', secondary_resource: 'gold',
    structure_slots: ['economic', 'diplomatic'],
    food_bonus: 1,
  },
  {
    territory_id: 'S2', name: 'Sunroad',
    continent_id: 'sunfields', region_id: 'western_plains',
    primary_resource: 'gold', secondary_resource: 'stone',
    structure_slots: ['diplomatic', 'omni'],
    food_bonus: 1,
  },

  // eastern_granaries
  {
    territory_id: 'S5', name: 'Granary Cross',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'gold', secondary_resource: 'gold', tertiary_resource: 'gold',
    structure_slots: ['omni'],
    food_bonus: 2,
  },
  {
    territory_id: 'S8', name: 'Lowgold',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'gold', secondary_resource: 'gold',
    structure_slots: ['economic', 'economic'],
    food_bonus: 2,
  },
  {
    territory_id: 'S3', name: 'Harvest Ford',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'iron', secondary_resource: 'iron',
    structure_slots: ['military', 'economic'],
    food_bonus: 2,
  },
  {
    territory_id: 'S6', name: 'Dawnmarch',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['diplomatic', 'diplomatic'],
    food_bonus: 2,
  },
  {
    territory_id: 'S9', name: 'Coastward Fields',
    continent_id: 'sunfields', region_id: 'eastern_granaries',
    primary_resource: 'iron', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 2,
  },

  // ── SHATTERED COAST ───────────────────────────────────────────────────────
  // Continent: shattered_coast
  // Regions: northern_isles (C1,C2,C3,C4), southern_fractures (C5,C6,C7,C8)

  // northern_isles
  {
    territory_id: 'C1', name: 'Northcliff',
    continent_id: 'shattered_coast', region_id: 'northern_isles',
    primary_resource: 'iron', secondary_resource: 'gold',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 0,
  },
  {
    territory_id: 'C2', name: 'Saltwind Pass',
    continent_id: 'shattered_coast', region_id: 'northern_isles',
    primary_resource: 'gold', secondary_resource: 'stone',
    structure_slots: ['military', 'economic'],
    food_bonus: 0,
  },
  {
    territory_id: 'C3', name: 'Broken Harbor',
    continent_id: 'shattered_coast', region_id: 'northern_isles',
    primary_resource: 'iron', secondary_resource: 'iron',
    structure_slots: ['military', 'omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'C4', name: 'Blacktide Gate',
    continent_id: 'shattered_coast', region_id: 'northern_isles',
    primary_resource: 'gold', secondary_resource: 'gold', tertiary_resource: 'timber',
    structure_slots: ['omni'],
    food_bonus: 0,
  },

  // southern_fractures
  {
    territory_id: 'C5', name: 'Shardport',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'gold', secondary_resource: 'timber',
    structure_slots: ['economic', 'diplomatic'],
    food_bonus: 0,
  },
  {
    territory_id: 'C6', name: 'Mirror Cape',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'gold', secondary_resource: 'gold', tertiary_resource: 'gold',
    structure_slots: ['omni'],
    food_bonus: 0,
  },
  {
    territory_id: 'C7', name: 'Southwake',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'stone', secondary_resource: 'gold',
    structure_slots: ['diplomatic', 'diplomatic'],
    food_bonus: 0,
  },
  {
    territory_id: 'C8', name: 'Tidebreak',
    continent_id: 'shattered_coast', region_id: 'southern_fractures',
    primary_resource: 'gold', secondary_resource: 'timber',
    structure_slots: ['military', 'diplomatic'],
    food_bonus: 0,
  },
];

// ─── Typed Adjacency List ─────────────────────────────────────────────────────
// Every edge is listed once. The helper functions in mapAdjacency.js treat all
// edges as bidirectional (A→B implies B→A).
//
// Types:
//   land           — standard ground movement
//   maritime       — coastal/sea crossing
//   river_crossing — single river ford (B10↔S3)
//
// NOTE: C2↔C3 is land (not maritime).
//
// Sprint 4A: all types are traversable for combat and fortification.
// Future sprints may restrict maritime/river_crossing based on unit type.

export const SC_ADJACENCY: SCTypedAdjacency[] = [
  // ── IRONSPINE internal ───────────────────────────────────────────────────
  { from:'I8', to:'I4', type:'land' },
  { from:'I4', to:'I3', type:'land' },
  { from:'I4', to:'I7', type:'land' },
  { from:'I6', to:'I3', type:'land' },
  { from:'I6', to:'I5', type:'land' },
  { from:'I6', to:'I7', type:'land' },
  { from:'I1', to:'I2', type:'land' },
  { from:'I1', to:'I5', type:'land' },
  { from:'I2', to:'I3', type:'land' },
  { from:'I2', to:'I5', type:'land' },

  // ── IRONSPINE ↔ FRACTURE BASIN ────────────────────────────────────────
  { from:'I6', to:'B1', type:'land' },
  { from:'I7', to:'B1', type:'land' },
  { from:'I7', to:'B3', type:'land' },

  // ── IRONSPINE ↔ SHATTERED COAST ───────────────────────────────────────
  { from:'I8', to:'C1', type:'maritime' },

  // ── WILD FRONTIER internal ────────────────────────────────────────────
  { from:'W1', to:'W2', type:'land' },
  { from:'W2', to:'W3', type:'land' },
  { from:'W2', to:'W4', type:'land' },
  { from:'W2', to:'W5', type:'land' },
  { from:'W3', to:'W5', type:'land' },
  { from:'W3', to:'W6', type:'land' },
  { from:'W4', to:'W5', type:'land' },
  { from:'W4', to:'W7', type:'land' },
  { from:'W5', to:'W6', type:'land' },
  { from:'W5', to:'W7', type:'land' },
  { from:'W5', to:'W8', type:'land' },
  { from:'W6', to:'W9', type:'land' },
  { from:'W7', to:'W8', type:'land' },
  { from:'W8', to:'W9', type:'land' },

  // ── WILD FRONTIER ↔ SUNFIELDS ─────────────────────────────────────────
  { from:'W7', to:'S1', type:'land' },
  { from:'W9', to:'S2', type:'land' },

  // ── FRACTURE BASIN internal ───────────────────────────────────────────
  { from:'B1', to:'B3', type:'land' },
  { from:'B1', to:'B2', type:'land' },
  { from:'B3', to:'B2', type:'land' },
  { from:'B3', to:'B4', type:'land' },
  { from:'B2', to:'B4', type:'land' },
  { from:'B2', to:'B5', type:'land' },
  { from:'B2', to:'B6', type:'land' },
  { from:'B4', to:'B7', type:'land' },
  { from:'B5', to:'B6', type:'land' },
  { from:'B5', to:'B8', type:'land' },
  { from:'B6', to:'B7', type:'land' },
  { from:'B6', to:'B8', type:'land' },
  { from:'B6', to:'B9', type:'land' },
  { from:'B7', to:'B10', type:'land' },
  { from:'B8', to:'B9', type:'land' },
  { from:'B9', to:'B10', type:'land' },

  // ── FRACTURE BASIN ↔ SHATTERED COAST ──────────────────────────────────
  { from:'B10', to:'C6', type:'maritime' },
  { from:'B10', to:'C4', type:'maritime' },

  // ── FRACTURE BASIN ↔ SUNFIELDS ────────────────────────────────────────
  { from:'B10', to:'S3', type:'river_crossing' },  // The single river crossing

  // ── SUNFIELDS internal ────────────────────────────────────────────────
  { from:'S1', to:'S2', type:'land' },
  { from:'S1', to:'S4', type:'land' },
  { from:'S4', to:'S5', type:'land' },
  { from:'S4', to:'S7', type:'land' },
  { from:'S7', to:'S5', type:'land' },
  { from:'S7', to:'S8', type:'land' },
  { from:'S2', to:'S3', type:'land' },
  { from:'S2', to:'S5', type:'land' },
  { from:'S5', to:'S8', type:'land' },
  { from:'S5', to:'S6', type:'land' },
  { from:'S3', to:'S6', type:'land' },
  { from:'S6', to:'S9', type:'land' },

  // ── SUNFIELDS ↔ SHATTERED COAST ───────────────────────────────────────
  { from:'S6', to:'C8', type:'maritime' },
  { from:'S9', to:'C8', type:'maritime' },

  // ── SHATTERED COAST internal ──────────────────────────────────────────
  { from:'C1', to:'C2', type:'maritime' },
  { from:'C2', to:'C3', type:'land' },         // land connection (not maritime)
  { from:'C3', to:'C4', type:'maritime' },
  { from:'C3', to:'C5', type:'maritime' },
  { from:'C4', to:'C5', type:'maritime' },
  { from:'C4', to:'C6', type:'maritime' },
  { from:'C5', to:'C6', type:'maritime' },
  { from:'C5', to:'C7', type:'maritime' },
  { from:'C6', to:'C7', type:'maritime' },
  { from:'C6', to:'C8', type:'maritime' },
  { from:'C7', to:'C8', type:'maritime' },
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
  I1:'iron',  I2:'iron',  I3:'stone', I4:'iron',  I5:'stone',
  I6:'timber',I7:'timber',I8:'iron',
  W1:'timber',W2:'stone', W3:'timber',W4:'timber',W5:'timber',
  W6:'timber',W7:'gold',  W8:'gold',  W9:'iron',
  B1:'stone', B2:'stone', B3:'stone', B4:'stone', B5:'iron',
  B6:'stone', B7:'stone', B8:'stone', B9:'iron',  B10:'gold',
  S1:'timber',S2:'gold',  S3:'iron',  S4:'gold',  S5:'gold',
  S6:'stone', S7:'timber',S8:'gold',  S9:'iron',
  C1:'iron',  C2:'gold',  C3:'iron',  C4:'gold',  C5:'gold',
  C6:'gold',  C7:'stone', C8:'gold',
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