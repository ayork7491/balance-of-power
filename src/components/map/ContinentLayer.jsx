/**
 * ContinentLayer — renders background silhouette fills and terrain atmosphere
 * for each continent, drawn BELOW territory polygons.
 *
 * Uses each territory's polygon points to build a composite SVG path
 * that creates a landmass feel. No external data — purely derived from mapDef.
 *
 * Continent visual identity:
 *   ironspine      — cold slate/steel, highland ridges
 *   wild_frontier  — deep forest green, organic
 *   fracture_basin — dark crimson, cracked earth
 *   sunfields      — warm amber/gold, open plains
 *   shattered_coast — deep teal/navy, sea cliffs
 */

// Continent background style config — fill, glow color, atmosphere
const CONTINENT_STYLES = {
  ironspine: {
    fill: '#1e2533',
    atmosphereFill: '#3a4a6a',
    glowColor: '#94a3b8',
    glowOpacity: 0.12,
    fillOpacity: 0.55,
  },
  wild_frontier: {
    fill: '#0f1f14',
    atmosphereFill: '#1a3d22',
    glowColor: '#4ade80',
    glowOpacity: 0.10,
    fillOpacity: 0.55,
  },
  fracture_basin: {
    fill: '#1c0f0f',
    atmosphereFill: '#3d1515',
    glowColor: '#f87171',
    glowOpacity: 0.10,
    fillOpacity: 0.55,
  },
  sunfields: {
    fill: '#1c1608',
    atmosphereFill: '#3d2e0a',
    glowColor: '#fbbf24',
    glowOpacity: 0.10,
    fillOpacity: 0.55,
  },
  shattered_coast: {
    fill: '#081520',
    atmosphereFill: '#0c2d40',
    glowColor: '#38bdf8',
    glowOpacity: 0.12,
    fillOpacity: 0.55,
  },
};

const DEFAULT_CONTINENT_STYLE = {
  fill: '#111827',
  atmosphereFill: '#1f2937',
  glowColor: '#6b7280',
  glowOpacity: 0.08,
  fillOpacity: 0.50,
};

/**
 * Compute a simple bounding box expand polygon that "connects" all territory
 * polygons in a continent into a single background blob.
 * We use a slight convex hull approximation by collecting all vertices and
 * rendering them all as a single polygon — SVG will auto-close the convex area.
 * This isn't a true convex hull but gives a natural unified land mass look.
 */
function getContinentPoints(territories) {
  const all = [];
  for (const t of territories) {
    if (!t.points) continue;
    const pairs = t.points.trim().split(/\s+/);
    for (const pair of pairs) {
      const [x, y] = pair.split(',').map(Number);
      if (!isNaN(x) && !isNaN(y)) all.push([x, y]);
    }
  }
  if (all.length === 0) return null;
  return computeConvexHull(all);
}

/** Graham scan convex hull */
function computeConvexHull(points) {
  if (points.length < 3) return points;
  // Find lowest y (then leftmost)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] > points[start][1] ||
        (points[i][1] === points[start][1] && points[i][0] < points[start][0])) {
      start = i;
    }
  }
  const pivot = points[start];
  const sorted = points
    .filter((_, i) => i !== start)
    .sort((a, b) => {
      const angA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
      const angB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
      if (angA !== angB) return angA - angB;
      return dist(pivot, a) - dist(pivot, b);
    });

  const hull = [pivot, sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0) {
      hull.pop();
    }
    hull.push(sorted[i]);
  }
  return hull;
}

function dist(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function cross(O, A, B) {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

/** Expand hull outward by `px` pixels from centroid */
function expandHull(hull, px) {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  return hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * px, y + (dy / len) * px];
  });
}

function hullToPoints(hull) {
  return hull.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

export default function ContinentLayer({ mapDef }) {
  if (!mapDef?.territories || !mapDef?.continents) return null;

  // Group territories by continent
  const byContinent = {};
  for (const t of mapDef.territories) {
    if (!byContinent[t.continent_id]) byContinent[t.continent_id] = [];
    byContinent[t.continent_id].push(t);
  }

  return (
    <g>
      <defs>
        {mapDef.continents.map(c => {
          const style = CONTINENT_STYLES[c.id] ?? DEFAULT_CONTINENT_STYLE;
          return (
            <filter key={`blur-${c.id}`} id={`continent-blur-${c.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="18" result="blur" />
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.6 0"
                in="blur"
              />
            </filter>
          );
        })}
        {/* Terrain hatching patterns */}
        <pattern id="hatch-mountain" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="0.5" opacity="0.3" />
        </pattern>
        <pattern id="hatch-forest" patternUnits="userSpaceOnUse" width="10" height="10">
          <circle cx="3" cy="3" r="1" fill="#4ade80" opacity="0.15" />
          <circle cx="8" cy="8" r="1" fill="#4ade80" opacity="0.15" />
        </pattern>
        <pattern id="hatch-plains" patternUnits="userSpaceOnUse" width="16" height="8" patternTransform="rotate(15)">
          <line x1="0" y1="4" x2="16" y2="4" stroke="#fbbf24" strokeWidth="0.4" opacity="0.12" />
        </pattern>
        <pattern id="hatch-coastal" patternUnits="userSpaceOnUse" width="12" height="12">
          <line x1="0" y1="0" x2="12" y2="12" stroke="#38bdf8" strokeWidth="0.5" opacity="0.18" />
          <line x1="12" y1="0" x2="0" y2="12" stroke="#38bdf8" strokeWidth="0.5" opacity="0.10" />
        </pattern>
        <pattern id="hatch-cracked" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(30)">
          <line x1="0" y1="0" x2="0" y2="14" stroke="#f87171" strokeWidth="0.4" opacity="0.18" />
          <line x1="7" y1="0" x2="7" y2="14" stroke="#f87171" strokeWidth="0.3" opacity="0.10" />
        </pattern>
      </defs>

      {/* Continent atmosphere/glow blobs — very blurred, drawn first */}
      {mapDef.continents.map(c => {
        const territories = byContinent[c.id] ?? [];
        const hull = getContinentPoints(territories);
        if (!hull || hull.length < 3) return null;
        const expanded = expandHull(hull, 32);
        const style = CONTINENT_STYLES[c.id] ?? DEFAULT_CONTINENT_STYLE;
        return (
          <polygon
            key={`atmo-${c.id}`}
            points={hullToPoints(expanded)}
            fill={style.atmosphereFill}
            opacity={0.55}
            filter={`url(#continent-blur-${c.id})`}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}

      {/* Continent base fills — tighter expanded hull */}
      {mapDef.continents.map(c => {
        const territories = byContinent[c.id] ?? [];
        const hull = getContinentPoints(territories);
        if (!hull || hull.length < 3) return null;
        const expanded = expandHull(hull, 14);
        const style = CONTINENT_STYLES[c.id] ?? DEFAULT_CONTINENT_STYLE;
        return (
          <polygon
            key={`base-${c.id}`}
            points={hullToPoints(expanded)}
            fill={style.fill}
            fillOpacity={style.fillOpacity}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}
    </g>
  );
}