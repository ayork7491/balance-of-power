/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 * Source: shattered_crown_map_data_v3_graph_synchronized.json (version 0.3)
 * Coordinate space: 1000 × 1400 logical units.
 * Recommended players: 5–7 (ideal: 6)
 *
 * v3 topology: graph-synchronized — visual geography matches the gameplay
 * adjacency graph. Adjacent territories touch or have explicit route hints.
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

// ─── v3 Graph-synchronized territory data ────────────────────────────────────

const RAW_TERRITORIES = [

  // ══ IRONSPINE ═════════════════════════════════════════════════════════════

  { territory_id:'I1', name:'Frostgate',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:315, cy:140,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I2','I4','W1'],
    polygon:[{x:369.0,y:140.0},{x:348.6,y:168.6},{x:315.0,y:189.7},{x:279.9,y:169.9},{x:258.3,y:140.0},{x:282.2,y:112.0},{x:315.0,y:88.5},{x:350.9,y:109.4}],
  },
  { territory_id:'I2', name:'Northpass',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:465, cy:125,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I1','I3','I5','B1'],
    polygon:[{x:522.2,y:132.4},{x:494.5,y:156.6},{x:454.4,y:171.8},{x:421.4,y:148.4},{x:405.0,y:117.2},{x:436.2,y:94.1},{x:476.0,y:76.4},{x:509.5,y:101.1}],
  },
  { territory_id:'I3', name:'Cliffwatch',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'coastal' as const,
    cx:615, cy:145,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I2','I6','C1'],
    polygon:[{x:665.9,y:160.3},{x:635.5,y:181.5},{x:595.6,y:191.8},{x:570.2,y:163.2},{x:561.5,y:128.9},{x:595.0,y:109.3},{x:635.2,y:96.4},{x:660.8,y:126.4}],
  },
  { territory_id:'I4', name:'Greyhold',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:305, cy:270,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I1','I5','I7','W2'],
    polygon:[{x:359.1,y:295.4},{x:319.8,y:314.0},{x:272.3,y:319.0},{x:250.1,y:283.0},{x:248.2,y:243.3},{x:290.5,y:227.0},{x:338.9,y:219.2},{x:361.1,y:256.7}],
  },
  { territory_id:'I5', name:'Crownforge',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:465, cy:275,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I2','I4','I6','I7','B2'],
    polygon:[{x:514.8,y:309.0},{x:470.9,y:322.3},{x:421.5,y:320.3},{x:406.4,y:280.2},{x:412.7,y:239.3},{x:459.2,y:228.8},{x:510.1,y:228.0},{x:524.8,y:269.7}],
  },
  { territory_id:'I6', name:'Ridgefall',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:625, cy:280,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I3','I5','I8','C2'],
    polygon:[{x:665.9,y:319.1},{x:621.5,y:325.7},{x:574.7,y:317.1},{x:568.1,y:276.9},{x:582.0,y:239.0},{x:628.4,y:235.4},{x:677.2,y:241.6},{x:683.2,y:283.2}],
  },
  { territory_id:'I7', name:'Basinwatch',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:385, cy:405,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I4','I5','I8','B3'],
    polygon:[{x:447.0,y:405.0},{x:423.6,y:437.4},{x:385.0,y:461.2},{x:344.7,y:438.8},{x:319.9,y:405.0},{x:347.3,y:373.4},{x:385.0,y:346.8},{x:426.2,y:370.4}],
  },
  { territory_id:'I8', name:'Eastspire',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:625, cy:415,
    resource:res({ore:50,stone:40,relics:10}),
    adjacency_ids:['I6','I7','B4','C3'],
    polygon:[{x:690.0,y:424.1},{x:658.5,y:453.8},{x:612.9,y:472.5},{x:575.4,y:443.7},{x:556.7,y:405.4},{x:592.2,y:377.1},{x:637.5,y:355.4},{x:675.7,y:385.7}],
  },

  // ══ WILD FRONTIER ═════════════════════════════════════════════════════════

  { territory_id:'W1', name:'Thornwood Edge',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:135, cy:310,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['I1','W2','W4'],
    polygon:[{x:189.7,y:327.3},{x:157.0,y:351.3},{x:114.1,y:362.9},{x:86.8,y:330.6},{x:77.6,y:291.8},{x:113.5,y:269.6},{x:156.7,y:255.1},{x:184.2,y:288.9}],
  },
  { territory_id:'W2', name:'Greenmarch',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:245, cy:415,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['I4','W1','W3','W5'],
    polygon:[{x:299.1,y:441.4},{x:259.8,y:460.7},{x:212.3,y:465.9},{x:190.1,y:428.5},{x:188.2,y:387.3},{x:230.5,y:370.3},{x:278.9,y:362.2},{x:301.1,y:401.2}],
  },
  { territory_id:'W3', name:'Broken Pines',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:365, cy:430,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W2','W6','B1'],
    polygon:[{x:410.1,y:461.4},{x:370.4,y:473.8},{x:325.6,y:472.0},{x:311.9,y:434.8},{x:317.6,y:397.0},{x:359.8,y:387.2},{x:405.8,y:386.5},{x:419.2,y:425.1}],
  },
  { territory_id:'W4', name:'Mossfen',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'swamp' as const,
    cx:120, cy:535,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W1','W5','W7'],
    polygon:[{x:162.2,y:578.6},{x:116.4,y:585.9},{x:68.1,y:576.3},{x:61.2,y:531.6},{x:75.6,y:489.2},{x:123.6,y:485.2},{x:173.9,y:492.1},{x:180.0,y:538.5}],
  },
  { territory_id:'W5', name:'Wildcross',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'forest' as const,
    cx:255, cy:555,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W2','W4','W6','W8','B2'],
    polygon:[{x:325.0,y:555.0},{x:298.6,y:592.3},{x:255.0,y:619.8},{x:209.5,y:594.0},{x:181.5,y:555.0},{x:212.4,y:518.5},{x:255.0,y:487.8},{x:301.5,y:515.1}],
  },
  { territory_id:'W6', name:'Emberwood',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:380, cy:565,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W3','W5','W9','B5'],
    polygon:[{x:441.1,y:574.1},{x:411.5,y:603.8},{x:368.7,y:622.5},{x:333.4,y:593.7},{x:315.8,y:555.4},{x:349.2,y:527.1},{x:391.7,y:505.4},{x:427.6,y:535.7}],
  },
  { territory_id:'W7', name:'Lowbranch',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:125, cy:735,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W4','W8','S1'],
    polygon:[{x:192.9,y:757.0},{x:152.3,y:787.4},{x:99.1,y:802.2},{x:65.2,y:761.2},{x:53.7,y:711.9},{x:98.3,y:683.8},{x:151.9,y:665.3},{x:186.1,y:708.3}],
  },
  { territory_id:'W8', name:'Riverholt',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:265, cy:745,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W5','W7','W9','S2'],
    polygon:[{x:327.8,y:775.3},{x:282.2,y:797.5},{x:227.0,y:803.4},{x:201.3,y:760.5},{x:199.0,y:713.2},{x:248.2,y:693.7},{x:304.4,y:684.4},{x:330.1,y:729.2}],
  },
  { territory_id:'W9', name:'Ashen Ford',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:395, cy:750,
    resource:res({lumber:50,grain:25,wool:25}),
    adjacency_ids:['W6','W8','B6','S3'],
    polygon:[{x:446.3,y:786.5},{x:401.1,y:800.8},{x:350.2,y:798.7},{x:334.6,y:755.6},{x:341.1,y:711.7},{x:389.0,y:700.4},{x:441.5,y:699.5},{x:456.7,y:744.3}],
  },

  // ══ FRACTURE BASIN ════════════════════════════════════════════════════════

  { territory_id:'B1', name:'North Ruin Gate',
    continent_id:'fracture_basin', region_id:'northern_ruins', terrain:'plains' as const,
    cx:470, cy:435,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I2','W3','B2','B5'],
    polygon:[{x:505.6,y:469.6},{x:466.9,y:475.4},{x:426.2,y:467.8},{x:420.4,y:432.3},{x:432.6,y:398.7},{x:473.0,y:395.5},{x:515.4,y:401.0},{x:520.7,y:437.8}],
  },
  { territory_id:'B2', name:'Old Bastion',
    continent_id:'fracture_basin', region_id:'northern_ruins', terrain:'plains' as const,
    cx:555, cy:435,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I5','W5','B1','B3','B5'],
    polygon:[{x:611.0,y:435.0},{x:589.8,y:464.9},{x:555.0,y:486.8},{x:518.6,y:466.2},{x:496.2,y:435.0},{x:520.9,y:405.8},{x:555.0,y:381.2},{x:592.2,y:403.1}],
  },
  { territory_id:'B3', name:'Highbridge',
    continent_id:'fracture_basin', region_id:'northern_ruins', terrain:'plains' as const,
    cx:640, cy:460,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I7','B2','B4','B6'],
    polygon:[{x:693.2,y:467.8},{x:667.4,y:493.1},{x:630.1,y:509.0},{x:599.4,y:484.4},{x:584.1,y:451.8},{x:613.2,y:427.7},{x:650.2,y:409.2},{x:681.4,y:435.0}],
  },
  { territory_id:'B4', name:'East Rupture',
    continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'mountains' as const,
    cx:705, cy:570,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['I8','C3','B3','B7'],
    polygon:[{x:759.7,y:587.3},{x:727.0,y:611.3},{x:684.1,y:622.9},{x:656.8,y:590.6},{x:647.6,y:551.8},{x:683.5,y:529.6},{x:726.7,y:515.1},{x:754.2,y:548.9}],
  },
  { territory_id:'B5', name:'West Crucible',
    continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'plains' as const,
    cx:475, cy:595,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['W6','B1','B2','B6','B8'],
    polygon:[{x:529.1,y:621.4},{x:489.8,y:640.7},{x:442.3,y:645.9},{x:420.1,y:608.5},{x:418.2,y:567.3},{x:460.5,y:550.3},{x:508.9,y:542.2},{x:531.1,y:581.2}],
  },
  { territory_id:'B6', name:'Crownbreak',
    continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'plains' as const,
    cx:590, cy:620,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['W9','B3','B5','B7','B9'],
    polygon:[{x:642.9,y:656.5},{x:596.3,y:670.8},{x:543.8,y:668.7},{x:527.8,y:625.6},{x:534.5,y:581.7},{x:583.8,y:570.4},{x:637.9,y:569.5},{x:653.6,y:614.3}],
  },
  { territory_id:'B7', name:'Glass Rift',
    continent_id:'fracture_basin', region_id:'central_crossroads', terrain:'plains' as const,
    cx:700, cy:690,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['C4','B4','B6','B10'],
    polygon:[{x:739.6,y:730.6},{x:696.6,y:737.4},{x:651.3,y:728.5},{x:644.9,y:686.8},{x:658.4,y:647.4},{x:703.3,y:643.7},{x:750.5,y:650.1},{x:756.3,y:693.3}],
  },
  { territory_id:'B8', name:'Southwatch Ruins',
    continent_id:'fracture_basin', region_id:'southern_ruins', terrain:'plains' as const,
    cx:470, cy:765,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['S3','B5','B9'],
    polygon:[{x:528.0,y:765.0},{x:506.1,y:796.1},{x:470.0,y:819.0},{x:432.3,y:797.5},{x:409.1,y:765.0},{x:434.7,y:734.6},{x:470.0,y:709.0},{x:508.6,y:731.8}],
  },
  { territory_id:'B9', name:'Golden Causeway',
    continent_id:'fracture_basin', region_id:'southern_ruins', terrain:'plains' as const,
    cx:590, cy:780,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['S5','B6','B8','B10'],
    polygon:[{x:651.1,y:788.8},{x:621.5,y:817.4},{x:578.7,y:835.4},{x:543.4,y:807.6},{x:525.8,y:770.8},{x:559.2,y:743.5},{x:601.7,y:722.6},{x:637.6,y:751.8}],
  },
  { territory_id:'B10', name:'Riftmarket',
    continent_id:'fracture_basin', region_id:'southern_ruins', terrain:'plains' as const,
    cx:700, cy:805,
    resource:res({relics:35,ore:25,grain:25,stone:15}),
    adjacency_ids:['C6','S6','B7','B9'],
    polygon:[{x:758.5,y:823.0},{x:723.5,y:847.9},{x:677.7,y:860.0},{x:648.5,y:826.4},{x:638.6,y:786.1},{x:677.0,y:763.1},{x:723.2,y:748.0},{x:752.6,y:783.1}],
  },

  // ══ SUNFIELDS ═════════════════════════════════════════════════════════════

  { territory_id:'S1', name:'Westmeadow',
    continent_id:'sunfields', region_id:'western_plains', terrain:'plains' as const,
    cx:275, cy:930,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['W7','S2','S4'],
    polygon:[{x:337.8,y:958.3},{x:292.2,y:979.1},{x:237.0,y:984.7},{x:211.3,y:944.5},{x:209.0,y:900.3},{x:258.2,y:882.0},{x:314.4,y:873.3},{x:340.1,y:915.2}],
  },
  { territory_id:'S2', name:'Sunroad',
    continent_id:'sunfields', region_id:'western_plains', terrain:'plains' as const,
    cx:440, cy:925,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['W8','S1','S3','S5'],
    polygon:[{x:499.1,y:961.5},{x:447.0,y:975.8},{x:388.4,y:973.7},{x:370.5,y:930.6},{x:377.9,y:886.7},{x:433.1,y:875.4},{x:493.5,y:874.5},{x:511.0,y:919.3}],
  },
  { territory_id:'S3', name:'Harvest Ford',
    continent_id:'sunfields', region_id:'western_plains', terrain:'plains' as const,
    cx:605, cy:930,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['W9','B8','S2','S6'],
    polygon:[{x:653.8,y:973.6},{x:600.8,y:980.9},{x:545.0,y:971.3},{x:537.1,y:926.6},{x:553.7,y:884.2},{x:609.1,y:880.2},{x:667.3,y:887.1},{x:674.4,y:933.5}],
  },
  { territory_id:'S4', name:'Amberhold',
    continent_id:'sunfields', region_id:'western_plains', terrain:'plains' as const,
    cx:245, cy:1085,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S1','S5','S7'],
    polygon:[{x:323.0,y:1085.0},{x:293.5,y:1124.8},{x:245.0,y:1154.1},{x:194.3,y:1126.6},{x:163.1,y:1085.0},{x:197.6,y:1046.1},{x:245.0,y:1013.3},{x:296.8,y:1042.5}],
  },
  { territory_id:'S5', name:'Granary Cross',
    continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains' as const,
    cx:505, cy:1080,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S2','B9','S4','S6','S8'],
    polygon:[{x:591.7,y:1091.2},{x:549.7,y:1127.4},{x:488.9,y:1150.3},{x:438.9,y:1115.1},{x:413.9,y:1068.3},{x:461.3,y:1033.7},{x:521.7,y:1007.1},{x:572.5,y:1044.2}],
  },
  { territory_id:'S6', name:'Dawnmarch',
    continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains' as const,
    cx:735, cy:1065,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S3','B10','S5','S9'],
    polygon:[{x:810.4,y:1086.3},{x:765.3,y:1115.8},{x:706.2,y:1130.2},{x:668.6,y:1090.4},{x:655.8,y:1042.6},{x:705.4,y:1015.3},{x:764.9,y:997.4},{x:802.9,y:1039.1}],
  },
  { territory_id:'S7', name:'South Orchard',
    continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains' as const,
    cx:300, cy:1240,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S4','S8'],
    polygon:[{x:373.3,y:1272.2},{x:320.1,y:1295.9},{x:255.7,y:1302.2},{x:225.6,y:1256.5},{x:223.0,y:1206.2},{x:280.4,y:1185.4},{x:345.9,y:1175.5},{x:376.0,y:1223.1}],
  },
  { territory_id:'S8', name:'Lowgold',
    continent_id:'sunfields', region_id:'eastern_granaries', terrain:'plains' as const,
    cx:535, cy:1240,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S5','S7','S9'],
    polygon:[{x:603.4,y:1281.5},{x:543.1,y:1297.8},{x:475.2,y:1295.4},{x:454.5,y:1246.4},{x:463.2,y:1196.4},{x:527.0,y:1183.6},{x:597.0,y:1182.5},{x:617.3,y:1233.5}],
  },
  { territory_id:'S9', name:'Coastward Fields',
    continent_id:'sunfields', region_id:'eastern_granaries', terrain:'coastal' as const,
    cx:770, cy:1225,
    resource:res({grain:60,wool:25,lumber:15}),
    adjacency_ids:['S6','S8','C8'],
    polygon:[{x:824.1,y:1274.6},{x:765.3,y:1283.0},{x:703.5,y:1272.0},{x:694.7,y:1221.1},{x:713.2,y:1172.9},{x:774.6,y:1168.4},{x:839.0,y:1176.2},{x:846.9,y:1229.0}],
  },

  // ══ SHATTERED COAST ═══════════════════════════════════════════════════════

  { territory_id:'C1', name:'Northcliff',
    continent_id:'shattered_coast', region_id:'northern_isles', terrain:'coastal' as const,
    cx:790, cy:290,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['I3','C2','C4'],
    polygon:[{x:846.0,y:290.0},{x:824.8,y:322.4},{x:790.0,y:346.2},{x:753.6,y:323.8},{x:731.2,y:290.0},{x:755.9,y:258.4},{x:790.0,y:231.8},{x:827.2,y:255.4}],
  },
  { territory_id:'C2', name:'Saltwind Pass',
    continent_id:'shattered_coast', region_id:'northern_isles', terrain:'coastal' as const,
    cx:860, cy:425,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['I6','C1','C3','C5'],
    polygon:[{x:919.1,y:434.5},{x:890.5,y:465.2},{x:849.0,y:484.6},{x:814.9,y:454.7},{x:797.9,y:415.1},{x:830.2,y:385.7},{x:871.4,y:363.2},{x:906.1,y:394.6}],
  },
  { territory_id:'C3', name:'Broken Harbor',
    continent_id:'shattered_coast', region_id:'northern_isles', terrain:'coastal' as const,
    cx:850, cy:565,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['I8','B4','C2','C6'],
    polygon:[{x:908.5,y:583.7},{x:873.5,y:609.5},{x:827.7,y:622.0},{x:798.5,y:587.2},{x:788.6,y:545.4},{x:827.0,y:521.5},{x:873.2,y:505.9},{x:902.6,y:542.3}],
  },
  { territory_id:'C4', name:'Blacktide Gate',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:805, cy:675,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C1','C5','B7'],
    polygon:[{x:857.4,y:701.4},{x:819.4,y:720.7},{x:773.4,y:725.9},{x:751.9,y:688.5},{x:750.0,y:647.3},{x:791.0,y:630.3},{x:837.8,y:622.2},{x:859.3,y:661.2}],
  },
  { territory_id:'C5', name:'Shardport',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:895, cy:725,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C2','C4','C6','C7'],
    polygon:[{x:944.8,y:761.5},{x:900.9,y:775.8},{x:851.5,y:773.7},{x:836.4,y:730.6},{x:842.7,y:686.7},{x:889.2,y:675.4},{x:940.1,y:674.5},{x:954.8,y:719.3}],
  },
  { territory_id:'C6', name:'Mirror Cape',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:815, cy:850,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C3','C5','B10','C8'],
    polygon:[{x:858.6,y:895.1},{x:811.3,y:902.7},{x:761.4,y:892.8},{x:754.4,y:846.4},{x:769.3,y:802.7},{x:818.7,y:798.5},{x:870.5,y:805.6},{x:876.9,y:853.6}],
  },
  { territory_id:'C7', name:'Tidebreak',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:920, cy:925,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C5','C8'],
    polygon:[{x:982.0,y:925.0},{x:958.6,y:959.8},{x:920.0,y:985.5},{x:879.7,y:961.4},{x:854.9,y:925.0},{x:882.3,y:890.9},{x:920.0,y:862.3},{x:961.2,y:887.8}],
  },
  { territory_id:'C8', name:'Southwake',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:845, cy:1085,
    resource:res({wool:35,ore:25,grain:20,relics:20}),
    adjacency_ids:['C6','C7','S9'],
    polygon:[{x:916.0,y:1095.5},{x:881.6,y:1129.6},{x:831.8,y:1151.0},{x:790.9,y:1117.9},{x:770.5,y:1074.0},{x:809.3,y:1041.5},{x:858.6,y:1016.6},{x:900.3,y:1051.4}],
  },
];

