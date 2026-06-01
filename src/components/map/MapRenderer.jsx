/**
 * MapRenderer — schema-driven SVG map.
 *
 * Pointer/touch architecture:
 *   - Mouse: pointerdown/move/up for pan + click
 *   - Touch: native touchstart/touchmove/touchend for pan, pinch-zoom, and tap
 *     (avoids pointer capture issues on mobile)
 */
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { PLAYER_COLORS } from '@/config/theme';
import MapLayerStack from './MapLayerStack';
import { useMapInteraction } from '@/features/maps/useMapInteraction';
import { Map, Eye, Layers } from 'lucide-react';

// Helper: button that works on both desktop and mobile by using pointer events
// directly. Stops propagation so the map's native touch handlers never see it.
function MapButton({ onClick, className, children, 'aria-label': ariaLabel, title }) {
  const handlePointer = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);
  const handlePointerUp = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  }, [onClick]);
  return (
    <button
      onPointerDown={handlePointer}
      onPointerUp={handlePointerUp}
      onTouchStart={handlePointer}
      onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      onMouseDown={handlePointer}
      onClick={(e) => e.stopPropagation()}
      className={className}
      aria-label={ariaLabel}
      title={title}
      style={{ touchAction: 'none', userSelect: 'none' }}
    >
      {children}
    </button>
  );
}

function getPlayerHex(players, playerId) {
  if (!playerId) return null;
  const player = players.find(p => p.id === playerId || p.user_id === playerId);
  if (!player) return null;
  const pc = PLAYER_COLORS.find(c => c.id === player.color);
  return pc?.hex ?? null;
}

const MAX_ZOOM = 4.0;
const TAP_THRESHOLD = 8;

function getTerritoryIdFromTarget(target) {
  let el = target;
  let depth = 0;
  while (el && depth < 8) {
    const tid = el.dataset?.tid;
    if (tid) return tid;
    el = el.parentElement;
    depth++;
  }
  return null;
}

// Compute tight-fit transform: landmass fills full container width
function computeFitTransform(cw, ch, mapDef) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of mapDef.territories) {
    if (t.cx < minX) minX = t.cx;
    if (t.cx > maxX) maxX = t.cx;
    if (t.cy < minY) minY = t.cy;
    if (t.cy > maxY) maxY = t.cy;
  }
  const padX = 80, padY = 80;
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(mapDef.width, maxX + padX);
  maxY = Math.min(mapDef.height, maxY + padY);

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const scale = cw / contentW;
  const x = -minX * scale;
  const y = (ch - contentH * scale) / 2 - minY * scale;
  return { x, y, scale };
}

