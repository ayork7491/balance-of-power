/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 * Source: shattered_crown_map_data_v1.json (version 0.1-production-draft)
 * Coordinate space: 1000 × 1400 logical units.
 *
 * Recommended players: 5–7 (ideal: 6)
 *
 * ── Resource compatibility note (TEMPORARY) ───────────────────────────────────
 * The source map uses "stone" and "relics" resources that are not yet in the V1
 * resource system (brick | lumber | wool | grain | ore).
 * Until map-defined resources are supported these translations are applied:
 *   stone  → brick   (masonry / quarried material — closest V1 analogue)
 *   relics → ore     (rare/high-value material — closest V1 analogue)
 * All resource_distribution weights are renormalised to sum to exactly 100.
 * Remove this note and restore native types when map-defined resources land.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Terrain type mapping ──────────────────────────────────────────────────────
 * The source uses fine-grained terrain types not present in the V1 TerrainType
 * enum. They are mapped to the nearest canonical type:
 *   mountain_pass      → mountains
 *   mountain_coast     → coastal
 *   highlands          → mountains
 *   fortress_mountain  → mountains
 *   highland_gate      → mountains
 *   fortress_ridge     → mountains
 *   forest_hills       → forest
 *   forest_pass        → forest
 *   swamp_forest       → swamp
 *   river_forest       → forest
 *   forest_ruins       → forest
 *   forest_plains      → plains
 *   riverlands         → plains
 *   wetlands           → swamp
 *   river_delta        → swamp
 *   saltmarsh          → swamp
 *   lowlands           → plains
 *   floodplains        → plains
 *   central_basin      → plains
 *   basin_ford         → plains
 *   basin_ruins        → plains
 *   plains_road        → plains
 *   trade_plains       → plains
 *   contested_plains   → plains
 *   open_plains        → plains
 *   coastal_road       → coastal
 *   clifftop           → coastal
 *   cliffside_road     → coastal
 *   coastal_ruins      → coastal
 *   tidal_flats        → coastal
 *   sea_cliffs         → coastal
 *   cape               → coastal
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { MapDefinition, ResourceDistribution } from './types';

// ─── Resource helpers ─────────────────────────────────────────────────────────

/** Translate source resource map to V1 ResourceDistribution.
 *  stone → brick, relics → ore.
 *  Remaining keys must be valid V1 types (lumber, wool, grain, ore).
 *  Weights are renormalised to sum to exactly 100. */
function res(raw: Record<string, number>): ResourceDistribution {
  let brick = 0, lumber = 0, wool = 0, grain = 0, ore = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'brick')  brick  += v;
    if (k === 'stone')  brick  += v; // TEMP: stone → brick
    if (k === 'lumber') lumber += v;
    if (k === 'wool')   wool   += v;
    if (k === 'grain')  grain  += v;
    if (k === 'ore')    ore    += v;
    if (k === 'relics') ore    += v; // TEMP: relics → ore
  }
  const total = brick + lumber + wool + grain + ore || 100;
  const scale = 100 / total;
  // Round and fix off-by-one on ore (last bucket) so sum = 100.
  const b = Math.round(brick * scale);
  const l = Math.round(lumber * scale);
  const w = Math.round(wool * scale);
  const g = Math.round(grain * scale);
  const o = 100 - b - l - w - g;
  return { brick: b, lumber: l, wool: w, grain: g, ore: Math.max(0, o) };
}

/** Convert [{x,y}] polygon array to SVG points string "x,y x,y ..." */
function pts(polygon: { x: number; y: number }[]): string {
  return polygon.map(p => `${p.x},${p.y}`).join(' ');
}

// ─── Adjacency extraction ─────────────────────────────────────────────────────
// Build canonical [a,b] pairs from adjacency_ids (each pair added once).

function buildAdjacency(territories: { territory_id: string; adjacency_ids: string[] }[]): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  for (const t of territories) {
    for (const nb of (t.adjacency_ids ?? [])) {
      const key = [t.territory_id, nb].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([t.territory_id, nb]);
      }
    }
  }
  return pairs;
}

// ─── Raw source territory data ────────────────────────────────────────────────
// Faithfully preserved from shattered_crown_map_data_v1.json.
// Only display_name → name, visual.center → cx/cy, terrain_type remapped, resources translated.

