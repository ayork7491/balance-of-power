/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 * Source: shattered_crown_map_data_v2_hand_sculpted.json (version 0.2-hand-sculpted-topology)
 * Coordinate space: 1000 × 1400 logical units.
 * Recommended players: 5–7 (ideal: 6)
 *
 * ── Resource compatibility note (TEMPORARY) ───────────────────────────────────
 * stone → brick, relics → ore (renormalised to 100).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── Terrain type mapping ──────────────────────────────────────────────────────
 * mountain / mountain_pass / mountain_coast / highlands /
 * fortress_mountain / highland_gate / fortress_ridge   → mountains
 * forest / forest_hills / forest_pass / river_forest /
 * forest_ruins / forest_plains / swamp_forest          → forest (or swamp)
 * riverlands / wetlands / river_delta / saltmarsh      → plains / swamp
 * ruins_pass / ruins / broken_bridge / ruins_coast /
 * ruined_plains / central_ruins / fracture_ruins /
 * ruined_lowlands / ancient_road / ruins_trade_gate    → plains (basin)
 * plains / open_plains / river_plains / hills_plains /
 * plains_market / plains_road / farmland /
 * coastal_plains / river_crossing                      → plains
 * cliff_coast / coast_pass / harbor_cliff / harbor /
 * coastal_gate / cape_ruins / island_coast /
 * coastal_road                                         → coastal
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { MapDefinition, ResourceDistribution } from './types';

// ─── Resource helpers ─────────────────────────────────────────────────────────

function res(raw: Record<string, number>): ResourceDistribution {
  let brick = 0, lumber = 0, wool = 0, grain = 0, ore = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'brick')  brick  += v;
    if (k === 'stone')  brick  += v;
    if (k === 'lumber') lumber += v;
    if (k === 'wool')   wool   += v;
    if (k === 'grain')  grain  += v;
    if (k === 'ore')    ore    += v;
    if (k === 'relics') ore    += v;
  }
  const total = brick + lumber + wool + grain + ore || 100;
  const scale = 100 / total;
  const b = Math.round(brick * scale);
  const l = Math.round(lumber * scale);
  const w = Math.round(wool * scale);
  const g = Math.round(grain * scale);
  const o = 100 - b - l - w - g;
  return { brick: b, lumber: l, wool: w, grain: g, ore: Math.max(0, o) };
}

function pts(polygon: { x: number; y: number }[]): string {
  return polygon.map(p => `${p.x},${p.y}`).join(' ');
}

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

// ─── v2 Hand-sculpted territory data ─────────────────────────────────────────
// Faithfully transcribed from shattered_crown_map_data_v2_hand_sculpted.json.
// polygon, cx/cy from visual.center, terrain mapped to canonical TerrainType.

