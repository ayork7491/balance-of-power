/**
 * features/maps/mapData.ts
 *
 * V1 Standard Map — schema-driven, data-only.
 * No rendering logic. The MapRenderer reads this; never the reverse.
 *
 * Canonical identifier: territory_id (snake_case stable string)
 * Coordinate space: 1000 × 700 logical units
 *
 * Structure:
 *   2 continents (Northlands, Southlands)
 *   6 regions distributed across continents
 *   36 territories
 */
import type {
  MapDefinition,
  TerritoryDefinition,
  MapRegion,
  MapContinent,
  ResourceDistribution,
} from './types';

// ─── Resource distribution helpers ───────────────────────────────────────────

function res(brick: number, lumber: number, wool: number, grain: number, ore: number): ResourceDistribution {
  // Weights must total 100. Checked by validateMap().
  return { brick, lumber, wool, grain, ore };
}

// Terrain-biased presets (all sum to 100)
const RES = {
  mountains:  res(10, 5,  5,  10, 70), // ore-heavy
  forest:     res(5,  60, 15, 10, 10), // lumber-heavy
  swamp:      res(15, 20, 30, 25, 10), // wool/grain mix
  tundra:     res(20, 10, 15, 15, 40), // ore/brick mix
  coastal:    res(10, 10, 35, 30, 15), // wool/grain mix
  desert:     res(30, 5,  10, 15, 40), // brick/ore mix
  urban:      res(25, 15, 15, 15, 30), // brick/ore mix
  plains:     res(10, 15, 20, 50, 5),  // grain-heavy
} as const;

// ─── V1 Standard Map ──────────────────────────────────────────────────────────

