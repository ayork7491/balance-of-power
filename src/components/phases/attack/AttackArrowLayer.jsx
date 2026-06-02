/**
 * AttackArrowLayer — SVG overlay for rendering attack arrows on the map.
 *
 * Usage:
 *   - During staging: renders current player's own staged attacks (my color, dashed).
 *   - After reveal: renders all AttackReveal records (player colors, solid).
 *
 * Arrow design (per spec):
 *   - Color coded by attacking player
 *   - Display troop count
 *   - Offset overlapping arrows (multiple attacks on same route are shifted)
 *
 * This component must be placed inside the MapRenderer SVG via a portal-like
 * render or as a sibling overlay SVG with matching viewBox.
 *
 * Props:
 *   attacks       — array of { origin_territory_id, target_territory_id, committed_troops, player_id }
 *   mapDef        — MapDefinition (for territory cx/cy centers)
 *   players       — CampaignPlayer[] (for color lookup)
 *   myPlayerId    — current player's CampaignPlayer.id (own attacks get dashed style)
 *   viewBox       — "0 0 W H" string matching map SVG viewBox
 *   revealed      — boolean — if true, all arrows are solid; if false, own arrows dashed, others hidden
 */
import { useMemo } from 'react';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#ef4444';
}

function getCenter(territoryId, mapDef) {
  const t = mapDef?.territories.find(t => t.territory_id === territoryId);
  return t ? { x: t.cx, y: t.cy } : null;
}

/**
 * Offset a line's midpoint perpendicularly to separate overlapping arrows.
 * offsetIndex: which parallel offset to apply (-1, 0, +1, ...)
 */
function computeArrowPoints(x1, y1, x2, y2, offsetIndex, totalOverlapping) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular unit vector
  const px = -dy / len;
  const py =  dx / len;

  // Offset spacing: 12px per slot, centered
  const spacing = 12;
  const offset  = (offsetIndex - (totalOverlapping - 1) / 2) * spacing;

  return {
    x1: x1 + px * offset,
    y1: y1 + py * offset,
    x2: x2 + px * offset,
    y2: y2 + py * offset,
  };
}

function ArrowMarker({ id, color }) {
  return (
    <marker
      id={id}
      markerWidth="5"
      markerHeight="5"
      refX="4"
      refY="2.5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <path d="M0,0 L0,5 L5,2.5 z" fill={color} />
    </marker>
  );
}

export default function AttackArrowLayer({
  attacks,
  mapDef,
  players,
  myPlayerId,
  revealed = false,
}) {
  // Group arrows by route key (origin→target) to offset overlapping ones
  const arrowData = useMemo(() => {
    if (!attacks?.length || !mapDef) return [];

    // Build a list with centers
    const withCenters = attacks.map(atk => {
      const from = getCenter(atk.origin_territory_id, mapDef);
      const to   = getCenter(atk.target_territory_id, mapDef);
      return from && to ? { ...atk, from, to } : null;
    }).filter(Boolean);

    // Group by route key (canonical: sorted origin+target)
    const routeGroups = {};
    for (const atk of withCenters) {
      const key = [atk.origin_territory_id, atk.target_territory_id].join('→');
      if (!routeGroups[key]) routeGroups[key] = [];
      routeGroups[key].push(atk);
    }

    // Build final arrow list with offsets
    const result = [];
    for (const [, group] of Object.entries(routeGroups)) {
      group.forEach((atk, i) => {
        const { x1, y1, x2, y2 } = computeArrowPoints(
          atk.from.x, atk.from.y,
          atk.to.x,   atk.to.y,
          i, group.length,
        );
        result.push({ ...atk, x1, y1, x2, y2, offsetIndex: i });
      });
    }
    return result;
  }, [attacks, mapDef]);

  if (!arrowData.length) return null;

  // Collect unique colors for marker defs (includes delayed orange)
  const uniqueColors = [...new Set(arrowData.map(a => a.is_delayed ? '#f59e0b' : getPlayerHex(players, a.player_id)))];

  // Rendered as SVG <g> elements inside the map's own <svg> so they
  // inherit the pan/zoom transform automatically. Arrow sizes are in
  // native map coords (10240×10240 space).
  const STROKE_W   = 60;   // line thickness in map coords
  const BADGE_R    = 120;  // label badge half-size
  const FONT_SIZE  = 90;

  return (
    <g id="layer-arrows" style={{ pointerEvents: 'none' }}>
      <defs>
        {uniqueColors.map(color => (
          <ArrowMarker
            key={color}
            id={`arrow-${color.replace('#', '')}`}
            color={color}
          />
        ))}
      </defs>

      {arrowData.map((atk, idx) => {
        const color    = getPlayerHex(players, atk.player_id);
        const markerId = `arrow-${color.replace('#', '')}`;
        const isOwn    = atk.player_id === myPlayerId;
        // Delayed arrows: orange tint + dashed; staging: dashed own color
        const isDelayed = !!atk.is_delayed;
        const arrowColor = isDelayed ? '#f59e0b' : color;
        const delayedMarkerId = `arrow-${arrowColor.replace('#', '')}`;
        const isDashed = isDelayed || (!revealed && isOwn);

        // Label position: 60% along the arrow
        const lx = atk.x1 + (atk.x2 - atk.x1) * 0.6;
        const ly = atk.y1 + (atk.y2 - atk.y1) * 0.6;

        return (
          <g key={idx}>
            <line
              x1={atk.x1} y1={atk.y1}
              x2={atk.x2} y2={atk.y2}
              stroke={arrowColor}
              strokeWidth={STROKE_W}
              strokeDasharray={isDashed ? '200 120' : undefined}
              strokeOpacity={isDelayed ? 0.7 : 0.9}
              markerEnd={`url(#${isDelayed ? delayedMarkerId : markerId})`}
            />
            {/* Troop count label */}
            <g transform={`translate(${lx}, ${ly})`}>
              <rect
                x={-BADGE_R * 1.4} y={-BADGE_R * 0.75}
                width={BADGE_R * 2.8} height={BADGE_R * 1.5}
                rx={BADGE_R * 0.4}
                fill="#0a0f1e"
                fillOpacity={0.82}
                stroke={arrowColor}
                strokeWidth={18}
              />
              <text
                x="0" y={FONT_SIZE * 0.38}
                textAnchor="middle"
                fontSize={FONT_SIZE}
                fontFamily="'Orbitron', monospace"
                fill={arrowColor}
                fontWeight="700"
              >
                {atk.committed_troops}{isDelayed ? '⏱' : ''}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}