/**
 * features/maps/mapData.shattered_crown.ts
 *
 * "The Shattered Crown" — 44-territory, 5-continent map.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SOURCE: Shattered_Crown_Final_Game_Map_Data_Package (production package)
 * ═══════════════════════════════════════════════════════════════════════════════
 * All geometry, anchors, and adjacency sourced from:
 *   shattered_crown_map_metadata_final.json   — territory metadata + adjacency
 *   shattered_crown_territory_polygons_final.json — polygon geometry
 *   shattered_crown_anchors_final.json        — center / troop / label / continent anchors
 *
 * Native coordinate space: 10240 × 10240
 * Background PNG: 10240 × 10240 — exact 1:1 match with polygon coordinates.
 *
 * Validation: 44 territories · 82 adjacency pairs · 5 continents
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { MapDefinition } from './types';

// Helper: scale a points string from 1000×1400 → 10240×10240
// Previous data was scaled: x/=1000*10240, y/=1400*10240
// To restore: x *= 10.24, y *= 10240/1400
const SX = 10.24;
const SY = 10240 / 1400;

function sp(pts: string): string {
  return pts.split(' ').map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return `${+(x * SX).toFixed(1)},${+(y * SY).toFixed(1)}`;
  }).join(' ');
}
function sx(v: number) { return +(v * SX).toFixed(1); }
function sy(v: number) { return +(v * SY).toFixed(1); }

// ─── Territory data (native 10240×10240 coordinate space) ─────────────────────

const TERRITORIES = [

  // ══ FRACTURE BASIN ════════════════════════════════════════════════════════

  { territory_id: 'B1',  name: 'North Ruin Gate', continent_id: 'fracture_basin', region_id: 'northern_ruins',     terrain: 'plains'    as const,
    points:   sp('438.8,539.6 533.6,534.8 561.1,489.4 503.4,464.1 455.4,492.9 455.6,514.4'),
    cx: sx(503.1), cy: sy(503.6), troop_x: sx(503.1), troop_y: sy(484.2), label_x: sx(494.4), label_y: sy(516.9),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B2',  name: 'Old Bastion',      continent_id: 'fracture_basin', region_id: 'northern_ruins',     terrain: 'plains'    as const,
    points:   sp('570.6,622.5 452,594.5 449.3,582.5 442.7,574.6 438.8,564.5 438.8,539.6 533.6,534.8 580.9,570.6'),
    cx: sx(512.8), cy: sy(572.3), troop_x: sx(477.4), troop_y: sy(569.4), label_x: sx(511.1), label_y: sy(564.4),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B3',  name: 'Highbridge',        continent_id: 'fracture_basin', region_id: 'northern_ruins',     terrain: 'plains'    as const,
    points:   sp('580.9,570.6 533.6,534.8 561.1,489.4 578.8,474 593.8,495.5 601.6,495.5 606.8,508 626,510.9 633.9,521.6 640.1,537.2 650,548'),
    cx: sx(585.4), cy: sy(524.9), troop_x: sx(611.5), troop_y: sy(533.1), label_x: sx(587.9), label_y: sy(536.6),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B4',  name: 'East Rupture',      continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'mountains' as const,
    points:   sp('644.3,635.6 570.6,622.5 580.9,570.6 650,548 657.5,576 663,589.7 657.2,615.3'),
    cx: sx(617.0), cy: sy(592.3), troop_x: sx(638.0), troop_y: sy(572.3), label_x: sx(622.9), label_y: sy(596.5),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B5',  name: 'West Crucible',     continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'plains'    as const,
    points:   sp('452,594.5 570.6,622.5 544.3,656.6 512.9,672.3 468.2,671.8 445.4,649.2 432.6,614'),
    cx: sx(473.2), cy: sy(626.9), troop_x: sx(455.7), troop_y: sy(615.1), label_x: sx(471.9), label_y: sy(635.3),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B6',  name: 'Crownbreak',        continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'plains'    as const,
    points:   sp('544.3,656.6 570.6,622.5 644.3,635.6 662.5,670.2 646.9,700.7 612.8,716.5 575.5,717.3 554.7,699.6'),
    cx: sx(535.5), cy: sy(646.5), troop_x: sx(552.3), troop_y: sy(652.2), label_x: sx(534.0), label_y: sy(661.7),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B7',  name: 'Glass Rift',        continent_id: 'fracture_basin', region_id: 'central_crossroads', terrain: 'plains'    as const,
    points:   sp('662.5,670.2 644.3,635.6 657.2,615.3 663,589.7 700.2,606.2 715.8,636.8 713.1,670.2 695.6,691.2'),
    cx: sx(678.7), cy: sy(647.7), troop_x: sx(695.4), troop_y: sy(645.9), label_x: sx(678.7), label_y: sy(658.3),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B8',  name: 'Southwatch Ruins',  continent_id: 'fracture_basin', region_id: 'southern_ruins',    terrain: 'plains'    as const,
    points:   sp('512.9,672.3 544.3,656.6 554.7,699.6 536.8,740.7 497.9,754.2 463.7,735.1 454.5,696.9 468.2,671.8'),
    cx: sx(505.5), cy: sy(710.4), troop_x: sx(491.3), troop_y: sy(697.0), label_x: sx(503.9), label_y: sy(717.8),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B9',  name: 'Golden Causeway',   continent_id: 'fracture_basin', region_id: 'southern_ruins',    terrain: 'plains'    as const,
    points:   sp('554.7,699.6 612.8,716.5 646.9,700.7 662.5,670.2 695.6,691.2 692.9,726.3 666.1,759.6 625.6,776.2 580.9,760.3 554.7,731'),
    cx: sx(623.8), cy: sy(726.5), troop_x: sx(630.0), troop_y: sy(712.2), label_x: sx(620.9), label_y: sy(733.1),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  { territory_id: 'B10', name: 'Riftmarket',        continent_id: 'fracture_basin', region_id: 'southern_ruins',    terrain: 'plains'    as const,
    points:   sp('692.9,726.3 695.6,691.2 713.1,670.2 715.8,636.8 754.4,655 763.5,695.6 761.5,736.3 739.5,763.1 704.4,776.2'),
    cx: sx(727.7), cy: sy(713.6), troop_x: sx(737.0), troop_y: sy(697.7), label_x: sx(729.9), label_y: sy(722.1),
    resource_distribution: { brick: 15, lumber:  0, wool:  0, grain: 25, ore: 60 } },

  // ══ SHATTERED COAST ═══════════════════════════════════════════════════════

  { territory_id: 'C1',  name: 'Northcliff',        continent_id: 'shattered_coast', region_id: 'northern_isles',    terrain: 'coastal'   as const,
    points:   sp('763.5,243.4 754.4,280.9 715.8,300.2 692.9,272 703.4,238.5 730.9,212.8'),
    cx: sx(730.1), cy: sy(258.7), troop_x: sx(749.2), troop_y: sy(247.6), label_x: sx(728.5), label_y: sy(263.5),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  { territory_id: 'C2',  name: 'Saltwind Pass',     continent_id: 'shattered_coast', region_id: 'northern_isles',    terrain: 'coastal'   as const,
    points:   sp('815.8,388.3 815.8,341.1 763.5,280.9 754.4,280.9 763.5,243.4 800,218.6 841.4,225.6 871.9,270.8 875.5,331.5 858.4,374'),
    cx: sx(817.5), cy: sy(306.1), troop_x: sx(842.9), troop_y: sy(294.3), label_x: sx(817.5), label_y: sy(312.0),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  { territory_id: 'C3',  name: 'Broken Harbor',     continent_id: 'shattered_coast', region_id: 'northern_isles',    terrain: 'coastal'   as const,
    points:   sp('815.8,388.3 858.4,374 875.5,421.2 873.7,460.2 843.8,484.5 808.5,490.5 776.8,467.6 763.5,432.5 763.5,388.3'),
    cx: sx(822.3), cy: sy(434.4), troop_x: sx(843.5), troop_y: sy(418.8), label_x: sx(822.3), label_y: sy(441.1),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  { territory_id: 'C4',  name: 'Blacktide Gate',    continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal'  as const,
    points:   sp('763.5,388.3 776.8,467.6 754.4,511.6 715.8,530.8 700.2,502.9 700.2,467.6 703.4,432.5 715.8,400.6'),
    cx: sx(731.4), cy: sy(468.3), troop_x: sx(742.2), troop_y: sy(451.3), label_x: sx(731.4), label_y: sy(474.7),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  { territory_id: 'C5',  name: 'Shardport',         continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal'  as const,
    points:   sp('808.5,490.5 843.8,484.5 873.7,530.8 875.5,568.3 858.4,605.1 815.8,625.4 776.8,611.5 754.4,576.3 754.4,511.6 776.8,467.6'),
    cx: sx(819.6), cy: sy(550.1), troop_x: sx(844.3), troop_y: sy(538.4), label_x: sx(820.4), label_y: sy(558.2),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  { territory_id: 'C6',  name: 'Mirror Cape',       continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal'  as const,
    points:   sp('754.4,576.3 776.8,611.5 815.8,625.4 858.4,605.1 875.5,647.2 863.5,686.7 830.4,714.6 793.7,724.5 754.4,704.8 740.2,669.8 740.2,614'),
    cx: sx(804.5), cy: sy(651.9), troop_x: sx(832.1), troop_y: sy(641.5), label_x: sx(806.1), label_y: sy(661.9),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  { territory_id: 'C7',  name: 'Tidebreak',         continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal'  as const,
    points:   sp('858.4,605.1 875.5,568.3 912.4,578.6 940.1,618 940.1,668.2 912.4,700.7 875.5,715.5 863.5,686.7'),
    cx: sx(901.9), cy: sy(649.1), troop_x: sx(918.1), troop_y: sy(636.5), label_x: sx(901.9), label_y: sy(657.2),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  { territory_id: 'C8',  name: 'Southwake',         continent_id: 'shattered_coast', region_id: 'southern_fractures', terrain: 'coastal'  as const,
    points:   sp('863.5,686.7 875.5,715.5 912.4,700.7 940.1,733.4 940.1,793.2 912.4,833.7 863.5,857.5 820.4,841 793.7,800.5 793.7,760 793.7,724.5 830.4,714.6'),
    cx: sx(876.6), cy: sy(773.9), troop_x: sx(906.8), troop_y: sy(759.0), label_x: sx(878.3), label_y: sy(784.9),
    resource_distribution: { brick:  5, lumber:  5, wool: 35, grain: 20, ore: 35 } },

  // ══ IRONSPINE ═════════════════════════════════════════════════════════════

  { territory_id: 'I1',  name: 'Frostgate',         continent_id: 'ironspine',       region_id: 'outer_passes',      terrain: 'mountains' as const,
    points:   sp('371.1,176.4 371.1,222.5 335.7,249.3 298.1,232.4 279.5,195.3 303.8,166.3 337.6,149.4'),
    cx: sx(331.6), cy: sy(199.1), troop_x: sx(350.9), troop_y: sy(187.6), label_x: sx(329.5), label_y: sy(205.7),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  { territory_id: 'I2',  name: 'Northpass',         continent_id: 'ironspine',       region_id: 'outer_passes',      terrain: 'mountains' as const,
    points:   sp('440.4,176.4 440.4,222.5 371.1,222.5 371.1,176.4 398,141.2 421,141.2'),
    cx: sx(407.5), cy: sy(186.2), troop_x: sx(407.5), troop_y: sy(171.7), label_x: sx(407.5), label_y: sy(192.7),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  { territory_id: 'I3',  name: 'Cliffwatch',        continent_id: 'ironspine',       region_id: 'outer_passes',      terrain: 'coastal'   as const,
    points:   sp('509.8,176.4 440.4,176.4 440.4,222.5 509.8,222.5 536,195.3 521.9,163.8'),
    cx: sx(484.0), cy: sy(195.7), troop_x: sx(503.4), troop_y: sy(185.1), label_x: sx(482.8), label_y: sy(202.0),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  { territory_id: 'I4',  name: 'Greyhold',          continent_id: 'ironspine',       region_id: 'high_crown',        terrain: 'mountains' as const,
    points:   sp('279.5,195.3 298.1,232.4 335.7,249.3 371.1,222.5 440.4,222.5 440.4,290.7 371.1,290.7 335.7,312.9 298.1,290.7 263.9,268.5 244.5,230.1'),
    cx: sx(335.2), cy: sy(257.8), troop_x: sx(350.6), troop_y: sy(244.6), label_x: sx(334.1), label_y: sy(264.9),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  { territory_id: 'I5',  name: 'Crownforge',        continent_id: 'ironspine',       region_id: 'high_crown',        terrain: 'mountains' as const,
    points:   sp('440.4,222.5 509.8,222.5 536,195.3 579.3,222.5 579.3,290.7 509.8,290.7 440.4,290.7'),
    cx: sx(512.5), cy: sy(252.3), troop_x: sx(512.5), troop_y: sy(237.5), label_x: sx(512.5), label_y: sy(259.0),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  { territory_id: 'I6',  name: 'Ridgefall',         continent_id: 'ironspine',       region_id: 'outer_passes',      terrain: 'mountains' as const,
    points:   sp('579.3,222.5 509.8,222.5 509.8,290.7 579.3,290.7 619.3,268.5 619.3,230.1'),
    cx: sx(566.3), cy: sy(255.4), troop_x: sx(591.4), troop_y: sy(244.4), label_x: sx(566.3), label_y: sy(261.8),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  { territory_id: 'I7',  name: 'Basinwatch',        continent_id: 'ironspine',       region_id: 'high_crown',        terrain: 'mountains' as const,
    points:   sp('579.3,290.7 619.3,268.5 650.9,290.7 663,312.9 644.3,341.1 619.3,358.4 579.3,358.4 563.4,330.3'),
    cx: sx(614.5), cy: sy(315.4), troop_x: sx(635.4), troop_y: sy(305.5), label_x: sx(614.5), label_y: sy(321.8),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  { territory_id: 'I8',  name: 'Eastspire',         continent_id: 'ironspine',       region_id: 'high_crown',        terrain: 'mountains' as const,
    points:   sp('579.3,290.7 509.8,290.7 440.4,290.7 371.1,290.7 335.7,312.9 371.1,358.4 440.4,358.4 509.8,358.4 563.4,330.3 579.3,358.4 619.3,358.4 644.3,341.1 663,312.9'),
    cx: sx(516.6), cy: sy(326.4), troop_x: sx(516.6), troop_y: sy(311.1), label_x: sx(516.6), label_y: sy(333.2),
    resource_distribution: { brick:  5, lumber:  5, wool:  5, grain:  5, ore: 80 } },

  // ══ SUNFIELDS ═════════════════════════════════════════════════════════════

  { territory_id: 'S1',  name: 'Westmeadow',        continent_id: 'sunfields',       region_id: 'western_plains',    terrain: 'plains'    as const,
    points:   sp('259.1,920 297.5,886.3 335.7,886.3 371.1,920 371.1,965.8 335.7,993.2 297.5,993.2 259.1,965.8'),
    cx: sx(315.1), cy: sy(939.8), troop_x: sx(315.1), troop_y: sy(923.9), label_x: sx(315.1), label_y: sy(946.7),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S2',  name: 'Sunroad',           continent_id: 'sunfields',       region_id: 'western_plains',    terrain: 'plains'    as const,
    points:   sp('371.1,920 440.4,886.3 509.8,920 509.8,965.8 440.4,993.2 371.1,965.8'),
    cx: sx(440.4), cy: sy(939.5), troop_x: sx(440.4), troop_y: sy(923.6), label_x: sx(440.4), label_y: sy(946.5),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S3',  name: 'Harvest Ford',      continent_id: 'sunfields',       region_id: 'western_plains',    terrain: 'plains'    as const,
    points:   sp('509.8,920 440.4,886.3 440.4,847.9 509.8,847.9 579.3,886.3 579.3,920'),
    cx: sx(509.8), cy: sy(890.1), troop_x: sx(509.8), troop_y: sy(873.2), label_x: sx(509.8), label_y: sy(897.4),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S4',  name: 'Amberhold',         continent_id: 'sunfields',       region_id: 'western_plains',    terrain: 'plains'    as const,
    points:   sp('259.1,965.8 297.5,993.2 259.1,1033.2 207.7,1055.8 166.7,1033.2 159.9,992.6 196.1,965.8'),
    cx: sx(221.3), cy: sy(1002.5), troop_x: sx(221.3), troop_y: sy(985.0), label_x: sx(221.3), label_y: sy(1010.1),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S5',  name: 'Granary Cross',     continent_id: 'sunfields',       region_id: 'eastern_granaries', terrain: 'plains'    as const,
    points:   sp('509.8,965.8 440.4,993.2 371.1,965.8 371.1,1033.2 440.4,1060.8 509.8,1033.2'),
    cx: sx(440.4), cy: sy(1009.2), troop_x: sx(440.4), troop_y: sy(992.1), label_x: sx(440.4), label_y: sy(1016.3),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S6',  name: 'Dawnmarch',         continent_id: 'sunfields',       region_id: 'eastern_granaries', terrain: 'plains'    as const,
    points:   sp('579.3,965.8 509.8,965.8 509.8,1033.2 579.3,1060.8 648.9,1033.2 648.9,965.8'),
    cx: sx(579.3), cy: sy(1009.2), troop_x: sx(579.3), troop_y: sy(992.1), label_x: sx(579.3), label_y: sy(1016.3),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S7',  name: 'South Orchard',     continent_id: 'sunfields',       region_id: 'eastern_granaries', terrain: 'plains'    as const,
    points:   sp('371.1,1033.2 297.5,1033.2 259.1,1065.2 259.1,1120.5 297.5,1148.1 371.1,1120.5 440.4,1120.5 440.4,1060.8'),
    cx: sx(340.0), cy: sy(1090.5), troop_x: sx(340.0), troop_y: sy(1072.9), label_x: sx(340.0), label_y: sy(1097.9),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S8',  name: 'Lowgold',           continent_id: 'sunfields',       region_id: 'eastern_granaries', terrain: 'plains'    as const,
    points:   sp('509.8,1033.2 440.4,1060.8 440.4,1120.5 509.8,1148.1 579.3,1120.5 579.3,1060.8'),
    cx: sx(509.8), cy: sy(1090.7), troop_x: sx(509.8), troop_y: sy(1073.1), label_x: sx(509.8), label_y: sy(1098.1),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  { territory_id: 'S9',  name: 'Coastward Fields',  continent_id: 'sunfields',       region_id: 'eastern_granaries', terrain: 'coastal'   as const,
    points:   sp('648.9,1033.2 579.3,1060.8 579.3,1120.5 648.9,1148.1 718.3,1120.5 718.3,1065.2'),
    cx: sx(648.9), cy: sy(1090.7), troop_x: sx(648.9), troop_y: sy(1073.1), label_x: sx(648.9), label_y: sy(1098.1),
    resource_distribution: { brick:  5, lumber: 10, wool: 25, grain: 55, ore:  5 } },

  // ══ WILD FRONTIER ═════════════════════════════════════════════════════════

  { territory_id: 'W1',  name: 'Thornwood Edge',    continent_id: 'wild_frontier',   region_id: 'northern_wilds',    terrain: 'forest'    as const,
    points:   sp('279.5,195.3 244.5,230.1 207.7,249.3 171.1,232.4 152.4,195.3 171.1,158.2 207.7,141.4 244.5,158.2'),
    cx: sx(215.8), cy: sy(195.7), troop_x: sx(215.8), troop_y: sy(179.5), label_x: sx(215.8), label_y: sy(202.5),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W2',  name: 'Greenmarch',        continent_id: 'wild_frontier',   region_id: 'northern_wilds',    terrain: 'forest'    as const,
    points:   sp('244.5,230.1 263.9,268.5 298.1,290.7 263.9,312.9 225.5,312.9 196.3,290.7 152.4,290.7 152.4,249.3 171.1,232.4'),
    cx: sx(223.0), cy: sy(271.6), troop_x: sx(223.0), troop_y: sy(255.7), label_x: sx(223.0), label_y: sy(278.4),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W3',  name: 'Broken Pines',      continent_id: 'wild_frontier',   region_id: 'northern_wilds',    terrain: 'forest'    as const,
    points:   sp('335.7,312.9 298.1,290.7 263.9,312.9 225.5,312.9 196.3,358.4 244.5,403.9 298.1,403.9 335.7,358.4'),
    cx: sx(285.0), cy: sy(347.3), troop_x: sx(285.0), troop_y: sy(330.9), label_x: sx(285.0), label_y: sy(354.3),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W4',  name: 'Mossfen',           continent_id: 'wild_frontier',   region_id: 'deepwoods',         terrain: 'swamp'     as const,
    points:   sp('152.4,290.7 196.3,290.7 225.5,312.9 196.3,358.4 152.4,403.9 104.1,380.2 79.8,341.8 104.1,312.9'),
    cx: sx(157.1), cy: sy(347.5), troop_x: sx(157.1), troop_y: sy(330.5), label_x: sx(157.1), label_y: sy(354.7),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W5',  name: 'Wildcross',         continent_id: 'wild_frontier',   region_id: 'deepwoods',         terrain: 'forest'    as const,
    points:   sp('335.7,358.4 298.1,403.9 244.5,403.9 196.3,403.9 152.4,403.9 104.1,449.4 152.4,494.9 196.3,494.9 244.5,449.4 298.1,449.4 335.7,403.9'),
    cx: sx(230.4), cy: sy(433.5), troop_x: sx(230.4), troop_y: sy(417.2), label_x: sx(230.4), label_y: sy(440.8),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W6',  name: 'Emberwood',         continent_id: 'wild_frontier',   region_id: 'northern_wilds',    terrain: 'forest'    as const,
    points:   sp('371.1,358.4 335.7,403.9 298.1,449.4 244.5,449.4 298.1,494.9 371.1,494.9 438.8,464.1 455.4,421.7 438.8,403.9'),
    cx: sx(368.2), cy: sy(436.0), troop_x: sx(368.2), troop_y: sy(419.7), label_x: sx(368.2), label_y: sy(443.3),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W7',  name: 'Lowbranch',         continent_id: 'wild_frontier',   region_id: 'deepwoods',         terrain: 'plains'    as const,
    points:   sp('196.3,494.9 152.4,494.9 104.1,540.4 79.8,601.9 104.1,657.3 152.4,679.9 196.3,657.3 244.5,611.7 244.5,540.4'),
    cx: sx(163.6), cy: sy(582.1), troop_x: sx(163.6), troop_y: sy(564.5), label_x: sx(163.6), label_y: sy(589.7),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W8',  name: 'Riverholt',         continent_id: 'wild_frontier',   region_id: 'deepwoods',         terrain: 'plains'    as const,
    points:   sp('298.1,494.9 244.5,494.9 196.3,494.9 244.5,540.4 244.5,611.7 298.1,657.3 371.1,657.3 438.8,611.7 438.8,539.6 438.8,464.1 371.1,494.9'),
    cx: sx(318.0), cy: sy(571.7), troop_x: sx(318.0), troop_y: sy(554.7), label_x: sx(318.0), label_y: sy(578.7),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

  { territory_id: 'W9',  name: 'Ashen Ford',        continent_id: 'wild_frontier',   region_id: 'deepwoods',         terrain: 'plains'    as const,
    points:   sp('438.8,539.6 438.8,611.7 438.8,656.6 452,594.5 432.6,614 468.2,671.8 438.8,720 371.1,720 298.1,720 244.5,657.3 244.5,611.7 298.1,657.3 371.1,657.3'),
    cx: sx(371.1), cy: sy(658.0), troop_x: sx(371.1), troop_y: sy(640.7), label_x: sx(371.1), label_y: sy(665.4),
    resource_distribution: { brick:  5, lumber: 55, wool: 20, grain: 15, ore:  5 } },

];

// ─── Adjacency (82 pairs, from production package meta.adjacency) ──────────────

const ADJACENCY: [string, string][] = [
  ['I1', 'I2'], ['I1', 'I4'], ['I1', 'W1'],
  ['I2', 'I3'], ['I2', 'I5'], ['I2', 'B1'],
  ['I3', 'I6'], ['I3', 'C1'],
  ['I4', 'I5'], ['I4', 'I7'], ['I4', 'W2'],
  ['I5', 'I6'], ['I5', 'I7'], ['I5', 'B2'],
  ['I6', 'I8'], ['I6', 'C2'],
  ['I7', 'I8'], ['I7', 'B3'],
  ['I8', 'B4'], ['I8', 'C3'],
  ['W1', 'W2'], ['W1', 'W4'],
  ['W2', 'W3'], ['W2', 'W5'],
  ['W3', 'W6'], ['W3', 'B1'],
  ['W4', 'W5'], ['W4', 'W7'],
  ['W5', 'W6'], ['W5', 'W8'], ['W5', 'B2'],
  ['W6', 'W9'], ['W6', 'B5'],
  ['W7', 'W8'], ['W7', 'S1'],
  ['W8', 'W9'], ['W8', 'S2'],
  ['W9', 'B6'], ['W9', 'S3'],
  ['B1', 'B2'], ['B1', 'B5'],
  ['B2', 'B3'], ['B2', 'B5'],
  ['B3', 'B4'], ['B3', 'B6'],
  ['B4', 'C3'], ['B4', 'B7'],
  ['B5', 'B6'], ['B5', 'B8'],
  ['B6', 'B7'], ['B6', 'B9'],
  ['B7', 'C4'], ['B7', 'B10'],
  ['B8', 'S3'], ['B8', 'B9'],
  ['B9', 'S5'], ['B9', 'B10'],
  ['B10', 'C6'], ['B10', 'S6'],
  ['S1', 'S2'], ['S1', 'S4'],
  ['S2', 'S3'], ['S2', 'S5'],
  ['S3', 'S6'],
  ['S4', 'S5'], ['S4', 'S7'],
  ['S5', 'S6'], ['S5', 'S8'],
  ['S6', 'S9'],
  ['S7', 'S8'],
  ['S8', 'S9'],
  ['S9', 'C8'],
  ['C1', 'C2'], ['C1', 'C4'],
  ['C2', 'C3'], ['C2', 'C5'],
  ['C3', 'C5'],
  ['C4', 'C5'], ['C4', 'C6'],
  ['C5', 'C6'], ['C5', 'C7'],
  ['C6', 'C7'], ['C6', 'C8'],
  ['C7', 'C8'],
];

// ─── Map definition ───────────────────────────────────────────────────────────

export const MAP_SHATTERED_CROWN: MapDefinition = {
  id: 'shattered_crown_v1',
  name: 'The Shattered Crown',
  description: '44-territory campaign map across 5 continents. Recommended 5–7 players.',
  width:  10240,
  height: 10240,
  min_players: 5,
  max_players: 7,

  // ── Background art (single 10240×10240 PNG) ────────────────────────────────
  background_image_url: 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/7af44e9bf_SHATTERED_CROWN_MAP_PNG.png',

  // ── Continents ─────────────────────────────────────────────────────────────
  continents: [
    { id: 'ironspine',       name: 'Ironspine',       control_bonus: 7,  color: '#64748b' },
    { id: 'wild_frontier',   name: 'Wild Frontier',   control_bonus: 8,  color: '#16a34a' },
    { id: 'fracture_basin',  name: 'Fracture Basin',  control_bonus: 10, color: '#dc2626' },
    { id: 'sunfields',       name: 'Sunfields',       control_bonus: 8,  color: '#ca8a04' },
    { id: 'shattered_coast', name: 'Shattered Coast', control_bonus: 7,  color: '#0891b2' },
  ],

  // ── Regions ────────────────────────────────────────────────────────────────
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

  // ── Territories ────────────────────────────────────────────────────────────
  territories: TERRITORIES.map(t => ({
    territory_id:          t.territory_id,
    name:                  t.name,
    continent_id:          t.continent_id,
    region_id:             t.region_id,
    terrain:               t.terrain,
    points:                t.points,
    cx:                    t.cx,
    cy:                    t.cy,
    troop_x:               t.troop_x,
    troop_y:               t.troop_y,
    label_x:               t.label_x,
    label_y:               t.label_y,
    resource_distribution: t.resource_distribution,
  })),

  // ── Adjacency ──────────────────────────────────────────────────────────────
  adjacency: ADJACENCY,
};