/**
 * MapGeometryAudit — Shattered Coast geometry validation page.
 *
 * For each Shattered Coast territory, shows:
 * - Loaded polygon (from mapData.shattered_crown.ts) in blue
 * - Raw source polygon (accumulated from JSON deltas inline) in red/orange
 * - Both center anchors
 * - Bounding box comparison
 *
 * This does NOT use territory centers to reconstruct geometry.
 * It accumulates delta coords from the raw source JSON directly.
 */
import { useMemo, useState } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';

// ── Raw source data (verbatim from shattered_crown_territory_polygons_final.json) ──
// C1, C2, C3, C4, C5, C7, C8 = delta-encoded (first point absolute, rest are offsets)
// C6 = fully absolute

const RAW_DELTAS = {
  C1: [[6841.78,2936.0],[42.67,-213.33],[44.44,-216.0],[1.78,-2.67],[88.0,-64.89],[88.0,-64.89],[0.0,0.0],[38.22,-10.67],[48.0,-25.78],[9.78,-15.11],[40.89,-104.89],[40.89,-104.89],[129.78,-60.44],[35.56,-176.0],[44.44,11.56],[177.78,54.22],[56.89,12.44],[61.33,102.22],[57.78,16.89],[71.11,58.67],[-13.33,61.33],[-9.78,106.67],[41.78,106.67],[41.78,-55.11],[67.56,-48.0],[37.33,55.11],[62.22,-30.22],[76.44,-94.22],[52.44,-102.22],[59.56,-64.0],[39.11,-88.89],[-7.11,-52.44],[47.11,55.11],[57.78,-43.56],[32.89,-88.0],[4.44,-48.89],[37.33,-53.33],[-12.44,-19.56],[-34.67,42.67],[-104.0,-160.89]],
  C2: [[7264.0,3230.22],[15.11,-15.11],[215.11,-127.11],[215.11,-127.11],[172.44,96.0],[81.78,176.89],[87.11,16.0],[93.33,0.0],[6.22,-16.0],[46.22,-149.33],[46.22,-149.33],[62.22,-32.89],[43.56,86.22],[32.89,138.67],[-91.56,55.11],[5.33,159.11],[-83.56,21.33],[-254.22,-80.0],[61.33,-216.89],[-128.89,-160.0],[62.22,-120.89],[-55.11,-120.0],[-63.11,89.0],[-8.0,-44.44],[-131.56,-44.44],[-131.56,113.78],[-117.33,72.0],[-12.44,52.44],[43.56,62.22],[-28.44,65.78],[-40.89,3.56],[-12.44,-6.22],[-96.89,-6.22]],
  C3: [[7230.22,3980.44],[4.44,-10.67],[51.56,-66.67],[52.44,-69.33],[12.44,-139.56],[12.44,-139.56],[0.0,0.0],[117.33,-20.44],[127.11,-9.78],[9.78,10.67],[61.33,86.22],[61.33,86.22],[0.0,0.0],[39.11,-69.33],[38.22,-73.78],[-14.22,-58.67],[-14.22,-58.67],[80.0,-61.33],[254.22,83.56],[-21.33,39.11],[-5.33,39.11],[-8.0,9.78],[-72.0,11.56],[-74.67,1.78],[-2.67,19.56],[-15.11,19.56],[-15.11,27.56],[34.67,3.56],[60.44,101.33],[85.33,48.89],[177.78,-38.22],[63.11,-54.22],[66.67,48.0],[81.78,71.11],[-33.78,48.89],[50.67,-50.67],[48.0,-53.33],[48.89,-2.67],[89.0,-6.22],[40.0,-6.22],[40.0,56.0],[59.56,-41.78],[58.67,-45.33],[59.56,-113.78],[36.44,-113.78],[36.44,-92.44],[-102.22,-60.44],[-127.11,-69.33],[-53.33,-13.33],[62.22,115.56],[124.44,82.67],[-35.56,90.67],[-179.56,47.11],[-84.44,-25.78],[-83.56,-31.11],[-51.56,-184.89],[-51.56,-184.89],[-128.89,-169.78],[-192.0,-192.89]],
  C4: [[7028.44,4997.33],[8.0,-9.78],[218.67,-112.0],[217.78,-124.44],[89.0,-12.44],[-67.56,-126.22],[-63.11,-129.78],[4.44,-3.56],[29.33,-17.78],[29.33,-17.78],[76.44,39.11],[62.22,-39.11],[-98.67,-59.56],[54.22,-28.44],[91.56,38.22],[95.11,-116.44],[-46.22,-129.78],[-61.33,-134.22],[-62.22,-136.89],[-70.22,-39.11],[-71.11,-41.78],[-47.11,-127.11],[-47.11,-127.11],[-105.78,75.56],[-49.78,-45.33],[-82.67,-116.44],[-81.78,109.33],[42.67,128.89],[-71.11,78.22],[34.67,174.22],[43.56,157.33],[-53.33,32.0],[-35.56,65.78],[6.22,150.22],[114.67,64.0]],
  C5: [[7236.44,5064.89],[26.67,-128.89],[32.89,-125.33],[6.22,3.56],[83.56,30.22],[83.56,30.22],[0.0,0.0],[64.0,-59.56],[64.0,-71.11],[76.44,-180.44],[76.44,-180.44],[178.67,40.89],[192.89,183.11],[171.56,142.22],[182.22,123.56],[-153.78,112.89],[-176.0,154.67],[-102.22,98.67],[-66.67,-20.44],[-144.0,-160.89],[-176.89,-183.11],[-162.67,-144.89]],
  C6: [[6660.44,5461.33],[6830.22,5158.22],[6850.67,5078.22],[7009.78,5175.11],[7065.78,5081.78],[7167.11,5223.11],[7385.78,5417.78],[7327.11,5527.11],[7369.78,5629.33],[7225.78,5691.56],[7106.67,5805.33],[6832.0,5638.22]],
  C7: [[7138.67,6494.22],[-4.44,-14.22],[-238.22,-242.67],[-238.22,-242.67],[5.33,-115.56],[72.0,-82.67],[13.33,-98.67],[40.0,13.33],[3.56,63.11],[154.67,5.33],[17.78,-71.11],[77.33,21.33],[77.33,190.22],[164.44,16.89],[130.67,-110.22],[97.78,-242.67]],
  C8: [[7428.44,5920.89],[2.67,-16.0],[29.33,-223.11],[29.33,-223.11],[167.11,-204.44],[91.56,136.0],[144.89,-16.89],[123.56,229.33],[-38.22,193.78],[-251.56,45.33],[-114.67,-22.22],[-152.0,-137.78]],
};

