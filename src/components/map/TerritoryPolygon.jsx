/**
 * TerritoryPolygon — renders a single territory as an SVG group.
 *
 * No onClick — all pointer handling is delegated to the MapRenderer container
 * via event delegation (getTerritoryIdFromTarget walks up to data-tid).
 *
 * Every interactive element carries data-tid so the container can identify
 * which territory was tapped even if the hit element is a circle or text.
 */
import { PLAYER_COLORS } from '@/config/theme';

const TERRAIN_PATTERNS = {
  mountains: { strokeDash: '4,2', extraOpacity: 0.9 },
  forest:    { strokeDash: '6,3', extraOpacity: 0.85 },
  swamp:     { strokeDash: '3,3', extraOpacity: 0.8 },
  tundra:    { strokeDash: '8,2', extraOpacity: 0.85 },
  coastal:   { strokeDash: '2,4', extraOpacity: 0.9 },
  desert:    { strokeDash: '6,2', extraOpacity: 0.85 },
  urban:     { strokeDash: null,  extraOpacity: 1.0  },
  plains:    { strokeDash: null,  extraOpacity: 1.0  },
};
// Fallback: any unmapped terrain key (e.g. extended types from future maps) → plains
const DEFAULT_TERRAIN = TERRAIN_PATTERNS.plains;

export default function TerritoryPolygon({
  territory,       // TerritoryDef
  regionColor,     // hex string from region
  ownerColor,      // hex string | null
  troopCount,      // number
  isSelected,      // bool
  isHighlighted,   // bool — e.g. valid attack/fortify target
  isAttackable,    // bool
  // onClick intentionally removed — handled by MapRenderer container delegation
}) {
  const { points, cx, cy, terrain, name, territory_id } = territory;
  const terrain_cfg = TERRAIN_PATTERNS[terrain ?? 'plains'] ?? DEFAULT_TERRAIN;

  // Fill: owned → player color tinted, unowned → region color dimmed
  const baseFill    = ownerColor ?? regionColor;
  const fillOpacity = ownerColor
    ? (isSelected ? 0.95 : 0.65)
    : (isSelected ? 0.50 : 0.25);

  // Stroke
  let strokeColor   = ownerColor ?? '#ffffff';
  let strokeWidth   = isSelected ? 2.5 : 1.2;
  let strokeOpacity = isSelected ? 1.0 : 0.5;

  if (isHighlighted) {
    strokeColor   = '#facc15';
    strokeWidth   = 2.5;
    strokeOpacity = 1;
  }
  if (isAttackable) {
    strokeColor   = '#ef4444';
    strokeWidth   = 2;
    strokeOpacity = 0.9;
  }

  // Selection glow filter
  const filterStyle = isSelected
    ? { filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))' }
    : {};

  return (
    // data-tid on the <g> is the primary anchor for event delegation.
    // cursor-pointer gives visual affordance.
    <g
      data-tid={territory_id}
      style={{ cursor: 'pointer', ...filterStyle }}
    >
      <polygon
        data-tid={territory_id}
        points={points}
        fill={baseFill}
        fillOpacity={fillOpacity * terrain_cfg.extraOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={terrain_cfg.strokeDash ?? undefined}
      />

      {/* Troop count label — only when owned */}
      {troopCount > 0 && (
        <>
          <circle
            data-tid={territory_id}
            cx={cx}
            cy={cy}
            r={12}
            fill="rgba(0,0,0,0.7)"
            stroke={ownerColor ?? '#888'}
            strokeWidth={1}
          />
          <text
            cx={cx}
            cy={cy}
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize={10}
            fontFamily="monospace"
            fontWeight="bold"
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