/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 * Topology Pass v2 — Hand-authored geography.
 *
 * Coordinate space: 1000 × 1400 logical units.
 * Recommended players: 5–7 (ideal: 6)
 *
 * v2 Changes:
 *   - Full topology refinement: all polygon geometry hand-authored.
 *   - Continental masses given lateral spread and natural silhouettes.
 *   - Ironspine: wide mountain arc across the north, not a vertical strip.
 *   - Wild Frontier: sweeping southwest forest mass with rounded bays.
 *   - Fracture Basin: sunken central depression, visually dominant conflict zone.
 *   - Sunfields: broad southern plains with peninsula shapes.
 *   - Shattered Coast: ragged eastern coastline with sea inlets and capes.
 *   - All territory IDs, adjacency relationships, and strategic balance preserved.
 *
 * ── Resource compatibility note (TEMPORARY) ───────────────────────────────────
 * stone → brick, relics → ore (renormalised to 100). Remove when map-defined
 * resource types land.
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

// ─── Topology v2 — Hand-authored geography ────────────────────────────────────
//
// Coordinate philosophy:
//   X: 30–970 (full width used, 30px margin)
//   Y: 30–1370 (full height used, 30px margin)
//
// Continental layout:
//   Ironspine      — northern arc, x:120–750, y:30–340  (mountain backbone)
//   Wild Frontier  — western mass, x:30–380, y:280–900  (forest sweep)
//   Fracture Basin — central depression, x:280–750, y:320–1050 (conflict zone)
//   Sunfields      — southern plains, x:30–650, y:880–1370 (wide southern mass)
//   Shattered Coast— eastern strip, x:680–970, y:140–1200 (ragged coastline)
//
// Fracture Basin is deliberately wide and central — it touches all other continents.

