/**
 * services/maps/mapResourceTypes.js
 *
 * Sprint 3B canonical resource type assignments per territory.
 * Maps territory_id → primary resource type (gold | iron | timber | stone | food).
 *
 * Design principles:
 *   - Each territory produces exactly ONE resource type.
 *   - Assignment is terrain/lore-driven, not random.
 *   - Distributions are balanced per continent/region where possible.
 *
 * ─── V1 STANDARD MAP ─────────────────────────────────────────────────────────
 *
 * Territory → Resource assignments (36 territories):
 *
 * North Coast (8):
 *   frost_peak     → iron     (mountains)
 *   irongate       → gold     (urban trade hub)
 *   tundra_flats   → food     (harsh plains farming)
 *   glacier_pass   → stone    (tundra quarrying)
 *   stormwatch     → timber   (coastal lumber)
 *   crow_harbor    → gold     (major port — trade)
 *   pale_cliffs    → stone    (coastal cliffs)
 *   veil_crossing  → food     (plains farming)
 *
 * Western Reaches (6):
 *   ashwood        → timber   (dense forest)
 *   redstone_ridge → iron     (mountains)
 *   dustmarsh      → food     (swamp foraging)
 *   saltfen        → food     (marshland)
 *   verdant_vale   → food     (plains)
 *   greywood       → timber   (forest)
 *
 * Heartland (7):
 *   heartlands     → food     (agricultural center)
 *   golden_citadel → gold     (major city)
 *   iron_ridge     → iron     (mountains)
 *   stonefield     → stone    (plains quarrying)
 *   the_crossing   → gold     (trade nexus)
 *   ember_vale     → food     (plains)
 *   deepstone      → iron     (mountains)
 *
 * Eastern Shore (7):
 *   ember_coast    → gold     (coastal trade)
 *   blackstone     → iron     (mountains)
 *   iron_coast     → iron     (coastal mines)
 *   scalewood      → timber   (forest)
 *   the_bastion    → stone    (fortified urban)
 *   ashfen_coast   → food     (coastal plains)
 *   ridgeline      → stone    (mountain ridges)
 *
 * Southern Plains (5):
 *   sunken_delta   → food     (river delta farming)
 *   dustplains     → stone    (desert quarrying)
 *   amber_fields   → food     (plains)
 *   sunspire       → gold     (desert trade post)
 *   verdant_basin  → food     (fertile basin)
 *
 * Far South (3):
 *   sea_gate       → gold     (port — trade)
 *   crimson_shore  → gold     (coastal trade)
 *   southern_reach → food     (plains)
 *
 * Balance: gold=8, iron=6, timber=5, stone=6, food=11 / 36 total
 *
 * ─── SHATTERED CROWN MAP ─────────────────────────────────────────────────────
 *
 * Ironspine (8 territories — mountains dominate):
 *   I1 Frostgate     → iron     (mountain pass)
 *   I2 Northpass     → iron     (mountain pass)
 *   I3 Cliffwatch    → stone    (coastal cliffs)
 *   I4 Greyhold      → iron     (high mountain)
 *   I5 Crownforge    → iron     (forges in the peaks)
 *   I6 Ridgefall     → stone    (mountain ridge)
 *   I7 Basinwatch    → iron     (mountain watch)
 *   I8 Eastspire     → stone    (mountain spire)
 *   Balance: iron=5, stone=3
 *
 * Wild Frontier (9 territories — forest/plains):
 *   W1 Thornwood Edge → timber  (forest)
 *   W2 Greenmarch     → timber  (forest)
 *   W3 Broken Pines   → timber  (forest)
 *   W4 Mossfen        → food    (swamp foraging)
 *   W5 Wildcross      → timber  (forest crossroads)
 *   W6 Emberwood      → timber  (forest)
 *   W7 Lowbranch      → food    (plains)
 *   W8 Riverholt      → food    (plains river)
 *   W9 Ashen Ford     → gold    (trade ford crossing)
 *   Balance: timber=5, food=3, gold=1
 *
 * Fracture Basin (10 territories — contested ruins):
 *   B1  North Ruin Gate  → stone   (ruins quarrying)
 *   B2  Old Bastion      → stone   (fortified ruins)
 *   B3  Highbridge       → gold    (trade bridge)
 *   B4  East Rupture     → iron    (mountain rift)
 *   B5  West Crucible    → iron    (forge district)
 *   B6  Crownbreak       → gold    (central market)
 *   B7  Glass Rift       → stone   (crystal quarrying)
 *   B8  Southwatch Ruins → food    (plains ruins)
 *   B9  Golden Causeway  → gold    (trade causeway)
 *   B10 Riftmarket       → gold    (market district)
 *   Balance: stone=3, gold=4, iron=2, food=1
 *
 * Sunfields (9 territories — plains/farming):
 *   S1 Westmeadow      → food    (plains)
 *   S2 Sunroad         → food    (grain road)
 *   S3 Harvest Ford    → food    (harvest plains)
 *   S4 Amberhold       → food    (amber grain fields)
 *   S5 Granary Cross   → food    (granary hub)
 *   S6 Dawnmarch       → gold    (eastern market)
 *   S7 South Orchard   → food    (orchards)
 *   S8 Lowgold         → gold    (gold fields)
 *   S9 Coastward Fields→ gold    (coastal trade)
 *   Balance: food=6, gold=3
 *
 * Shattered Coast (8 territories — coastal):
 *   C1 Northcliff      → stone   (sea cliffs)
 *   C2 Saltwind Pass   → gold    (coastal trade)
 *   C3 Broken Harbor   → gold    (harbor trade)
 *   C4 Blacktide Gate  → iron    (fortified coast)
 *   C5 Shardport       → gold    (major port)
 *   C6 Mirror Cape     → timber  (coastal forest)
 *   C7 Tidebreak       → food    (coastal fishing)
 *   C8 Southwake       → stone   (southern cliffs)
 *   Balance: gold=3, stone=2, iron=1, timber=1, food=1
 *
 * Shattered Crown total: iron=8, stone=8, timber=6, food=10, gold=11 / 44 total
 */