// ─── Route hints from v3 connections ─────────────────────────────────────────
// Only gateway_route connections need explicit visual corridors;
// internal_border connections are implied by adjacent polygons.

export const ROUTE_HINTS: { from: string; to: string; type: string; points: [number,number][] }[] = [
  // Ironspine ↔ Wild Frontier
  { from:'I1', to:'W1', type:'gateway_route', points:[[315,140],[225,205],[135,310]] },
  { from:'I4', to:'W2', type:'gateway_route', points:[[305,270],[275,323],[245,415]] },
  // Ironspine ↔ Basin
  { from:'I2', to:'B1', type:'gateway_route', points:[[465,125],[467,280],[470,435]] },
  { from:'I5', to:'B2', type:'gateway_route', points:[[465,275],[510,335],[555,435]] },
  { from:'I7', to:'B3', type:'gateway_route', points:[[385,405],[512,413],[640,460]] },
  { from:'I8', to:'B4', type:'gateway_route', points:[[625,415],[665,473],[705,570]] },
  // Ironspine ↔ Coast
  { from:'I3', to:'C1', type:'gateway_route', points:[[615,145],[703,198],[790,290]] },
  { from:'I6', to:'C2', type:'gateway_route', points:[[625,280],[743,333],[860,425]] },
  { from:'I8', to:'C3', type:'gateway_route', points:[[625,415],[738,470],[850,565]] },
  // Basin ↔ Wild
  { from:'W3', to:'B1', type:'gateway_route', points:[[365,430],[418,413],[470,435]] },
  { from:'W5', to:'B2', type:'gateway_route', points:[[255,555],[405,475],[555,435]] },
  { from:'W6', to:'B5', type:'gateway_route', points:[[380,565],[428,560],[475,595]] },
  { from:'W9', to:'B6', type:'gateway_route', points:[[395,750],[493,665],[590,620]] },
  // Basin ↔ Coast
  { from:'B4', to:'C3', type:'gateway_route', points:[[705,570],[778,548],[850,565]] },
  { from:'B7', to:'C4', type:'gateway_route', points:[[700,690],[753,663],[805,675]] },
  { from:'B10', to:'C6', type:'gateway_route', points:[[700,805],[758,808],[815,850]] },
  // Basin ↔ Sunfields
  { from:'B8', to:'S3', type:'gateway_route', points:[[470,765],[538,828],[605,930]] },
  { from:'B9', to:'S5', type:'gateway_route', points:[[590,780],[548,910],[505,1080]] },
  { from:'B10', to:'S6', type:'gateway_route', points:[[700,805],[718,915],[735,1065]] },
  // Wild ↔ Sunfields
  { from:'W7', to:'S1', type:'gateway_route', points:[[125,735],[200,813],[275,930]] },
  { from:'W8', to:'S2', type:'gateway_route', points:[[265,745],[353,815],[440,925]] },
  { from:'W9', to:'S3', type:'gateway_route', points:[[395,750],[500,820],[605,930]] },
  // Coast ↔ Sunfields
  { from:'C8', to:'S9', type:'gateway_route', points:[[845,1085],[808,1135],[770,1225]] },
];

