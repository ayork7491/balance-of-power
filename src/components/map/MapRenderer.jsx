/**
 * MapRenderer — schema-driven SVG map.
 *
 * Pointer event architecture (fixes territory click regression):
 *
 *   pointerdown on container  → record start position + capture pointer
 *   pointermove on container  → track drag distance, pan if moved
 *   pointerup on container    → if NOT dragged (< TAP_THRESHOLD px), check if
 *                               the event target has data-tid and fire territory
 *                               selection. drag.current is still live here.
 *
 * Key fix: territory selection fires in onPointerUp (NOT via child onClick).
 * This keeps drag.current live at decision time and avoids the child onClick
 * firing AFTER drag.current was nulled out.
 *
 * TerritoryPolygon no longer has an onClick prop — all clicks are handled here
 * via event delegation on the container.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/config/theme';
import TerritoryPolygon from './TerritoryPolygon';
import AdjacencyLines from './AdjacencyLines';
import { useMapInteraction } from '@/features/maps/useMapInteraction';

function getPlayerHex(players, playerId) {
  if (!playerId) return null;
  const player = players.find(p => p.id === playerId || p.user_id === playerId);
  if (!player) return null;
  const pc = PLAYER_COLORS.find(c => c.id === player.color);
  return pc?.hex ?? null;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4.0;
const TAP_THRESHOLD = 6; // px — slightly larger for touch

// Walk up the DOM from event.target to find the nearest [data-tid] attribute.
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

export default function MapRenderer({
  mapDef,
  stateById = {},
  players = [],
  selectedId = null,
  highlightIds = new Set(),
  attackableIds = new Set(),
  onSelect,
  arrowLayer = null,
  // Phase interaction props
  currentPhase = null,
  actingPlayer = null,
  onAttackOriginSelect = null,
  onAttackTargetSelect = null,
  onFortifyOriginSelect = null,
  onFortifyDestinationSelect = null,
  onBuildTerritorySelect = null,
  onDraftTerritorySelect = null,
  onDeployTerritorySelect = null,
  // Debug
  debugMode = false,
}) {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  // drag.current is nulled AFTER territory selection in onPointerUp
  const drag = useRef(null);
  const rafRef = useRef(null);

  // Debug state
  const [debugInfo, setDebugInfo] = useState(null);

  // Use canonical map interaction controller
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
    onSelect,
    onAttackOriginSelect,
    onAttackTargetSelect,
    onFortifyOriginSelect,
    onFortifyDestinationSelect,
    onBuildTerritorySelect,
    onDraftTerritorySelect,
    onDeployTerritorySelect,
  });

  // Fit map to container on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapDef) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const scaleX = cw / mapDef.width;
    const scaleY = ch / mapDef.height;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    const x = (cw - mapDef.width * scale) / 2;
    const y = (ch - mapDef.height * scale) / 2;
    setTransform({ x, y, scale });
  }, [mapDef]);

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform(prev => {
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.scale * delta));
      const scaleRatio = newScale / prev.scale;
      return {
        scale: newScale,
        x: mouseX - scaleRatio * (mouseX - prev.x),
        y: mouseY - scaleRatio * (mouseY - prev.y),
      };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Pointer handlers ───────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: transform.x,
      originY: transform.y,
      moved: false,
      downTarget: e.target, // save target at pointerdown for tid lookup
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  }, [transform.x, transform.y]);

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    e.preventDefault();

    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;

    if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
      drag.current.moved = true;
    }

    if (!drag.current.moved) return; // don't pan until threshold exceeded

    if (rafRef.current) return;
    const captureDx = dx;
    const captureDy = dy;

    rafRef.current = requestAnimationFrame(() => {
      if (!drag.current) return;
      setTransform(prev => ({
        ...prev,
        x: drag.current.originX + captureDx,
        y: drag.current.originY + captureDy,
      }));
      rafRef.current = null;
    });
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!drag.current) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const wasDrag = drag.current.moved;
    const downTarget = drag.current.downTarget;

    // ── CRITICAL: resolve territory BEFORE nulling drag.current ──────────────
    if (!wasDrag) {
      // It was a tap — find territory id from the element tapped
      // Use the pointerup target first, fall back to pointerdown target
      const tid = getTerritoryIdFromTarget(e.target) ?? getTerritoryIdFromTarget(downTarget);

      if (debugMode) {
        setDebugInfo({
          classification: 'tap',
          upTarget: e.target?.tagName,
          downTarget: downTarget?.tagName,
          territoryId: tid ?? 'none',
          phase: currentPhase,
          selectedBefore: selectedId,
          interactionMode,
          timestamp: new Date().toISOString(),
        });
        console.log('[MapRenderer] TAP', { tid, phase: currentPhase, target: e.target });
      }

      if (tid) {
        handleTerritoryClick(tid);
      }
    } else {
      if (debugMode) {
        setDebugInfo(prev => ({
          ...(prev ?? {}),
          classification: 'drag',
          timestamp: new Date().toISOString(),
        }));
      }
    }

    // Null AFTER selection fires
    drag.current = null;
  }, [handleTerritoryClick, debugMode, currentPhase, selectedId, interactionMode]);

  // ── Region color lookup ────────────────────────────────────────────────────
  const regionColorById = {};
  for (const r of (mapDef?.regions ?? [])) {
    regionColorById[r.id] = r.color ?? '#334155';
  }

  if (!mapDef) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{
        cursor: 'grab',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
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
          <g>
            {/* Adjacency lines — non-interactive */}
            <AdjacencyLines mapDef={mapDef} />

            {/* Territory polygons — interactive via data-tid, no onClick prop */}
            {mapDef.territories.map(territory => {
              const tid = territory.territory_id;
              const tState = stateById[tid];
              const ownerColor = tState?.owner_player_id
                ? getPlayerHex(players, tState.owner_player_id)
                : null;
              const regionColor = regionColorById[territory.region_id] ?? '#334155';

              return (
                <TerritoryPolygon
                  key={tid}
                  territory={territory}
                  regionColor={regionColor}
                  ownerColor={ownerColor}
                  troopCount={tState?.troop_count ?? 0}
                  isSelected={selectedId === tid}
                  isHighlighted={highlightIds.has(tid)}
                  isAttackable={attackableIds.has(tid)}
                />
              );
            })}

            {/* Territory name labels — non-interactive */}
            {transform.scale >= 0.7 && mapDef.territories.map(territory => (
              <text
                key={`label-${territory.territory_id}`}
                x={territory.cx}
                y={territory.cy + 22}
                textAnchor="middle"
                fontSize={Math.max(7, 10 / transform.scale * 0.85)}
                fontFamily="'Rajdhani', sans-serif"
                fontWeight="600"
                fill="rgba(255,255,255,0.85)"
                stroke="rgba(0,0,0,0.7)"
                strokeWidth={0.7}
                style={{
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {territory.name}
              </text>
            ))}
          </g>
        </svg>
      </div>

      {/* Attack arrow overlay — non-interactive overlay */}
      <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}>
        {arrowLayer}
      </div>

      {/* Debug overlay */}
      {debugMode && debugInfo && (
        <div className="absolute top-2 left-2 z-50 bg-black/80 text-green-400 text-[10px] font-mono p-2 rounded max-w-[220px] space-y-0.5 pointer-events-none">
          <div className="font-bold text-yellow-400 uppercase tracking-wider mb-1">Map Interaction Debug</div>
          <div>Classification: <span className={debugInfo.classification === 'tap' ? 'text-green-300' : 'text-orange-300'}>{debugInfo.classification}</span></div>
          <div>Territory: {debugInfo.territoryId ?? '—'}</div>
          <div>Phase: {debugInfo.phase ?? '—'}</div>
          <div>Mode: {debugInfo.interactionMode ?? '—'}</div>
          <div>Selected before: {debugInfo.selectedBefore ?? '—'}</div>
          <div>Up target: {debugInfo.upTarget ?? '—'}</div>
          <div className="text-muted-foreground">{debugInfo.timestamp?.split('T')[1]?.slice(0,8)}</div>
        </div>
      )}

      {/* Zoom controls */}
      <motion.div
        className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        style={{ pointerEvents: 'auto' }}
      >
        <motion.button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setTransform(t => ({ ...t, scale: Math.min(MAX_ZOOM, t.scale * 1.25) }))}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg font-light flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Zoom in"
        >+</motion.button>
        <motion.button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setTransform(t => ({ ...t, scale: Math.max(MIN_ZOOM, t.scale / 1.25) }))}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg font-light flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Zoom out"
        >−</motion.button>
        <motion.button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => {
            const el = containerRef.current;
            if (!el || !mapDef) return;
            const { width: cw, height: ch } = el.getBoundingClientRect();
            const scale = Math.min(cw / mapDef.width, ch / mapDef.height) * 0.95;
            setTransform({ x: (cw - mapDef.width * scale) / 2, y: (ch - mapDef.height * scale) / 2, scale });
          }}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-sm flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Reset zoom"
          title="Reset view"
        >⊡</motion.button>
      </motion.div>
    </div>
  );
}