const RAW_TERRITORIES = [

  // ══ IRONSPINE ═════════════════════════════════════════════════════════════

  { territory_id:'I1', name:'Frostgate',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:300, cy:150,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I2','I4','W1'],
    polygon:[{x:368.0,y:150.0},{x:341.4,y:182.8},{x:300.0,y:210.5},{x:255.8,y:185.1},{x:226.6,y:150.0},{x:257.7,y:116.4},{x:300.0,y:87.4},{x:345.2,y:114.1}],
  },
  { territory_id:'I2', name:'Northpass',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:450, cy:135,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I1','I3','I5','B1'],
    polygon:[{x:528.7,y:144.3},{x:489.2,y:171.8},{x:434.0,y:192.3},{x:389.5,y:162.2},{x:365.0,y:124.9},{x:409.9,y:97.4},{x:466.6,y:75.7},{x:511.8,y:107.2}],
  },
  { territory_id:'I3', name:'Cliffwatch',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'coastal' as const,
    cx:610, cy:150,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I2','I6','C1'],
    polygon:[{x:683.0,y:169.7},{x:637.7,y:193.9},{x:579.2,y:208.7},{x:544.6,y:171.3},{x:531.2,y:128.7},{x:581.7,y:105.1},{x:641.9,y:89.2},{x:676.8,y:128.3}],
  },
  { territory_id:'I4', name:'Greyhold',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:255, cy:270,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I1','I5','I7','W2'],
    polygon:[{x:330.5,y:312.2},{x:273.4,y:338.4},{x:204.3,y:348.8},{x:176.5,y:288.3},{x:173.5,y:224.5},{x:236.2,y:200.0},{x:307.5,y:188.4},{x:335.2,y:251.3}],
  },
  { territory_id:'I5', name:'Crownforge',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:440, cy:285,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I2','I4','I6','I7','B2'],
    polygon:[{x:511.4,y:336.4},{x:445.3,y:351.9},{x:369.8,y:350.7},{x:352.8,y:289.7},{x:362.9,y:229.5},{x:434.5,y:216.5},{x:512.7,y:217.0},{x:529.1,y:280.2}],
  },
  { territory_id:'I6', name:'Ridgefall',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:610, cy:285,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I3','I5','I8','C2'],
    polygon:[{x:664.7,y:346.1},{x:601.3,y:351.6},{x:532.8,y:339.3},{x:529.6,y:276.8},{x:550.9,y:219.0},{x:618.9,y:216.8},{x:690.0,y:228.8},{x:692.2,y:293.4}],
  },
  { territory_id:'I7', name:'Basinwatch',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:365, cy:420,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I4','I5','I8','B3'],
    polygon:[{x:406.5,y:487.0},{x:343.0,y:482.5},{x:278.1,y:460.1},{x:287.5,y:399.7},{x:320.2,y:347.6},{x:387.5,y:356.0},{x:455.0,y:378.4},{x:444.2,y:440.7}],
  },
  { territory_id:'I8', name:'Eastspire',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:650, cy:425,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I6','I7','B4','C3'],
    polygon:[{x:748.0,y:425.0},{x:709.6,y:474.9},{x:650.0,y:516.8},{x:586.2,y:478.3},{x:544.2,y:425.0},{x:589.0,y:374.0},{x:650.0,y:329.9},{x:715.1,y:370.5}],
  },

  // ══ WILD FRONTIER ═════════════════════════════════════════════════════════

  { territory_id:'W1', name:'Thornwood Edge',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:130, cy:330,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['I1','W2','W4'],
    polygon:[{x:206.7,y:342.9},{x:168.2,y:380.9},{x:114.4,y:409.3},{x:71.0,y:367.7},{x:47.1,y:316.1},{x:90.9,y:277.9},{x:146.2,y:247.8},{x:190.3,y:291.5}],
  },
  { territory_id:'W2', name:'Greenmarch',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:225, cy:440,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['I4','W1','W3','W5'],
    polygon:[{x:311.1,y:466.8},{x:257.7,y:499.5},{x:188.7,y:519.7},{x:147.9,y:468.9},{x:132.0,y:411.1},{x:191.6,y:379.1},{x:262.6,y:357.5},{x:303.8,y:410.5}],
  },
  { territory_id:'W3', name:'Broken Pines',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:350, cy:455,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W2','W6','B1'],
    polygon:[{x:425.5,y:492.0},{x:368.4,y:515.1},{x:299.3,y:524.2},{x:271.5,y:471.1},{x:268.5,y:415.0},{x:331.2,y:393.5},{x:402.5,y:383.4},{x:430.2,y:438.6}],
  },
  { territory_id:'W4', name:'Mossfen',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'swamp' as const,
    cx:115, cy:560,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W1','W5','W7'],
    polygon:[{x:184.2,y:623.3},{x:120.2,y:642.4},{x:47.1,y:640.8},{x:30.5,y:565.8},{x:40.3,y:491.6},{x:109.7,y:475.7},{x:185.4,y:476.3},{x:201.3,y:554.1}],
  },
  { territory_id:'W5', name:'Wildcross',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'forest' as const,
    cx:255, cy:590,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W2','W4','W6','W8','B2'],
    polygon:[{x:322.1,y:658.9},{x:244.4,y:665.2},{x:160.2,y:651.3},{x:156.3,y:580.7},{x:182.5,y:515.6},{x:265.9,y:513.1},{x:353.1,y:526.5},{x:355.9,y:599.5}],
  },
  { territory_id:'W6', name:'Emberwood',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:385, cy:610,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W3','W5','W9','B5'],
    polygon:[{x:426.5,y:678.8},{x:363.0,y:674.2},{x:298.1,y:651.2},{x:307.5,y:589.2},{x:340.2,y:535.7},{x:407.5,y:544.3},{x:475.0,y:567.4},{x:464.2,y:631.3}],
  },
  { territory_id:'W7', name:'Lowbranch',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:155, cy:760,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W4','W8','S1'],
    polygon:[{x:259.0,y:760.0},{x:218.2,y:825.7},{x:155.0,y:881.0},{x:87.3,y:830.3},{x:42.7,y:760.0},{x:90.3,y:692.8},{x:155.0,y:634.7},{x:224.1,y:688.2}],
  },
  { territory_id:'W8', name:'Riverholt',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:290, cy:790,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W5','W7','W9','S2'],
    polygon:[{x:396.3,y:806.5},{x:342.9,y:855.1},{x:268.3,y:891.4},{x:208.3,y:838.2},{x:175.2,y:772.2},{x:235.9,y:723.4},{x:312.4,y:685.0},{x:373.5,y:740.8}],
  },
  { territory_id:'W9', name:'Rustholm',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:420, cy:800,
    resource:res({grain:40,lumber:30,ore:20,wool:10}),
    adjacency_ids:['W6','W8','B6','S3'],
    polygon:[{x:508.0,y:829.6},{x:453.4,y:865.8},{x:382.9,y:888.0},{x:341.2,y:831.9},{x:325.0,y:768.0},{x:385.9,y:732.7},{x:458.4,y:708.8},{x:500.5,y:767.4}],
  },

  // ══ FRACTURE BASIN ════════════════════════════════════════════════════════

  { territory_id:'B1', name:'North Ruin Gate',
    continent_id:'fracture_basin', region_id:'northern_basin', terrain:'plains' as const,
    cx:465, cy:470,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I2','W3','B2','B5'],
    polygon:[{x:531.9,y:501.9},{x:481.3,y:521.7},{x:420.1,y:529.6},{x:395.4,y:483.9},{x:392.7,y:435.6},{x:448.3,y:417.1},{x:511.5,y:408.3},{x:536.1,y:455.8}],
  },
  { territory_id:'B2', name:'Old Bastion',
    continent_id:'fracture_basin', region_id:'northern_basin', terrain:'plains' as const,
    cx:555, cy:465,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I5','W5','B1','B3','B5'],
    polygon:[{x:616.6,y:505.9},{x:559.6,y:518.2},{x:494.4,y:517.2},{x:479.7,y:468.7},{x:488.4,y:420.8},{x:550.3,y:410.6},{x:617.7,y:410.9},{x:631.9,y:461.2}],
  },
  { territory_id:'B3', name:'Highbridge',
    continent_id:'fracture_basin', region_id:'northern_basin', terrain:'plains' as const,
    cx:650, cy:490,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I7','B2','B4','B6'],
    polygon:[{x:698.5,y:541.7},{x:642.3,y:546.4},{x:581.6,y:535.9},{x:578.7,y:483.1},{x:597.6,y:434.2},{x:657.8,y:432.3},{x:720.9,y:442.4},{x:722.8,y:497.1}],
  },
  { territory_id:'B4', name:'East Rupture',
    continent_id:'fracture_basin', region_id:'eastern_basin', terrain:'mountains' as const,
    cx:720, cy:610,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I8','C3','B3','B7'],
    polygon:[{x:756.8,y:678.8},{x:700.5,y:674.2},{x:643.0,y:651.2},{x:651.3,y:589.2},{x:680.3,y:535.7},{x:739.9,y:544.3},{x:799.8,y:567.4},{x:790.2,y:631.3}],
  },
  { territory_id:'B5', name:'West Crucible',
    continent_id:'fracture_basin', region_id:'central_basin', terrain:'plains' as const,
    cx:470, cy:620,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['W6','B1','B2','B6','B8'],
    polygon:[{x:558.0,y:620.0},{x:523.5,y:669.9},{x:470.0,y:711.8},{x:412.8,y:673.3},{x:375.0,y:620.0},{x:415.2,y:569.0},{x:470.0,y:524.9},{x:528.5,y:565.5}],
  },
  { territory_id:'B6', name:'Crownbreak',
    continent_id:'fracture_basin', region_id:'central_basin', terrain:'plains' as const,
    cx:590, cy:645,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['W9','B3','B5','B7','B9'],
    polygon:[{x:688.4,y:660.8},{x:638.9,y:707.2},{x:569.9,y:742.0},{x:514.4,y:691.1},{x:483.7,y:628.0},{x:539.9,y:581.3},{x:610.8,y:544.6},{x:667.3,y:597.9}],
  },
  { territory_id:'B7', name:'Glass Rift',
    continent_id:'fracture_basin', region_id:'central_basin', terrain:'plains' as const,
    cx:700, cy:720,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['C4','B4','B6','B10'],
    polygon:[{x:778.6,y:748.9},{x:729.8,y:784.2},{x:666.9,y:806.0},{x:629.6,y:751.1},{x:615.1,y:688.8},{x:669.5,y:654.3},{x:734.3,y:631.0},{x:771.9,y:688.2}],
  },
  { territory_id:'B8', name:'Southwatch Ruins',
    continent_id:'fracture_basin', region_id:'southern_basin', terrain:'plains' as const,
    cx:465, cy:765,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['S3','B5','B9'],
    polygon:[{x:537.0,y:802.0},{x:482.6,y:825.1},{x:416.6,y:834.2},{x:390.0,y:781.1},{x:387.2,y:725.0},{x:447.0,y:703.5},{x:515.1,y:693.4},{x:541.6,y:748.6}],
  },
  { territory_id:'B9', name:'Golden Causeway',
    continent_id:'fracture_basin', region_id:'southern_basin', terrain:'plains' as const,
    cx:590, cy:800,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['S5','B6','B8','B10'],
    polygon:[{x:656.2,y:847.5},{x:594.9,y:861.8},{x:525.0,y:860.6},{x:509.2,y:804.3},{x:518.5,y:748.7},{x:584.9,y:736.8},{x:657.3,y:737.2},{x:672.5,y:795.6}],
  },
  { territory_id:'B10', name:'Riftmarket',
    continent_id:'fracture_basin', region_id:'southern_basin', terrain:'plains' as const,
    cx:705, cy:820,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['C6','S6','B7','B9'],
    polygon:[{x:759.7,y:881.1},{x:696.3,y:886.6},{x:627.8,y:874.3},{x:624.6,y:811.8},{x:645.9,y:754.0},{x:713.9,y:751.8},{x:785.0,y:763.8},{x:787.2,y:828.4}],
  },

  // ══ SUNFIELDS ═════════════════════════════════════════════════════════════

  { territory_id:'S1', name:'Westmeadow',
    continent_id:'sunfields', region_id:'northern_sun', terrain:'plains' as const,
    cx:280, cy:950,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['W7','S2','S4'],
    polygon:[{x:329.0,y:1022.3},{x:254.0,y:1017.5},{x:177.3,y:993.3},{x:188.4,y:928.1},{x:227.1,y:871.9},{x:306.6,y:880.9},{x:386.4,y:905.2},{x:373.5,y:972.4}],
  },
  { territory_id:'S2', name:'Sunroad',
    continent_id:'sunfields', region_id:'northern_sun', terrain:'plains' as const,
    cx:445, cy:950,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['W8','S1','S3','S5'],
    polygon:[{x:553.0,y:950.0},{x:510.7,y:997.4},{x:445.0,y:1037.4},{x:374.7,y:1000.7},{x:328.4,y:950.0},{x:377.8,y:901.5},{x:445.0,y:859.5},{x:516.8,y:898.2}],
  },
  { territory_id:'S3', name:'Harvest Ford',
    continent_id:'sunfields', region_id:'western_sun', terrain:'plains' as const,
    cx:610, cy:950,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['W9','B8','S2','S6'],
    polygon:[{x:716.3,y:964.7},{x:662.9,y:1008.0},{x:588.3,y:1040.4},{x:528.3,y:992.9},{x:495.2,y:934.1},{x:555.9,y:890.7},{x:632.4,y:856.4},{x:693.5,y:906.1}],
  },
  { territory_id:'S4', name:'Amberhold',
    continent_id:'sunfields', region_id:'northern_sun', terrain:'plains' as const,
    cx:225, cy:1110,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S1','S5','S7'],
    polygon:[{x:331.7,y:1144.5},{x:265.5,y:1186.8},{x:180.0,y:1212.7},{x:129.5,y:1147.2},{x:109.8,y:1072.7},{x:183.6,y:1031.4},{x:271.6,y:1003.6},{x:322.6,y:1072.0}],
  },
  { territory_id:'S5', name:'Granary Cross',
    continent_id:'sunfields', region_id:'central_sun', terrain:'plains' as const,
    cx:505, cy:1110,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S2','B9','S4','S6','S8'],
    polygon:[{x:616.5,y:1160.4},{x:532.2,y:1191.8},{x:430.1,y:1204.1},{x:389.0,y:1131.9},{x:384.6,y:1055.6},{x:477.2,y:1026.3},{x:582.5,y:1012.5},{x:623.5,y:1087.6}],
  },
  { territory_id:'S6', name:'Dawnmarch',
    continent_id:'sunfields', region_id:'western_sun', terrain:'plains' as const,
    cx:735, cy:1085,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S3','B10','S5','S9'],
    polygon:[{x:823.7,y:1145.7},{x:741.6,y:1164.0},{x:647.9,y:1162.5},{x:626.7,y:1090.5},{x:639.2,y:1019.5},{x:728.2,y:1004.2},{x:825.3,y:1004.8},{x:845.7,y:1079.3}],
  },
  { territory_id:'S7', name:'South Orchard',
    continent_id:'sunfields', region_id:'southern_sun', terrain:'plains' as const,
    cx:315, cy:1260,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S4','S8'],
    polygon:[{x:392.1,y:1332.1},{x:302.8,y:1338.6},{x:206.2,y:1324.1},{x:201.7,y:1250.3},{x:231.8,y:1182.2},{x:327.5,y:1179.6},{x:427.7,y:1193.7},{x:430.8,y:1269.9}],
  },
  { territory_id:'S8', name:'Lowgold',
    continent_id:'sunfields', region_id:'southern_sun', terrain:'plains' as const,
    cx:545, cy:1260,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S5','S7','S9'],
    polygon:[{x:605.3,y:1341.1},{x:513.0,y:1335.7},{x:418.6,y:1308.6},{x:432.3,y:1235.4},{x:479.8,y:1172.4},{x:577.7,y:1182.5},{x:676.0,y:1209.7},{x:660.1,y:1285.1}],
  },
  { territory_id:'S9', name:'Coastward Fields',
    continent_id:'sunfields', region_id:'southern_sun', terrain:'coastal' as const,
    cx:780, cy:1235,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S6','S8','C8'],
    polygon:[{x:894.0,y:1235.0},{x:849.3,y:1294.6},{x:780.0,y:1344.8},{x:705.8,y:1298.8},{x:656.9,y:1235.0},{x:709.1,y:1174.0},{x:780.0,y:1121.3},{x:855.8,y:1169.9}],
  },

  // ══ SHATTERED COAST ═══════════════════════════════════════════════════════

  { territory_id:'C1', name:'Northcliff',
    continent_id:'shattered_coast', region_id:'northern_coast', terrain:'coastal' as const,
    cx:790, cy:300,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['I3','C2','C4'],
    polygon:[{x:866.7,y:312.9},{x:828.2,y:350.9},{x:774.4,y:379.3},{x:731.0,y:337.7},{x:707.1,y:286.1},{x:750.9,y:247.9},{x:806.2,y:217.8},{x:850.3,y:261.5}],
  },
  { territory_id:'C2', name:'Saltwind Pass',
    continent_id:'shattered_coast', region_id:'northern_coast', terrain:'coastal' as const,
    cx:865, cy:430,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['I6','C1','C3','C5'],
    polygon:[{x:943.6,y:458.9},{x:894.8,y:494.2},{x:831.9,y:516.0},{x:794.6,y:461.1},{x:780.1,y:398.8},{x:834.5,y:364.3},{x:899.3,y:341.0},{x:936.9,y:398.2}],
  },
  { territory_id:'C3', name:'Broken Harbor',
    continent_id:'shattered_coast', region_id:'northern_coast', terrain:'coastal' as const,
    cx:895, cy:575,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['I8','B4','C2','C6'],
    polygon:[{x:970.5,y:617.2},{x:913.4,y:643.4},{x:844.3,y:653.8},{x:816.5,y:593.3},{x:813.5,y:529.5},{x:876.2,y:505.0},{x:947.5,y:493.4},{x:975.2,y:556.3}],
  },
  { territory_id:'C4', name:'Blacktide Gate',
    continent_id:'shattered_coast', region_id:'central_coast', terrain:'coastal' as const,
    cx:790, cy:660,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C1','C5','B7'],
    polygon:[{x:853.2,y:714.1},{x:794.7,y:730.4},{x:728.0,y:729.0},{x:712.9,y:664.9},{x:721.8,y:601.6},{x:785.2,y:588.0},{x:854.3,y:588.5},{x:868.8,y:655.0}],
  },
  { territory_id:'C5', name:'Shardport',
    continent_id:'shattered_coast', region_id:'central_coast', terrain:'coastal' as const,
    cx:900, cy:760,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C2','C4','C6','C7'],
    polygon:[{x:958.4,y:828.9},{x:890.8,y:835.2},{x:817.5,y:821.3},{x:814.1,y:750.7},{x:836.9,y:685.6},{x:909.5,y:683.1},{x:985.4,y:696.5},{x:987.8,y:769.5}],
  },
  { territory_id:'C6', name:'Mirror Cape',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:805, cy:880,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C3','C5','B10','C8'],
    polygon:[{x:849.3,y:961.1},{x:781.5,y:955.7},{x:712.1,y:928.6},{x:722.2,y:855.4},{x:757.2,y:792.4},{x:829.0,y:802.5},{x:901.2,y:829.7},{x:889.6,y:905.1}],
  },
  { territory_id:'C7', name:'Tidebreak',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:910, cy:990,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C5','C8'],
    polygon:[{x:998.0,y:990.0},{x:963.5,y:1043.5},{x:910.0,y:1088.6},{x:852.8,y:1047.2},{x:815.0,y:990.0},{x:855.2,y:935.2},{x:910.0,y:887.9},{x:968.5,y:931.5}],
  },
  { territory_id:'C8', name:'Southwake',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:850, cy:1135,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C6','C7','S9'],
    polygon:[{x:948.4,y:1152.5},{x:898.9,y:1204.3},{x:829.9,y:1243.0},{x:774.4,y:1186.3},{x:743.7,y:1116.1},{x:799.9,y:1064.1},{x:870.8,y:1023.2},{x:927.3,y:1082.6}],
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
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players. Source: v0.2-hand-sculpted-topology.',
  width: 1000,
  height: 1400,
  min_players: 5,
  max_players: 7,

  continents: [
    { id: 'ironspine',       name: 'Ironspine',       control_bonus: 7,  color: '#64748b' },
    { id: 'wild_frontier',   name: 'Wild Frontier',   control_bonus: 8,  color: '#16a34a' },
    { id: 'fracture_basin',  name: 'Fracture Basin',  control_bonus: 10, color: '#dc2626' },
    { id: 'sunfields',       name: 'Sunfields',       control_bonus: 8,  color: '#ca8a04' },
    { id: 'shattered_coast', name: 'Shattered Coast', control_bonus: 7,  color: '#0891b2' },
  ],

  regions: [
    // Ironspine
    { id: 'outer_passes',       name: 'Outer Passes',       continent_id: 'ironspine',       control_bonus: 2, color: '#475569' },
    { id: 'high_crown',         name: 'High Crown',         continent_id: 'ironspine',       control_bonus: 3, color: '#334155' },
    // Wild Frontier
    { id: 'northern_wilds',     name: 'Northern Wilds',     continent_id: 'wild_frontier',   control_bonus: 3, color: '#15803d' },
    { id: 'deepwoods',          name: 'Deepwoods',          continent_id: 'wild_frontier',   control_bonus: 3, color: '#166534' },
    // Fracture Basin
    { id: 'northern_basin',     name: 'Northern Basin',     continent_id: 'fracture_basin',  control_bonus: 3, color: '#b91c1c' },
    { id: 'central_basin',      name: 'Central Basin',      continent_id: 'fracture_basin',  control_bonus: 3, color: '#991b1b' },
    { id: 'eastern_basin',      name: 'Eastern Basin',      continent_id: 'fracture_basin',  control_bonus: 2, color: '#7f1d1d' },
    { id: 'southern_basin',     name: 'Southern Basin',     continent_id: 'fracture_basin',  control_bonus: 3, color: '#dc2626' },
    // Sunfields
    { id: 'northern_sun',       name: 'Northern Sun',       continent_id: 'sunfields',       control_bonus: 2, color: '#b45309' },
    { id: 'central_sun',        name: 'Central Sun',        continent_id: 'sunfields',       control_bonus: 2, color: '#92400e' },
    { id: 'western_sun',        name: 'Western Sun',        continent_id: 'sunfields',       control_bonus: 2, color: '#78350f' },
    { id: 'southern_sun',       name: 'Southern Sun',       continent_id: 'sunfields',       control_bonus: 2, color: '#ca8a04' },
    // Shattered Coast
    { id: 'northern_coast',     name: 'Northern Coast',     continent_id: 'shattered_coast', control_bonus: 2, color: '#0e7490' },
    { id: 'central_coast',      name: 'Central Coast',      continent_id: 'shattered_coast', control_bonus: 2, color: '#0c4a6e' },
    { id: 'southern_fractures', name: 'Southern Fractures', continent_id: 'shattered_coast', control_bonus: 3, color: '#0369a1' },
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