// Detect if a polygon is delta-encoded: C6 is absolute (all large coords), rest are deltas after first point
function isAbsolute(id) { return id === 'C6'; }

// Accumulate delta coords to absolute
function accumulateDeltas(pairs) {
  const pts = [[pairs[0][0], pairs[0][1]]];
  let cx = pairs[0][0], cy = pairs[0][1];
  for (let i = 1; i < pairs.length; i++) {
    cx += pairs[i][0];
    cy += pairs[i][1];
    pts.push([cx, cy]);
  }
  return pts;
}

// Get absolute source polygon
function getSourcePoly(id) {
  const raw = RAW_DELTAS[id];
  if (!raw) return [];
  if (isAbsolute(id)) return raw.map(([x,y]) => ({x, y}));
  return accumulateDeltas(raw).map(([x,y]) => ({x, y}));
}

// Compute centroid
function centroid(pts) {
  if (!pts.length) return {x: 0, y: 0};
  return {
    x: pts.reduce((s,p) => s+p.x, 0) / pts.length,
    y: pts.reduce((s,p) => s+p.y, 0) / pts.length,
  };
}

// Compute bounding box
function bbox(pts) {
  if (!pts.length) return {minX:0,maxX:0,minY:0,maxY:0,w:0,h:0};
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  return {minX, maxX, minY, maxY, w: maxX-minX, h: maxY-minY};
}

