/**
 * RouteHintLayer — renders subtle strategic route corridors
 * for adjacent territories that do not physically touch.
 *
 * Shows gateway_route connections as faint dashed lanes.
 * Pure visual — no interactivity, no gameplay logic.
 */

import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';
const ROUTE_HINTS = MAP_SHATTERED_CROWN.adjacency.map(([from, to]) => {
  const fromT = MAP_SHATTERED_CROWN.territories.find(t => t.territory_id === from);
  const toT   = MAP_SHATTERED_CROWN.territories.find(t => t.territory_id === to);
  return { from, to, type: 'gateway_route', points: fromT && toT ? [[fromT.cx, fromT.cy], [toT.cx, toT.cy]] as [number,number][] : [] };
}).filter(r => r.points.length > 0);

// Continent color palette for route tinting
const CONTINENT_COLORS = {
  ironspine:       '#7a95b8',
  wild_frontier:   '#4ade80',
  fracture_basin:  '#f87171',
  sunfields:       '#fbbf24',
  shattered_coast: '#38bdf8',
};

const TERRITORY_CONTINENT = {
  I1:'ironspine', I2:'ironspine', I3:'ironspine', I4:'ironspine',
  I5:'ironspine', I6:'ironspine', I7:'ironspine', I8:'ironspine',
  W1:'wild_frontier', W2:'wild_frontier', W3:'wild_frontier',
  W4:'wild_frontier', W5:'wild_frontier', W6:'wild_frontier',
  W7:'wild_frontier', W8:'wild_frontier', W9:'wild_frontier',
  B1:'fracture_basin', B2:'fracture_basin', B3:'fracture_basin',
  B4:'fracture_basin', B5:'fracture_basin', B6:'fracture_basin',
  B7:'fracture_basin', B8:'fracture_basin', B9:'fracture_basin', B10:'fracture_basin',
  S1:'sunfields', S2:'sunfields', S3:'sunfields', S4:'sunfields',
  S5:'sunfields', S6:'sunfields', S7:'sunfields', S8:'sunfields', S9:'sunfields',
  C1:'shattered_coast', C2:'shattered_coast', C3:'shattered_coast',
  C4:'shattered_coast', C5:'shattered_coast', C6:'shattered_coast',
  C7:'shattered_coast', C8:'shattered_coast',
};

function pointsToPath(pts) {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
}

export default function RouteHintLayer() {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <filter id="route-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {ROUTE_HINTS.map((hint, i) => {
        const fromContinent = TERRITORY_CONTINENT[hint.from];
        const toContinent   = TERRITORY_CONTINENT[hint.to];
        const sameContinent = fromContinent === toContinent;

        // Cross-continent routes get a blended neutral tone; same-continent use continent color
        const color = sameContinent
          ? (CONTINENT_COLORS[fromContinent] ?? '#94a3b8')
          : '#94a3b8';

        const d = pointsToPath(hint.points);
        if (!d) return null;

        return (
          <g key={i}>
            {/* Outer glow lane */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={3.5}
              strokeOpacity={0.08}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#route-glow)"
            />
            {/* Dashed centre line */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.2}
              strokeOpacity={0.30}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={sameContinent ? '4 6' : '3 8'}
            />
          </g>
        );
      })}
    </g>
  );
}