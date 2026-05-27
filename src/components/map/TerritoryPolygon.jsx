/**
 * TerritoryPolygon — renders a single territory as an SVG group.
 *
 * Visual philosophy (Render Pass v2):
 *   - Terrain-first fill: each continent/terrain has a base palette.
 *   - Ownership: very low opacity tint (15–25%) so territory shapes stay legible.
 *   - Borders: primary visual signal — bright edge glow when selected/highlighted.
 *   - No stroke dashing — clean silhouette edges.
 *
 * No onClick — all pointer handling delegated to MapRenderer via event delegation.
 * Every interactive element carries data-tid.
 */

// ── Terrain base fills (unowned state) ─────────────────────────────────────────
// These tint the polygon even before ownership, giving terrain-first identity.
const TERRAIN_FILL = {
  mountains: '#2a3548',   // cold slate-blue
  forest:    '#14281a',   // deep forest green
  swamp:     '#1a2318',   // murky dark green
  tundra:    '#1e2535',   // icy dark blue
  coastal:   '#0d1f2d',   // deep navy
  desert:    '#2a1f0e',   // warm dark sand
  urban:     '#1e1e2e',   // dark purple-grey
  plains:    '#1a1e10',   // dark olive
};

// ── Terrain border colors (unowned) ────────────────────────────────────────────
const TERRAIN_STROKE = {
  mountains: '#64748b',
  forest:    '#4ade80',
  swamp:     '#86efac',
  tundra:    '#94a3b8',
  coastal:   '#38bdf8',
  desert:    '#fbbf24',
  urban:     '#a78bfa',
  plains:    '#bef264',
};

const DEFAULT_FILL   = '#1a1e2a';
const DEFAULT_STROKE = '#6b7280';

export default function TerritoryPolygon({
  territory,
  regionColor,   // used as accent tint hint — not primary fill driver
  ownerColor,
  troopCount,
  isSelected,
  isHighlighted,
  isAttackable,
}) {
  const { points, cx, cy, terrain, territory_id } = territory;
  const terrainKey = terrain ?? 'plains';

  const baseFill   = TERRAIN_FILL[terrainKey]   ?? DEFAULT_FILL;
  const baseStroke = TERRAIN_STROKE[terrainKey] ?? DEFAULT_STROKE;

  // ── Fill ───────────────────────────────────────────────────────────────────
  // Unowned: pure terrain fill, very low opacity.
  // Owned:   overlay player color at 18–22% opacity over terrain base.
  let fillColor   = baseFill;
  let fillOpacity = 0.82;  // terrain base is fairly opaque

  if (ownerColor) {
    fillColor   = ownerColor;
    fillOpacity = isSelected ? 0.28 : 0.18;  // ownership is a ghost tint
  } else if (isSelected) {
    fillOpacity = 0.92;
  }

  // ── Stroke ─────────────────────────────────────────────────────────────────
  let strokeColor   = ownerColor ?? baseStroke;
  let strokeWidth   = isSelected ? 2.2 : 0.9;
  let strokeOpacity = isSelected ? 1.0 : 0.60;
  const strokeDash  = undefined;  // clean edges always

  if (isHighlighted) {
    strokeColor   = '#fde047';
    strokeWidth   = 2.4;
    strokeOpacity = 1.0;
  }
  if (isAttackable) {
    strokeColor   = '#f87171';
    strokeWidth   = 2.0;
    strokeOpacity = 0.95;
  }

  // ── Glow filter ────────────────────────────────────────────────────────────
  let filterAttr = undefined;
  if (isSelected)    filterAttr = 'url(#glow-selected)';
  if (isHighlighted) filterAttr = 'url(#glow-highlight)';
  if (isAttackable)  filterAttr = 'url(#glow-attack)';

  // When owned, also add a subtle edge glow in the player color
  const ownedEdgeStroke = ownerColor && !isSelected && !isHighlighted && !isAttackable
    ? ownerColor : null;

  return (
    <g
      data-tid={territory_id}
      style={{ cursor: 'pointer' }}
    >
      {/* Owned territory edge glow — second polygon behind main, blurred */}
      {ownedEdgeStroke && (
        <polygon
          data-tid={territory_id}
          points={points}
          fill="none"
          stroke={ownedEdgeStroke}
          strokeWidth={4}
          strokeOpacity={0.20}
          filter="url(#glow-owner)"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Main polygon — terrain fill, then ownership tint on top */}
      <polygon
        data-tid={territory_id}
        points={points}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={strokeDash}
        filter={filterAttr}
      />

      {/* Troop count badge */}
      {troopCount > 0 && (
        <>
          <circle
            data-tid={territory_id}
            cx={cx}
            cy={cy}
            r={11}
            fill="rgba(0,0,0,0.75)"
            stroke={ownerColor ?? baseStroke}
            strokeWidth={1.2}
          />
          <text
            data-tid={territory_id}
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize={9}
            fontFamily="'Orbitron', monospace"
            fontWeight="700"
            fill="#ffffff"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {troopCount}
          </text>
        </>
      )}
    </g>
  );
}