const RAW_TERRITORIES = [
  // ══ IRONSPINE ═════════════════════════════════════════════════════════════
  { territory_id:'I1', name:'Frostgate',     continent_id:'ironspine', region_id:'outer_passes',
    terrain:'mountains' as const, cx:345, cy:160,
    resource:res({ore:50,stone:40,lumber:10}),
    adjacency_ids:['I2','I4','W1'],
    polygon:[{x:357.8,y:68.7},{x:357.1,y:68.4},{x:294.8,y:69.0},{x:293.9,y:69.5},{x:267.7,y:114.6},{x:265.5,y:181.9},{x:265.9,y:182.7},{x:352.5,y:248.7},{x:353.6,y:248.7},{x:419.5,y:201.2},{x:420.0,y:200.5},{x:419.9,y:200.3},{x:409.1,y:127.2},{x:408.9,y:126.7}],
  },
  { territory_id:'I2', name:'Northpass',     continent_id:'ironspine', region_id:'outer_passes',
    terrain:'mountains' as const, cx:480, cy:140,
    resource:res({ore:45,stone:35,relics:20}),
    adjacency_ids:['I1','I3','I5','B1'],
    polygon:[{x:559.7,y:67.6},{x:558.7,y:66.5},{x:554.9,y:66.6},{x:409.8,y:126.6},{x:409.2,y:127.7},{x:419.9,y:200.3},{x:420.6,y:201.1},{x:509.5,y:228.6},{x:510.4,y:228.5},{x:538.6,y:208.1},{x:539.0,y:207.4}],
  },
  { territory_id:'I3', name:'Cliffwatch',    continent_id:'ironspine', region_id:'outer_passes',
    terrain:'coastal' as const, cx:615, cy:160,
    resource:res({ore:50,stone:30,wool:20}),
    adjacency_ids:['I2','I6','C1'],
    polygon:[{x:691.5,y:180.2},{x:671.5,y:121.5},{x:616.2,y:66.2},{x:615.5,y:65.9},{x:560.7,y:66.4},{x:559.8,y:67.3},{x:539.1,y:207.4},{x:539.8,y:208.1},{x:663.2,y:237.7},{x:664.3,y:237.2},{x:690.3,y:196.7},{x:690.5,y:196.2}],
  },
  { territory_id:'I4', name:'Greyhold',      continent_id:'ironspine', region_id:'high_crown',
    terrain:'mountains' as const, cx:265, cy:265,
    resource:res({stone:50,ore:40,grain:10}),
    adjacency_ids:['I1','I5','I7','W2'],
    polygon:[{x:311.8,y:339.4},{x:344.7,y:317.0},{x:345.1,y:316.3},{x:353.0,y:249.7},{x:352.6,y:248.8},{x:266.0,y:182.8},{x:264.9,y:182.8},{x:242.0,y:198.9},{x:241.6,y:199.5},{x:219.7,y:269.3},{x:220.0,y:270.3},{x:279.4,y:332.7},{x:279.9,y:333.0}],
  },
  { territory_id:'I5', name:'Crownforge',    continent_id:'ironspine', region_id:'high_crown',
    terrain:'mountains' as const, cx:435, cy:285,
    resource:res({ore:55,stone:35,relics:10}),
    adjacency_ids:['I2','I4','I6','I7','B2'],
    polygon:[{x:420.5,y:201.0},{x:353.4,y:248.8},{x:353.0,y:249.5},{x:345.2,y:316.1},{x:345.7,y:317.1},{x:440.6,y:370.2},{x:441.2,y:370.3},{x:488.2,y:361.9},{x:509.6,y:347.6},{x:510.0,y:346.8},{x:510.0,y:229.5},{x:509.3,y:228.6}],
  },
  { territory_id:'I6', name:'Ridgefall',     continent_id:'ironspine', region_id:'outer_passes',
    terrain:'mountains' as const, cx:585, cy:285,
    resource:res({ore:45,stone:45,wool:10}),
    adjacency_ids:['I3','I5','I8','C2'],
    polygon:[{x:539.4,y:208.0},{x:538.6,y:208.1},{x:510.4,y:228.5},{x:510.0,y:229.3},{x:510.0,y:346.5},{x:510.7,y:347.5},{x:583.9,y:368.7},{x:584.7,y:368.6},{x:657.7,y:323.0},{x:658.2,y:322.4},{x:671.6,y:276.0},{x:671.7,y:275.5},{x:664.0,y:238.5},{x:663.3,y:237.7}],
  },
  { territory_id:'I7', name:'Basinwatch',    continent_id:'ironspine', region_id:'high_crown',
    terrain:'mountains' as const, cx:365, cy:410,
    resource:res({stone:45,ore:35,grain:20}),
    adjacency_ids:['I4','I5','I8','B3'],
    polygon:[{x:420.3,y:418.0},{x:420.8,y:417.5},{x:440.5,y:371.2},{x:440.1,y:369.9},{x:345.6,y:317.1},{x:344.6,y:317.1},{x:312.9,y:339.0},{x:312.4,y:339.9},{x:312.5,y:340.1},{x:348.9,y:444.1},{x:349.4,y:444.7},{x:354.8,y:447.4},{x:355.7,y:447.4}],
  },
  { territory_id:'I8', name:'Eastspire',     continent_id:'ironspine', region_id:'high_crown',
    terrain:'mountains' as const, cx:660, cy:405,
    resource:res({ore:50,stone:30,relics:20}),
    adjacency_ids:['I6','I7','B4','C3'],
    polygon:[{x:656.3,y:447.4},{x:688.8,y:433.4},{x:685.1,y:352.0},{x:684.9,y:351.4},{x:658.6,y:323.4},{x:657.4,y:323.2},{x:584.9,y:368.5},{x:584.5,y:369.5},{x:584.6,y:369.6},{x:590.8,y:391.0},{x:591.1,y:391.5}],
  },

  // ══ WILD FRONTIER ═════════════════════════════════════════════════════════
  { territory_id:'W1', name:'Thornwood Edge', continent_id:'wild_frontier', region_id:'northern_wilds',
    terrain:'forest' as const, cx:135, cy:325,
    resource:res({lumber:60,wool:30,grain:10}),
    adjacency_ids:['I1','W2','W4'],
    polygon:[{x:127.0,y:411.0},{x:220.0,y:359.5},{x:220.2,y:358.0},{x:146.3,y:264.8},{x:145.6,y:264.5},{x:119.4,y:263.2},{x:118.5,y:263.5},{x:82.6,y:307.8},{x:82.4,y:308.8},{x:117.0,y:403.9},{x:117.4,y:404.4}],
  },
  { territory_id:'W2', name:'Greenmarch',    continent_id:'wild_frontier', region_id:'northern_wilds',
    terrain:'forest' as const, cx:205, cy:450,
    resource:res({lumber:50,wool:30,stone:20}),
    adjacency_ids:['I4','W1','W3','W5'],
    polygon:[{x:278.0,y:370.9},{x:278.0,y:370.4},{x:274.1,y:359.7},{x:221.2,y:359.0},{x:220.7,y:359.1},{x:128.0,y:411.0},{x:127.5,y:411.9},{x:127.5,y:495.2},{x:128.0,y:495.8},{x:196.5,y:538.9},{x:197.2,y:539.0},{x:249.7,y:529.8},{x:250.5,y:528.9}],
  },
  { territory_id:'W3', name:'Broken Pines',  continent_id:'wild_frontier', region_id:'northern_wilds',
    terrain:'forest' as const, cx:320, cy:470,
    resource:res({lumber:45,grain:25,wool:30}),
    adjacency_ids:['W2','W6','B1'],
    polygon:[{x:336.0,y:539.4},{x:336.7,y:538.9},{x:382.2,y:461.5},{x:382.0,y:460.2},{x:279.4,y:371.8},{x:278.0,y:371.8},{x:277.7,y:372.4},{x:250.5,y:528.9},{x:251.0,y:530.0},{x:283.7,y:548.5},{x:284.3,y:548.6}],
  },
  { territory_id:'W4', name:'Mossfen',       continent_id:'wild_frontier', region_id:'deepwoods',
    terrain:'swamp' as const, cx:120, cy:585,
    resource:res({lumber:55,wool:25,grain:20}),
    adjacency_ids:['W1','W5','W7'],
    polygon:[{x:68.1,y:599.9},{x:68.2,y:601.0},{x:136.6,y:680.0},{x:137.1,y:680.3},{x:151.5,y:684.6},{x:152.7,y:683.9},{x:196.6,y:539.8},{x:196.2,y:538.7},{x:128.0,y:495.8},{x:127.0,y:495.7},{x:115.8,y:501.5},{x:115.4,y:502.0}],
  },
  { territory_id:'W5', name:'Wildcross',     continent_id:'wild_frontier', region_id:'deepwoods',
    terrain:'forest' as const, cx:235, cy:620,
    resource:res({lumber:40,wool:30,grain:20,stone:10}),
    adjacency_ids:['W2','W4','W6','W8','B2'],
    polygon:[{x:284.0,y:549.2},{x:283.5,y:548.4},{x:250.7,y:529.8},{x:250.0,y:529.7},{x:197.4,y:539.0},{x:196.6,y:539.7},{x:152.6,y:684.4},{x:152.7,y:685.3},{x:157.2,y:691.0},{x:157.5,y:691.2},{x:211.9,y:720.7},{x:212.4,y:720.8},{x:295.9,y:712.3},{x:298.6,y:709.7}],
  },
  { territory_id:'W6', name:'Emberwood',     continent_id:'wild_frontier', region_id:'northern_wilds',
    terrain:'forest' as const, cx:345, cy:610,
    resource:res({lumber:45,ore:20,grain:20,relics:15}),
    adjacency_ids:['W3','W5','W9','B5'],
    polygon:[{x:336.8,y:539.5},{x:336.0,y:539.4},{x:284.9,y:548.5},{x:284.0,y:549.5},{x:284.1,y:549.6},{x:298.6,y:709.2},{x:299.7,y:710.0},{x:305.3,y:709.1},{x:305.8,y:708.9},{x:407.7,y:623.4},{x:408.1,y:622.6},{x:407.0,y:586.8},{x:406.6,y:586.0}],
  },
  { territory_id:'W7', name:'Lowbranch',     continent_id:'wild_frontier', region_id:'deepwoods',
    terrain:'plains' as const, cx:140, cy:795,
    resource:res({lumber:45,grain:35,wool:20}),
    adjacency_ids:['W4','W8','S1'],
    polygon:[{x:158.1,y:691.6},{x:156.8,y:691.9},{x:88.7,y:797.8},{x:88.6,y:798.7},{x:88.9,y:799.1},{x:145.8,y:845.7},{x:146.9,y:845.8},{x:194.4,y:820.6},{x:194.9,y:819.9},{x:212.0,y:721.6},{x:211.5,y:720.5}],
  },
  { territory_id:'W8', name:'Riverholt',     continent_id:'wild_frontier', region_id:'deepwoods',
    terrain:'plains' as const, cx:285, cy:770,
    resource:res({lumber:35,grain:35,wool:30}),
    adjacency_ids:['W5','W7','W9','S2'],
    polygon:[{x:212.9,y:720.8},{x:212.4,y:720.8},{x:212.0,y:721.6},{x:194.9,y:819.9},{x:195.4,y:820.7},{x:247.4,y:859.0},{x:247.9,y:859.1},{x:307.4,y:830.4},{x:307.8,y:829.8},{x:302.9,y:709.7},{x:302.8,y:709.6},{x:299.0,y:709.9},{x:298.8,y:709.7}],
  },
  { territory_id:'W9', name:'Rustholm',      continent_id:'wild_frontier', region_id:'deepwoods',
    terrain:'plains' as const, cx:415, cy:720,
    resource:res({grain:40,lumber:30,ore:20,wool:10}),
    adjacency_ids:['W6','W8','B8','S3'],
    polygon:[{x:408.5,y:623.0},{x:408.1,y:622.6},{x:305.8,y:708.9},{x:307.4,y:830.4},{x:307.8,y:830.5},{x:383.6,y:874.8},{x:384.2,y:874.7},{x:462.4,y:833.0},{x:462.5,y:832.9},{x:454.7,y:623.1},{x:454.4,y:622.8}],
  },

  // ══ FRACTURE BASIN ════════════════════════════════════════════════════════
  { territory_id:'B1', name:'Ashen Ford',    continent_id:'fracture_basin', region_id:'northern_basin',
    terrain:'plains' as const, cx:500, cy:480,
    resource:res({grain:40,lumber:25,ore:20,wool:15}),
    adjacency_ids:['I2','W3','B2','B3'],
    polygon:[{x:510.5,y:347.4},{x:510.0,y:347.0},{x:441.2,y:370.3},{x:420.8,y:417.5},{x:420.9,y:418.1},{x:455.8,y:447.9},{x:456.1,y:448.1},{x:539.8,y:430.9},{x:540.0,y:430.9},{x:540.2,y:430.9},{x:583.7,y:450.0},{x:584.0,y:450.1},{x:590.7,y:429.2},{x:591.0,y:428.8},{x:591.1,y:428.3},{x:591.1,y:391.5},{x:590.8,y:391.0},{x:584.6,y:369.6},{x:584.5,y:369.5},{x:510.7,y:347.5}],
  },
  { territory_id:'B2', name:'Ironbell',      continent_id:'fracture_basin', region_id:'northern_basin',
    terrain:'plains' as const, cx:430, cy:550,
    resource:res({ore:35,grain:30,stone:25,lumber:10}),
    adjacency_ids:['I5','W5','B1','B3','B5'],
    polygon:[{x:420.3,y:418.2},{x:420.9,y:418.1},{x:455.8,y:447.9},{x:456.1,y:448.1},{x:421.0,y:554.4},{x:420.6,y:554.7},{x:408.8,y:623.0},{x:408.5,y:623.0},{x:454.4,y:622.8},{x:454.7,y:623.1},{x:463.0,y:535.4},{x:463.2,y:535.0},{x:440.2,y:447.7},{x:440.0,y:447.4},{x:420.3,y:418.2}],
  },
  { territory_id:'B3', name:'Dustholm',      continent_id:'fracture_basin', region_id:'central_basin',
    terrain:'plains' as const, cx:360, cy:520,
    resource:res({grain:45,stone:30,ore:15,wool:10}),
    adjacency_ids:['I7','B1','B2','B6','W6'],
    polygon:[{x:355.8,y:447.3},{x:349.4,y:444.7},{x:349.2,y:444.6},{x:312.5,y:340.1},{x:312.4,y:339.9},{x:279.9,y:333.0},{x:279.4,y:332.7},{x:220.0,y:270.3},{x:219.9,y:270.2},{x:219.7,y:269.9},{x:219.7,y:269.8},{x:219.7,y:340.0},{x:219.7,y:340.1},{x:270.0,y:460.0},{x:270.1,y:460.2},{x:336.0,y:539.4},{x:336.0,y:539.4},{x:381.9,y:461.4},{x:382.3,y:461.0},{x:355.8,y:447.3}],
  },
  { territory_id:'B4', name:'Crackspire',    continent_id:'fracture_basin', region_id:'eastern_basin',
    terrain:'mountains' as const, cx:695, cy:520,
    resource:res({ore:50,stone:35,grain:15}),
    adjacency_ids:['I8','B1','B5','C3','C4'],
    polygon:[{x:657.0,y:447.6},{x:656.3,y:447.4},{x:591.1,y:391.5},{x:591.1,y:428.3},{x:591.0,y:428.8},{x:590.7,y:429.2},{x:584.0,y:450.1},{x:583.7,y:450.0},{x:540.0,y:430.9},{x:539.8,y:430.9},{x:539.8,y:554.2},{x:540.0,y:554.4},{x:590.1,y:577.1},{x:590.4,y:577.2},{x:655.8,y:547.0},{x:656.1,y:546.8},{x:688.8,y:433.4},{x:657.0,y:447.6}],
  },
  { territory_id:'B5', name:'Riftscar',      continent_id:'fracture_basin', region_id:'central_basin',
    terrain:'plains' as const, cx:510, cy:610,
    resource:res({ore:30,grain:30,stone:25,lumber:15}),
    adjacency_ids:['W6','B2','B4','B6','B7'],
    polygon:[{x:463.0,y:535.4},{x:454.7,y:623.1},{x:454.4,y:622.8},{x:408.8,y:623.0},{x:407.8,y:623.3},{x:406.6,y:586.0},{x:406.6,y:586.1},{x:408.0,y:623.0},{x:408.1,y:622.7},{x:406.8,y:586.2},{x:406.6,y:586.0},{x:284.1,y:549.6},{x:298.6,y:709.2},{x:299.0,y:709.9},{x:302.8,y:709.6},{x:302.9,y:709.7},{x:307.8,y:829.8},{x:383.6,y:874.8},{x:384.2,y:874.7},{x:462.4,y:833.0},{x:462.5,y:832.9},{x:454.7,y:623.1},{x:539.4,y:554.5},{x:539.8,y:554.2},{x:539.8,y:430.9},{x:456.1,y:448.1},{x:440.2,y:447.7},{x:463.2,y:535.0},{x:463.0,y:535.4}],
  },
  { territory_id:'B6', name:'Marrowpeak',    continent_id:'fracture_basin', region_id:'central_basin',
    terrain:'mountains' as const, cx:310, cy:620,
    resource:res({ore:45,stone:40,grain:15}),
    adjacency_ids:['B3','B5','B7','S4'],
    polygon:[{x:270.1,y:460.2},{x:270.0,y:460.0},{x:219.7,y:340.1},{x:219.7,y:340.0},{x:147.0,y:845.7},{x:194.4,y:820.6},{x:194.9,y:819.9},{x:247.4,y:859.0},{x:307.4,y:830.4},{x:302.9,y:709.7},{x:302.8,y:709.6},{x:284.1,y:549.6},{x:270.1,y:460.2}],
  },
  { territory_id:'B7', name:'Fordmere',      continent_id:'fracture_basin', region_id:'southern_basin',
    terrain:'plains' as const, cx:430, cy:800,
    resource:res({grain:50,wool:25,ore:15,lumber:10}),
    adjacency_ids:['B5','B6','B8','S4','S5'],
    polygon:[{x:383.6,y:874.8},{x:307.8,y:830.5},{x:247.9,y:859.1},{x:248.0,y:863.0},{x:300.5,y:943.9},{x:300.8,y:944.1},{x:374.4,y:970.0},{x:374.8,y:970.0},{x:438.7,y:955.8},{x:439.0,y:955.7},{x:461.6,y:832.9},{x:462.4,y:833.0},{x:383.6,y:874.8}],
  },
  { territory_id:'B8', name:'Cinderpass',    continent_id:'fracture_basin', region_id:'southern_basin',
    terrain:'plains' as const, cx:540, cy:825,
    resource:res({ore:35,grain:35,stone:20,wool:10}),
    adjacency_ids:['W9','B7','B9','S5','S6'],
    polygon:[{x:462.5,y:832.9},{x:462.4,y:833.0},{x:384.2,y:874.7},{x:374.8,y:970.0},{x:374.4,y:970.0},{x:438.7,y:955.8},{x:439.0,y:955.7},{x:530.6,y:981.8},{x:531.0,y:981.8},{x:590.0,y:953.4},{x:590.4,y:953.1},{x:564.3,y:832.9},{x:564.0,y:832.7},{x:462.5,y:832.9}],
  },
  { territory_id:'B9', name:'Siltmere',      continent_id:'fracture_basin', region_id:'southern_basin',
    terrain:'swamp' as const, cx:650, cy:885,
    resource:res({wool:40,grain:35,lumber:15,ore:10}),
    adjacency_ids:['B8','B10','S6','S7','C5'],
    polygon:[{x:590.4,y:953.1},{x:590.0,y:953.4},{x:531.0,y:981.8},{x:530.6,y:981.8},{x:531.0,y:1050.0},{x:531.4,y:1050.2},{x:605.1,y:1066.5},{x:605.5,y:1066.4},{x:665.1,y:1040.2},{x:665.5,y:1039.9},{x:655.4,y:946.0},{x:655.2,y:945.8},{x:590.4,y:953.1}],
  },
  { territory_id:'B10', name:'Drowned Keep', continent_id:'fracture_basin', region_id:'southern_basin',
    terrain:'swamp' as const, cx:760, cy:970,
    resource:res({wool:35,ore:30,grain:25,lumber:10}),
    adjacency_ids:['B9','C5','C6','S8'],
    polygon:[{x:655.5,y:1039.9},{x:665.1,y:1040.2},{x:605.5,y:1066.4},{x:605.1,y:1066.5},{x:531.4,y:1050.2},{x:531.0,y:1050.0},{x:530.6,y:1050.4},{x:590.0,y:1140.0},{x:590.4,y:1140.2},{x:690.2,y:1110.4},{x:690.6,y:1110.1},{x:730.9,y:1050.0},{x:731.1,y:1049.7},{x:730.7,y:1005.0},{x:730.4,y:1004.8},{x:655.5,y:1039.9}],
  },

  // ══ SUNFIELDS ═════════════════════════════════════════════════════════════
  { territory_id:'S1', name:'Goldengate',    continent_id:'sunfields', region_id:'northern_sun',
    terrain:'plains' as const, cx:120, cy:950,
    resource:res({grain:55,wool:25,lumber:20}),
    adjacency_ids:['W7','S2','S4'],
    polygon:[{x:88.9,y:799.1},{x:88.9,y:799.1},{x:146.9,y:845.8},{x:146.7,y:845.8},{x:248.0,y:863.0},{x:247.9,y:859.1},{x:247.4,y:859.0},{x:195.4,y:820.7},{x:194.9,y:819.9},{x:147.0,y:845.7},{x:88.6,y:798.7},{x:49.0,y:900.0},{x:49.2,y:900.4},{x:90.5,y:999.8},{x:90.7,y:999.9},{x:148.2,y:1030.4},{x:148.6,y:1030.4},{x:208.9,y:1009.6},{x:209.1,y:1009.4},{x:248.4,y:863.5},{x:248.0,y:863.0}],
  },
  { territory_id:'S2', name:'Sunhaven',      continent_id:'sunfields', region_id:'northern_sun',
    terrain:'plains' as const, cx:295, cy:930,
    resource:res({grain:50,wool:30,lumber:20}),
    adjacency_ids:['W8','S1','S3','S5'],
    polygon:[{x:248.4,y:863.5},{x:209.1,y:1009.4},{x:208.9,y:1009.6},{x:148.6,y:1030.4},{x:148.2,y:1030.4},{x:209.9,y:1105.5},{x:210.3,y:1105.7},{x:300.4,y:1100.3},{x:300.8,y:1100.1},{x:375.0,y:1050.4},{x:375.3,y:1050.0},{x:374.8,y:970.0},{x:374.4,y:970.0},{x:300.5,y:943.9},{x:300.8,y:944.1},{x:248.4,y:863.5}],
  },
  { territory_id:'S3', name:'Dustrun',       continent_id:'sunfields', region_id:'western_sun',
    terrain:'plains' as const, cx:455, cy:965,
    resource:res({grain:45,wool:25,lumber:20,ore:10}),
    adjacency_ids:['W9','S2','S4','S6'],
    polygon:[{x:462.5,y:832.9},{x:439.0,y:955.7},{x:438.7,y:955.8},{x:374.8,y:970.0},{x:375.3,y:1050.0},{x:375.0,y:1050.4},{x:300.8,y:1100.1},{x:300.4,y:1100.3},{x:380.0,y:1160.0},{x:380.4,y:1160.1},{x:463.0,y:1130.0},{x:463.4,y:1129.7},{x:530.8,y:1050.4},{x:531.0,y:1050.0},{x:531.0,y:981.8},{x:530.6,y:981.8},{x:439.0,y:955.7},{x:462.5,y:832.9}],
  },
  { territory_id:'S4', name:'Meadowkeep',    continent_id:'sunfields', region_id:'northern_sun',
    terrain:'plains' as const, cx:230, cy:1080,
    resource:res({grain:55,wool:30,lumber:15}),
    adjacency_ids:['B6','B7','S1','S2','S5'],
    polygon:[{x:209.1,y:1009.4},{x:209.9,y:1105.5},{x:148.6,y:1030.4},{x:90.7,y:999.9},{x:50.0,y:1060.0},{x:50.2,y:1060.4},{x:120.0,y:1180.0},{x:120.4,y:1180.2},{x:209.9,y:1200.0},{x:210.3,y:1200.0},{x:300.0,y:1160.0},{x:300.4,y:1159.8},{x:300.8,y:1100.1},{x:300.4,y:1100.3},{x:210.3,y:1105.7},{x:209.9,y:1105.5},{x:209.1,y:1009.4}],
  },
  { territory_id:'S5', name:'Sunbridge',     continent_id:'sunfields', region_id:'central_sun',
    terrain:'plains' as const, cx:430, cy:1070,
    resource:res({grain:50,wool:25,lumber:15,ore:10}),
    adjacency_ids:['B7','B8','S2','S3','S4','S6'],
    polygon:[{x:375.3,y:1050.0},{x:375.0,y:1050.4},{x:300.8,y:1100.1},{x:300.0,y:1160.0},{x:380.4,y:1160.1},{x:380.0,y:1160.0},{x:463.4,y:1129.7},{x:463.0,y:1130.0},{x:530.8,y:1050.4},{x:531.0,y:1050.0},{x:375.3,y:1050.0}],
  },
  { territory_id:'S6', name:'Thornvale',     continent_id:'sunfields', region_id:'western_sun',
    terrain:'plains' as const, cx:560, cy:1075,
    resource:res({grain:45,wool:30,lumber:15,ore:10}),
    adjacency_ids:['B8','B9','S3','S5','S7'],
    polygon:[{x:531.0,y:1050.0},{x:531.4,y:1050.2},{x:605.1,y:1066.5},{x:605.5,y:1066.4},{x:665.1,y:1040.2},{x:655.4,y:946.0},{x:590.4,y:953.1},{x:590.0,y:953.4},{x:531.0,y:981.8},{x:530.6,y:981.8},{x:530.8,y:1050.4},{x:531.0,y:1050.0}],
  },
  { territory_id:'S7', name:'Goldfall',      continent_id:'sunfields', region_id:'southern_sun',
    terrain:'plains' as const, cx:620, cy:1180,
    resource:res({grain:50,wool:25,ore:15,lumber:10}),
    adjacency_ids:['B9','S6','S8','C7'],
    polygon:[{x:605.5,y:1066.4},{x:605.1,y:1066.5},{x:531.4,y:1050.2},{x:531.0,y:1050.0},{x:463.0,y:1130.0},{x:463.4,y:1129.7},{x:380.4,y:1160.1},{x:380.0,y:1160.0},{x:460.0,y:1290.0},{x:460.4,y:1290.3},{x:560.0,y:1310.0},{x:560.4,y:1310.0},{x:640.0,y:1280.0},{x:640.4,y:1279.6},{x:665.5,y:1190.0},{x:665.5,y:1039.9},{x:665.1,y:1040.2},{x:605.5,y:1066.4}],
  },
  { territory_id:'S8', name:'Southfen',      continent_id:'sunfields', region_id:'southern_sun',
    terrain:'swamp' as const, cx:760, cy:1165,
    resource:res({wool:40,grain:35,lumber:15,ore:10}),
    adjacency_ids:['B10','S7','S9','C7','C8'],
    polygon:[{x:730.9,y:1050.0},{x:690.6,y:1110.1},{x:690.2,y:1110.4},{x:590.4,y:1140.2},{x:590.0,y:1140.0},{x:640.4,y:1279.6},{x:640.0,y:1280.0},{x:730.0,y:1300.0},{x:730.4,y:1300.0},{x:800.0,y:1260.0},{x:800.4,y:1259.6},{x:820.0,y:1170.0},{x:820.0,y:1050.0},{x:731.1,y:1049.7},{x:730.9,y:1050.0}],
  },
  { territory_id:'S9', name:'Tidemark',      continent_id:'sunfields', region_id:'southern_sun',
    terrain:'coastal' as const, cx:875, cy:1160,
    resource:res({wool:35,grain:30,ore:25,lumber:10}),
    adjacency_ids:['S8','C8'],
    polygon:[{x:820.0,y:1050.0},{x:820.0,y:1170.0},{x:800.4,y:1259.6},{x:800.0,y:1260.0},{x:880.0,y:1290.0},{x:930.0,y:1390.0},{x:970.0,y:1370.0},{x:970.0,y:1050.0},{x:820.0,y:1050.0}],
  },

  // ══ SHATTERED COAST ═══════════════════════════════════════════════════════
  { territory_id:'C1', name:'Breakwater',    continent_id:'shattered_coast', region_id:'northern_coast',
    terrain:'coastal' as const, cx:810, cy:160,
    resource:res({wool:40,ore:35,grain:15,lumber:10}),
    adjacency_ids:['I3','C2'],
    polygon:[{x:691.5,y:180.2},{x:690.5,y:196.2},{x:690.3,y:196.7},{x:664.3,y:237.2},{x:663.2,y:237.7},{x:671.7,y:275.5},{x:671.7,y:276.0},{x:685.0,y:351.5},{x:685.1,y:351.9},{x:757.0,y:330.0},{x:757.4,y:329.7},{x:800.0,y:240.0},{x:800.4,y:239.6},{x:800.0,y:140.0},{x:740.0,y:100.0},{x:692.0,y:160.0},{x:691.5,y:180.2}],
  },
  { territory_id:'C2', name:'Saltspire',     continent_id:'shattered_coast', region_id:'northern_coast',
    terrain:'coastal' as const, cx:800, cy:350,
    resource:res({wool:45,ore:30,grain:15,lumber:10}),
    adjacency_ids:['I6','C1','C3'],
    polygon:[{x:671.7,y:276.0},{x:671.6,y:276.0},{x:658.2,y:322.4},{x:657.7,y:323.0},{x:685.1,y:351.9},{x:685.0,y:352.0},{x:757.0,y:330.0},{x:757.4,y:329.7},{x:800.4,y:239.6},{x:800.0,y:240.0},{x:760.0,y:350.0},{x:760.4,y:350.2},{x:800.0,y:440.0},{x:800.4,y:440.0},{x:757.0,y:440.0},{x:757.4,y:440.0},{x:710.0,y:447.6},{x:688.8,y:433.4},{x:688.8,y:433.5},{x:684.9,y:351.4},{x:685.0,y:351.5},{x:671.7,y:276.0}],
  },
  { territory_id:'C3', name:'Cliffshold',    continent_id:'shattered_coast', region_id:'northern_coast',
    terrain:'coastal' as const, cx:820, cy:520,
    resource:res({ore:40,wool:35,grain:15,lumber:10}),
    adjacency_ids:['I8','C2','C4'],
    polygon:[{x:757.0,y:440.0},{x:800.4,y:440.0},{x:800.0,y:440.0},{x:760.4,y:350.2},{x:760.0,y:350.0},{x:800.0,y:440.0},{x:800.4,y:540.0},{x:800.0,y:540.0},{x:750.0,y:555.0},{x:750.4,y:555.0},{x:720.0,y:550.0},{x:688.8,y:433.5},{x:688.8,y:434.3},{x:688.2,y:434.3},{x:656.8,y:447.6},{x:656.3,y:447.4},{x:657.0,y:447.6},{x:757.0,y:447.6},{x:757.4,y:447.4},{x:757.0,y:440.0}],
  },
  { territory_id:'C4', name:'Tidecrag',      continent_id:'shattered_coast', region_id:'central_coast',
    terrain:'coastal' as const, cx:840, cy:660,
    resource:res({wool:45,ore:30,grain:15,lumber:10}),
    adjacency_ids:['B4','C3','C5'],
    polygon:[{x:800.0,y:540.0},{x:800.4,y:540.0},{x:750.4,y:555.0},{x:750.0,y:555.0},{x:720.0,y:550.0},{x:656.1,y:546.8},{x:655.8,y:547.0},{x:590.4,y:577.2},{x:590.1,y:577.1},{x:640.0,y:700.0},{x:640.4,y:700.2},{x:730.0,y:710.0},{x:730.4,y:709.8},{x:800.0,y:650.0},{x:800.4,y:649.6},{x:800.0,y:540.0}],
  },
  { territory_id:'C5', name:'Seastone',      continent_id:'shattered_coast', region_id:'central_coast',
    terrain:'coastal' as const, cx:810, cy:800,
    resource:res({wool:40,ore:35,grain:15,lumber:10}),
    adjacency_ids:['B9','B10','C4','C6'],
    polygon:[{x:730.4,y:709.8},{x:730.0,y:710.0},{x:640.4,y:700.2},{x:640.0,y:700.0},{x:590.4,y:577.2},{x:665.5,y:1039.9},{x:730.7,y:1005.0},{x:730.4,y:1004.8},{x:802.7,y:940.9},{x:802.7,y:940.5},{x:800.0,y:800.0},{x:800.4,y:799.6},{x:800.0,y:650.0},{x:800.4,y:649.6},{x:730.4,y:709.8}],
  },
  { territory_id:'C6', name:'Wrackpoint',    continent_id:'shattered_coast', region_id:'southern_fractures',
    terrain:'coastal' as const, cx:870, cy:960,
    resource:res({wool:40,ore:30,grain:20,lumber:10}),
    adjacency_ids:['B10','C5','C7','C8'],
    polygon:[{x:802.7,y:940.5},{x:730.7,y:1005.0},{x:731.1,y:1049.7},{x:730.9,y:1050.0},{x:820.0,y:1050.0},{x:930.0,y:1015.7},{x:930.0,y:1015.0},{x:930.0,y:940.0},{x:870.0,y:900.0},{x:802.7,y:940.5}],
  },
  { territory_id:'C7', name:'Ashcove',       continent_id:'shattered_coast', region_id:'southern_fractures',
    terrain:'coastal' as const, cx:900, cy:1060,
    resource:res({wool:35,grain:30,ore:25,lumber:10}),
    adjacency_ids:['C6','C8','S7','S8'],
    polygon:[{x:930.0,y:1015.7},{x:820.0,y:1050.0},{x:820.0,y:1170.0},{x:800.4,y:1259.6},{x:880.0,y:1290.0},{x:930.0,y:1390.0},{x:970.0,y:1370.0},{x:970.0,y:1050.0},{x:930.0,y:1015.7}],
  },
  { territory_id:'C8', name:'Southwake',     continent_id:'shattered_coast', region_id:'southern_fractures',
    terrain:'coastal' as const, cx:850, cy:1115,
    resource:res({grain:35,wool:30,ore:20,lumber:15}),
    adjacency_ids:['C6','C7','S9'],
    polygon:[{x:799.3,y:1051.8},{x:799.1,y:1052.6},{x:801.6,y:1100.4},{x:801.9,y:1101.0},{x:848.1,y:1150.6},{x:849.1,y:1150.8},{x:886.6,y:1139.3},{x:887.3,y:1138.7},{x:896.7,y:1116.2},{x:896.6,y:1115.3},{x:839.8,y:1028.5},{x:839.3,y:1028.1},{x:824.1,y:1023.6},{x:824.0,y:1023.6}],
  },
];