// ─── V1 Standard Map resource types ──────────────────────────────────────────

export const V1_TERRITORY_RESOURCE_TYPES = {
  // North Coast
  frost_peak:     'iron',
  irongate:       'gold',
  tundra_flats:   'food',
  glacier_pass:   'stone',
  stormwatch:     'timber',
  crow_harbor:    'gold',
  pale_cliffs:    'stone',
  veil_crossing:  'food',
  // Western Reaches
  ashwood:        'timber',
  redstone_ridge: 'iron',
  dustmarsh:      'food',
  saltfen:        'food',
  verdant_vale:   'food',
  greywood:       'timber',
  // Heartland
  heartlands:     'food',
  golden_citadel: 'gold',
  iron_ridge:     'iron',
  stonefield:     'stone',
  the_crossing:   'gold',
  ember_vale:     'food',
  deepstone:      'iron',
  // Eastern Shore
  ember_coast:    'gold',
  blackstone:     'iron',
  iron_coast:     'iron',
  scalewood:      'timber',
  the_bastion:    'stone',
  ashfen_coast:   'food',
  ridgeline:      'stone',
  // Southern Plains
  sunken_delta:   'food',
  dustplains:     'stone',
  amber_fields:   'food',
  sunspire:       'gold',
  verdant_basin:  'food',
  // Far South
  sea_gate:       'gold',
  crimson_shore:  'gold',
  southern_reach: 'food',
};

// ─── Shattered Crown resource types ──────────────────────────────────────────

export const SHATTERED_CROWN_TERRITORY_RESOURCE_TYPES = {
  // Ironspine
  I1: 'iron',
  I2: 'iron',
  I3: 'stone',
  I4: 'iron',
  I5: 'iron',
  I6: 'stone',
  I7: 'iron',
  I8: 'stone',
  // Wild Frontier
  W1: 'timber',
  W2: 'timber',
  W3: 'timber',
  W4: 'food',
  W5: 'timber',
  W6: 'timber',
  W7: 'food',
  W8: 'food',
  W9: 'gold',
  // Fracture Basin
  B1:  'stone',
  B2:  'stone',
  B3:  'gold',
  B4:  'iron',
  B5:  'iron',
  B6:  'gold',
  B7:  'stone',
  B8:  'food',
  B9:  'gold',
  B10: 'gold',
  // Sunfields
  S1: 'food',
  S2: 'food',
  S3: 'food',
  S4: 'food',
  S5: 'food',
  S6: 'gold',
  S7: 'food',
  S8: 'gold',
  S9: 'gold',
  // Shattered Coast
  C1: 'stone',
  C2: 'gold',
  C3: 'gold',
  C4: 'iron',
  C5: 'gold',
  C6: 'timber',
  C7: 'food',
  C8: 'stone',
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const RESOURCE_TYPE_BY_MAP = {
  'map_v1_standard':    V1_TERRITORY_RESOURCE_TYPES,
  'shattered_crown_v1': SHATTERED_CROWN_TERRITORY_RESOURCE_TYPES,
};

/**
 * getResourceTypeForTerritory
 * Returns the primary resource type for a territory in a given map.
 * Defaults to 'food' if the territory or map is not found (safe fallback).
 *
 * @param {string} mapId
 * @param {string} territoryId
 * @returns {'gold'|'iron'|'timber'|'stone'|'food'}
 */
export function getResourceTypeForTerritory(mapId, territoryId) {
  const mapTypes = RESOURCE_TYPE_BY_MAP[mapId];
  if (!mapTypes) return 'food';
  return mapTypes[territoryId] ?? 'food';
}

/**
 * getResourceTypesForMap
 * Returns a map of all territory_id → resource_type for a given map.
 * @param {string} mapId
 * @returns {Record<string, string>}
 */
export function getResourceTypesForMap(mapId) {
  return RESOURCE_TYPE_BY_MAP[mapId] ?? {};
}