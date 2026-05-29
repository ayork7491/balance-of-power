/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 * Source: shattered_crown_map_data_v37_density_pass.json (version 0.37-density-pass)
 * Coordinate space: 1000 × 1400 logical units.
 * Recommended players: 5–7 (ideal: 6)
 *
 * v3.7 Density Pass: final geometry freeze candidate before world-art development.
 * - Fracture Basin: dense central conflict zone
 * - Ironspine: relatively dense continuous mountain crown
 * - Sunfields: moderate density connected southern lowlands
 * - Wild Frontier: open wilderness / maneuver space
 * - Shattered Coast: most open — island and archipelago feel
 *
 * Gameplay graph (adjacency, IDs, regions, resources) is IDENTICAL to v3.
 * Only visual geometry (polygon, center, cx/cy) has been updated.
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

// ─── v3.7 territory data (geometry from density-pass JSON) ───────────────────

const RAW_TERRITORIES = [

  // ══ IRONSPINE ═════════════════════════════════════════════════════════════

  { territory_id: 'I1', name: 'Frostgate',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'mountains' as const,
    cx: 238.9, cy: 158.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I2', 'I4', 'W1'],
    polygon: [{ x: 281.0, y: 158.3 }, { x: 265.1, y: 180.6 }, { x: 238.9, y: 197.1 }, { x: 211.5, y: 181.6 }, { x: 194.7, y: 158.3 }, { x: 213.3, y: 136.5 }, { x: 238.9, y: 118.1 }, { x: 266.9, y: 134.4 }],
  },
  { territory_id: 'I2', name: 'Northpass',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'mountains' as const,
    cx: 379.7, cy: 118.7,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I1', 'I3', 'I5', 'B1'],
    polygon: [{ x: 424.3, y: 124.5 }, { x: 402.7, y: 143.3 }, { x: 371.4, y: 155.2 }, { x: 345.7, y: 137.0 }, { x: 332.9, y: 112.6 }, { x: 357.2, y: 94.6 }, { x: 388.3, y: 80.8 }, { x: 414.4, y: 100.1 }],
  },
  { territory_id: 'I3', name: 'Cliffwatch',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'coastal' as const,
    cx: 529.3, cy: 118.7,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I2', 'I6', 'C1'],
    polygon: [{ x: 569.0, y: 130.6 }, { x: 545.3, y: 147.2 }, { x: 514.2, y: 155.2 }, { x: 494.4, y: 132.9 }, { x: 487.6, y: 106.1 }, { x: 513.7, y: 90.9 }, { x: 545.1, y: 80.8 }, { x: 565.0, y: 104.2 }],
  },
  { territory_id: 'I4', name: 'Greyhold',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 678.9, cy: 158.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I1', 'I5', 'I7', 'W2'],
    polygon: [{ x: 721.1, y: 178.1 }, { x: 690.4, y: 192.6 }, { x: 653.4, y: 196.5 }, { x: 636.1, y: 168.4 }, { x: 634.6, y: 137.5 }, { x: 667.6, y: 124.8 }, { x: 705.3, y: 118.7 }, { x: 722.7, y: 147.9 }],
  },
  { territory_id: 'I5', name: 'Crownforge',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 322.5, cy: 268.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I2', 'I4', 'I6', 'I7', 'B2'],
    polygon: [{ x: 361.3, y: 294.8 }, { x: 327.1, y: 305.2 }, { x: 288.6, y: 303.6 }, { x: 276.8, y: 272.4 }, { x: 281.7, y: 240.5 }, { x: 318.0, y: 232.3 }, { x: 357.7, y: 231.6 }, { x: 369.1, y: 264.2 }],
  },
  { territory_id: 'I6', name: 'Ridgefall',
    continent_id: 'ironspine', region_id: 'outer_passes', terrain: 'mountains' as const,
    cx: 498.5, cy: 259.5,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I3', 'I5', 'I8', 'C2'],
    polygon: [{ x: 530.4, y: 290.0 }, { x: 495.8, y: 295.1 }, { x: 459.3, y: 288.4 }, { x: 454.1, y: 257.1 }, { x: 465.0, y: 227.5 }, { x: 501.2, y: 224.7 }, { x: 539.2, y: 229.5 }, { x: 543.9, y: 262.0 }],
  },
  { territory_id: 'I7', name: 'Basinwatch',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 652.5, cy: 290.3,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I4', 'I5', 'I8', 'B3'],
    polygon: [{ x: 700.9, y: 290.3 }, { x: 682.6, y: 315.6 }, { x: 652.5, y: 334.1 }, { x: 621.1, y: 316.7 }, { x: 601.7, y: 290.3 }, { x: 623.1, y: 265.7 }, { x: 652.5, y: 244.9 }, { x: 684.6, y: 263.3 }],
  },
  { territory_id: 'I8', name: 'Eastspire',
    continent_id: 'ironspine', region_id: 'high_crown', terrain: 'mountains' as const,
    cx: 599.7, cy: 382.7,
    resource: res({ ore: 50, stone: 40, relics: 10 }),
    adjacency_ids: ['I6', 'I7', 'B4', 'C3'],
    polygon: [{ x: 650.4, y: 389.8 }, { x: 625.8, y: 413.0 }, { x: 590.3, y: 427.6 }, { x: 561.0, y: 405.1 }, { x: 546.4, y: 375.2 }, { x: 574.1, y: 353.1 }, { x: 609.5, y: 336.2 }, { x: 639.2, y: 359.8 }],
  },

  // ══ WILD FRONTIER ═════════════════════════════════════════════════════════

  { territory_id: 'W1', name: 'Thornwood Edge',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 95.0, cy: 305.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['I1', 'W2', 'W4'],
    polygon: [{ x: 138.8, y: 318.8 }, { x: 112.6, y: 338.0 }, { x: 78.3, y: 347.3 }, { x: 56.4, y: 321.5 }, { x: 49.1, y: 290.4 }, { x: 77.8, y: 272.7 }, { x: 112.4, y: 261.1 }, { x: 134.4, y: 288.1 }],
  },
  { territory_id: 'W2', name: 'Greenmarch',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 225.0, cy: 390.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['I4', 'W1', 'W3', 'W5'],
    polygon: [{ x: 268.3, y: 411.1 }, { x: 236.8, y: 426.6 }, { x: 198.8, y: 430.7 }, { x: 181.1, y: 400.8 }, { x: 179.6, y: 367.8 }, { x: 213.4, y: 354.2 }, { x: 252.1, y: 347.8 }, { x: 269.9, y: 379.0 }],
  },
  { territory_id: 'W3', name: 'Broken Pines',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 360.0, cy: 400.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W2', 'W6', 'B1'],
    polygon: [{ x: 396.1, y: 425.1 }, { x: 364.3, y: 435.0 }, { x: 328.5, y: 433.6 }, { x: 317.5, y: 403.8 }, { x: 322.1, y: 373.6 }, { x: 355.8, y: 365.8 }, { x: 392.6, y: 365.2 }, { x: 403.4, y: 396.1 }],
  },
  { territory_id: 'W4', name: 'Mossfen',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'swamp' as const,
    cx: 70.0, cy: 525.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W1', 'W5', 'W7'],
    polygon: [{ x: 103.8, y: 559.9 }, { x: 67.1, y: 565.7 }, { x: 28.5, y: 558.0 }, { x: 23.0, y: 522.3 }, { x: 34.5, y: 488.4 }, { x: 72.9, y: 485.2 }, { x: 113.1, y: 490.7 }, { x: 118.0, y: 527.8 }],
  },
  { territory_id: 'W5', name: 'Wildcross',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'forest' as const,
    cx: 225.0, cy: 555.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W2', 'W4', 'W6', 'W8', 'B2'],
    polygon: [{ x: 281.0, y: 555.0 }, { x: 259.9, y: 584.8 }, { x: 225.0, y: 606.8 }, { x: 188.6, y: 586.2 }, { x: 166.2, y: 555.0 }, { x: 190.9, y: 525.8 }, { x: 225.0, y: 501.2 }, { x: 262.2, y: 523.1 }],
  },
  { territory_id: 'W6', name: 'Emberwood',
    continent_id: 'wild_frontier', region_id: 'northern_wilds', terrain: 'forest' as const,
    cx: 370.0, cy: 565.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W3', 'W5', 'W9', 'B5'],
    polygon: [{ x: 418.9, y: 572.3 }, { x: 395.2, y: 596.0 }, { x: 361.0, y: 611.0 }, { x: 332.7, y: 588.0 }, { x: 318.6, y: 557.3 }, { x: 345.4, y: 534.7 }, { x: 379.4, y: 517.3 }, { x: 408.1, y: 541.6 }],
  },
  { territory_id: 'W7', name: 'Lowbranch',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'plains' as const,
    cx: 90.0, cy: 750.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W4', 'W8', 'S1'],
    polygon: [{ x: 144.3, y: 767.6 }, { x: 111.8, y: 791.9 }, { x: 69.3, y: 803.8 }, { x: 42.2, y: 771.0 }, { x: 33.0, y: 731.5 }, { x: 68.6, y: 709.0 }, { x: 111.5, y: 694.2 }, { x: 138.9, y: 728.6 }],
  },
  { territory_id: 'W8', name: 'Riverholt',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'plains' as const,
    cx: 245.0, cy: 765.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W5', 'W7', 'W9', 'S2'],
    polygon: [{ x: 295.2, y: 789.2 }, { x: 258.8, y: 807.0 }, { x: 214.6, y: 811.7 }, { x: 194.0, y: 777.4 }, { x: 192.2, y: 739.6 }, { x: 231.6, y: 724.0 }, { x: 276.5, y: 716.5 }, { x: 297.1, y: 752.4 }],
  },
  { territory_id: 'W9', name: 'Ashen Ford',
    continent_id: 'wild_frontier', region_id: 'deepwoods', terrain: 'plains' as const,
    cx: 360.0, cy: 780.0,
    resource: res({ lumber: 50, grain: 25, wool: 25 }),
    adjacency_ids: ['W6', 'W8', 'B6', 'S3'],
    polygon: [{ x: 401.0, y: 809.2 }, { x: 364.9, y: 820.6 }, { x: 324.2, y: 819.0 }, { x: 311.7, y: 784.5 }, { x: 316.9, y: 749.4 }, { x: 355.2, y: 740.3 }, { x: 397.2, y: 739.6 }, { x: 409.4, y: 775.4 }],
  },

  // ══ FRACTURE BASIN ════════════════════════════════════════════════════════

  { territory_id: 'B1', name: 'North Ruin Gate',
    continent_id: 'fracture_basin', region_id: 'northern_ruins', terrain: 'plains' as const,
    cx: 480.6, cy: 468.3,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I2', 'W3', 'B2', 'B5'],
    polygon: [{ x: 507.7, y: 494.6 }, { x: 478.2, y: 499.0 }, { x: 447.3, y: 493.2 }, { x: 442.9, y: 466.2 }, { x: 452.2, y: 440.7 }, { x: 482.9, y: 438.3 }, { x: 515.1, y: 442.5 }, { x: 519.1, y: 470.4 }],
  },
  { territory_id: 'B2', name: 'Old Bastion',
    continent_id: 'fracture_basin', region_id: 'northern_ruins', terrain: 'plains' as const,
    cx: 562.6, cy: 460.1,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I5', 'W5', 'B1', 'B3', 'B5'],
    polygon: [{ x: 605.2, y: 460.1 }, { x: 589.0, y: 482.8 }, { x: 562.6, y: 499.5 }, { x: 534.9, y: 483.8 }, { x: 517.9, y: 460.1 }, { x: 536.7, y: 437.9 }, { x: 562.6, y: 419.2 }, { x: 590.9, y: 435.9 }],
  },
  { territory_id: 'B3', name: 'Highbridge',
    continent_id: 'fracture_basin', region_id: 'northern_ruins', terrain: 'plains' as const,
    cx: 644.6, cy: 484.7,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I7', 'B2', 'B4', 'B6'],
    polygon: [{ x: 685.0, y: 490.6 }, { x: 665.4, y: 509.9 }, { x: 637.1, y: 521.9 }, { x: 613.7, y: 503.2 }, { x: 602.1, y: 478.5 }, { x: 624.2, y: 460.2 }, { x: 652.4, y: 446.1 }, { x: 676.1, y: 465.7 }],
  },
  { territory_id: 'B4', name: 'East Rupture',
    continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'mountains' as const,
    cx: 706.1, cy: 570.8,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['I8', 'C3', 'B3', 'B7'],
    polygon: [{ x: 747.7, y: 583.9 }, { x: 722.8, y: 602.2 }, { x: 690.2, y: 611.0 }, { x: 669.5, y: 586.5 }, { x: 662.5, y: 557.0 }, { x: 689.8, y: 540.1 }, { x: 722.6, y: 529.1 }, { x: 743.5, y: 554.8 }],
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
    cx: 587.2, cy: 615.9,
    resource: res({ relics: 35, ore: 25, grain: 25, stone: 15 }),
    adjacency_ids: ['W9', 'B3', 'B5', 'B7', 'B9'],
    polygon: [{ x: 627.4, y: 643.6 }, { x: 592.0, y: 654.5 }, { x: 552.1, y: 652.9 }, { x: 539.9, y: 620.2 }, { x: 545.0, y: 586.8 }, { x: 582.5, y: 578.2 }, { x: 623.6, y: 577.5 }, { x: 635.5, y: 611.6 }],
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
    cx: 215.8, cy: 956.6,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['W7', 'S2', 'S4'],
    polygon: [{ x: 267.3, y: 979.8 }, { x: 229.9, y: 996.9 }, { x: 184.6, y: 1001.5 }, { x: 163.6, y: 968.5 }, { x: 161.7, y: 932.2 }, { x: 202.0, y: 917.2 }, { x: 248.1, y: 910.1 }, { x: 269.2, y: 944.5 }],
  },
  { territory_id: 'S2', name: 'Sunroad',
    continent_id: 'sunfields', region_id: 'western_plains', terrain: 'plains' as const,
    cx: 395.2, cy: 942.8,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['W8', 'S1', 'S3', 'S5'],
    polygon: [{ x: 443.7, y: 972.7 }, { x: 400.9, y: 984.5 }, { x: 352.9, y: 982.7 }, { x: 338.2, y: 947.4 }, { x: 344.3, y: 911.4 }, { x: 389.5, y: 902.1 }, { x: 439.1, y: 901.4 }, { x: 453.4, y: 938.1 }],
  },
  { territory_id: 'S3', name: 'Harvest Ford',
    continent_id: 'sunfields', region_id: 'western_plains', terrain: 'plains' as const,
    cx: 570.0, cy: 947.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['W9', 'B8', 'S2', 'S6'],
    polygon: [{ x: 610.0, y: 983.2 }, { x: 566.6, y: 989.1 }, { x: 520.8, y: 981.3 }, { x: 514.3, y: 944.6 }, { x: 527.9, y: 909.8 }, { x: 573.4, y: 906.6 }, { x: 621.1, y: 912.2 }, { x: 626.9, y: 950.3 }],
  },
  { territory_id: 'S4', name: 'Amberhold',
    continent_id: 'sunfields', region_id: 'western_plains', terrain: 'plains' as const,
    cx: 192.8, cy: 1094.6,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S1', 'S5', 'S7'],
    polygon: [{ x: 256.8, y: 1094.6 }, { x: 232.6, y: 1127.2 }, { x: 192.8, y: 1151.3 }, { x: 151.2, y: 1128.7 }, { x: 125.6, y: 1094.6 }, { x: 153.9, y: 1062.7 }, { x: 192.8, y: 1035.8 }, { x: 235.3, y: 1059.8 }],
  },
  { territory_id: 'S5', name: 'Granary Cross',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 482.6, cy: 1085.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S2', 'B9', 'S4', 'S6', 'S8'],
    polygon: [{ x: 553.7, y: 1094.6 }, { x: 519.3, y: 1124.3 }, { x: 469.4, y: 1143.0 }, { x: 428.4, y: 1114.2 }, { x: 407.9, y: 1075.8 }, { x: 446.8, y: 1047.4 }, { x: 496.3, y: 1025.6 }, { x: 538.0, y: 1056.0 }],
  },
  { territory_id: 'S6', name: 'Dawnmarch',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 698.8, cy: 1067.0,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S3', 'B10', 'S5', 'S9'],
    polygon: [{ x: 760.6, y: 1084.5 }, { x: 723.6, y: 1108.7 }, { x: 675.2, y: 1120.5 }, { x: 644.4, y: 1087.8 }, { x: 633.9, y: 1048.6 }, { x: 674.5, y: 1026.2 }, { x: 723.3, y: 1011.6 }, { x: 754.5, y: 1045.8 }],
  },
  { territory_id: 'S7', name: 'South Orchard',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 252.6, cy: 1246.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S4', 'S8'],
    polygon: [{ x: 312.7, y: 1272.8 }, { x: 269.1, y: 1292.2 }, { x: 216.3, y: 1297.4 }, { x: 191.6, y: 1259.9 }, { x: 189.5, y: 1218.7 }, { x: 236.5, y: 1201.6 }, { x: 290.2, y: 1193.5 }, { x: 314.9, y: 1232.5 }],
  },
  { territory_id: 'S8', name: 'Lowgold',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'plains' as const,
    cx: 510.2, cy: 1246.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S5', 'S7', 'S9'],
    polygon: [{ x: 566.3, y: 1280.4 }, { x: 516.8, y: 1293.8 }, { x: 461.2, y: 1291.8 }, { x: 444.2, y: 1251.6 }, { x: 451.3, y: 1210.6 }, { x: 503.6, y: 1200.2 }, { x: 561.0, y: 1199.2 }, { x: 577.7, y: 1241.1 }],
  },
  { territory_id: 'S9', name: 'Coastward Fields',
    continent_id: 'sunfields', region_id: 'eastern_granaries', terrain: 'coastal' as const,
    cx: 772.4, cy: 1223.4,
    resource: res({ grain: 60, wool: 25, lumber: 15 }),
    adjacency_ids: ['S6', 'S8', 'C8'],
    polygon: [{ x: 816.8, y: 1264.1 }, { x: 768.5, y: 1271.0 }, { x: 717.9, y: 1261.9 }, { x: 710.7, y: 1220.2 }, { x: 725.8, y: 1180.7 }, { x: 776.2, y: 1177.0 }, { x: 829.0, y: 1183.4 }, { x: 835.5, y: 1226.7 }],
  },

  // ══ SHATTERED COAST ═══════════════════════════════════════════════════════

  { territory_id: 'C1', name: 'Northcliff',
    continent_id: 'shattered_coast', region_id: 'northern_isles', terrain: 'coastal' as const,
    cx: 830.0, cy: 280.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['I3', 'C2', 'C4'],
    polygon: [{ x: 873.7, y: 280.0 }, { x: 857.1, y: 305.3 }, { x: 830.0, y: 323.8 }, { x: 801.6, y: 306.4 }, { x: 784.1, y: 280.0 }, { x: 803.4, y: 255.4 }, { x: 830.0, y: 234.6 }, { x: 859.0, y: 253.0 }],
  },
  { territory_id: 'C2', name: 'Saltwind Pass',
    continent_id: 'shattered_coast', region_id: 'northern_isles', terrain: 'coastal' as const,
    cx: 910.0, cy: 410.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['I6', 'C1', 'C3', 'C5'],
    polygon: [{ x: 956.1, y: 417.4 }, { x: 933.8, y: 441.4 }, { x: 901.4, y: 456.5 }, { x: 874.8, y: 433.2 }, { x: 861.6, y: 402.3 }, { x: 886.8, y: 379.3 }, { x: 918.9, y: 361.8 }, { x: 946.0, y: 386.3 }],
  },
  { territory_id: 'C3', name: 'Broken Harbor',
    continent_id: 'shattered_coast', region_id: 'northern_isles', terrain: 'coastal' as const,
    cx: 875.0, cy: 550.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['I8', 'B4', 'C2', 'C6'],
    polygon: [{ x: 920.6, y: 564.6 }, { x: 893.3, y: 584.7 }, { x: 857.6, y: 594.5 }, { x: 834.8, y: 567.3 }, { x: 827.1, y: 534.7 }, { x: 857.1, y: 516.1 }, { x: 893.1, y: 503.9 }, { x: 916.0, y: 532.3 }],
  },
  { territory_id: 'C4', name: 'Blacktide Gate',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 835.0, cy: 655.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C1', 'C5', 'B7'],
    polygon: [{ x: 875.9, y: 675.6 }, { x: 846.2, y: 690.6 }, { x: 810.4, y: 694.7 }, { x: 793.6, y: 665.5 }, { x: 792.1, y: 633.4 }, { x: 824.1, y: 620.1 }, { x: 860.6, y: 613.8 }, { x: 877.4, y: 644.2 }],
  },
  { territory_id: 'C5', name: 'Shardport',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 930.0, cy: 745.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C2', 'C4', 'C6', 'C7'],
    polygon: [{ x: 968.8, y: 773.5 }, { x: 934.6, y: 784.6 }, { x: 896.1, y: 783.0 }, { x: 884.3, y: 749.4 }, { x: 889.2, y: 715.1 }, { x: 925.5, y: 706.3 }, { x: 965.2, y: 705.6 }, { x: 976.6, y: 740.6 }],
  },
  { territory_id: 'C6', name: 'Mirror Cape',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 835.0, cy: 865.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C3', 'C5', 'B10', 'C8'],
    polygon: [{ x: 869.0, y: 900.2 }, { x: 832.1, y: 906.1 }, { x: 793.2, y: 898.4 }, { x: 787.7, y: 862.2 }, { x: 799.4, y: 828.1 }, { x: 837.9, y: 824.8 }, { x: 878.3, y: 830.4 }, { x: 883.3, y: 867.8 }],
  },
  { territory_id: 'C7', name: 'Tidebreak',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 935.0, cy: 955.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C5', 'C8'],
    polygon: [{ x: 983.4, y: 955.0 }, { x: 965.1, y: 982.1 }, { x: 935.0, y: 1002.2 }, { x: 903.6, y: 983.4 }, { x: 884.2, y: 955.0 }, { x: 905.6, y: 928.4 }, { x: 935.0, y: 906.1 }, { x: 967.1, y: 926.0 }],
  },
  { territory_id: 'C8', name: 'Southwake',
    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal' as const,
    cx: 900.0, cy: 1100.0,
    resource: res({ wool: 35, ore: 25, grain: 20, relics: 20 }),
    adjacency_ids: ['C6', 'C7', 'S9'],
    polygon: [{ x: 955.4, y: 1108.2 }, { x: 928.5, y: 1134.8 }, { x: 889.7, y: 1151.5 }, { x: 857.8, y: 1125.7 }, { x: 841.9, y: 1091.4 }, { x: 872.2, y: 1066.1 }, { x: 910.6, y: 1046.6 }, { x: 943.1, y: 1073.8 }],
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
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players. Source: v0.37-density-pass.',
  width: 1000,
  height: 1400,
  min_players: 5,
  max_players: 7,
  underlay_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/6942acb34_shattered_crown_svg_v37_density_pass.svg',

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