// Parse loaded points string to array of {x,y}
function parsePoints(str) {
  if (!str) return [];
  return str.trim().split(/\s+/).map(pair => {
    const [x,y] = pair.split(',').map(Number);
    return {x, y};
  });
}

const COAST_IDS = ['C1','C2','C3','C4','C5','C6','C7','C8'];

const TERRITORY_NAMES = {
  C1: 'Northcliff',
  C2: 'Saltwind Pass',
  C3: 'Broken Harbor',
  C4: 'Blacktide Gate',
  C5: 'Shardport',
  C6: 'Mirror Cape',
  C7: 'Tidebreak',
  C8: 'Southwake',
};

// Mini SVG viewer for a single territory comparison
function TerritoryCompare({ tid }) {
  const loadedTerr = MAP_SHATTERED_CROWN.territories.find(t => t.territory_id === tid);
  const loadedPts = loadedTerr ? parsePoints(loadedTerr.points) : [];
  const sourcePts = getSourcePoly(tid);

  const allPts = [...loadedPts, ...sourcePts];
  const bb = bbox(allPts);
  const pad = Math.max(bb.w, bb.h) * 0.12 + 100;
  const vMinX = bb.minX - pad, vMinY = bb.minY - pad;
  const vW = bb.w + pad*2, vH = bb.h + pad*2;

  const loadedCx = centroid(loadedPts);
  const sourceCx = centroid(sourcePts);

  const loadedBB = bbox(loadedPts);
  const sourceBB = bbox(sourcePts);

  const dCx = Math.round(loadedCx.x - sourceCx.x);
  const dCy = Math.round(loadedCx.y - sourceCx.y);

  const toPoints = (pts) => pts.map(p=>`${p.x},${p.y}`).join(' ');

  const [hover, setHover] = useState(null);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-panel-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel-header border-b border-border">
        <div>
          <span className="text-xs font-mono text-primary mr-2">{tid}</span>
          <span className="text-sm font-display text-foreground">{TERRITORY_NAMES[tid]}</span>
          {isAbsolute(tid) && <span className="ml-2 text-xs text-green-400 border border-green-400/40 px-1 rounded">ABSOLUTE</span>}
          {!isAbsolute(tid) && <span className="ml-2 text-xs text-yellow-400 border border-yellow-400/40 px-1 rounded">DELTA</span>}
        </div>
        <div className={`text-xs font-mono ${(Math.abs(dCx) + Math.abs(dCy)) < 5 ? 'text-green-400' : 'text-red-400'}`}>
          Δcenter: ({dCx > 0 ? '+' : ''}{dCx}, {dCy > 0 ? '+' : ''}{dCy})
        </div>
      </div>

      {/* SVG overlay */}
      <div className="relative bg-[#04111e]">
        <svg
          viewBox={`${vMinX} ${vMinY} ${vW} ${vH}`}
          className="w-full"
          style={{ height: '220px' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Source polygon (orange, dashed) */}
          {sourcePts.length > 0 && (
            <polygon
              points={toPoints(sourcePts)}
              fill="rgba(251,146,60,0.15)"
              stroke="#f97316"
              strokeWidth={Math.max(bb.w, bb.h) * 0.008}
              strokeDasharray={`${Math.max(bb.w, bb.h) * 0.02} ${Math.max(bb.w, bb.h) * 0.01}`}
            />
          )}
          {/* Loaded polygon (blue, solid) */}
          {loadedPts.length > 0 && (
            <polygon
              points={toPoints(loadedPts)}
              fill="rgba(56,189,248,0.18)"
              stroke="#38bdf8"
              strokeWidth={Math.max(bb.w, bb.h) * 0.005}
            />
          )}
          {/* Source centroid (orange dot) */}
          {sourcePts.length > 0 && (
            <circle
              cx={sourceCx.x} cy={sourceCx.y}
              r={Math.max(bb.w, bb.h) * 0.018}
              fill="#f97316"
              opacity={0.9}
            />
          )}
          {/* Loaded centroid (blue dot) */}
          {loadedPts.length > 0 && (
            <circle
              cx={loadedCx.x} cy={loadedCx.y}
              r={Math.max(bb.w, bb.h) * 0.015}
              fill="#38bdf8"
              opacity={0.9}
            />
          )}
          {/* Delta line between centroids */}
          {loadedPts.length > 0 && sourcePts.length > 0 && (
            <line
              x1={sourceCx.x} y1={sourceCx.y}
              x2={loadedCx.x} y2={loadedCx.y}
              stroke="#facc15"
              strokeWidth={Math.max(bb.w, bb.h) * 0.005}
              strokeDasharray={`${Math.max(bb.w, bb.h) * 0.015} ${Math.max(bb.w, bb.h) * 0.01}`}
            />
          )}
        </svg>
        {/* Legend */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 text-[10px]">
          <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#38bdf8] inline-block"/><span className="text-[#38bdf8]">Loaded</span></div>
          <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#f97316] inline-block border-dashed"/><span className="text-[#f97316]">Source (raw)</span></div>
        </div>
      </div>

      {/* Data table */}
      <div className="grid grid-cols-2 gap-0 text-[10px] font-mono border-t border-border">
        <div className="p-2 border-r border-border">
          <div className="text-[#38bdf8] font-bold mb-1">LOADED (mapData.ts)</div>
          <div>pts: {loadedPts.length}</div>
          <div>cx: {loadedCx.x.toFixed(1)}, {loadedCx.y.toFixed(1)}</div>
          <div>bbox: {loadedBB.w.toFixed(0)} × {loadedBB.h.toFixed(0)}</div>
          <div>min: ({loadedBB.minX.toFixed(0)}, {loadedBB.minY.toFixed(0)})</div>
          <div>max: ({loadedBB.maxX.toFixed(0)}, {loadedBB.maxY.toFixed(0)})</div>
          {loadedTerr && <div className="text-muted-foreground mt-1">label_x: {loadedTerr.label_x?.toFixed(1)}</div>}
          {loadedTerr && <div className="text-muted-foreground">label_y: {loadedTerr.label_y?.toFixed(1)}</div>}
        </div>
        <div className="p-2">
          <div className="text-[#f97316] font-bold mb-1">SOURCE (final.json)</div>
          <div>pts: {sourcePts.length}</div>
          <div>cx: {sourceCx.x.toFixed(1)}, {sourceCx.y.toFixed(1)}</div>
          <div>bbox: {sourceBB.w.toFixed(0)} × {sourceBB.h.toFixed(0)}</div>
          <div>min: ({sourceBB.minX.toFixed(0)}, {sourceBB.minY.toFixed(0)})</div>
          <div>max: ({sourceBB.maxX.toFixed(0)}, {sourceBB.maxY.toFixed(0)})</div>
          <div className="mt-1 text-muted-foreground">
            {isAbsolute(tid) ? '✓ absolute coords' : '⚠ delta-accumulated'}
          </div>
        </div>
      </div>

      {/* Point-level mismatch if any */}
      {(Math.abs(dCx) + Math.abs(dCy)) > 5 && (
        <div className="px-3 py-2 bg-red-900/20 border-t border-red-500/30 text-[10px] text-red-400 font-mono">
          ⚠ Centroid mismatch detected: loaded polygon is offset by ({dCx}, {dCy}) from source
        </div>
      )}
      {(Math.abs(dCx) + Math.abs(dCy)) <= 5 && loadedPts.length > 0 && (
        <div className="px-3 py-2 bg-green-900/20 border-t border-green-500/30 text-[10px] text-green-400 font-mono">
          ✓ Centroid match within tolerance
        </div>
      )}
    </div>
  );
}

// Overlay all Shattered Coast polys on the background image
function FullOverlay() {
  const W = 10240, H = 10240;
  const bgUrl = MAP_SHATTERED_CROWN.background_image_url;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-[#04111e]">
      <div className="px-3 py-2 bg-panel-header border-b border-border text-xs font-display tracking-wider uppercase text-muted-foreground">
        Full Map Overlay — Shattered Coast (Blue=Loaded, Orange=Source)
      </div>
      <div className="relative" style={{ aspectRatio: '1/1', maxHeight: '480px' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {bgUrl && (
            <image href={bgUrl} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid meet" />
          )}
          {COAST_IDS.map(tid => {
            const loadedTerr = MAP_SHATTERED_CROWN.territories.find(t => t.territory_id === tid);
            const loadedPts = loadedTerr ? parsePoints(loadedTerr.points) : [];
            const sourcePts = getSourcePoly(tid);
            const toPoints = (pts) => pts.map(p=>`${p.x},${p.y}`).join(' ');
            const lc = centroid(loadedPts);
            const sc = centroid(sourcePts);
            return (
              <g key={tid}>
                {sourcePts.length > 0 && (
                  <polygon points={toPoints(sourcePts)} fill="rgba(251,146,60,0.2)" stroke="#f97316" strokeWidth="12" strokeDasharray="30 15" />
                )}
                {loadedPts.length > 0 && (
                  <polygon points={toPoints(loadedPts)} fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth="8" />
                )}
                {sourcePts.length > 0 && <circle cx={sc.x} cy={sc.y} r={30} fill="#f97316" />}
                {loadedPts.length > 0 && <circle cx={lc.x} cy={lc.y} r={25} fill="#38bdf8" />}
                {loadedPts.length > 0 && (
                  <text x={lc.x} y={lc.y - 50} textAnchor="middle" fontSize="80" fill="white" stroke="black" strokeWidth="10" paintOrder="stroke" fontFamily="sans-serif" fontWeight="bold">{tid}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex gap-4 px-3 py-2 text-xs border-t border-border">
        <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#38bdf8] inline-block"/><span className="text-[#38bdf8]">Loaded (mapData.ts)</span></div>
        <div className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#f97316] inline-block"/><span className="text-[#f97316]">Source (final.json accumulated)</span></div>
      </div>
    </div>
  );
}

export default function MapGeometryAudit() {
  const [activeId, setActiveId] = useState(null);

  // Summary: for each territory, check if loaded matches source
  const summaryRows = COAST_IDS.map(tid => {
    const loadedTerr = MAP_SHATTERED_CROWN.territories.find(t => t.territory_id === tid);
    const loadedPts = loadedTerr ? parsePoints(loadedTerr.points) : [];
    const sourcePts = getSourcePoly(tid);
    const lc = centroid(loadedPts);
    const sc = centroid(sourcePts);
    const dCx = Math.round(lc.x - sc.x);
    const dCy = Math.round(lc.y - sc.y);
    const match = Math.abs(dCx) + Math.abs(dCy) < 5;
    const ptCountMatch = loadedPts.length === sourcePts.length;
    return { tid, name: TERRITORY_NAMES[tid], loadedPts: loadedPts.length, sourcePts: sourcePts.length, dCx, dCy, match, ptCountMatch, isDelta: !isAbsolute(tid) };
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-panel-header flex items-center gap-4">
        <h1 className="font-display text-base tracking-widest uppercase text-primary">Shattered Coast — Geometry Audit</h1>
        <span className="text-xs text-muted-foreground">Blue = loaded from mapData.ts | Orange (dashed) = accumulated from source JSON</span>
        <a href="/map-validation" className="ml-auto text-xs text-muted-foreground hover:text-foreground underline">← Map Validation</a>
      </div>

      <div className="p-4 space-y-6">

        {/* Summary table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-panel-header text-xs font-display tracking-wider uppercase text-muted-foreground border-b border-border">
            Summary — All 8 Shattered Coast Territories
          </div>
          <table className="w-full text-xs font-mono">
            <thead className="border-b border-border bg-panel-bg">
              <tr>
                <th className="text-left px-3 py-2 text-muted-foreground">ID</th>
                <th className="text-left px-3 py-2 text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2 text-muted-foreground">Encoding</th>
                <th className="text-right px-3 py-2 text-muted-foreground">Loaded pts</th>
                <th className="text-right px-3 py-2 text-muted-foreground">Source pts</th>
                <th className="text-right px-3 py-2 text-muted-foreground">Δcx</th>
                <th className="text-right px-3 py-2 text-muted-foreground">Δcy</th>
                <th className="text-center px-3 py-2 text-muted-foreground">Match?</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(row => (
                <tr
                  key={row.tid}
                  className={`border-b border-border cursor-pointer hover:bg-secondary/50 ${activeId === row.tid ? 'bg-primary/10' : ''}`}
                  onClick={() => setActiveId(activeId === row.tid ? null : row.tid)}
                >
                  <td className="px-3 py-2 text-primary font-bold">{row.tid}</td>
                  <td className="px-3 py-2 text-foreground">{row.name}</td>
                  <td className="px-3 py-2">
                    {row.isDelta
                      ? <span className="text-yellow-400">delta-encoded</span>
                      : <span className="text-green-400">absolute</span>}
                  </td>
                  <td className={`px-3 py-2 text-right ${row.ptCountMatch ? 'text-foreground' : 'text-red-400'}`}>{row.loadedPts}</td>
                  <td className={`px-3 py-2 text-right ${row.ptCountMatch ? 'text-foreground' : 'text-red-400'}`}>{row.sourcePts}</td>
                  <td className={`px-3 py-2 text-right ${Math.abs(row.dCx) < 5 ? 'text-green-400' : 'text-red-400'}`}>
                    {row.dCx > 0 ? '+' : ''}{row.dCx}
                  </td>
                  <td className={`px-3 py-2 text-right ${Math.abs(row.dCy) < 5 ? 'text-green-400' : 'text-red-400'}`}>
                    {row.dCy > 0 ? '+' : ''}{row.dCy}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.match && row.ptCountMatch
                      ? <span className="text-green-400">✓</span>
                      : <span className="text-red-400">✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[10px] text-muted-foreground bg-panel-bg border-t border-border">
            Click a row to expand detail below. Δ = loaded centroid minus source centroid. Mismatch indicates polygon was incorrectly accumulated or not updated.
          </div>
        </div>

        {/* Detail view for selected territory */}
        {activeId && (
          <div>
            <div className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">Detail: {activeId} — {TERRITORY_NAMES[activeId]}</div>
            <TerritoryCompare tid={activeId} />
          </div>
        )}

        {/* All territories grid */}
        <div>
          <div className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-3">Per-Territory Overlay (all 8)</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {COAST_IDS.map(tid => (
              <TerritoryCompare key={tid} tid={tid} />
            ))}
          </div>
        </div>

        {/* Full map overlay */}
        <FullOverlay />

        {/* Transform audit note */}
        <div className="border border-yellow-500/30 rounded-lg p-4 bg-yellow-900/10">
          <div className="text-xs font-display tracking-wider uppercase text-yellow-400 mb-2">SVG Transform Audit</div>
          <div className="text-xs font-mono text-muted-foreground space-y-1">
            <div>• MapLayerStack renders polygons directly inside <code className="text-foreground">&lt;g id="layer-01-territory-polygons"&gt;</code></div>
            <div>• No <code className="text-foreground">transform</code>, <code className="text-foreground">translate()</code>, <code className="text-foreground">scale()</code>, or <code className="text-foreground">matrix()</code> on any group</div>
            <div>• The outer SVG has <code className="text-foreground">width={10240} height={10240}</code> — no viewBox scaling</div>
            <div>• The container div uses <code className="text-foreground">transform: translate3d + scale</code> for pan/zoom only (CSS, not SVG)</div>
            <div>• TerritoryPolygon renders <code className="text-foreground">&lt;polygon points=&#123;territory.points&#125; /&gt;</code> with no additional transform</div>
            <div className="text-yellow-300 mt-2">→ If polygons are offset, the issue is in the coordinate data itself (mapData.shattered_crown.ts), not in SVG transforms.</div>
          </div>
        </div>
      </div>
    </div>
  );
}