const RAW_TERRITORIES = [

  // ══ IRONSPINE — Northern mountain arc ════════════════════════════════════
  // A wide, curved mountain range that crowns the north. Territories spread
  // laterally, not vertically. The arc bends slightly south in the center.
  // Western flank descends toward Wild Frontier. Eastern flank meets Shattered Coast.

  { territory_id:'I1', name:'Frostgate',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:195, cy:115,
    resource:res({ore:50,stone:40,lumber:10}),
    adjacency_ids:['I2','I4','W1'],
    polygon:[
      {x:80,  y:30},  {x:175, y:30},  {x:285, y:55},
      {x:310, y:95},  {x:305, y:145}, {x:265, y:185},
      {x:200, y:210}, {x:140, y:195}, {x:90,  y:160},
      {x:70,  y:115}, {x:75,  y:70},
    ],
  },
  { territory_id:'I2', name:'Northpass',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:390, cy:95,
    resource:res({ore:45,stone:35,relics:20}),
    adjacency_ids:['I1','I3','I5','B1'],
    polygon:[
      {x:285, y:55},  {x:390, y:35},  {x:500, y:45},
      {x:540, y:75},  {x:545, y:120}, {x:510, y:160},
      {x:455, y:180}, {x:375, y:175}, {x:315, y:150},
      {x:305, y:110}, {x:310, y:70},
    ],
  },
  { territory_id:'I3', name:'Cliffwatch',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'coastal' as const,
    cx:610, cy:120,
    resource:res({ore:50,stone:30,wool:20}),
    adjacency_ids:['I2','I6','C1'],
    polygon:[
      {x:500, y:45},  {x:610, y:30},  {x:720, y:55},
      {x:755, y:95},  {x:750, y:145}, {x:700, y:185},
      {x:640, y:200}, {x:570, y:190}, {x:510, y:165},
      {x:498, y:125}, {x:505, y:80},
    ],
  },
  { territory_id:'I4', name:'Greyhold',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:195, cy:275,
    resource:res({stone:50,ore:40,grain:10}),
    adjacency_ids:['I1','I5','I7','W2'],
    polygon:[
      {x:90,  y:160}, {x:145, y:195}, {x:205, y:210},
      {x:270, y:190}, {x:315, y:155}, {x:325, y:215},
      {x:305, y:285}, {x:265, y:335}, {x:210, y:360},
      {x:150, y:355}, {x:100, y:320}, {x:75,  y:265},
      {x:80,  y:210},
    ],
  },
  { territory_id:'I5', name:'Crownforge',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:415, cy:265,
    resource:res({ore:55,stone:35,relics:10}),
    adjacency_ids:['I2','I4','I6','I7','B2'],
    polygon:[
      {x:315, y:150}, {x:380, y:175}, {x:460, y:183},
      {x:515, y:168}, {x:550, y:125}, {x:555, y:180},
      {x:540, y:240}, {x:505, y:295}, {x:455, y:330},
      {x:385, y:340}, {x:320, y:310}, {x:290, y:265},
      {x:295, y:210}, {x:310, y:165},
    ],
  },
  { territory_id:'I6', name:'Ridgefall',
    continent_id:'ironspine', region_id:'outer_passes', terrain:'mountains' as const,
    cx:635, cy:275,
    resource:res({ore:45,stone:45,wool:10}),
    adjacency_ids:['I3','I5','I8','C2'],
    polygon:[
      {x:510, y:165}, {x:575, y:192}, {x:645, y:200},
      {x:705, y:188}, {x:755, y:150}, {x:760, y:210},
      {x:745, y:275}, {x:705, y:330}, {x:650, y:355},
      {x:580, y:355}, {x:520, y:325}, {x:498, y:280},
      {x:505, y:225}, {x:510, y:175},
    ],
  },
  { territory_id:'I7', name:'Basinwatch',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:310, cy:405,
    resource:res({stone:45,ore:35,grain:20}),
    adjacency_ids:['I4','I5','I8','B3'],
    polygon:[
      {x:150, y:355}, {x:215, y:365}, {x:270, y:340},
      {x:320, y:315}, {x:390, y:342}, {x:460, y:335},
      {x:480, y:390}, {x:460, y:445}, {x:410, y:475},
      {x:335, y:480}, {x:270, y:455}, {x:220, y:415},
      {x:195, y:365},
    ],
  },
  { territory_id:'I8', name:'Eastspire',
    continent_id:'ironspine', region_id:'high_crown', terrain:'mountains' as const,
    cx:590, cy:410,
    resource:res({ore:50,stone:30,relics:20}),
    adjacency_ids:['I6','I7','B4','C3'],
    polygon:[
      {x:460, y:335}, {x:525, y:330}, {x:585, y:360},
      {x:655, y:358}, {x:710, y:335}, {x:755, y:295},
      {x:768, y:355}, {x:760, y:420}, {x:720, y:465},
      {x:660, y:490}, {x:590, y:490}, {x:520, y:460},
      {x:480, y:415}, {x:472, y:365},
    ],
  },

  // ══ WILD FRONTIER — Western forest sweep ══════════════════════════════════
  // A sweeping, rounded forest mass that occupies the west. It has bays along
  // its eastern edge where it meets the Fracture Basin, and a rugged northern
  // coastline that meets Ironspine. The south curves into the Sunfields.

  { territory_id:'W1', name:'Thornwood Edge',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:75, cy:310,
    resource:res({lumber:60,wool:30,grain:10}),
    adjacency_ids:['I1','W2','W4'],
    polygon:[
      {x:30,  y:185}, {x:80,  y:170}, {x:130, y:185},
      {x:165, y:230}, {x:170, y:285}, {x:150, y:345},
      {x:110, y:385}, {x:65,  y:395}, {x:30,  y:365},
      {x:30,  y:220},
    ],
  },
  { territory_id:'W2', name:'Greenmarch',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:175, cy:450,
    resource:res({lumber:50,wool:30,stone:20}),
    adjacency_ids:['I4','W1','W3','W5'],
    polygon:[
      {x:65,  y:395}, {x:115, y:385}, {x:158, y:350},
      {x:200, y:370}, {x:240, y:415}, {x:268, y:460},
      {x:270, y:520}, {x:245, y:565}, {x:200, y:590},
      {x:150, y:590}, {x:105, y:560}, {x:75,  y:510},
      {x:60,  y:455}, {x:57,  y:410},
    ],
  },
  { territory_id:'W3', name:'Broken Pines',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:335, cy:445,
    resource:res({lumber:45,grain:25,wool:30}),
    adjacency_ids:['W2','W6','B1'],
    polygon:[
      {x:240, y:420}, {x:310, y:380}, {x:385, y:365},
      {x:460, y:380}, {x:490, y:420}, {x:490, y:480},
      {x:460, y:520}, {x:400, y:545}, {x:335, y:545},
      {x:275, y:520}, {x:245, y:475}, {x:242, y:435},
    ],
  },
  { territory_id:'W4', name:'Mossfen',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'swamp' as const,
    cx:90, cy:590,
    resource:res({lumber:55,wool:25,grain:20}),
    adjacency_ids:['W1','W5','W7'],
    polygon:[
      {x:30,  y:510}, {x:75,  y:510}, {x:108, y:562},
      {x:110, y:620}, {x:90,  y:670}, {x:55,  y:700},
      {x:30,  y:685}, {x:30,  y:530},
    ],
  },
  { territory_id:'W5', name:'Wildcross',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'forest' as const,
    cx:210, cy:645,
    resource:res({lumber:40,wool:30,grain:20,stone:10}),
    adjacency_ids:['W2','W4','W6','W8','B2'],
    polygon:[
      {x:106, y:562}, {x:152, y:592}, {x:200, y:595},
      {x:248, y:570}, {x:272, y:523}, {x:310, y:550},
      {x:330, y:600}, {x:315, y:660}, {x:270, y:710},
      {x:215, y:730}, {x:162, y:715}, {x:118, y:675},
      {x:108, y:622},
    ],
  },
  { territory_id:'W6', name:'Emberwood',
    continent_id:'wild_frontier', region_id:'northern_wilds', terrain:'forest' as const,
    cx:395, cy:610,
    resource:res({lumber:45,ore:20,grain:20,relics:15}),
    adjacency_ids:['W3','W5','W9','B5'],
    polygon:[
      {x:336, y:546}, {x:402, y:548}, {x:462, y:522},
      {x:495, y:482}, {x:500, y:555}, {x:490, y:625},
      {x:460, y:680}, {x:410, y:710}, {x:355, y:715},
      {x:310, y:690}, {x:290, y:645}, {x:300, y:590},
      {x:330, y:560},
    ],
  },
  { territory_id:'W7', name:'Lowbranch',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:95, cy:795,
    resource:res({lumber:45,grain:35,wool:20}),
    adjacency_ids:['W4','W8','S1'],
    polygon:[
      {x:30,  y:688}, {x:56,  y:702}, {x:92,  y:678},
      {x:120, y:678}, {x:165, y:718}, {x:175, y:780},
      {x:155, y:840}, {x:110, y:875}, {x:60,  y:875},
      {x:30,  y:850}, {x:30,  y:700},
    ],
  },
  { territory_id:'W8', name:'Riverholt',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:270, cy:785,
    resource:res({lumber:35,grain:35,wool:30}),
    adjacency_ids:['W5','W7','W9','S2'],
    polygon:[
      {x:160, y:718}, {x:218, y:732}, {x:270, y:715},
      {x:330, y:695}, {x:375, y:720}, {x:390, y:780},
      {x:370, y:850}, {x:325, y:895}, {x:265, y:910},
      {x:205, y:895}, {x:158, y:850}, {x:150, y:790},
      {x:155, y:748},
    ],
  },
  { territory_id:'W9', name:'Rustholm',
    continent_id:'wild_frontier', region_id:'deepwoods', terrain:'plains' as const,
    cx:450, cy:780,
    resource:res({grain:40,lumber:30,ore:20,wool:10}),
    adjacency_ids:['W6','W8','B8','S3'],
    polygon:[
      {x:360, y:718}, {x:413, y:712}, {x:468, y:685},
      {x:510, y:660}, {x:540, y:700}, {x:545, y:770},
      {x:520, y:840}, {x:470, y:885}, {x:405, y:895},
      {x:348, y:875}, {x:320, y:830}, {x:330, y:765},
      {x:348, y:730},
    ],
  },

  // ══ FRACTURE BASIN — Central conflict zone ════════════════════════════════
  // The heart of the map. Visually dominant, wide, slightly sunken.
  // Surrounded on all sides by other continents. Shaped like a fractured bowl.
  // Northern section bridges under Ironspine. Southern section pushes into Sunfields.
  // Eastern edge abuts Shattered Coast. Western edge presses on Wild Frontier.

  { territory_id:'B1', name:'Ashen Ford',
    continent_id:'fracture_basin', region_id:'northern_basin', terrain:'plains' as const,
    cx:505, cy:410,
    resource:res({grain:40,lumber:25,ore:20,wool:15}),
    adjacency_ids:['I2','W3','B2','B3'],
    polygon:[
      {x:390, y:345}, {x:460, y:340}, {x:530, y:348},
      {x:590, y:365}, {x:625, y:398}, {x:620, y:450},
      {x:590, y:490}, {x:540, y:510}, {x:478, y:510},
      {x:420, y:490}, {x:385, y:455}, {x:378, y:412},
    ],
  },
  { territory_id:'B2', name:'Ironbell',
    continent_id:'fracture_basin', region_id:'northern_basin', terrain:'plains' as const,
    cx:440, cy:560,
    resource:res({ore:35,grain:30,stone:25,lumber:10}),
    adjacency_ids:['I5','W5','B1','B3','B5'],
    polygon:[
      {x:380, y:458}, {x:422, y:492}, {x:482, y:513},
      {x:544, y:512}, {x:590, y:495}, {x:615, y:548},
      {x:608, y:610}, {x:570, y:650}, {x:510, y:668},
      {x:445, y:660}, {x:395, y:628}, {x:370, y:578},
      {x:368, y:525}, {x:370, y:480},
    ],
  },
  { territory_id:'B3', name:'Dustholm',
    continent_id:'fracture_basin', region_id:'central_basin', terrain:'plains' as const,
    cx:340, cy:540,
    resource:res({grain:45,stone:30,ore:15,wool:10}),
    adjacency_ids:['I7','B1','B2','B6','W6'],
    polygon:[
      {x:272, y:458}, {x:335, y:480}, {x:382, y:458},
      {x:382, y:515}, {x:370, y:580}, {x:358, y:635},
      {x:315, y:660}, {x:268, y:650}, {x:235, y:615},
      {x:225, y:560}, {x:238, y:510}, {x:258, y:475},
    ],
  },
  { territory_id:'B4', name:'Crackspire',
    continent_id:'fracture_basin', region_id:'eastern_basin', terrain:'mountains' as const,
    cx:680, cy:525,
    resource:res({ore:50,stone:35,grain:15}),
    adjacency_ids:['I8','B1','B5','C3','C4'],
    polygon:[
      {x:590, y:370}, {x:655, y:365}, {x:718, y:390},
      {x:758, y:435}, {x:762, y:495}, {x:740, y:550},
      {x:700, y:585}, {x:648, y:598}, {x:598, y:582},
      {x:565, y:548}, {x:562, y:498}, {x:572, y:445},
      {x:590, y:405},
    ],
  },
  { territory_id:'B5', name:'Riftscar',
    continent_id:'fracture_basin', region_id:'central_basin', terrain:'plains' as const,
    cx:535, cy:680,
    resource:res({ore:30,grain:30,stone:25,lumber:15}),
    adjacency_ids:['W6','B2','B4','B6','B7'],
    polygon:[
      {x:445, y:663}, {x:512, y:670}, {x:572, y:655},
      {x:620, y:620}, {x:650, y:600}, {x:703, y:592},
      {x:742, y:612}, {x:750, y:670}, {x:728, y:730},
      {x:690, y:768}, {x:635, y:782}, {x:572, y:775},
      {x:510, y:750}, {x:468, y:715}, {x:440, y:680},
    ],
  },
  { territory_id:'B6', name:'Marrowpeak',
    continent_id:'fracture_basin', region_id:'central_basin', terrain:'mountains' as const,
    cx:335, cy:710,
    resource:res({ore:45,stone:40,grain:15}),
    adjacency_ids:['B3','B5','B7','S4'],
    polygon:[
      {x:225, y:622}, {x:270, y:652}, {x:320, y:662},
      {x:365, y:642}, {x:400, y:668}, {x:440, y:688},
      {x:440, y:755}, {x:415, y:810}, {x:368, y:845},
      {x:308, y:855}, {x:255, y:835}, {x:215, y:795},
      {x:200, y:745}, {x:210, y:685}, {x:215, y:645},
    ],
  },
  { territory_id:'B7', name:'Fordmere',
    continent_id:'fracture_basin', region_id:'southern_basin', terrain:'plains' as const,
    cx:490, cy:835,
    resource:res({grain:50,wool:25,ore:15,lumber:10}),
    adjacency_ids:['B5','B6','B8','S4','S5'],
    polygon:[
      {x:410, y:813}, {x:470, y:778}, {x:535, y:778},
      {x:595, y:790}, {x:635, y:825}, {x:640, y:885},
      {x:610, y:938}, {x:558, y:965}, {x:495, y:968},
      {x:435, y:950}, {x:395, y:910}, {x:385, y:860},
      {x:392, y:832},
    ],
  },
  { territory_id:'B8', name:'Cinderpass',
    continent_id:'fracture_basin', region_id:'southern_basin', terrain:'plains' as const,
    cx:640, cy:890,
    resource:res({ore:35,grain:35,stone:20,wool:10}),
    adjacency_ids:['W9','B7','B9','S5','S6'],
    polygon:[
      {x:575, y:795}, {x:638, y:790}, {x:695, y:805},
      {x:738, y:840}, {x:752, y:895}, {x:738, y:952},
      {x:698, y:990}, {x:640, y:1005},{x:578, y:995},
      {x:532, y:965}, {x:510, y:938},{x:530, y:885},
      {x:550, y:845},
    ],
  },
  { territory_id:'B9', name:'Siltmere',
    continent_id:'fracture_basin', region_id:'southern_basin', terrain:'swamp' as const,
    cx:620, cy:1050,
    resource:res({wool:40,grain:35,lumber:15,ore:10}),
    adjacency_ids:['B8','B10','S6','S7','C5'],
    polygon:[
      {x:530, y:968}, {x:582, y:997}, {x:643, y:1007},
      {x:700, y:993}, {x:742, y:955}, {x:762, y:1010},
      {x:755, y:1070},{x:720, y:1115},{x:665, y:1140},
      {x:600, y:1145},{x:548, y:1118},{x:518, y:1070},
      {x:515, y:1015},
    ],
  },
  { territory_id:'B10', name:'Drowned Keep',
    continent_id:'fracture_basin', region_id:'southern_basin', terrain:'swamp' as const,
    cx:700, cy:1160,
    resource:res({wool:35,ore:30,grain:25,lumber:10}),
    adjacency_ids:['B9','C5','C6','S8'],
    polygon:[
      {x:600, y:1148},{x:665, y:1143},{x:725, y:1118},
      {x:762, y:1075},{x:770, y:1120},{x:778, y:1178},
      {x:758, y:1235},{x:715, y:1268},{x:658, y:1275},
      {x:602, y:1255},{x:562, y:1218},{x:548, y:1170},
      {x:558, y:1128},
    ],
  },

  // ══ SUNFIELDS — Southern plains ═══════════════════════════════════════════
  // The broad agrarian south. Gentle, curved territories with wide spans.
  // Western edge meets Wild Frontier. Northern edge meets Fracture Basin.
  // Eastern edge meets Shattered Coast. Southern tip is a peninsula.

  { territory_id:'S1', name:'Goldengate',
    continent_id:'sunfields', region_id:'northern_sun', terrain:'plains' as const,
    cx:105, cy:960,
    resource:res({grain:55,wool:25,lumber:20}),
    adjacency_ids:['W7','S2','S4'],
    polygon:[
      {x:30,  y:878}, {x:62,  y:877}, {x:112, y:878},
      {x:158, y:905}, {x:182, y:955}, {x:175, y:1015},
      {x:145, y:1060},{x:95,  y:1082},{x:45,  y:1068},
      {x:30,  y:1038},{x:30,  y:890},
    ],
  },
  { territory_id:'S2', name:'Sunhaven',
    continent_id:'sunfields', region_id:'northern_sun', terrain:'plains' as const,
    cx:280, cy:965,
    resource:res({grain:50,wool:30,lumber:20}),
    adjacency_ids:['W8','S1','S3','S5'],
    polygon:[
      {x:158, y:905}, {x:208, y:898}, {x:265, y:912},
      {x:330, y:898}, {x:378, y:915}, {x:408, y:960},
      {x:402, y:1022},{x:368, y:1070},{x:315, y:1095},
      {x:252, y:1098},{x:195, y:1072},{x:160, y:1022},
      {x:152, y:968},
    ],
  },
  { territory_id:'S3', name:'Dustrun',
    continent_id:'sunfields', region_id:'western_sun', terrain:'plains' as const,
    cx:465, cy:960,
    resource:res({grain:45,wool:25,lumber:20,ore:10}),
    adjacency_ids:['W9','S2','S4','S6'],
    polygon:[
      {x:375, y:920}, {x:435, y:908}, {x:498, y:918},
      {x:548, y:942}, {x:572, y:990}, {x:560, y:1050},
      {x:525, y:1095},{x:470, y:1120},{x:408, y:1118},
      {x:352, y:1090},{x:318, y:1045},{x:318, y:985},
      {x:342, y:945},
    ],
  },
  { territory_id:'S4', name:'Meadowkeep',
    continent_id:'sunfields', region_id:'northern_sun', terrain:'plains' as const,
    cx:155, cy:1130,
    resource:res({grain:55,wool:30,lumber:15}),
    adjacency_ids:['B6','B7','S1','S2','S5'],
    polygon:[
      {x:44,  y:1072},{x:97,  y:1085},{x:148, y:1065},
      {x:200, y:1075},{x:258, y:1102},{x:298, y:1158},
      {x:298, y:1225},{x:258, y:1278},{x:195, y:1302},
      {x:128, y:1298},{x:72,  y:1268},{x:38,  y:1218},
      {x:30,  y:1158},{x:30,  y:1090},
    ],
  },
  { territory_id:'S5', name:'Sunbridge',
    continent_id:'sunfields', region_id:'central_sun', terrain:'plains' as const,
    cx:395, cy:1145,
    resource:res({grain:50,wool:25,lumber:15,ore:10}),
    adjacency_ids:['B7','B8','S2','S3','S4','S6'],
    polygon:[
      {x:298, y:1098},{x:358, y:1092},{x:420, y:1122},
      {x:472, y:1125},{x:522, y:1100},{x:540, y:1152},
      {x:525, y:1215},{x:480, y:1260},{x:415, y:1280},
      {x:348, y:1268},{x:298, y:1228},{x:295, y:1168},
    ],
  },
  { territory_id:'S6', name:'Thornvale',
    continent_id:'sunfields', region_id:'western_sun', terrain:'plains' as const,
    cx:580, cy:1100,
    resource:res({grain:45,wool:30,lumber:15,ore:10}),
    adjacency_ids:['B8','B9','S3','S5','S7'],
    polygon:[
      {x:525, y:1050},{x:562, y:999}, {x:605, y:1005},
      {x:645, y:1008},{x:682, y:1048},{x:695, y:1108},
      {x:672, y:1165},{x:628, y:1200},{x:572, y:1210},
      {x:518, y:1188},{x:488, y:1148},{x:488, y:1100},
      {x:502, y:1062},
    ],
  },
  { territory_id:'S7', name:'Goldfall',
    continent_id:'sunfields', region_id:'southern_sun', terrain:'plains' as const,
    cx:555, cy:1280,
    resource:res({grain:50,wool:25,ore:15,lumber:10}),
    adjacency_ids:['B9','S6','S8','C7'],
    polygon:[
      {x:488, y:1155},{x:520, y:1192},{x:575, y:1215},
      {x:635, y:1210},{x:682, y:1172},{x:712, y:1215},
      {x:720, y:1278},{x:692, y:1336},{x:638, y:1365},
      {x:570, y:1368},{x:510, y:1338},{x:468, y:1285},
      {x:460, y:1225},{x:470, y:1172},
    ],
  },
  { territory_id:'S8', name:'Southfen',
    continent_id:'sunfields', region_id:'southern_sun', terrain:'swamp' as const,
    cx:748, cy:1255,
    resource:res({wool:40,grain:35,lumber:15,ore:10}),
    adjacency_ids:['B10','S7','S9','C7','C8'],
    polygon:[
      {x:680, y:1175},{x:718, y:1218},{x:724, y:1280},
      {x:700, y:1340},{x:720, y:1368},{x:780, y:1370},
      {x:838, y:1350},{x:872, y:1305},{x:870, y:1240},
      {x:845, y:1190},{x:810, y:1160},{x:768, y:1148},
      {x:720, y:1155},{x:695, y:1168},
    ],
  },
  { territory_id:'S9', name:'Tidemark',
    continent_id:'sunfields', region_id:'southern_sun', terrain:'coastal' as const,
    cx:900, cy:1290,
    resource:res({wool:35,grain:30,ore:25,lumber:10}),
    adjacency_ids:['S8','C8'],
    polygon:[
      {x:840, y:1195},{x:875, y:1210},{x:905, y:1250},
      {x:940, y:1250},{x:965, y:1280},{x:965, y:1370},
      {x:905, y:1370},{x:840, y:1360},{x:800, y:1310},
      {x:808, y:1255},{x:820, y:1222},
    ],
  },

  // ══ SHATTERED COAST — Eastern ragged coastline ════════════════════════════
  // A dramatic eastern coastal strip with irregular shapes, sea inlets, and capes.
  // Wider in the north (clifftop bastions), narrowing in the mid-section,
  // then fracturing into a broken archipelago/cape complex in the south.
  // Shares western border with Ironspine (north), Basin (mid), Sunfields (south).

  { territory_id:'C1', name:'Breakwater',
    continent_id:'shattered_coast', region_id:'northern_coast', terrain:'coastal' as const,
    cx:848, cy:165,
    resource:res({wool:40,ore:35,grain:15,lumber:10}),
    adjacency_ids:['I3','C2'],
    polygon:[
      {x:755, y:60},  {x:850, y:40},  {x:935, y:70},
      {x:965, y:115}, {x:960, y:180}, {x:930, y:230},
      {x:880, y:260}, {x:820, y:270}, {x:768, y:248},
      {x:742, y:205}, {x:740, y:155}, {x:748, y:105},
    ],
  },
  { territory_id:'C2', name:'Saltspire',
    continent_id:'shattered_coast', region_id:'northern_coast', terrain:'coastal' as const,
    cx:870, cy:360,
    resource:res({wool:45,ore:30,grain:15,lumber:10}),
    adjacency_ids:['I6','C1','C3'],
    polygon:[
      {x:768, y:250}, {x:822, y:272}, {x:882, y:264},
      {x:935, y:235}, {x:960, y:185}, {x:965, y:280},
      {x:960, y:368}, {x:935, y:430}, {x:890, y:460},
      {x:838, y:468}, {x:790, y:448}, {x:762, y:408},
      {x:756, y:355}, {x:760, y:295},
    ],
  },
  { territory_id:'C3', name:'Cliffshold',
    continent_id:'shattered_coast', region_id:'northern_coast', terrain:'coastal' as const,
    cx:872, cy:545,
    resource:res({ore:40,wool:35,grain:15,lumber:10}),
    adjacency_ids:['I8','C2','C4'],
    polygon:[
      {x:792, y:452}, {x:840, y:470}, {x:895, y:465},
      {x:940, y:438}, {x:965, y:480}, {x:965, y:575},
      {x:945, y:635}, {x:905, y:670}, {x:855, y:680},
      {x:805, y:662}, {x:772, y:628}, {x:762, y:578},
      {x:768, y:522}, {x:778, y:478},
    ],
  },
  { territory_id:'C4', name:'Tidecrag',
    continent_id:'shattered_coast', region_id:'central_coast', terrain:'coastal' as const,
    cx:878, cy:730,
    resource:res({wool:45,ore:30,grain:15,lumber:10}),
    adjacency_ids:['B4','C3','C5'],
    polygon:[
      {x:808, y:665}, {x:858, y:683}, {x:910, y:675},
      {x:950, y:642}, {x:965, y:688}, {x:965, y:790},
      {x:948, y:850}, {x:910, y:885}, {x:860, y:895},
      {x:808, y:878}, {x:775, y:845}, {x:762, y:800},
      {x:762, y:748}, {x:772, y:700},
    ],
  },
  { territory_id:'C5', name:'Seastone',
    continent_id:'shattered_coast', region_id:'central_coast', terrain:'coastal' as const,
    cx:876, cy:960,
    resource:res({wool:40,ore:35,grain:15,lumber:10}),
    adjacency_ids:['B9','B10','C4','C6'],
    polygon:[
      {x:808, y:880}, {x:862, y:898}, {x:915, y:892},
      {x:952, y:858}, {x:965, y:900}, {x:965, y:1010},
      {x:948, y:1058},{x:910, y:1090},{x:858, y:1102},
      {x:802, y:1085},{x:768, y:1048},{x:755, y:1000},
      {x:758, y:945}, {x:772, y:900},
    ],
  },
  { territory_id:'C6', name:'Wrackpoint',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:888, cy:1140,
    resource:res({wool:40,ore:30,grain:20,lumber:10}),
    adjacency_ids:['B10','C5','C7','C8'],
    polygon:[
      {x:805, y:1090},{x:860, y:1105},{x:915, y:1098},
      {x:952, y:1065},{x:965, y:1115},{x:965, y:1205},
      {x:945, y:1252},{x:908, y:1280},{x:858, y:1285},
      {x:808, y:1262},{x:775, y:1225},{x:762, y:1178},
      {x:764, y:1132},{x:778, y:1102},
    ],
  },
  { territory_id:'C7', name:'Ashcove',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:890, cy:1335,
    resource:res({wool:35,grain:30,ore:25,lumber:10}),
    adjacency_ids:['C6','C8','S7','S8'],
    polygon:[
      {x:808, y:1265},{x:860, y:1288},{x:910, y:1282},
      {x:950, y:1258},{x:965, y:1295},{x:965, y:1370},
      {x:915, y:1370},{x:858, y:1370},{x:810, y:1370},
      {x:768, y:1352},{x:755, y:1310},{x:762, y:1268},
    ],
  },
  { territory_id:'C8', name:'Southwake',
    continent_id:'shattered_coast', region_id:'southern_fractures', terrain:'coastal' as const,
    cx:858, cy:1200,
    resource:res({grain:35,wool:30,ore:20,lumber:15}),
    adjacency_ids:['C6','C7','S9'],
    polygon:[
      {x:762, y:1185},{x:808, y:1265},{x:762, y:1270},
      {x:720, y:1285},{x:710, y:1250},{x:718, y:1210},
      {x:738, y:1188},{x:754, y:1178},
    ],
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
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players. Topology v2.',
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