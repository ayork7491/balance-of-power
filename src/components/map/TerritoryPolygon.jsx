/**
 * TerritoryPolygon — renders a single territory as an SVG polygon.
 * All visual state (color, opacity, highlight) is derived from props.
 * No business logic lives here.
 */
import { motion } from 'framer-motion';
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

export default function TerritoryPolygon({
  territory,       // TerritoryDef
  regionColor,     // hex string from region
  ownerColor,      // hex string | null
  troopCount,      // number
  isSelected,      // bool
  isHighlighted,   // bool — e.g. valid attack/fortify target
  isAttackable,    // bool
  onClick,
}) {
  const { points, cx, cy, terrain, name } = territory;
  const terrain_cfg = TERRAIN_PATTERNS[terrain ?? 'plains'] ?? TERRAIN_PATTERNS.plains;

  // Fill: owned → player color tinted, unowned → region color dimmed
  const baseFill  = ownerColor ?? regionColor;
  const fillOpacity = ownerColor
    ? (isSelected ? 0.95 : 0.65)
    : (isSelected ? 0.50 : 0.25);

  // Stroke
  let strokeColor   = ownerColor ?? '#ffffff';
  let strokeWidth   = isSelected ? 2.5 : 1.2;
  let strokeOpacity = isSelected ? 1.0 : 0.5;

  if (isHighlighted) {
    strokeColor   = '#facc15'; // yellow pulse target
    strokeWidth   = 2.5;
    strokeOpacity = 1;
  }
  if (isAttackable) {
    strokeColor   = '#ef4444'; // red hostile border
    strokeWidth   = 2;
    strokeOpacity = 0.9;
  }

  return (
    <motion.g
      onClick={onClick}
      className="cursor-pointer touch-manipulation"
      role="button"
      aria-label={name}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.polygon
        points={points}
        fill={baseFill}
        fillOpacity={fillOpacity * terrain_cfg.extraOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={terrain_cfg.strokeDash ?? undefined}
        animate={{
          fillOpacity: fillOpacity * terrain_cfg.extraOpacity,
          strokeWidth: strokeWidth
        }}
        transition={{ duration: 0.15 }}
        style={{ filter: isSelected ? 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.4))' : 'none' }}
      />

      {/* Troop count label — only when owned */}
      {troopCount > 0 && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={12}
            fill="rgba(0,0,0,0.7)"
            stroke={ownerColor ?? '#888'}
            strokeWidth={1}
          />
          <text
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
    </motion.g>
  );
}