/**
 * TerritoryPolygon — Terrain & Landmass Composition Pass
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

export default function TerritoryPolygon({
  territory,
  regionColor,
  ownerColor,
  troopCount,
  isSelected,
  isHighlighted,
  isAttackable,
  isLocked,
  mapView = 'artistic', // 'artistic' | 'tactical'
}) {
  const { points, cx, cy, troop_x, troop_y, terrain, territory_id, continent_id } = territory;
  const tx = troop_x ?? cx;
  const ty = troop_y ?? cy;
  const terrainKey = terrain ?? 'plains';
  const baseStroke = TERRAIN_STROKE[terrainKey] ?? CONTINENT_STROKE_ACCENT[continent_id] ?? DEFAULT_STROKE;

  // ── Tactical view: transparent fill, colored border, player-colored troop badge ──
  if (mapView === 'tactical') {
    let strokeColor   = ownerColor ?? baseStroke;
    let strokeWidth   = isSelected ? 3.0 : 1.8;
    let strokeOpacity = isSelected ? 1.0 : (ownerColor ? 0.90 : 0.60);
    let fillOpacity   = isSelected ? 0.15 : 0.0;
    let fillColor     = ownerColor ?? 'transparent';

    if (isHighlighted) { strokeColor = '#fde047'; strokeWidth = 3.0; strokeOpacity = 1.0; fillColor = '#fde047'; fillOpacity = 0.08; }
    if (isAttackable)  { strokeColor = '#f87171'; strokeWidth = 2.6; strokeOpacity = 1.0; fillColor = '#f87171'; fillOpacity = 0.08; }
    if (isLocked)      { strokeColor = '#f97316'; strokeWidth = 3.0; strokeOpacity = 1.0; }

    let filterAttr;
    if (isSelected)    filterAttr = 'url(#glow-selected)';
    if (isHighlighted) filterAttr = 'url(#glow-highlight)';
    if (isAttackable)  filterAttr = 'url(#glow-attack)';

    const troopColor = ownerColor ?? '#e8eef8';

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
          <polygon data-tid={territory_id} points={points} fill="url(#locked-hatch)" fillOpacity={0.25} stroke="none" style={{ pointerEvents: 'none' }} />
        )}
        {troopCount > 0 && (
          <>
            <circle data-tid={territory_id} cx={tx} cy={ty} r={14} fill={troopColor} fillOpacity={0.20} stroke={troopColor} strokeWidth={2} strokeOpacity={0.90} />
            <circle data-tid={territory_id} cx={tx} cy={ty} r={11} fill="rgba(0,0,0,0.75)" stroke="none" />
            <text data-tid={territory_id} x={tx} y={ty + 4} textAnchor="middle" fontSize={9} fontFamily="'Orbitron', monospace" fontWeight="700" fill={troopColor} style={{ pointerEvents: 'none', userSelect: 'none' }}>{troopCount}</text>
          </>
        )}
      </g>
    );
  }

  // ── Artistic view (default): semi-transparent player-colored fill ──
  let fillColor   = 'transparent';
  let fillOpacity = 0.0;
  if (ownerColor) {
    fillColor   = ownerColor;
    fillOpacity = isSelected ? 0.35 : 0.22;
  } else if (isSelected) {
    fillColor = '#ffffff';
    fillOpacity = 0.10;
  }

  let strokeColor   = ownerColor ?? baseStroke;
  let strokeWidth   = isSelected ? 2.4 : 1.2;
  let strokeOpacity = isSelected ? 1.0 : (ownerColor ? 0.80 : 0.45);

  if (isHighlighted) { strokeColor = '#fde047'; strokeWidth = 2.6; strokeOpacity = 1.0; }
  if (isAttackable)  { strokeColor = '#f87171'; strokeWidth = 2.2; strokeOpacity = 1.0; }
  if (isLocked)      { strokeColor = '#f97316'; strokeWidth = 2.4; strokeOpacity = 1.0; }

  let filterAttr;
  if (isSelected)    filterAttr = 'url(#glow-selected)';
  if (isHighlighted) filterAttr = 'url(#glow-highlight)';
  if (isAttackable)  filterAttr = 'url(#glow-attack)';
  if (isLocked)      filterAttr = 'url(#glow-attack)';

  const ownedEdgeStroke = ownerColor && !isSelected && !isHighlighted && !isAttackable ? ownerColor : null;
  const troopColor = ownerColor ?? '#e8eef8';

  return (
    <g data-tid={territory_id} style={{ cursor: 'pointer' }}>
      {ownedEdgeStroke && (
        <polygon data-tid={territory_id} points={points} fill="none" stroke={ownedEdgeStroke} strokeWidth={6} strokeOpacity={0.18} filter="url(#glow-owner)" style={{ pointerEvents: 'none' }} />
      )}
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
        <>
          <circle data-tid={territory_id} cx={tx} cy={ty} r={14} fill={troopColor} fillOpacity={0.20} stroke={troopColor} strokeWidth={2} strokeOpacity={0.90} />
          <circle data-tid={territory_id} cx={tx} cy={ty} r={11} fill="rgba(0,0,0,0.75)" stroke="none" />
          <text data-tid={territory_id} x={tx} y={ty + 4} textAnchor="middle" fontSize={9} fontFamily="'Orbitron', monospace" fontWeight="700" fill={troopColor} style={{ pointerEvents: 'none', userSelect: 'none' }}>{troopCount}</text>
        </>
      )}
    </g>
  );
}