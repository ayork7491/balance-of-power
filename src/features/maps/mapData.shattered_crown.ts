/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 * Source: shattered_crown_map_data_v381_collision_cleanup.json (version 0.381-surgical-collision-cleanup)
 * Coordinate space: 1000 × 1400 logical units.
 * Recommended players: 5–7 (ideal: 6)
 *
 * v3.8.1 surgical collision cleanup:
 * - Adjusts B1, B2, B3, B4, B6 locally to clear B2/B3/I8 overlap.
 * - No adjacency, resource, region, or territory ID changes.
 * - Geometry imported verbatim from authoritative JSON — no regeneration.
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
    if (k === 'grain')  grain  += v;
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

// ─── v3.8.1 territory data — geometry verbatim from JSON ─────────────────────

const RAW_TERRITORIES = [

  // ══ IRONSPINE ═════════════════════════════════════════════════════════════

  { territory_id: 'I1', name: 'Frostgate',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'mountains' as const,
    cx: 238.9, cy: 223.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I2', 'I4', 'W1'],
    polygon: [{ x: 281.0, y: 223.3 }, { x: 265.1, y: 245.6 }, { x: 238.9, y: 262.1 }, { x: 211.5, y: 246.6 }, { x: 194.7, y: 223.3 }, { x: 213.3, y: 201.5 }, { x: 238.9, y: 183.1 }, { x: 266.9, y: 199.4 }],
  },
  { territory_id: 'I2', name: 'Northpass',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'mountains' as const,
    cx: 379.7, cy: 183.7,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I1', 'I3', 'I5', 'B1'],
    polygon: [{ x: 424.3, y: 189.5 }, { x: 402.7, y: 208.3 }, { x: 371.4, y: 220.2 }, { x: 345.7, y: 202.0 }, { x: 332.9, y: 177.6 }, { x: 357.2, y: 159.6 }, { x: 388.3, y: 145.8 }, { x: 414.4, y: 165.1 }],
  },
  { territory_id: 'I3', name: 'Cliffwatch',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'coastal' as const,
    cx: 529.3, cy: 183.7,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I2', 'I6', 'C1'],
    polygon: [{ x: 569.0, y: 195.6 }, { x: 545.3, y: 212.2 }, { x: 514.2, y: 220.2 }, { x: 494.4, y: 197.9 }, { x: 487.6, y: 171.1 }, { x: 513.7, y: 155.9 }, { x: 545.1, y: 145.8 }, { x: 565.0, y: 169.2 }],
  },
  { territory_id: 'I4', name: 'Greyhold',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 678.9, cy: 223.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I1', 'I5', 'I7', 'W2'],
    polygon: [{ x: 721.1, y: 243.1 }, { x: 690.4, y: 257.6 }, { x: 653.4, y: 261.5 }, { x: 636.1, y: 233.4 }, { x: 634.6, y: 202.5 }, { x: 667.6, y: 189.8 }, { x: 705.3, y: 183.7 }, { x: 722.7, y: 212.9 }],
  },
  { territory_id: 'I5', name: 'Crownforge',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 322.5, cy: 333.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I2', 'I4', 'I6', 'I7', 'B2'],
    polygon: [{ x: 361.3, y: 359.8 }, { x: 327.1, y: 370.2 }, { x: 288.6, y: 368.6 }, { x: 276.8, y: 337.4 }, { x: 281.7, y: 305.5 }, { x: 318.0, y: 297.3 }, { x: 357.7, y: 296.6 }, { x: 369.1, y: 329.2 }],
  },
  { territory_id: 'I6', name: 'Ridgefall',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'mountains' as const,
    cx: 498.5, cy: 324.5,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I3', 'I5', 'I8', 'C2'],
    polygon: [{ x: 530.4, y: 355.0 }, { x: 495.8, y: 360.1 }, { x: 459.3, y: 353.4 }, { x: 454.1, y: 322.1 }, { x: 465.0, y: 292.5 }, { x: 501.2, y: 289.7 }, { x: 539.2, y: 294.5 }, { x: 543.9, y: 327.0 }],
  },
  { territory_id: 'I7', name: 'Basinwatch',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 652.5, cy: 355.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I4', 'I5', 'I8', 'B3'],
    polygon: [{ x: 700.9, y: 355.3 }, { x: 682.6, y: 380.6 }, { x: 652.5, y: 399.1 }, { x: 621.1, y: 381.7 }, { x: 601.7, y: 355.3 }, { x: 623.1, y: 330.7 }, { x: 652.5, y: 309.9 }, { x: 684.6, y: 328.3 }],
  },
  { territory_id: 'I8', name: 'Eastspire',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 599.7, cy: 447.7,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I6', 'I7', 'B4', 'C3'],
    polygon: [{ x: 650.4, y: 454.8 }, { x: 625.8, y: 478.0 }, { x: 590.3, y: 492.6 }, { x: 561.0, y: 470.1 }, { x: 546.4, y: 440.2 }, { x: 574.1, y: 418.1 }, { x: 609.5, y: 401.2 }, { x: 639.2, y: 424.8 }],
  },

  // ══ WILD FRONTIER ═════════════════════════════════════════════════════════

  { territory_id: 'W1', name: 'Thornwood Edge',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 123.0, cy: 317.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['I1', 'W2', 'W4'],
    polygon: [{ x: 166.8, y: 330.8 }, { x: 140.6, y: 350.0 }, { x: 106.3, y: 359.3 }, { x: 84.4, y: 333.5 }, { x: 77.1, y: 302.4 }, { x: 105.8, y: 284.7 }, { x: 140.4, y: 273.1 }, { x: 162.4, y: 300.1 }],
  },
  { territory_id: 'W2', name: 'Greenmarch',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 253.0, cy: 402.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['I4', 'W1', 'W3', 'W5'],
    polygon: [{ x: 296.3, y: 423.1 }, { x: 264.8, y: 438.6 }, { x: 226.8, y: 442.7 }, { x: 209.1, y: 412.8 }, { x: 207.6, y: 379.8 }, { x: 241.4, y: 366.2 }, { x: 280.1, y: 359.8 }, { x: 297.9, y: 391.0 }],
  },
  { territory_id: 'W3', name: 'Broken Pines',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 388.0, cy: 412.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W2', 'W6', 'B1'],
    polygon: [{ x: 424.1, y: 437.1 }, { x: 392.3, y: 447.0 }, { x: 356.5, y: 445.6 }, { x: 345.5, y: 415.8 }, { x: 350.1, y: 385.6 }, { x: 383.8, y: 377.8 }, { x: 420.6, y: 377.2 }, { x: 431.4, y: 408.1 }],
  },
  { territory_id: 'W4', name: 'Mossfen',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'swamp' as const,
    cx: 98.0, cy: 537.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W1', 'W5', 'W7'],
    polygon: [{ x: 131.8, y: 571.9 }, { x: 95.1, y: 577.7 }, { x: 56.5, y: 570.0 }, { x: 51.0, y: 534.3 }, { x: 62.5, y: 500.4 }, { x: 100.9, y: 497.2 }, { x: 141.1, y: 502.7 }, { x: 146.0, y: 539.8 }],
  },
  { territory_id: 'W5', name: 'Wildcross',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'forest' as const,
    cx: 253.0, cy: 567.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W2', 'W4', 'W6', 'W8', 'B2'],
    polygon: [{ x: 309.0, y: 567.0 }, { x: 287.9, y: 596.8 }, { x: 253.0, y: 618.8 }, { x: 216.6, y: 598.2 }, { x: 194.2, y: 567.0 }, { x: 218.9, y: 537.8 }, { x: 253.0, y: 513.2 }, { x: 290.2, y: 535.1 }],
  },
  { territory_id: 'W6', name: 'Emberwood',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 398.0, cy: 577.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W3', 'W5', 'W9', 'B5'],
    polygon: [{ x: 446.9, y: 584.3 }, { x: 423.2, y: 608.0 }, { x: 389.0, y: 623.0 }, { x: 360.7, y: 600.0 }, { x: 346.6, y: 569.3 }, { x: 373.4, y: 546.7 }, { x: 407.4, y: 529.3 }, { x: 436.1, y: 553.6 }],
  },
  { territory_id: 'W7', name: 'Lowbranch',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'plains' as const,
    cx: 118.0, cy: 762.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W4', 'W8', 'S1'],
    polygon: [{ x: 172.3, y: 779.6 }, { x: 139.8, y: 803.9 }, { x: 97.3, y: 815.8 }, { x: 70.2, y: 783.0 }, { x: 61.0, y: 743.5 }, { x: 96.6, y: 721.0 }, { x: 139.5, y: 706.2 }, { x: 166.9, y: 740.6 }],
  },
  { territory_id: 'W8', name: 'Riverholt',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'plains' as const,
    cx: 273.0, cy: 777.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W5', 'W7', 'W9', 'S2'],
    polygon: [{ x: 323.2, y: 801.2 }, { x: 286.8, y: 819.0 }, { x: 242.6, y: 823.7 }, { x: 222.0, y: 789.4 }, { x: 220.2, y: 751.6 }, { x: 259.6, y: 736.0 }, { x: 304.5, y: 728.5 }, { x: 325.1, y: 764.4 }],
  },
  { territory_id: 'W9', name: 'Ashen Ford',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'plains' as const,
    cx: 388.0, cy: 792.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W6', 'W8', 'B6', 'S3'],
    polygon: [{ x: 429.0, y: 821.2 }, { x: 392.9, y: 832.6 }, { x: 352.2, y: 831.0 }, { x: 339.7, y: 796.5 }, { x: 344.9, y: 761.4 }, { x: 383.2, y: 752.3 }, { x: 425.2, y: 751.6 }, { x: 437.4, y: 787.4 }],
  },

  // ══ FRACTURE BASIN ════════════════════════════════════════════════════════

  { territory_id: 'B1', name: 'North Ruin Gate',
    continent_id: 'fracture_basin', region_id: 'northern_ruins', terrain: 'plains' as const,
    cx: 472.6, cy: 492.3,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I2', 'W3', 'B2', 'B5'],
    polygon: [{ x: 499.7, y: 518.6 }, { x: 470.2, y: 523.0 }, { x: 439.3, y: 517.2 }, { x: 434.9, y: 490.2 }, { x: 444.2, y: 464.7 }, { x: 474.9, y: 462.3 }, { x: 507.1, y: 466.5 }, { x: 511.1, y: 494.4 }],
  },
  { territory_id: 'B2', name: 'Old Bastion',
    continent_id: 'fracture_basin', region_id: 'northern_ruins', terrain: 'plains' as const,
    cx: 544.6, cy: 502.1,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I5', 'W5', 'B1', 'B3', 'B5'],
    polygon: [{ x: 587.2, y: 502.1 }, { x: 571.0, y: 524.8 }, { x: 544.6, y: 541.5 }, { x: 516.9, y: 525.8 }, { x: 499.9, y: 502.1 }, { x: 518.7, y: 479.9 }, { x: 544.6, y: 461.2 }, { x: 572.9, y: 477.9 }],
  },
  { territory_id: 'B3', name: 'Highbridge',
    continent_id: 'fracture_basin', region_id: 'northern_ruins', terrain: 'plains' as const,
    cx: 666.6, cy: 522.7,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I7', 'B2', 'B4', 'B6'],
    polygon: [{ x: 707.0, y: 528.6 }, { x: 687.4, y: 547.9 }, { x: 659.1, y: 559.9 }, { x: 635.7, y: 541.2 }, { x: 624.1, y: 516.5 }, { x: 646.2, y: 498.2 }, { x: 674.4, y: 484.1 }, { x: 698.1, y: 503.7 }],
  },
  { territory_id: 'B4', name: 'East Rupture',
    continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'mountains' as const,
    cx: 718.1, cy: 588.8,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I8', 'C3', 'B3', 'B7'],
    polygon: [{ x: 759.7, y: 601.9 }, { x: 734.8, y: 620.2 }, { x: 702.2, y: 629.0 }, { x: 681.5, y: 604.5 }, { x: 674.5, y: 575.0 }, { x: 701.8, y: 558.1 }, { x: 734.6, y: 547.1 }, { x: 755.5, y: 572.8 }],
  },
  { territory_id: 'B5', name: 'West Crucible',
    continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'plains' as const,
    cx: 488.8, cy: 611.8,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['W6', 'B1', 'B2', 'B6', 'B8'],
    polygon: [{ x: 529.9, y: 631.9 }, { x: 500.0, y: 646.5 }, { x: 463.9, y: 650.5 }, { x: 447.1, y: 622.1 }, { x: 445.6, y: 590.7 }, { x: 477.8, y: 577.8 }, { x: 514.6, y: 571.7 }, { x: 531.4, y: 601.3 }],
  },
  { territory_id: 'B6', name: 'Crownbreak',
    continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'plains' as const,
    cx: 587.2, cy: 633.9,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['W9', 'B3', 'B5', 'B7', 'B9'],
    polygon: [{ x: 627.4, y: 661.6 }, { x: 592.0, y: 672.5 }, { x: 552.1, y: 670.9 }, { x: 539.9, y: 638.2 }, { x: 545.0, y: 604.8 }, { x: 582.5, y: 596.2 }, { x: 623.6, y: 595.5 }, { x: 635.5, y: 629.6 }],
  },
  { territory_id: 'B7', name: 'Glass Rift',
    continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'plains' as const,
    cx: 677.4, cy: 685.6,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['C4', 'B4', 'B6', 'B10'],
    polygon: [{ x: 707.5, y: 716.5 }, { x: 674.8, y: 721.6 }, { x: 640.4, y: 714.9 }, { x: 635.5, y: 683.2 }, { x: 645.8, y: 653.2 }, { x: 679.9, y: 650.4 }, { x: 715.8, y: 655.3 }, { x: 720.2, y: 688.1 }],
  },
  { territory_id: 'B8', name: 'Southwatch Ruins',
    continent_id: 'fracture_basin', region_id: 'southern_ruins', terrain: 'plains' as const,
    cx: 517.5, cy: 755.3,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['S3', 'B5', 'B9'],
    polygon: [{ x: 561.6, y: 755.3 }, { x: 544.9, y: 778.9 }, { x: 517.5, y: 796.3 }, { x: 488.8, y: 780.0 }, { x: 471.2, y: 755.3 }, { x: 490.7, y: 732.2 }, { x: 517.5, y: 712.7 }, { x: 546.8, y: 730.1 }],
  },
  { territory_id: 'B9', name: 'Golden Causeway',
    continent_id: 'fracture_basin', region_id: 'southern_ruins', terrain: 'plains' as const,
    cx: 607.7, cy: 763.5,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['S5', 'B6', 'B8', 'B10'],
    polygon: [{ x: 654.1, y: 770.2 }, { x: 631.6, y: 791.9 }, { x: 599.1, y: 805.6 }, { x: 572.3, y: 784.5 }, { x: 558.9, y: 756.5 }, { x: 584.3, y: 735.8 }, { x: 616.6, y: 719.9 }, { x: 643.9, y: 742.1 }],
  },
  { territory_id: 'B10', name: 'Riftmarket',
    continent_id: 'fracture_basin', region_id: 'southern_ruins', terrain: 'plains' as const,
    cx: 697.9, cy: 784.0,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['C6', 'S6', 'B7', 'B9'],
    polygon: [{ x: 742.4, y: 797.7 }, { x: 715.8, y: 816.6 }, { x: 681.0, y: 825.8 }, { x: 658.8, y: 800.3 }, { x: 651.2, y: 769.6 }, { x: 680.4, y: 752.2 }, { x: 715.5, y: 740.7 }, { x: 737.9, y: 767.4 }],
  },

  // ══ SUNFIELDS ═════════════════════════════════════════════════════════════

  { territory_id: 'S1', name: 'Westmeadow',
    continent_id: 'sunfields', region_id: 'western_plains', terrain: 'plains' as const,
    cx: 215.8, cy: 886.6,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['W7', 'S2', 'S4'],
    polygon: [{ x: 267.3, y: 909.8 }, { x: 229.9, y: 926.9 }, { x: 184.6, y: 931.5 }, { x: 163.6, y: 898.5 }, { x: 161.7, y: 862.2 }, { x: 202.0, y: 847.2 }, { x: 248.1, y: 840.1 }, { x: 269.2, y: 874.5 }],
  },
  { territory_id: 'S2', name: 'Sunroad',
    continent_id: 'sunfields', region_id: 'western_plains', terrain: 'plains' as const,
    cx: 395.2, cy: 872.8,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['W8', 'S1', 'S3', 'S5'],
    polygon: [{ x: 443.7, y: 902.7 }, { x: 400.9, y: 914.5 }, { x: 352.9, y: 912.7 }, { x: 338.2, y: 877.4 }, { x: 344.3, y: 841.4 }, { x: 389.5, y: 832.1 }, { x: 439.1, y: 831.4 }, { x: 453.4, y: 868.1 }],
  },
  { territory_id: 'S3', name: 'Harvest Ford',
    continent_id: 'sunfields', region_id: 'western_plains', terrain: 'plains' as const,
    cx: 570.0, cy: 877.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['W9', 'B8', 'S2', 'S6'],
    polygon: [{ x: 610.0, y: 913.2 }, { x: 566.6, y: 919.1 }, { x: 520.8, y: 911.3 }, { x: 514.3, y: 874.6 }, { x: 527.9, y: 839.8 }, { x: 573.4, y: 836.6 }, { x: 621.1, y: 842.2 }, { x: 626.9, y: 880.3 }],
  },
  { territory_id: 'S4', name: 'Amberhold',
    continent_id: 'sunfields', region_id: 'western_plains', terrain: 'plains' as const,
    cx: 192.8, cy: 1024.6,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S1', 'S5', 'S7'],
    polygon: [{ x: 256.8, y: 1024.6 }, { x: 232.6, y: 1057.2 }, { x: 192.8, y: 1081.3 }, { x: 151.2, y: 1058.7 }, { x: 125.6, y: 1024.6 }, { x: 153.9, y: 992.7 }, { x: 192.8, y: 965.8 }, { x: 235.3, y: 989.8 }],
  },
  { territory_id: 'S5', name: 'Granary Cross',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 482.6, cy: 1015.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S2', 'B9', 'S4', 'S6', 'S8'],
    polygon: [{ x: 553.7, y: 1024.6 }, { x: 519.3, y: 1054.3 }, { x: 469.4, y: 1073.0 }, { x: 428.4, y: 1044.2 }, { x: 407.9, y: 1005.8 }, { x: 446.8, y: 977.4 }, { x: 496.3, y: 955.6 }, { x: 538.0, y: 986.0 }],
  },
  { territory_id: 'S6', name: 'Dawnmarch',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 698.8, cy: 997.0,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S3', 'B10', 'S5', 'S9'],
    polygon: [{ x: 760.6, y: 1014.5 }, { x: 723.6, y: 1038.7 }, { x: 675.2, y: 1050.5 }, { x: 644.4, y: 1017.8 }, { x: 633.9, y: 978.6 }, { x: 674.5, y: 956.2 }, { x: 723.3, y: 941.6 }, { x: 754.5, y: 975.8 }],
  },
  { territory_id: 'S7', name: 'South Orchard',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 252.6, cy: 1176.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S4', 'S8'],
    polygon: [{ x: 312.7, y: 1202.8 }, { x: 269.1, y: 1222.2 }, { x: 216.3, y: 1227.4 }, { x: 191.6, y: 1189.9 }, { x: 189.5, y: 1148.7 }, { x: 236.5, y: 1131.6 }, { x: 290.2, y: 1123.5 }, { x: 314.9, y: 1162.5 }],
  },
  { territory_id: 'S8', name: 'Lowgold',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 510.2, cy: 1176.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S5', 'S7', 'S9'],
    polygon: [{ x: 566.3, y: 1210.4 }, { x: 516.8, y: 1223.8 }, { x: 461.2, y: 1221.8 }, { x: 444.2, y: 1181.6 }, { x: 451.3, y: 1140.6 }, { x: 503.6, y: 1130.2 }, { x: 561.0, y: 1129.2 }, { x: 577.7, y: 1171.1 }],
  },
  { territory_id: 'S9', name: 'Coastward Fields',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'coastal' as const,
    cx: 772.4, cy: 1153.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S6', 'S8', 'C8'],
    polygon: [{ x: 816.8, y: 1194.1 }, { x: 768.5, y: 1201.0 }, { x: 717.9, y: 1191.9 }, { x: 710.7, y: 1150.2 }, { x: 725.8, y: 1110.7 }, { x: 776.2, y: 1107.0 }, { x: 829.0, y: 1113.4 }, { x: 835.5, y: 1156.7 }],
  },

  // ══ SHATTERED COAST ═══════════════════════════════════════════════════════

  { territory_id: 'C1', name: 'Northcliff',
    continent_id: 'shattered_coast', region_id: 'northern_isles', terrain: 'coastal' as const,
    cx: 795.0, cy: 290.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['I3', 'C2', 'C4'],
    polygon: [{ x: 838.7, y: 290.0 }, { x: 822.1, y: 315.3 }, { x: 795.0, y: 333.8 }, { x: 766.6, y: 316.4 }, { x: 749.1, y: 290.0 }, { x: 768.4, y: 265.4 }, { x: 795.0, y: 244.6 }, { x: 824.0, y: 263.0 }],
  },
  { territory_id: 'C2', name: 'Saltwind Pass',
    continent_id: 'shattered_coast', region_id: 'northern_isles', terrain: 'coastal' as const,
    cx: 875.0, cy: 420.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['I6', 'C1', 'C3', 'C5'],
    polygon: [{ x: 921.1, y: 427.4 }, { x: 898.8, y: 451.4 }, { x: 866.4, y: 466.5 }, { x: 839.8, y: 443.2 }, { x: 826.6, y: 412.3 }, { x: 851.8, y: 389.3 }, { x: 883.9, y: 371.8 }, { x: 911.0, y: 396.3 }],
  },
  { territory_id: 'C3', name: 'Broken Harbor',
    continent_id: 'shattered_coast', region_id: 'northern_isles', terrain: 'coastal' as const,
    cx: 840.0, cy: 560.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['I8', 'B4', 'C2', 'C6'],
    polygon: [{ x: 885.6, y: 574.6 }, { x: 858.3, y: 594.7 }, { x: 822.6, y: 604.5 }, { x: 799.8, y: 577.3 }, { x: 792.1, y: 544.7 }, { x: 822.1, y: 526.1 }, { x: 858.1, y: 513.9 }, { x: 881.0, y: 542.3 }],
  },
  { territory_id: 'C4', name: 'Blacktide Gate',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 800.0, cy: 665.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C1', 'C5', 'B7'],
    polygon: [{ x: 840.9, y: 685.6 }, { x: 811.2, y: 700.6 }, { x: 775.4, y: 704.7 }, { x: 758.6, y: 675.5 }, { x: 757.1, y: 643.4 }, { x: 789.1, y: 630.1 }, { x: 825.6, y: 623.8 }, { x: 842.4, y: 654.2 }],
  },
  { territory_id: 'C5', name: 'Shardport',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 895.0, cy: 755.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C2', 'C4', 'C6', 'C7'],
    polygon: [{ x: 933.8, y: 783.5 }, { x: 899.6, y: 794.6 }, { x: 861.1, y: 793.0 }, { x: 849.3, y: 759.4 }, { x: 854.2, y: 725.1 }, { x: 890.5, y: 716.3 }, { x: 930.2, y: 715.6 }, { x: 941.6, y: 750.6 }],
  },
  { territory_id: 'C6', name: 'Mirror Cape',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 800.0, cy: 875.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C3', 'C5', 'B10', 'C8'],
    polygon: [{ x: 834.0, y: 910.2 }, { x: 797.1, y: 916.1 }, { x: 758.2, y: 908.4 }, { x: 752.7, y: 872.2 }, { x: 764.4, y: 838.1 }, { x: 802.9, y: 834.8 }, { x: 843.3, y: 840.4 }, { x: 848.3, y: 877.8 }],
  },
  { territory_id: 'C7', name: 'Tidebreak',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 900.0, cy: 965.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C5', 'C8'],
    polygon: [{ x: 948.4, y: 965.0 }, { x: 930.1, y: 992.1 }, { x: 900.0, y: 1012.2 }, { x: 868.6, y: 993.4 }, { x: 849.2, y: 965.0 }, { x: 870.6, y: 938.4 }, { x: 900.0, y: 916.1 }, { x: 932.1, y: 936.0 }],
  },
  { territory_id: 'C8', name: 'Southwake',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 865.0, cy: 1110.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C6', 'C7', 'S9'],
    polygon: [{ x: 920.4, y: 1118.2 }, { x: 893.5, y: 1144.8 }, { x: 854.7, y: 1161.5 }, { x: 822.8, y: 1135.7 }, { x: 806.9, y: 1101.4 }, { x: 837.2, y: 1076.1 }, { x: 875.6, y: 1056.6 }, { x: 908.1, y: 1083.8 }],
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
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players. Source: v0.381-surgical-collision-cleanup.',
  width: 1000,
  height: 1400,
  min_players: 5,
  max_players: 7,
  // 00_ocean_background — v1.0 ocean base color, gradient, wave texture
  ocean_background_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/2a2d79aa8_00_ocean_background_v10.svg',
  // 01_world_landmasses — v2.1 clean: continent silhouettes + coastlines only
  underlay_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/1d9e65aeb_01_world_landmasses_v21_clean.svg',
  // 02_geography_detail — v2.0 landforms: mountains, forests, rivers, fracture scars, reefs
  geography_detail_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/6cdf1c4e3_02_geography_detail_v20_landforms.svg',
  // 03_atlas_labels — v1.0: continent titles, subtitles, sea name, compass rose, decorative rings/arcs
  atlas_labels_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/6c6f260af_03_atlas_labels_v10.svg',
  // 03_atmosphere_effects — v1.0: atmospheric depth, fog, continent glow, coastal bloom, vignette
  atmosphere_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/8fbae6fd1_09_atmosphere_v10.svg',

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