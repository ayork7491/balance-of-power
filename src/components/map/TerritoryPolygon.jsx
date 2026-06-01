/**
 * TerritoryPolygon — renders a single territory polygon with ownership fills,
 * state highlights, and troop badges.
 *
 * No onClick — all pointer handling delegated to MapRenderer via event delegation.
 * Every interactive element carries data-tid.
 */

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

const DEFAULT_STROKE = '#4a5a6a';

// Badge radius in native map coords (10240×10240 space)
const BADGE_R = 90;

function TroopBadge({ cx, cy, troopCount, color, tid }) {
  return (
    <>
      {/* Outer colored ring */}
      <circle
        data-tid={tid}
        cx={cx} cy={cy} r={BADGE_R}
        fill="rgba(0,0,0,0.72)"
        stroke={color}
        strokeWidth={22}
        strokeOpacity={0.95}
      />
      {/* Troop count text */}
      <text
        data-tid={tid}
        x={cx} y={cy + BADGE_R * 0.38}
        textAnchor="middle"
        fontSize={BADGE_R * 1.1}
        fontFamily="'Orbitron', monospace"
        fontWeight="700"
        fill={color}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {troopCount}
      </text>
    </>
  );
}

export default function TerritoryPolygon({
  territory,
  regionColor,
  ownerColor,
  troopCount,
  isSelected,
  isHighlighted,
  isAttackable,
  isLocked,
  mapView = 'artistic',
}) {
  const { points, cx, cy, troop_x, troop_y, terrain, territory_id, continent_id } = territory;
  const tx = troop_x ?? cx;
  const ty = troop_y ?? cy;
  const terrainKey = terrain ?? 'plains';
  const baseStroke = TERRAIN_STROKE[terrainKey] ?? CONTINENT_STROKE_ACCENT[continent_id] ?? DEFAULT_STROKE;
  const troopColor = ownerColor ?? '#e8eef8';

  // ── Artistic view — borders only, no fill (color PNG provides visual) ─────
  if (mapView === 'artistic') {
    let strokeColor   = ownerColor ?? baseStroke;
    let strokeWidth   = isSelected ? 40 : (ownerColor ? 28 : 18);
    let strokeOpacity = isSelected ? 1.0 : (ownerColor ? 0.85 : 0.50);

    if (isHighlighted) { strokeColor = '#fde047'; strokeWidth = 38; strokeOpacity = 1.0; }
    if (isAttackable)  { strokeColor = '#f87171'; strokeWidth = 32; strokeOpacity = 1.0; }
    if (isLocked)      { strokeColor = '#f97316'; strokeWidth = 36; strokeOpacity = 1.0; }

    let filterAttr;
    if (isSelected)    filterAttr = 'url(#glow-selected)';
    if (isHighlighted) filterAttr = 'url(#glow-highlight)';
    if (isAttackable)  filterAttr = 'url(#glow-attack)';
    if (isLocked)      filterAttr = 'url(#glow-attack)';

    return (
      <g data-tid={territory_id} style={{ cursor: 'pointer' }}>
        <polygon
          data-tid={territory_id}
          points={points}
          fill="transparent"
          fillOpacity={0}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          filter={filterAttr}
        />
        {isLocked && (
          <polygon data-tid={territory_id} points={points} fill="url(#locked-hatch)" fillOpacity={0.35} stroke="none" style={{ pointerEvents: 'none' }} />
        )}
        {troopCount > 0 && (
          <TroopBadge cx={tx} cy={ty} troopCount={troopCount} color={troopColor} tid={territory_id} />
        )}
      </g>
    );
  }

  // ── Tactical view — filled polygons over grayscale PNG ────────────────────
  let fillColor   = ownerColor ?? '#1e293b';
  let fillOpacity = ownerColor ? (isSelected ? 0.75 : 0.55) : 0.30;

  let strokeColor   = ownerColor ?? baseStroke;
  let strokeWidth   = isSelected ? 36 : 22;
  let strokeOpacity = isSelected ? 1.0 : (ownerColor ? 0.90 : 0.55);

  if (isHighlighted) { strokeColor = '#fde047'; strokeWidth = 32; strokeOpacity = 1.0; fillColor = '#fde047'; fillOpacity = 0.25; }
  if (isAttackable)  { strokeColor = '#f87171'; strokeWidth = 28; strokeOpacity = 1.0; fillColor = '#f87171'; fillOpacity = 0.20; }
  if (isLocked)      { strokeColor = '#f97316'; strokeWidth = 32; strokeOpacity = 1.0; }

  let filterAttr;
  if (isSelected)    filterAttr = 'url(#glow-selected)';
  if (isHighlighted) filterAttr = 'url(#glow-highlight)';
  if (isAttackable)  filterAttr = 'url(#glow-attack)';

  return (
    <g data-tid={territory_id} style={{ cursor: 'pointer' }}>
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
      {isLocked && (
        <polygon data-tid={territory_id} points={points} fill="url(#locked-hatch)" fillOpacity={0.35} stroke="none" style={{ pointerEvents: 'none' }} />
      )}
      {troopCount > 0 && (
        <TroopBadge cx={tx} cy={ty} troopCount={troopCount} color={troopColor} tid={territory_id} />
      )}
    </g>
  );
}