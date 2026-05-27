/**
 * ContinentLayer — Terrain & Landmass Composition Pass
 *
 * Render order (bottom → top):
 *   1. Continent atmosphere halos (very blurred, wide)
 *   2. Continent base landmass fills (tight hull)
 *   3. Per-territory terrain texture overlays
 *   4. Coastline rim glows
 *   5. Landmark features: mountain ridgelines, forest canopy, ruin cracks,
 *      plains grass strokes, coastal wave marks
 *   6. River lines
 *
 * All layers are pointer-events:none.
 */

// ── Continent visual identity ──────────────────────────────────────────────────
const CONTINENT_STYLES = {
  ironspine: {
    baseFill: '#1a2135', atmosphereFill: '#3a4a6a',
    rimColor: '#7a95b8', rimOpacity: 0.18, fillOpacity: 0.82,
  },
  wild_frontier: {
    baseFill: '#0c1a10', atmosphereFill: '#1a3d22',
    rimColor: '#4ade80', rimOpacity: 0.14, fillOpacity: 0.82,
  },
  fracture_basin: {
    baseFill: '#190c0c', atmosphereFill: '#3d1515',
    rimColor: '#f87171', rimOpacity: 0.14, fillOpacity: 0.82,
  },
  sunfields: {
    baseFill: '#191408', atmosphereFill: '#3d2e0a',
    rimColor: '#fbbf24', rimOpacity: 0.14, fillOpacity: 0.82,
  },
  shattered_coast: {
    baseFill: '#06111e', atmosphereFill: '#0c2d40',
    rimColor: '#38bdf8', rimOpacity: 0.18, fillOpacity: 0.82,
  },
};

const DEFAULT_STYLE = {
  baseFill: '#111827', atmosphereFill: '#1f2937',
  rimColor: '#6b7280', rimOpacity: 0.08, fillOpacity: 0.75,
};

// ── Geometry helpers ───────────────────────────────────────────────────────────

function parsePoints(pointsStr) {
  if (!pointsStr) return [];
  return pointsStr.trim().split(/\s+/).map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return [x, y];
  }).filter(([x, y]) => !isNaN(x) && !isNaN(y));
}

function computeConvexHull(points) {
  if (points.length < 3) return points;
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] > points[start][1] ||
        (points[i][1] === points[start][1] && points[i][0] < points[start][0])) {
      start = i;
    }
  }
  const pivot = points[start];
  const sorted = points.filter((_, i) => i !== start).sort((a, b) => {
    const angA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const angB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    if (angA !== angB) return angA - angB;
    return Math.hypot(a[0]-pivot[0],a[1]-pivot[1]) - Math.hypot(b[0]-pivot[0],b[1]-pivot[1]);
  });
  const hull = [pivot, sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    while (hull.length > 1) {
      const [ox,oy] = hull[hull.length-2];
      const [ax,ay] = hull[hull.length-1];
      const [bx,by] = sorted[i];
      if ((ax-ox)*(by-oy)-(ay-oy)*(bx-ox) <= 0) hull.pop();
      else break;
    }
    hull.push(sorted[i]);
  }
  return hull;
}

function expandHull(hull, px) {
  if (!hull || hull.length === 0) return hull;
  const cx = hull.reduce((s,p) => s+p[0], 0) / hull.length;
  const cy = hull.reduce((s,p) => s+p[1], 0) / hull.length;
  return hull.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx/len)*px, y + (dy/len)*px];
  });
}

