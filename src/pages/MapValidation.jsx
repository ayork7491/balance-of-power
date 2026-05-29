/**
 * MapValidation — map overview: ocean + continent silhouettes + coastlines + labels.
 * No territories, no adjacency, no gameplay UI.
 */
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';

// ── Geometry helpers (inline — no dependency on ContinentLayer internals) ─────

function parsePoints(str) {
  if (!str) return [];
  return str.trim().split(/\s+/).map(pair => {
    const [x, y] = pair.split(',').map(Number);
    return [x, y];
  }).filter(([x, y]) => !isNaN(x) && !isNaN(y));
}

function computeConvexHull(points) {
  if (points.length < 3) return points;
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] > points[start][1] ||
        (points[i][1] === points[start][1] && points[i][0] < points[start][0])) start = i;
  }
  const pivot = points[start];
  const sorted = points.filter((_, i) => i !== start).sort((a, b) => {
    const angA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const angB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    return angA !== angB ? angA - angB :
      Math.hypot(a[0]-pivot[0], a[1]-pivot[1]) - Math.hypot(b[0]-pivot[0], b[1]-pivot[1]);
  });
  const hull = [pivot, sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    while (hull.length > 1) {
      const [ox,oy] = hull[hull.length-2], [ax,ay] = hull[hull.length-1], [bx,by] = sorted[i];
      if ((ax-ox)*(by-oy)-(ay-oy)*(bx-ox) <= 0) hull.pop(); else break;
    }
    hull.push(sorted[i]);
  }
  return hull;
}

function expandHull(hull, px) {
  const cx = hull.reduce((s,p)=>s+p[0],0)/hull.length;
  const cy = hull.reduce((s,p)=>s+p[1],0)/hull.length;
  return hull.map(([x,y])=>{const dx=x-cx,dy=y-cy,len=Math.hypot(dx,dy)||1;return[x+(dx/len)*px,y+(dy/len)*px];});
}

