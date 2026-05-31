/**
 * TerritoryPolygon — Terrain & Landmass Composition Pass
 *
 * No onClick — all pointer handling delegated to MapRenderer via event delegation.
 * Every interactive element carries data-tid.
 */

const TERRAIN_FILL = {
  mountains: '#1c2840',
  forest:    '#0e1c12',
  swamp:     '#111e14',
  tundra:    '#182030',
  coastal:   '#081828',
  desert:    '#1e1608',
  urban:     '#18182a',
  plains:    '#141808',
};

const TERRAIN_STROKE = {
  mountains: '#5a7a9e',
  forest:    '#2ea84a',
  swamp:     '#4aaa6a',
  tundra:    '#7a9ab8',
  coastal:   '#1e90c8',
  desert:    '#c8962a',
  urban:     '#8a6abe',
  plains:    '#8aaa3a',
};

const CONTINENT_STROKE_ACCENT = {
  ironspine:       '#5a7a9e',
  wild_frontier:   '#2ea84a',
  fracture_basin:  '#c84040',
  sunfields:       '#c8962a',
  shattered_coast: '#1e90c8',
};

const DEFAULT_FILL   = '#141820';
const DEFAULT_STROKE = '#4a5a6a';

export default function TerritoryPolygon({
  territory,
  regionColor,
  ownerColor,
  troopCount,
  isSelected,
  isHighlighted,
  isAttackable,
  isLocked,
}) {
  const { points, cx, cy, terrain, territory_id, continent_id } = territory;
  const terrainKey = terrain ?? 'plains';

  const baseFill   = TERRAIN_FILL[terrainKey]   ?? DEFAULT_FILL;
  const baseStroke = TERRAIN_STROKE[terrainKey] ?? CONTINENT_STROKE_ACCENT[continent_id] ?? DEFAULT_STROKE;

  // Fill
  let fillColor   = baseFill;
  let fillOpacity = 0.72;
  if (ownerColor) {
    fillColor   = ownerColor;
    fillOpacity = isSelected ? 0.30 : 0.16;
  } else if (isSelected) {
    fillOpacity = 0.88;
  }

  // Stroke
  let strokeColor   = ownerColor ?? baseStroke;
  let strokeWidth   = isSelected ? 2.4 : 1.0;
  let strokeOpacity = isSelected ? 1.0 : (ownerColor ? 0.80 : 0.55);

  if (isHighlighted) {
    strokeColor   = '#fde047';
    strokeWidth   = 2.6;
    strokeOpacity = 1.0;
  }
  if (isAttackable) {
    strokeColor   = '#f87171';
    strokeWidth   = 2.2;
    strokeOpacity = 1.0;
  }
  if (isLocked) {
    strokeColor   = '#f97316'; // orange
    strokeWidth   = 2.4;
    strokeOpacity = 1.0;
  }

  // Glow filter
  let filterAttr;
  if (isSelected)    filterAttr = 'url(#glow-selected)';
  if (isHighlighted) filterAttr = 'url(#glow-highlight)';
  if (isAttackable)  filterAttr = 'url(#glow-attack)';
  if (isLocked)      filterAttr = 'url(#glow-attack)'; // reuse red glow, orange stroke distinguishes it

  const ownedEdgeStroke = ownerColor && !isSelected && !isHighlighted && !isAttackable
    ? ownerColor : null;

  return (
    <g data-tid={territory_id} style={{ cursor: 'pointer' }}>

      {/* Owned territory edge halo */}
      {ownedEdgeStroke && (
        <polygon
          data-tid={territory_id}
          points={points}
          fill="none"
          stroke={ownedEdgeStroke}
          strokeWidth={6}
          strokeOpacity={0.18}
          filter="url(#glow-owner)"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Main polygon */}
      <polygon
        data-tid={territory_id}
        points={points}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        filter={filterAttr}
      />

      {/* Inner edge sheen for unowned territories */}
      {!ownerColor && !isSelected && (
        <polygon
          data-tid={territory_id}
          points={points}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={3}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Locked territory overlay — orange diagonal hatch */}
      {isLocked && (
        <polygon
          data-tid={territory_id}
          points={points}
          fill="url(#locked-hatch)"
          fillOpacity={0.35}
          stroke="none"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Troop count badge */}
      {troopCount > 0 && (
        <>
          <circle data-tid={territory_id} cx={cx} cy={cy} r={13}
            fill="rgba(0,0,0,0.0)" stroke={ownerColor ?? baseStroke}
            strokeWidth={1.8} strokeOpacity={0.70}
          />
          <circle data-tid={territory_id} cx={cx} cy={cy} r={11}
            fill="rgba(6,10,18,0.85)" stroke="none"
          />
          <text
            data-tid={territory_id}
            x={cx} y={cy + 4}
            textAnchor="middle"
            fontSize={9}
            fontFamily="'Orbitron', monospace"
            fontWeight="700"
            fill="#e8eef8"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {troopCount}
          </text>
        </>
      )}
    </g>
  );
}