export default function MapRenderer({
  mapDef,
  stateById = {},
  players = [],
  selectedId = null,
  highlightIds = new Set(),
  attackableIds = new Set(),
  onSelect,
  arrowLayer = null,  // now rendered inside the SVG transform (must be SVG elements, not an <svg>)
  currentPhase = null,
  actingPlayer = null,
  onAttackOriginSelect = null,
  onAttackTargetSelect = null,
  onFortifyOriginSelect = null,
  onFortifyDestinationSelect = null,
  onBuildTerritorySelect = null,
  onDraftTerritorySelect = null,
  onDeployTerritorySelect = null,
  lockedIds = new Set(),
  debugMode = false,
  _suppressConnectionLines = false,
}) {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [mapView, setMapView] = useState('artistic');
  const [showBorders, setShowBorders] = useState(false);

  // Computed initial/min scale (updated on mount)
  const fitScaleRef = useRef(0.04);

  // Mouse drag state
  const mouseDrag = useRef(null);
  const rafRef = useRef(null);

  // Touch state
  const touchRef = useRef(null); // { touches: [...], originX, originY, originScale, startMidX, startMidY }

  const [hoveredId, setHoveredId] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  const adjacencyMapForInteraction = useMemo(() => {
    if (!mapDef?.adjacency) return {};
    const map = {};
    for (const t of mapDef.territories) map[t.territory_id] = new Set();
    for (const [a, b] of mapDef.adjacency) {
      map[a]?.add(b);
      map[b]?.add(a);
    }
    return map;
  }, [mapDef]);

  const {
    interactionMode,
    attackOriginId,
    fortifyOriginId,
    handleTerritoryClick,
  } = useMapInteraction({
    currentPhase,
    selectedTerritoryId: selectedId,
    actingPlayer,
    mapDef,
    stateById,
    players,
    adjacencyMap: adjacencyMapForInteraction,
    onSelect,
    onAttackOriginSelect,
    onAttackTargetSelect,
    onFortifyOriginSelect,
    onFortifyDestinationSelect,
    onBuildTerritorySelect,
    onDraftTerritorySelect,
    onDeployTerritorySelect,
  });

  // Fit on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapDef) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const fit = computeFitTransform(cw, ch, mapDef);
    fitScaleRef.current = fit.scale;
    setTransform(fit);
  }, [mapDef]);

  // ── Wheel zoom (mouse) ─────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pivotX = e.clientX - rect.left;
    const pivotY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    setTransform(prev => {
      const newScale = Math.max(fitScaleRef.current * 0.5, Math.min(MAX_ZOOM, prev.scale * factor));
      const ratio = newScale / prev.scale;
      return { scale: newScale, x: pivotX - ratio * (pivotX - prev.x), y: pivotY - ratio * (pivotY - prev.y) };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Zoom around screen center (buttons) ───────────────────────────────────
  const zoomAroundCenter = useCallback((factor) => {
    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const pivotX = cw / 2;
    const pivotY = ch / 2;
    setTransform(prev => {
      const newScale = Math.max(fitScaleRef.current * 0.5, Math.min(MAX_ZOOM, prev.scale * factor));
      const ratio = newScale / prev.scale;
      return { scale: newScale, x: pivotX - ratio * (pivotX - prev.x), y: pivotY - ratio * (pivotY - prev.y) };
    });
  }, []);

  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el || !mapDef) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const fit = computeFitTransform(cw, ch, mapDef);
    fitScaleRef.current = fit.scale;
    setTransform(fit);
  }, [mapDef]);

  // ── Mouse pointer handlers ─────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Don't start drag if clicking a button/control
    if (e.target.closest('button')) return;
    e.preventDefault();
    mouseDrag.current = {
      startX: e.clientX, startY: e.clientY,
      originX: transform.x, originY: transform.y,
      moved: false, downTarget: e.target,
    };
  }, [transform.x, transform.y]);

  const onMouseMove = useCallback((e) => {
    if (!mouseDrag.current) {
      // hover
      const tid = getTerritoryIdFromTarget(e.target);
      setHoveredId(tid ?? null);
      return;
    }
    const dx = e.clientX - mouseDrag.current.startX;
    const dy = e.clientY - mouseDrag.current.startY;
    if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) mouseDrag.current.moved = true;
    if (!mouseDrag.current.moved) return;
    if (rafRef.current) return;
    const { originX, originY } = mouseDrag.current;
    rafRef.current = requestAnimationFrame(() => {
      setTransform(prev => ({ ...prev, x: originX + dx, y: originY + dy }));
      rafRef.current = null;
    });
  }, []);

  const onMouseUp = useCallback((e) => {
    if (!mouseDrag.current) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const { moved, downTarget } = mouseDrag.current;
    mouseDrag.current = null;
    if (!moved) {
      const tid = getTerritoryIdFromTarget(e.target) ?? getTerritoryIdFromTarget(downTarget);
      if (tid) handleTerritoryClick(tid);
    }
  }, [handleTerritoryClick]);

  // ── Touch handlers (pan + pinch-zoom + tap) ────────────────────────────────
  const onTouchStart = useCallback((e) => {
    // Don't intercept touches on buttons/controls
    if (e.target.closest('button')) return;
    e.preventDefault();
    const touches = Array.from(e.touches);
    setTransform(current => {
      if (touches.length === 1) {
        touchRef.current = {
          type: 'pan',
          startX: touches[0].clientX,
          startY: touches[0].clientY,
          originX: current.x,
          originY: current.y,
          moved: false,
          downTarget: e.target,
        };
      } else if (touches.length === 2) {
        const midX = (touches[0].clientX + touches[1].clientX) / 2;
        const midY = (touches[0].clientY + touches[1].clientY) / 2;
        const dist = Math.hypot(
          touches[1].clientX - touches[0].clientX,
          touches[1].clientY - touches[0].clientY
        );
        touchRef.current = {
          type: 'pinch',
          startDist: dist,
          midX, midY,
          originScale: current.scale,
          originX: current.x,
          originY: current.y,
        };
      }
      return current; // no state change here
    });
  }, []);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!touchRef.current) return;
    const touches = Array.from(e.touches);
    const t = touchRef.current;

    if (t.type === 'pan' && touches.length === 1) {
      const dx = touches[0].clientX - t.startX;
      const dy = touches[0].clientY - t.startY;
      if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) t.moved = true;
      if (!t.moved) return;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        setTransform(prev => ({ ...prev, x: t.originX + dx, y: t.originY + dy }));
        rafRef.current = null;
      });
    } else if (t.type === 'pinch' && touches.length === 2) {
      const dist = Math.hypot(
        touches[1].clientX - touches[0].clientX,
        touches[1].clientY - touches[0].clientY
      );
      const newScale = Math.max(
        fitScaleRef.current * 0.5,
        Math.min(MAX_ZOOM, t.originScale * (dist / t.startDist))
      );
      const ratio = newScale / t.originScale;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        setTransform({
          scale: newScale,
          x: t.midX - ratio * (t.midX - t.originX),
          y: t.midY - ratio * (t.midY - t.originY),
        });
        rafRef.current = null;
      });
    }
  }, []);

  const onTouchEnd = useCallback((e) => {
    e.preventDefault();
    if (!touchRef.current) return;
    const t = touchRef.current;
    touchRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    // Tap detection — single finger, didn't move
    if (t.type === 'pan' && !t.moved && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const tid = getTerritoryIdFromTarget(el) ?? getTerritoryIdFromTarget(t.downTarget);
      if (tid) handleTerritoryClick(tid);
    }
  }, [handleTerritoryClick]);

  // Register touch handlers with passive:false so we can call preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const regionColorById = {};
  for (const r of (mapDef?.regions ?? [])) {
    regionColorById[r.id] = r.color ?? '#334155';
  }

  if (!mapDef) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={(e) => { setHoveredId(null); onMouseUp(e); }}
      style={{
        cursor: mouseDrag.current ? 'grabbing' : 'grab',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        backgroundColor: '#04111e',
      }}
      data-map-container="true"
    >
      {/* Map layer with GPU-accelerated transform */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          width={mapDef.width}
          height={mapDef.height}
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            <filter id="glow-selected" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-highlight" x="-30%" y="-30%" width="160%" height="160%">
              <feFlood floodColor="#fde047" floodOpacity="0.6" result="color" />
              <feComposite in="color" in2="SourceGraphic" operator="in" result="tinted" />
              <feGaussianBlur in="tinted" stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-attack" x="-30%" y="-30%" width="160%" height="160%">
              <feFlood floodColor="#f87171" floodOpacity="0.7" result="color" />
              <feComposite in="color" in2="SourceGraphic" operator="in" result="tinted" />
              <feGaussianBlur in="tinted" stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-owner" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
            </filter>
            <pattern id="locked-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#f97316" strokeWidth="2.5" strokeOpacity="0.8" />
            </pattern>
          </defs>

          <MapLayerStack
            mapDef={mapDef}
            width={mapDef.width}
            height={mapDef.height}
            stateById={stateById}
            players={players}
            selectedId={selectedId}
            highlightIds={highlightIds}
            attackableIds={attackableIds}
            lockedIds={lockedIds}
            hoveredId={hoveredId}
            attackOriginId={attackOriginId}
            fortifyOriginId={fortifyOriginId}
            scale={transform.scale}
            regionColorById={regionColorById}
            getPlayerHex={getPlayerHex}
            mapView={mapView}
            showBorders={showBorders}
          />

          {/* Arrow layer rendered inside the same SVG so it inherits the pan/zoom transform */}
          {arrowLayer}
        </svg>
      </div>

      {/* Debug overlay */}
      {debugMode && debugInfo && (
        <div className="absolute top-2 left-2 z-50 bg-black/80 text-green-400 text-[10px] font-mono p-2 rounded max-w-[220px] pointer-events-none">
          <div className="font-bold text-yellow-400 mb-1">Map Debug</div>
          <div>Territory: {debugInfo.territoryId ?? '—'}</div>
          <div>Phase: {debugInfo.phase ?? '—'}</div>
        </div>
      )}

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5" style={{ pointerEvents: 'auto' }}>
        {/* Borders toggle — only shown in artistic view */}
        {mapView === 'artistic' && (
          <MapButton
            onClick={() => setShowBorders(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-display tracking-wider uppercase transition-all shadow-lg touch-manipulation backdrop-blur-sm ${
              showBorders
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-panel-header/90 border-panel-border text-foreground hover:bg-secondary hover:border-primary/50'
            }`}
            aria-label="Toggle territory borders"
          >
            <Layers className="w-3.5 h-3.5" />
            Borders
          </MapButton>
        )}
        {/* View mode toggle */}
        <MapButton
          onClick={() => setMapView(v => v === 'artistic' ? 'tactical' : 'artistic')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel-header/90 border border-panel-border text-foreground text-xs font-display tracking-wider uppercase hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation backdrop-blur-sm"
          aria-label="Toggle map view"
        >
          {mapView === 'artistic' ? <Eye className="w-3.5 h-3.5" /> : <Map className="w-3.5 h-3.5" />}
          {mapView === 'artistic' ? 'Tactical' : 'Artistic'}
        </MapButton>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10" style={{ pointerEvents: 'auto' }}>
        <MapButton
          onClick={() => zoomAroundCenter(1.25)}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg font-light flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Zoom in"
        >+</MapButton>
        <MapButton
          onClick={() => zoomAroundCenter(0.8)}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg font-light flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Zoom out"
        >−</MapButton>
        <MapButton
          onClick={resetView}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-sm flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Reset zoom"
          title="Reset view"
        >⊡</MapButton>
      </div>
    </div>
  );
}