function hullToPoints(hull) {
  if (!hull) return '';
  return hull.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function getContinentHull(territories) {
  const all = [];
  for (const t of territories) {
    for (const pt of parsePoints(t.points)) all.push(pt);
  }
  if (all.length < 3) return null;
  return computeConvexHull(all);
}

// ── Terrain texture map ────────────────────────────────────────────────────────

const TERRAIN_TEXTURE_MAP = {
  mountains: 'tex-mountain',
  forest:    'tex-forest-dense',
  swamp:     'tex-swamp',
  coastal:   'tex-coastal',
  plains:    'tex-plains',
  tundra:    'tex-mountain',
  desert:    'tex-plains',
  urban:     'tex-ruins',
};

const CONTINENT_TEXTURE_MAP = {
  ironspine:       'tex-mountain',
  wild_frontier:   'tex-forest',
  fracture_basin:  'tex-ruins',
  sunfields:       'tex-plains',
  shattered_coast: 'tex-coastal',
};

const TERRAIN_TEXTURE_OPACITY = {
  mountains: 0.50, forest: 0.45, swamp: 0.40,
  coastal: 0.40, plains: 0.35, tundra: 0.45, urban: 0.38,
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function ContinentLayer({ mapDef }) {
  if (!mapDef?.territories || !mapDef?.continents) return null;

  const byContinent = {};
  for (const t of mapDef.territories) {
    if (!byContinent[t.continent_id]) byContinent[t.continent_id] = [];
    byContinent[t.continent_id].push(t);
  }

  return (
    <g>
      {/* ── SVG defs: patterns + filters ── */}
      <defs>
        {/* Terrain texture patterns */}
        <pattern id="tex-mountain" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="12" stroke="#8ba3c0" strokeWidth="0.8" opacity="0.22" />
          <line x1="6" y1="0" x2="6" y2="12" stroke="#8ba3c0" strokeWidth="0.4" opacity="0.12" />
        </pattern>
        <pattern id="tex-forest" patternUnits="userSpaceOnUse" width="14" height="14">
          <circle cx="3"  cy="4"  r="1.2" fill="#4ade80" opacity="0.16" />
          <circle cx="10" cy="10" r="1.0" fill="#4ade80" opacity="0.12" />
          <circle cx="7"  cy="1"  r="0.8" fill="#86efac" opacity="0.10" />
        </pattern>
        <pattern id="tex-forest-dense" patternUnits="userSpaceOnUse" width="10" height="10">
          <circle cx="2" cy="3" r="1.2" fill="#22c55e" opacity="0.18" />
          <circle cx="7" cy="7" r="1.0" fill="#4ade80" opacity="0.14" />
          <circle cx="5" cy="1" r="0.8" fill="#86efac" opacity="0.10" />
          <circle cx="9" cy="4" r="0.7" fill="#22c55e" opacity="0.10" />
        </pattern>
        <pattern id="tex-swamp" patternUnits="userSpaceOnUse" width="12" height="12">
          <circle cx="3" cy="5" r="1.2" fill="#86efac" opacity="0.14" />
          <circle cx="9" cy="9" r="0.8" fill="#4ade80" opacity="0.10" />
          <line x1="0" y1="8" x2="12" y2="8" stroke="#86efac" strokeWidth="0.4" opacity="0.08" />
        </pattern>
        <pattern id="tex-plains" patternUnits="userSpaceOnUse" width="20" height="8" patternTransform="rotate(8)">
          <line x1="0" y1="4" x2="20" y2="4" stroke="#d4a428" strokeWidth="0.5" opacity="0.14" />
          <line x1="0" y1="7" x2="20" y2="7" stroke="#d4a428" strokeWidth="0.3" opacity="0.07" />
        </pattern>
        <pattern id="tex-ruins" patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(22)">
          <line x1="0" y1="0" x2="0" y2="16" stroke="#f87171" strokeWidth="0.5" opacity="0.16" />
          <line x1="8" y1="0" x2="8" y2="16" stroke="#f87171" strokeWidth="0.3" opacity="0.09" />
          <line x1="0" y1="5" x2="16" y2="13" stroke="#f87171" strokeWidth="0.4" opacity="0.08" />
        </pattern>
        <pattern id="tex-coastal" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(15)">
          <line x1="0" y1="0" x2="14" y2="14" stroke="#38bdf8" strokeWidth="0.6" opacity="0.16" />
          <line x1="14" y1="0" x2="0" y2="14" stroke="#38bdf8" strokeWidth="0.4" opacity="0.09" />
        </pattern>

        {/* Blur filters */}
        <filter id="continent-atmo-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <filter id="continent-rim-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="feature-blur-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="mountain-ridge-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="river-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* ── Layer 1: Atmosphere halos ── */}
      <g style={{ pointerEvents: 'none' }}>
        {mapDef.continents.map(c => {
          const territories = byContinent[c.id] ?? [];
          const hull = getContinentHull(territories);
          if (!hull || hull.length < 3) return null;
          const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
          return (
            <polygon key={`atmo-${c.id}`}
              points={hullToPoints(expandHull(hull, 40))}
              fill={style.atmosphereFill} opacity={0.50}
              filter="url(#continent-atmo-blur)"
            />
          );
        })}
      </g>

      {/* ── Layer 2: Continent base fills ── */}
      <g style={{ pointerEvents: 'none' }}>
        {mapDef.continents.map(c => {
          const territories = byContinent[c.id] ?? [];
          const hull = getContinentHull(territories);
          if (!hull || hull.length < 3) return null;
          const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
          return (
            <polygon key={`base-${c.id}`}
              points={hullToPoints(expandHull(hull, 12))}
              fill={style.baseFill} fillOpacity={style.fillOpacity}
            />
          );
        })}
      </g>

      {/* ── Layer 3: Per-territory terrain texture overlays ── */}
      <g style={{ pointerEvents: 'none' }}>
        {mapDef.territories.map(t => {
          const textureId = TERRAIN_TEXTURE_MAP[t.terrain] ?? CONTINENT_TEXTURE_MAP[t.continent_id] ?? 'tex-plains';
          const opacity = TERRAIN_TEXTURE_OPACITY[t.terrain] ?? 0.35;
          return (
            <polygon key={`tex-${t.territory_id}`}
              points={t.points}
              fill={`url(#${textureId})`} fillOpacity={opacity}
              stroke="none"
            />
          );
        })}
      </g>

      {/* ── Layer 4: Coastline rim glows ── */}
      <g style={{ pointerEvents: 'none' }}>
        {mapDef.continents.map(c => {
          const territories = byContinent[c.id] ?? [];
          const hull = getContinentHull(territories);
          if (!hull || hull.length < 3) return null;
          const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
          return (
            <polygon key={`rim-${c.id}`}
              points={hullToPoints(expandHull(hull, 18))}
              fill="none"
              stroke={style.rimColor} strokeWidth={4} strokeOpacity={style.rimOpacity}
              filter="url(#continent-rim-blur)"
            />
          );
        })}
      </g>

      {/* ── Layer 5: Mountain ridge features (Ironspine) ── */}
      <g style={{ pointerEvents: 'none' }} opacity={0.55} filter="url(#mountain-ridge-blur)">
        <polyline points="230,105 260,130 270,165 255,200 230,230 215,265 200,310 195,355" fill="none" stroke="#8ba3c0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.60" />
        <polyline points="245,108 278,135 285,172 268,210 248,240 235,275" fill="none" stroke="#8ba3c0" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
        <polyline points="380,95 420,110 455,130 475,165 470,205 455,245 445,285 440,330" fill="none" stroke="#7a94b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        <polyline points="565,108 600,120 635,140 655,175 658,215 648,255 635,295 620,330" fill="none" stroke="#7080a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.50" />
        <polyline points="600,345 635,370 658,405 660,445 648,480" fill="none" stroke="#607090" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
        <polyline points="295,365 330,385 358,415 362,455 348,478" fill="none" stroke="#6a7e9a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
        {/* Peak chevrons */}
        {[[300,130],[450,110],[615,125],[650,420],[360,400]].map(([x,y],i) => (
          <g key={i} transform={`translate(${x},${y})`} opacity={0.5}>
            <polyline points="-7,8 0,-4 7,8" fill="none" stroke="#a0b8d0" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="-4,8 0,0 4,8" fill="none" stroke="#c0d4e8" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>

      {/* ── Layer 5b: Forest canopy (Wild Frontier) ── */}
      <g style={{ pointerEvents: 'none' }} filter="url(#feature-blur-soft)">
        {[
          {cx:130,cy:320,r:28,n:10},{cx:225,cy:440,r:32,n:12},{cx:350,cy:455,r:28,n:10},
          {cx:120,cy:558,r:30,n:11},{cx:255,cy:590,r:34,n:13},{cx:385,cy:610,r:30,n:11},
          {cx:155,cy:760,r:36,n:14},{cx:290,cy:790,r:32,n:12},{cx:420,cy:800,r:28,n:10},
        ].flatMap((cl,ci) =>
          Array.from({length:cl.n},(_,i) => {
            const angle = (ci*137.508 + i*43.5) * Math.PI/180;
            const d = cl.r*0.3 + ((ci*7+i*13)%17)/17*cl.r*0.65;
            return <circle key={`fc-${ci}-${i}`} cx={cl.cx+Math.cos(angle)*d} cy={cl.cy+Math.sin(angle)*d} r={3.5+((ci+i)%3)*1.5} fill="#22c55e" opacity={0.12+((i%4)*0.03)} />;
          })
        )}
      </g>

      {/* ── Layer 5c: Ruin crack-lines (Fracture Basin) ── */}
      <g style={{ pointerEvents: 'none' }} opacity={0.40} filter="url(#feature-blur-soft)">
        <line x1="590" y1="645" x2="465" y2="470" stroke="#f87171" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
        <line x1="590" y1="645" x2="555" y2="465" stroke="#f87171" strokeWidth="0.8" opacity="0.30" strokeLinecap="round" />
        <line x1="590" y1="645" x2="720" y2="610" stroke="#f87171" strokeWidth="1.0" opacity="0.38" strokeLinecap="round" />
        <line x1="590" y1="645" x2="700" y2="720" stroke="#f87171" strokeWidth="1.2" opacity="0.40" strokeLinecap="round" />
        <line x1="590" y1="645" x2="590" y2="800" stroke="#f87171" strokeWidth="0.9" opacity="0.35" strokeLinecap="round" />
        <line x1="590" y1="645" x2="470" y2="620" stroke="#f87171" strokeWidth="1.0" opacity="0.38" strokeLinecap="round" />
        <line x1="590" y1="645" x2="465" y2="765" stroke="#ef4444" strokeWidth="0.7" opacity="0.28" strokeLinecap="round" />
        <line x1="590" y1="645" x2="705" y2="820" stroke="#ef4444" strokeWidth="0.8" opacity="0.30" strokeLinecap="round" />
      </g>

      {/* ── Layer 5d: Plains grass strokes (Sunfields) ── */}
      <g style={{ pointerEvents: 'none' }} filter="url(#feature-blur-soft)">
        {[[280,950],[445,950],[610,950],[225,1110],[505,1110],[735,1085],[315,1260],[545,1260],[780,1235]]
          .flatMap(([ax,ay],ai) =>
            Array.from({length:8},(_,i) => {
              const dx=((ai*5+i*11)%60)-30, dy=((ai*7+i*9)%40)-20;
              const rad=(15+((ai+i)%4)*10)*Math.PI/180;
              return <line key={`pg-${ai}-${i}`}
                x1={ax+dx-Math.cos(rad)*5} y1={ay+dy-Math.sin(rad)*5}
                x2={ax+dx+Math.cos(rad)*5} y2={ay+dy+Math.sin(rad)*5}
                stroke="#d4a428" strokeWidth="0.7" opacity={0.12+(i%3)*0.03} strokeLinecap="round"
              />;
            })
          )}
      </g>

      {/* ── Layer 5e: Coastal wave marks (Shattered Coast) ── */}
      <g style={{ pointerEvents: 'none' }} opacity={0.45} filter="url(#feature-blur-soft)">
        {[[790,300],[865,430],[895,575],[790,660],[900,760],[805,880],[910,990],[850,1135]]
          .map(([x,y],i) => (
            <g key={`cw-${i}`}>
              <path d={`M${x-14},${y+2} Q${x-7},${y-5} ${x},${y+2}`} fill="none" stroke="#38bdf8" strokeWidth="0.9" opacity="0.35" strokeLinecap="round" />
              <path d={`M${x+2},${y+2} Q${x+9},${y-5} ${x+16},${y+2}`} fill="none" stroke="#38bdf8" strokeWidth="0.7" opacity="0.25" strokeLinecap="round" />
              <circle cx={x} cy={y} r={2.5} fill="#0ea5e9" opacity="0.12" />
            </g>
          ))}
      </g>

      {/* ── Layer 6: River lines ── */}
      <g style={{ pointerEvents: 'none' }} filter="url(#river-blur)">
        <path d="M290,790 C320,810 360,820 390,795 C420,770 445,745 465,720 C485,695 490,670 490,645"
          fill="none" stroke="#38bdf8" strokeWidth="2.0" strokeOpacity="0.22" strokeLinecap="round" />
        <path d="M290,790 C320,810 360,820 390,795 C420,770 445,745 465,720 C485,695 490,670 490,645"
          fill="none" stroke="#93c5fd" strokeWidth="0.8" strokeOpacity="0.18" strokeLinecap="round" />
        <path d="M365,480 C380,510 410,530 450,540 C490,550 530,555 555,570 C580,585 588,615 590,645"
          fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeOpacity="0.20" strokeLinecap="round" />
        <path d="M365,480 C380,510 410,530 450,540 C490,550 530,555 555,570 C580,585 588,615 590,645"
          fill="none" stroke="#93c5fd" strokeWidth="0.7" strokeOpacity="0.15" strokeLinecap="round" />
        <path d="M590,860 C580,900 560,940 530,970 C500,1000 495,1040 500,1080 C505,1120 530,1150 545,1200"
          fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeOpacity="0.20" strokeLinecap="round" />
        <path d="M805,930 C790,960 775,990 755,1010 C735,1030 730,1055 735,1085"
          fill="none" stroke="#38bdf8" strokeWidth="1.4" strokeOpacity="0.16" strokeLinecap="round" />
      </g>
    </g>
  );
}