// ─── Build adjacency pairs ────────────────────────────────────────────────────

const ADJACENCY = buildAdjacency(
  RAW_TERRITORIES.map(t => ({ territory_id: t.territory_id, adjacency_ids: t.adjacency_ids }))
);

// ─── Map definition ───────────────────────────────────────────────────────────

export const MAP_SHATTERED_CROWN: MapDefinition = {
  id: 'shattered_crown_v1',
  name: 'The Shattered Crown',
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players. Source: v0.1-production-draft.',
  width: 1000,
  height: 1400,
  min_players: 5,
  max_players: 7,

  continents: [
    { id: 'ironspine',      name: 'Ironspine',       control_bonus: 7,  color: '#64748b' },
    { id: 'wild_frontier',  name: 'Wild Frontier',   control_bonus: 8,  color: '#16a34a' },
    { id: 'fracture_basin', name: 'Fracture Basin',  control_bonus: 10, color: '#dc2626' },
    { id: 'sunfields',      name: 'Sunfields',       control_bonus: 8,  color: '#ca8a04' },
    { id: 'shattered_coast',name: 'Shattered Coast', control_bonus: 7,  color: '#0891b2' },
  ],

  regions: [
    // Ironspine
    { id: 'outer_passes',         name: 'Outer Passes',         continent_id: 'ironspine',       control_bonus: 2, color: '#475569' },
    { id: 'high_crown',           name: 'High Crown',           continent_id: 'ironspine',       control_bonus: 3, color: '#334155' },
    // Wild Frontier
    { id: 'northern_wilds',       name: 'Northern Wilds',       continent_id: 'wild_frontier',   control_bonus: 3, color: '#15803d' },
    { id: 'deepwoods',            name: 'Deepwoods',            continent_id: 'wild_frontier',   control_bonus: 3, color: '#166534' },
    // Fracture Basin
    { id: 'northern_basin',       name: 'Northern Basin',       continent_id: 'fracture_basin',  control_bonus: 3, color: '#b91c1c' },
    { id: 'central_basin',        name: 'Central Basin',        continent_id: 'fracture_basin',  control_bonus: 3, color: '#991b1b' },
    { id: 'eastern_basin',        name: 'Eastern Basin',        continent_id: 'fracture_basin',  control_bonus: 2, color: '#7f1d1d' },
    { id: 'southern_basin',       name: 'Southern Basin',       continent_id: 'fracture_basin',  control_bonus: 3, color: '#dc2626' },
    // Sunfields
    { id: 'northern_sun',         name: 'Northern Sun',         continent_id: 'sunfields',       control_bonus: 2, color: '#b45309' },
    { id: 'central_sun',          name: 'Central Sun',          continent_id: 'sunfields',       control_bonus: 2, color: '#92400e' },
    { id: 'western_sun',          name: 'Western Sun',          continent_id: 'sunfields',       control_bonus: 2, color: '#78350f' },
    { id: 'southern_sun',         name: 'Southern Sun',         continent_id: 'sunfields',       control_bonus: 2, color: '#ca8a04' },
    // Shattered Coast
    { id: 'northern_coast',       name: 'Northern Coast',       continent_id: 'shattered_coast', control_bonus: 2, color: '#0e7490' },
    { id: 'central_coast',        name: 'Central Coast',        continent_id: 'shattered_coast', control_bonus: 2, color: '#0c4a6e' },
    { id: 'southern_fractures',   name: 'Southern Fractures',   continent_id: 'shattered_coast', control_bonus: 3, color: '#0369a1' },
  ],

  territories: RAW_TERRITORIES.map(t => ({
    territory_id: t.territory_id,
    name: t.name,
    continent_id: t.continent_id,
    region_id: t.region_id,
    terrain: t.terrain,
    points: pts(t.polygon),
    cx: t.cx,
    cy: t.cy,
    resource_distribution: t.resource,
  })),

  adjacency: ADJACENCY,
};