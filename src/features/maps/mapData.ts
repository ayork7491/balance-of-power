/**
 * features/maps/mapData.ts
 *
 * V1 Standard Map definition — schema-driven, data-only.
 * No rendering logic lives here. The MapRenderer reads this data.
 *
 * Coordinate space: 1000 × 700 logical units.
 * Territories are polygons defined by their vertices.
 * Adjacency is declared as an array of [key, key] pairs — bidirectional.
 */

export interface TerritoryDef {
  /** Stable string key — used as foreign key in TerritoryState.territory_key */
  key: string;
  name: string;
  region_id: string;
  /** SVG polygon points string: "x1,y1 x2,y2 ..." in logical units */
  points: string;
  /** Label anchor — center of the territory for text and icons */
  cx: number;
  cy: number;
  terrain?: string;
}

export interface RegionDef {
  id: string;
  name: string;
  control_bonus: number;
  color: string; // hex fill tint for region
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  regions: RegionDef[];
  territories: TerritoryDef[];
  /** Adjacency edges: each entry is [keyA, keyB] */
  adjacency: [string, string][];
}

// ─── V1 Standard Map ──────────────────────────────────────────────────────────

export const MAP_V1_STANDARD: MapDef = {
  id: 'map_v1_standard',
  name: 'Standard V1',
  width: 1000,
  height: 700,

  regions: [
    { id: 'north',  name: 'Northern Reaches',  control_bonus: 3, color: '#1e3a5f' },
    { id: 'east',   name: 'Eastern Dominion',  control_bonus: 3, color: '#3b1e1e' },
    { id: 'south',  name: 'Southern Expanse',  control_bonus: 4, color: '#1e3b1e' },
    { id: 'west',   name: 'Western Frontier',  control_bonus: 3, color: '#3b2d1e' },
    { id: 'center', name: 'Central Throne',    control_bonus: 5, color: '#2d1e3b' },
  ],

  territories: [
    // ── Northern Reaches (6 territories) ──────────────────────────────────────
    {
      key: 'frost_peak',
      name: 'Frost Peak',
      region_id: 'north',
      points: '50,30 180,30 200,100 160,140 80,140 40,90',
      cx: 120, cy: 85,
      terrain: 'mountains',
    },
    {
      key: 'irongate',
      name: 'Irongate',
      region_id: 'north',
      points: '200,30 340,30 360,100 310,150 200,100',
      cx: 280, cy: 80,
      terrain: 'urban',
    },
    {
      key: 'tundra_flats',
      name: 'Tundra Flats',
      region_id: 'north',
      points: '340,30 480,30 490,110 440,150 360,100',
      cx: 415, cy: 80,
      terrain: 'tundra',
    },
    {
      key: 'glacier_pass',
      name: 'Glacier Pass',
      region_id: 'north',
      points: '480,30 620,30 630,80 590,130 490,110',
      cx: 555, cy: 75,
      terrain: 'tundra',
    },
    {
      key: 'stormwatch',
      name: 'Stormwatch',
      region_id: 'north',
      points: '620,30 760,30 780,90 730,140 630,80',
      cx: 695, cy: 75,
      terrain: 'coastal',
    },
    {
      key: 'crow_harbor',
      name: "Crow's Harbor",
      region_id: 'north',
      points: '760,30 950,30 950,120 870,140 780,90',
      cx: 855, cy: 75,
      terrain: 'coastal',
    },

    // ── Western Frontier (5 territories) ──────────────────────────────────────
    {
      key: 'ashwood',
      name: 'Ashwood',
      region_id: 'west',
      points: '40,90 80,140 100,220 60,280 20,200',
      cx: 60, cy: 190,
      terrain: 'forest',
    },
    {
      key: 'redstone_ridge',
      name: 'Redstone Ridge',
      region_id: 'west',
      points: '80,140 160,140 180,230 130,280 100,220',
      cx: 130, cy: 200,
      terrain: 'mountains',
    },
    {
      key: 'dustmarsh',
      name: 'Dustmarsh',
      region_id: 'west',
      points: '20,200 60,280 80,370 30,420 10,300',
      cx: 45, cy: 310,
      terrain: 'swamp',
    },
    {
      key: 'saltfen',
      name: 'Saltfen',
      region_id: 'west',
      points: '60,280 130,280 150,370 100,430 80,370',
      cx: 105, cy: 360,
      terrain: 'swamp',
    },
    {
      key: 'verdant_vale',
      name: 'Verdant Vale',
      region_id: 'west',
      points: '30,420 80,370 100,430 80,500 20,470',
      cx: 62, cy: 445,
      terrain: 'plains',
    },

    // ── Eastern Dominion (5 territories) ──────────────────────────────────────
    {
      key: 'ember_coast',
      name: 'Ember Coast',
      region_id: 'east',
      points: '870,140 950,120 950,240 900,270 840,200',
      cx: 900, cy: 195,
      terrain: 'coastal',
    },
    {
      key: 'blackstone',
      name: 'Blackstone',
      region_id: 'east',
      points: '780,90 870,140 840,200 780,230 730,140',
      cx: 800, cy: 172,
      terrain: 'mountains',
    },
    {
      key: 'iron_coast',
      name: 'Iron Coast',
      region_id: 'east',
      points: '900,270 950,240 960,370 910,410 850,340',
      cx: 918, cy: 330,
      terrain: 'coastal',
    },
    {
      key: 'scalewood',
      name: 'Scalewood',
      region_id: 'east',
      points: '840,200 900,270 850,340 790,320 780,230',
      cx: 832, cy: 272,
      terrain: 'forest',
    },
    {
      key: 'the_bastion',
      name: 'The Bastion',
      region_id: 'east',
      points: '850,340 910,410 890,490 820,470 790,390',
      cx: 852, cy: 420,
      terrain: 'urban',
    },

    // ── Central Throne (5 territories) ────────────────────────────────────────
    {
      key: 'heartlands',
      name: 'Heartlands',
      region_id: 'center',
      points: '360,200 490,180 520,270 440,320 340,290',
      cx: 430, cy: 255,
      terrain: 'plains',
    },
    {
      key: 'golden_citadel',
      name: 'Golden Citadel',
      region_id: 'center',
      points: '490,180 620,160 650,250 570,300 520,270',
      cx: 567, cy: 233,
      terrain: 'urban',
    },
    {
      key: 'iron_ridge',
      name: 'Iron Ridge',
      region_id: 'center',
      points: '440,320 520,270 570,300 550,390 460,400',
      cx: 508, cy: 348,
      terrain: 'mountains',
    },
    {
      key: 'stonefield',
      name: 'Stonefield',
      region_id: 'center',
      points: '340,290 440,320 460,400 380,430 300,380',
      cx: 384, cy: 364,
      terrain: 'plains',
    },
    {
      key: 'the_crossing',
      name: 'The Crossing',
      region_id: 'center',
      points: '570,300 650,250 700,300 680,390 600,410 550,390',
      cx: 625, cy: 342,
      terrain: 'plains',
    },

    // ── Southern Expanse (6 territories) ──────────────────────────────────────
    {
      key: 'sunken_delta',
      name: 'Sunken Delta',
      region_id: 'south',
      points: '20,470 80,500 90,590 40,630 10,550',
      cx: 50, cy: 555,
      terrain: 'swamp',
    },
    {
      key: 'dustplains',
      name: 'Dustplains',
      region_id: 'south',
      points: '80,500 180,490 200,580 130,630 90,590',
      cx: 145, cy: 555,
      terrain: 'desert',
    },
    {
      key: 'amber_fields',
      name: 'Amber Fields',
      region_id: 'south',
      points: '180,490 300,480 310,570 230,620 200,580',
      cx: 248, cy: 540,
      terrain: 'plains',
    },
    {
      key: 'sunspire',
      name: 'Sunspire',
      region_id: 'south',
      points: '300,480 420,470 440,560 360,610 310,570',
      cx: 368, cy: 530,
      terrain: 'desert',
    },
    {
      key: 'verdant_basin',
      name: 'Verdant Basin',
      region_id: 'south',
      points: '420,470 550,460 560,550 480,600 440,560',
      cx: 492, cy: 520,
      terrain: 'plains',
    },
    {
      key: 'sea_gate',
      name: 'Sea Gate',
      region_id: 'south',
      points: '550,460 700,450 720,540 650,590 560,550',
      cx: 635, cy: 510,
      terrain: 'coastal',
    },
    {
      key: 'crimson_shore',
      name: 'Crimson Shore',
      region_id: 'south',
      points: '700,450 820,460 840,550 760,600 720,540',
      cx: 768, cy: 515,
      terrain: 'coastal',
    },
    {
      key: 'southern_reach',
      name: 'Southern Reach',
      region_id: 'south',
      points: '820,460 950,450 950,560 870,600 840,550',
      cx: 888, cy: 518,
      terrain: 'plains',
    },
  ],

  adjacency: [
    // North ↔ North
    ['frost_peak', 'irongate'],
    ['irongate', 'tundra_flats'],
    ['tundra_flats', 'glacier_pass'],
    ['glacier_pass', 'stormwatch'],
    ['stormwatch', 'crow_harbor'],

    // North ↔ West
    ['frost_peak', 'ashwood'],
    ['irongate', 'redstone_ridge'],

    // North ↔ Center
    ['tundra_flats', 'heartlands'],
    ['glacier_pass', 'golden_citadel'],

    // North ↔ East
    ['stormwatch', 'blackstone'],
    ['crow_harbor', 'ember_coast'],

    // West ↔ West
    ['ashwood', 'redstone_ridge'],
    ['ashwood', 'dustmarsh'],
    ['redstone_ridge', 'saltfen'],
    ['dustmarsh', 'saltfen'],
    ['dustmarsh', 'verdant_vale'],
    ['saltfen', 'verdant_vale'],

    // West ↔ Center
    ['redstone_ridge', 'heartlands'],
    ['saltfen', 'stonefield'],

    // West ↔ South
    ['verdant_vale', 'sunken_delta'],
    ['verdant_vale', 'dustplains'],

    // East ↔ East
    ['ember_coast', 'blackstone'],
    ['ember_coast', 'iron_coast'],
    ['blackstone', 'scalewood'],
    ['iron_coast', 'scalewood'],
    ['iron_coast', 'the_bastion'],
    ['scalewood', 'the_bastion'],

    // East ↔ Center
    ['blackstone', 'golden_citadel'],
    ['scalewood', 'the_crossing'],
    ['the_bastion', 'the_crossing'],

    // East ↔ South
    ['the_bastion', 'crimson_shore'],
    ['the_bastion', 'southern_reach'],

    // Center ↔ Center
    ['heartlands', 'golden_citadel'],
    ['heartlands', 'iron_ridge'],
    ['heartlands', 'stonefield'],
    ['golden_citadel', 'the_crossing'],
    ['iron_ridge', 'stonefield'],
    ['iron_ridge', 'the_crossing'],

    // Center ↔ South
    ['stonefield', 'sunspire'],
    ['iron_ridge', 'verdant_basin'],
    ['the_crossing', 'sea_gate'],

    // South ↔ South
    ['sunken_delta', 'dustplains'],
    ['dustplains', 'amber_fields'],
    ['amber_fields', 'sunspire'],
    ['sunspire', 'verdant_basin'],
    ['verdant_basin', 'sea_gate'],
    ['sea_gate', 'crimson_shore'],
    ['crimson_shore', 'southern_reach'],
  ],
};

export const MAP_REGISTRY: Record<string, MapDef> = {
  [MAP_V1_STANDARD.id]: MAP_V1_STANDARD,
};

export function getMap(mapId: string): MapDef | null {
  return MAP_REGISTRY[mapId] ?? null;
}