// ─── Build adjacency pairs ────────────────────────────────────────────────────

const ADJACENCY = buildAdjacency(
  RAW_TERRITORIES.map(t => ({ territory_id: t.territory_id, adjacency_ids: t.adjacency_ids }))
);

// ─── Map definition ───────────────────────────────────────────────────────────

export const MAP_SHATTERED_CROWN: MapDefinition = {
  id: 'shattered_crown_v1',
  name: 'The Shattered Crown',
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players. Source: v0.3-graph-synchronized-topology.',
  width: 1000,
  height: 1400,
  min_players: 5,
  max_players: 7,
  underlay_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/a2d1a7220_shattered_crown_landmass_terrain_underlay_v1.svg',

  continents: [
    { id: 'ironspine',       name: 'Ironspine',       control_bonus: 7,  color: '#64748b' },
    { id: 'wild_frontier',   name: 'Wild Frontier',   control_bonus: 8,  color: '#16a34a' },
    { id: 'fracture_basin',  name: 'Fracture Basin',  control_bonus: 10, color: '#dc2626' },
    { id: 'sunfields',       name: 'Sunfields',       control_bonus: 8,  color: '#ca8a04' },
    { id: 'shattered_coast', name: 'Shattered Coast', control_bonus: 7,  color: '#0891b2' },
  ],

  regions: [
    { id: 'outer_passes',       name: 'Outer Passes',       continent_id: 'ironspine',       control_bonus: 2, color: '#475569' },
    { id: 'high_crown',         name: 'High Crown',         continent_id: 'ironspine',       control_bonus: 3, color: '#334155' },
    { id: 'northern_wilds',     name: 'Northern Wilds',     continent_id: 'wild_frontier',   control_bonus: 3, color: '#15803d' },
    { id: 'deepwoods',          name: 'Deepwoods',          continent_id: 'wild_frontier',   control_bonus: 3, color: '#166534' },
    { id: 'northern_ruins',     name: 'Northern Ruins',     continent_id: 'fracture_basin',  control_bonus: 3, color: '#b91c1c' },
    { id: 'central_crossroads', name: 'Central Crossroads', continent_id: 'fracture_basin',  control_bonus: 4, color: '#991b1b' },
    { id: 'southern_ruins',     name: 'Southern Ruins',     continent_id: 'fracture_basin',  control_bonus: 3, color: '#dc2626' },
    { id: 'western_plains',     name: 'Western Plains',     continent_id: 'sunfields',       control_bonus: 2, color: '#b45309' },
    { id: 'eastern_granaries',  name: 'Eastern Granaries',  continent_id: 'sunfields',       control_bonus: 3, color: '#92400e' },
    { id: 'northern_isles',     name: 'Northern Isles',     continent_id: 'shattered_coast', control_bonus: 2, color: '#0e7490' },
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