function toPoints(hull) {
  return hull.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function centroid(hull) {
  const x = hull.reduce((s,p)=>s+p[0],0)/hull.length;
  const y = hull.reduce((s,p)=>s+p[1],0)/hull.length;
  return [x, y];
}

// ── Continent visual styles ───────────────────────────────────────────────────

const CONTINENT_STYLES = {
  ironspine:       { fill: '#1a2135', atmo: '#3a4a6a', rim: '#7a95b8',  label: '#a8c0dc' },
  wild_frontier:   { fill: '#0c1a10', atmo: '#1a3d22', rim: '#4ade80',  label: '#6ee7a0' },
  fracture_basin:  { fill: '#190c0c', atmo: '#3d1515', rim: '#f87171',  label: '#fca5a5' },
  sunfields:       { fill: '#191408', atmo: '#3d2e0a', rim: '#fbbf24',  label: '#fcd34d' },
  shattered_coast: { fill: '#06111e', atmo: '#0c2d40', rim: '#38bdf8',  label: '#7dd3fc' },
};
const DEFAULT_STYLE = { fill: '#111827', atmo: '#1f2937', rim: '#6b7280', label: '#9ca3af' };

const MIN_ZOOM = 0.3, MAX_ZOOM = 4.0, TAP_THRESHOLD = 6;

// ── Main component ────────────────────────────────────────────────────────────

export default function MapValidation() {
  const mapDef = MAP_SHATTERED_CROWN;
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef(null);
  const rafRef = useRef(null);

  // Precompute continent hulls
  const continentHulls = useMemo(() => {
    const byContinent = {};
    for (const t of mapDef.territories) {
      if (!byContinent[t.continent_id]) byContinent[t.continent_id] = [];
      byContinent[t.continent_id].push(t);
    }
    const result = {};
    for (const c of mapDef.continents) {
      const all = [];
      for (const t of byContinent[c.id] ?? []) for (const pt of parsePoints(t.points)) all.push(pt);
      if (all.length >= 3) result[c.id] = computeConvexHull(all);
    }
    return result;
  }, []);

  // Fit map on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const t of mapDef.territories) {
      if(t.cx<minX)minX=t.cx;if(t.cx>maxX)maxX=t.cx;
      if(t.cy<minY)minY=t.cy;if(t.cy>maxY)maxY=t.cy;
    }
    const pad=80;
    minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
    maxX=Math.min(mapDef.width,maxX+pad);maxY=Math.min(mapDef.height,maxY+pad);
    const scale=Math.min(cw/(maxX-minX),ch/(maxY-minY))*0.96;
    setTransform({ x:(cw-(maxX-minX)*scale)/2-minX*scale, y:(ch-(maxY-minY)*scale)/2-minY*scale, scale });
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    setTransform(prev => {
      const delta = e.deltaY<0?1.1:0.9;
      const newScale = Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,prev.scale*delta));
      const r = newScale/prev.scale;
      return { scale:newScale, x:mx-r*(mx-prev.x), y:my-r*(my-prev.y) };
    });
  }, []);
  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    el.addEventListener('wheel',handleWheel,{passive:false});
    return()=>el.removeEventListener('wheel',handleWheel);
  },[handleWheel]);

  // Pan
  const onPointerDown = useCallback((e) => {
    if (e.button!==0) return;
    e.preventDefault();
    drag.current = { startX:e.clientX, startY:e.clientY, originX:transform.x, originY:transform.y, moved:false };
    e.currentTarget.setPointerCapture(e.pointerId);
  },[transform.x,transform.y]);

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    const dx=e.clientX-drag.current.startX, dy=e.clientY-drag.current.startY;
    if (Math.abs(dx)>TAP_THRESHOLD||Math.abs(dy)>TAP_THRESHOLD) drag.current.moved=true;
    if (!drag.current.moved) return;
    if (rafRef.current) return;
    rafRef.current=requestAnimationFrame(()=>{
      if(!drag.current)return;
      setTransform(prev=>({...prev,x:drag.current.originX+dx,y:drag.current.originY+dy}));
      rafRef.current=null;
    });
  },[]);

  const onPointerUp = useCallback(()=>{ drag.current=null; },[]);

  const fontSize = Math.max(9, Math.min(18, 14/transform.scale));

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-panel-header shrink-0">
        <span className="font-display text-sm tracking-widest uppercase text-foreground">
          The Shattered Crown
        </span>
        <span className="text-xs text-muted-foreground">— Continent Overview</span>
        <div className="ml-auto flex gap-3">
          {mapDef.continents.map(c => {
            const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
            return (
              <span key={c.id} className="flex items-center gap-1.5 text-xs" style={{color:style.label}}>
                <span className="w-2 h-2 rounded-full inline-block" style={{background:style.rim}} />
                {c.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Map canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none"
        style={{ backgroundColor:'#030810', cursor:'grab', touchAction:'none', userSelect:'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{ transform:`translate3d(${transform.x}px,${transform.y}px,0) scale(${transform.scale})`, transformOrigin:'0 0' }}
        >
          <svg width={mapDef.width} height={mapDef.height} style={{overflow:'visible',display:'block'}}>
            <defs>
              <filter id="atmo-blur" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="32" />
              </filter>
              <filter id="rim-blur" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
              <filter id="coast-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            {/* Ocean fill */}
            <rect x={0} y={0} width={mapDef.width} height={mapDef.height} fill="#030d1a" />

            {/* Layer 1: Atmosphere halos */}
            <g style={{pointerEvents:'none'}}>
              {mapDef.continents.map(c => {
                const hull = continentHulls[c.id]; if (!hull) return null;
                const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
                return <polygon key={`atmo-${c.id}`} points={toPoints(expandHull(hull,55))}
                  fill={style.atmo} opacity={0.55} filter="url(#atmo-blur)" />;
              })}
            </g>

            {/* Layer 2: Continent silhouette fills */}
            <g style={{pointerEvents:'none'}}>
              {mapDef.continents.map(c => {
                const hull = continentHulls[c.id]; if (!hull) return null;
                const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
                return <polygon key={`fill-${c.id}`} points={toPoints(expandHull(hull,14))}
                  fill={style.fill} fillOpacity={0.90} />;
              })}
            </g>

            {/* Layer 3: Coastline rim glow (blurred) */}
            <g style={{pointerEvents:'none'}}>
              {mapDef.continents.map(c => {
                const hull = continentHulls[c.id]; if (!hull) return null;
                const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
                return <polygon key={`rimglow-${c.id}`} points={toPoints(expandHull(hull,20))}
                  fill="none" stroke={style.rim} strokeWidth={8} strokeOpacity={0.22}
                  filter="url(#rim-blur)" />;
              })}
            </g>

            {/* Layer 4: Coastline crisp outline */}
            <g style={{pointerEvents:'none'}}>
              {mapDef.continents.map(c => {
                const hull = continentHulls[c.id]; if (!hull) return null;
                const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
                return <polygon key={`coast-${c.id}`} points={toPoints(expandHull(hull,14))}
                  fill="none" stroke={style.rim} strokeWidth={1.4} strokeOpacity={0.65} />;
              })}
            </g>

            {/* Layer 5: Continent labels */}
            <g style={{pointerEvents:'none'}}>
              {mapDef.continents.map(c => {
                const hull = continentHulls[c.id]; if (!hull) return null;
                const style = CONTINENT_STYLES[c.id] ?? DEFAULT_STYLE;
                const [lx, ly] = centroid(hull);
                return (
                  <g key={`label-${c.id}`}>
                    {/* Shadow */}
                    <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                      fontSize={fontSize*1.15} fontFamily="'Rajdhani',sans-serif" fontWeight="700"
                      letterSpacing="0.12em" fill="rgba(0,0,0,0.7)" stroke="rgba(0,0,0,0.6)"
                      strokeWidth={fontSize*0.18} paintOrder="stroke"
                      style={{textTransform:'uppercase'}}>
                      {c.name.toUpperCase()}
                    </text>
                    {/* Main label */}
                    <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                      fontSize={fontSize*1.15} fontFamily="'Rajdhani',sans-serif" fontWeight="700"
                      letterSpacing="0.12em" fill={style.label} fillOpacity={0.85}
                      style={{textTransform:'uppercase'}}>
                      {c.name.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10" style={{pointerEvents:'auto'}}>
          <button onClick={()=>setTransform(t=>({...t,scale:Math.min(MAX_ZOOM,t.scale*1.25)}))}
            className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg flex items-center justify-center hover:bg-secondary transition-all shadow-lg">+</button>
          <button onClick={()=>setTransform(t=>({...t,scale:Math.max(MIN_ZOOM,t.scale/1.25)}))}
            className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg flex items-center justify-center hover:bg-secondary transition-all shadow-lg">−</button>
        </div>
      </div>
    </div>
  );
}