export const MAP_V1_STANDARD: MapDefinition = {
  id: 'map_v1_standard',
  name: 'Standard V1',
  description: 'The V1 starter map. 36 territories across 2 continents and 6 regions.',
  width: 1000,
  height: 700,
  min_players: 2,
  max_players: 8,

  // ── Continents ─────────────────────────────────────────────────────────────
  // Continents are the large strategic bonus groups.
  // Controlling an entire continent grants a flat troop bonus each round.
  continents: [
    {
      id: 'northlands',
      name: 'The Northlands',
      control_bonus: 7,
      color: '#3b82f6', // blue
    },
    {
      id: 'southlands',
      name: 'The Southlands',
      control_bonus: 9,
      color: '#f59e0b', // amber
    },
  ],

  // ── Regions ────────────────────────────────────────────────────────────────
  // Regions are smaller bonus groups within continents.
  // Controlling an entire region grants a smaller per-region troop bonus.
  regions: [
    // Northlands regions
    { id: 'north_coast', name: 'Northern Coast',   continent_id: 'northlands', control_bonus: 2, color: '#1e3a5f' },
    { id: 'west_reach',  name: 'Western Reaches',  continent_id: 'northlands', control_bonus: 2, color: '#3b2d1e' },
    { id: 'heartland',   name: 'The Heartland',    continent_id: 'northlands', control_bonus: 3, color: '#2d1e3b' },
    { id: 'east_shore',  name: 'Eastern Shore',    continent_id: 'northlands', control_bonus: 2, color: '#3b1e1e' },
    // Southlands regions
    { id: 'south_plains', name: 'Southern Plains',  continent_id: 'southlands', control_bonus: 3, color: '#1e3b1e' },
    { id: 'far_south',    name: 'The Far South',    continent_id: 'southlands', control_bonus: 2, color: '#3b3b1e' },
  ],

  // ── Territories ────────────────────────────────────────────────────────────
  territories: [

    // ═══ NORTHLANDS — NORTH COAST (8 territories) ═══════════════════════════

    {
      territory_id: 'frost_peak',
      name: 'Frost Peak',
      region_id: 'north_coast', continent_id: 'northlands',
      points: '50,30 180,30 200,100 160,140 80,140 40,90',
      cx: 120, cy: 82,
      terrain: 'mountains',
      resource_distribution: RES.mountains,
    },
    {
      territory_id: 'irongate',
      name: 'Irongate',
      region_id: 'north_coast', continent_id: 'northlands',
      points: '200,30 340,30 350,90 310,140 200,100',
      cx: 275, cy: 75,
      terrain: 'urban',
      resource_distribution: RES.urban,
    },
    {
      territory_id: 'tundra_flats',
      name: 'Tundra Flats',
      region_id: 'north_coast', continent_id: 'northlands',
      points: '340,30 480,30 485,105 445,145 350,90',
      cx: 415, cy: 76,
      terrain: 'tundra',
      resource_distribution: RES.tundra,
    },
    {
      territory_id: 'glacier_pass',
      name: 'Glacier Pass',
      region_id: 'north_coast', continent_id: 'northlands',
      points: '480,30 620,30 625,80 588,128 485,105',
      cx: 550, cy: 72,
      terrain: 'tundra',
      resource_distribution: RES.tundra,
    },
    {
      territory_id: 'stormwatch',
      name: 'Stormwatch',
      region_id: 'north_coast', continent_id: 'northlands',
      points: '620,30 760,30 775,88 728,138 625,80',
      cx: 690, cy: 72,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'crow_harbor',
      name: "Crow's Harbor",
      region_id: 'north_coast', continent_id: 'northlands',
      points: '760,30 950,30 950,120 865,140 775,88',
      cx: 855, cy: 72,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'pale_cliffs',
      name: 'Pale Cliffs',
      region_id: 'north_coast', continent_id: 'northlands',
      points: '160,140 240,130 260,185 200,210 140,185',
      cx: 200, cy: 172,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'veil_crossing',
      name: 'Veil Crossing',
      region_id: 'north_coast', continent_id: 'northlands',
      points: '588,128 700,110 720,170 660,200 588,165',
      cx: 650, cy: 152,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },

    // ═══ NORTHLANDS — WESTERN REACHES (6 territories) ════════════════════════

    {
      territory_id: 'ashwood',
      name: 'Ashwood',
      region_id: 'west_reach', continent_id: 'northlands',
      points: '40,90 80,140 100,220 55,275 18,195',
      cx: 58, cy: 186,
      terrain: 'forest',
      resource_distribution: RES.forest,
    },
    {
      territory_id: 'redstone_ridge',
      name: 'Redstone Ridge',
      region_id: 'west_reach', continent_id: 'northlands',
      points: '140,185 200,210 215,280 155,315 105,265',
      cx: 163, cy: 252,
      terrain: 'mountains',
      resource_distribution: RES.mountains,
    },
    {
      territory_id: 'dustmarsh',
      name: 'Dustmarsh',
      region_id: 'west_reach', continent_id: 'northlands',
      points: '18,195 55,275 72,365 28,415 8,295',
      cx: 38, cy: 308,
      terrain: 'swamp',
      resource_distribution: RES.swamp,
    },
    {
      territory_id: 'saltfen',
      name: 'Saltfen',
      region_id: 'west_reach', continent_id: 'northlands',
      points: '55,275 140,265 155,355 100,415 72,365',
      cx: 104, cy: 346,
      terrain: 'swamp',
      resource_distribution: RES.swamp,
    },
    {
      territory_id: 'verdant_vale',
      name: 'Verdant Vale',
      region_id: 'west_reach', continent_id: 'northlands',
      points: '28,415 72,365 100,415 88,495 22,468',
      cx: 62, cy: 440,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },
    {
      territory_id: 'greywood',
      name: 'Greywood',
      region_id: 'west_reach', continent_id: 'northlands',
      points: '105,265 155,315 170,390 118,435 92,368',
      cx: 128, cy: 355,
      terrain: 'forest',
      resource_distribution: RES.forest,
    },

    // ═══ NORTHLANDS — THE HEARTLAND (7 territories) ══════════════════════════

    {
      territory_id: 'heartlands',
      name: 'Heartlands',
      region_id: 'heartland', continent_id: 'northlands',
      points: '260,185 360,170 385,255 320,300 245,270',
      cx: 315, cy: 238,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },
    {
      territory_id: 'golden_citadel',
      name: 'Golden Citadel',
      region_id: 'heartland', continent_id: 'northlands',
      points: '360,170 490,155 510,240 440,280 385,255',
      cx: 437, cy: 220,
      terrain: 'urban',
      resource_distribution: RES.urban,
    },
    {
      territory_id: 'iron_ridge',
      name: 'Iron Ridge',
      region_id: 'heartland', continent_id: 'northlands',
      points: '440,280 510,240 558,275 542,360 458,375',
      cx: 502, cy: 313,
      terrain: 'mountains',
      resource_distribution: RES.mountains,
    },
    {
      territory_id: 'stonefield',
      name: 'Stonefield',
      region_id: 'heartland', continent_id: 'northlands',
      points: '320,300 440,280 458,375 378,415 295,372',
      cx: 378, cy: 349,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },
    {
      territory_id: 'the_crossing',
      name: 'The Crossing',
      region_id: 'heartland', continent_id: 'northlands',
      points: '558,275 645,245 688,295 668,378 592,395 542,360',
      cx: 616, cy: 325,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },
    {
      territory_id: 'ember_vale',
      name: 'Ember Vale',
      region_id: 'heartland', continent_id: 'northlands',
      points: '215,280 320,300 295,372 230,398 175,348',
      cx: 248, cy: 340,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },
    {
      territory_id: 'deepstone',
      name: 'Deepstone',
      region_id: 'heartland', continent_id: 'northlands',
      points: '490,155 620,140 645,245 510,240',
      cx: 566, cy: 195,
      terrain: 'mountains',
      resource_distribution: RES.mountains,
    },

    // ═══ NORTHLANDS — EASTERN SHORE (7 territories) ══════════════════════════

    {
      territory_id: 'ember_coast',
      name: 'Ember Coast',
      region_id: 'east_shore', continent_id: 'northlands',
      points: '865,140 950,120 950,235 900,265 835,195',
      cx: 898, cy: 192,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'blackstone',
      name: 'Blackstone',
      region_id: 'east_shore', continent_id: 'northlands',
      points: '728,138 865,140 835,195 775,230 688,175',
      cx: 779, cy: 175,
      terrain: 'mountains',
      resource_distribution: RES.mountains,
    },
    {
      territory_id: 'iron_coast',
      name: 'Iron Coast',
      region_id: 'east_shore', continent_id: 'northlands',
      points: '900,265 950,235 960,360 908,402 845,332',
      cx: 913, cy: 320,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'scalewood',
      name: 'Scalewood',
      region_id: 'east_shore', continent_id: 'northlands',
      points: '835,195 900,265 845,332 782,315 775,230',
      cx: 827, cy: 267,
      terrain: 'forest',
      resource_distribution: RES.forest,
    },
    {
      territory_id: 'the_bastion',
      name: 'The Bastion',
      region_id: 'east_shore', continent_id: 'northlands',
      points: '845,332 908,402 885,482 818,462 782,385',
      cx: 848, cy: 412,
      terrain: 'urban',
      resource_distribution: RES.urban,
    },
    {
      territory_id: 'ashfen_coast',
      name: 'Ashfen Coast',
      region_id: 'east_shore', continent_id: 'northlands',
      points: '688,175 775,230 750,298 668,285 650,210',
      cx: 706, cy: 240,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'ridgeline',
      name: 'Ridgeline',
      region_id: 'east_shore', continent_id: 'northlands',
      points: '668,285 750,298 782,385 710,405 648,358',
      cx: 712, cy: 346,
      terrain: 'mountains',
      resource_distribution: RES.mountains,
    },

    // ═══ SOUTHLANDS — SOUTHERN PLAINS (5 territories) ════════════════════════

    {
      territory_id: 'sunken_delta',
      name: 'Sunken Delta',
      region_id: 'south_plains', continent_id: 'southlands',
      points: '22,468 88,495 96,582 42,625 8,545',
      cx: 50, cy: 548,
      terrain: 'swamp',
      resource_distribution: RES.swamp,
    },
    {
      territory_id: 'dustplains',
      name: 'Dustplains',
      region_id: 'south_plains', continent_id: 'southlands',
      points: '88,495 185,485 202,572 130,625 96,582',
      cx: 145, cy: 551,
      terrain: 'desert',
      resource_distribution: RES.desert,
    },
    {
      territory_id: 'amber_fields',
      name: 'Amber Fields',
      region_id: 'south_plains', continent_id: 'southlands',
      points: '185,485 308,474 318,562 232,615 202,572',
      cx: 248, cy: 533,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },
    {
      territory_id: 'sunspire',
      name: 'Sunspire',
      region_id: 'south_plains', continent_id: 'southlands',
      points: '308,474 428,464 445,552 362,602 318,562',
      cx: 370, cy: 525,
      terrain: 'desert',
      resource_distribution: RES.desert,
    },
    {
      territory_id: 'verdant_basin',
      name: 'Verdant Basin',
      region_id: 'south_plains', continent_id: 'southlands',
      points: '428,464 552,455 562,542 480,592 445,552',
      cx: 492, cy: 516,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },

    // ═══ SOUTHLANDS — THE FAR SOUTH (3 territories) ══════════════════════════

    {
      territory_id: 'sea_gate',
      name: 'Sea Gate',
      region_id: 'far_south', continent_id: 'southlands',
      points: '552,455 698,445 718,532 648,582 562,542',
      cx: 632, cy: 504,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'crimson_shore',
      name: 'Crimson Shore',
      region_id: 'far_south', continent_id: 'southlands',
      points: '698,445 818,455 838,542 758,592 718,532',
      cx: 765, cy: 511,
      terrain: 'coastal',
      resource_distribution: RES.coastal,
    },
    {
      territory_id: 'southern_reach',
      name: 'Southern Reach',
      region_id: 'far_south', continent_id: 'southlands',
      points: '818,455 950,445 950,552 865,592 838,542',
      cx: 882, cy: 512,
      terrain: 'plains',
      resource_distribution: RES.plains,
    },
  ],

  // ── Adjacency ───────────────────────────────────────────────────────────────
  // Each pair is bidirectional. territory_id strings only.
  adjacency: [
    // North Coast — internal
    ['frost_peak',    'irongate'],
    ['irongate',      'tundra_flats'],
    ['tundra_flats',  'glacier_pass'],
    ['glacier_pass',  'stormwatch'],
    ['stormwatch',    'crow_harbor'],
    ['irongate',      'pale_cliffs'],
    ['glacier_pass',  'veil_crossing'],
    ['stormwatch',    'veil_crossing'],

    // North Coast → West Reaches
    ['frost_peak',    'ashwood'],
    ['pale_cliffs',   'redstone_ridge'],

    // North Coast → Heartland
    ['tundra_flats',  'heartlands'],
    ['glacier_pass',  'golden_citadel'],
    ['veil_crossing', 'deepstone'],
    ['veil_crossing', 'the_crossing'],

    // North Coast → East Shore
    ['stormwatch',    'blackstone'],
    ['crow_harbor',   'ember_coast'],
    ['veil_crossing', 'ashfen_coast'],

    // Western Reaches — internal
    ['ashwood',       'redstone_ridge'],
    ['ashwood',       'dustmarsh'],
    ['redstone_ridge','saltfen'],
    ['redstone_ridge','greywood'],
    ['dustmarsh',     'saltfen'],
    ['dustmarsh',     'verdant_vale'],
    ['saltfen',       'greywood'],
    ['saltfen',       'verdant_vale'],
    ['greywood',      'verdant_vale'],

    // Western Reaches → Heartland
    ['pale_cliffs',   'heartlands'],
    ['redstone_ridge','heartlands'],
    ['greywood',      'ember_vale'],
    ['saltfen',       'stonefield'],

    // Western Reaches → South Plains
    ['verdant_vale',  'sunken_delta'],
    ['verdant_vale',  'dustplains'],

    // Heartland — internal
    ['heartlands',    'golden_citadel'],
    ['heartlands',    'iron_ridge'],
    ['heartlands',    'stonefield'],
    ['heartlands',    'ember_vale'],
    ['golden_citadel','iron_ridge'],
    ['golden_citadel','the_crossing'],
    ['golden_citadel','deepstone'],
    ['iron_ridge',    'stonefield'],
    ['iron_ridge',    'the_crossing'],
    ['ember_vale',    'stonefield'],

    // Heartland → East Shore
    ['deepstone',     'blackstone'],
    ['the_crossing',  'ashfen_coast'],
    ['the_crossing',  'ridgeline'],

    // Heartland → South Plains
    ['stonefield',    'sunspire'],
    ['iron_ridge',    'verdant_basin'],
    ['the_crossing',  'sea_gate'],

    // Eastern Shore — internal
    ['ember_coast',   'blackstone'],
    ['ember_coast',   'iron_coast'],
    ['blackstone',    'scalewood'],
    ['blackstone',    'ashfen_coast'],
    ['iron_coast',    'scalewood'],
    ['iron_coast',    'the_bastion'],
    ['scalewood',     'the_bastion'],
    ['scalewood',     'ridgeline'],
    ['ashfen_coast',  'ridgeline'],
    ['ridgeline',     'the_bastion'],

    // Eastern Shore → Far South / South Plains
    ['the_bastion',   'crimson_shore'],
    ['the_bastion',   'southern_reach'],
    ['ridgeline',     'sea_gate'],

    // South Plains — internal
    ['sunken_delta',  'dustplains'],
    ['dustplains',    'amber_fields'],
    ['amber_fields',  'sunspire'],
    ['sunspire',      'verdant_basin'],
    ['verdant_basin', 'sea_gate'],

    // Far South — internal
    ['sea_gate',      'crimson_shore'],
    ['crimson_shore', 'southern_reach'],

    // South Plains → Far South
    ['verdant_basin', 'crimson_shore'],
  ],
};

// ─── Registry & Lookup ────────────────────────────────────────────────────────

import { MAP_SHATTERED_CROWN } from './mapData.shattered_crown';

export const MAP_REGISTRY: Record<string, MapDefinition> = {
  [MAP_V1_STANDARD.id]:      MAP_V1_STANDARD,
  [MAP_SHATTERED_CROWN.id]:  MAP_SHATTERED_CROWN,
};

export function getMap(mapId: string): MapDefinition | null {
  return MAP_REGISTRY[mapId] ?? null;
}

/** All maps available for campaign creation, ordered for display. */
export const AVAILABLE_MAPS = [
  MAP_SHATTERED_CROWN,
  MAP_V1_STANDARD,
] as const;