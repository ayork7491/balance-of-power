/**
 * MapRenderer — schema-driven SVG map.
 *
 * Accepts:
 *   mapDef       — static MapDef (shape, adjacency, regions)
 *   stateByKey   — { [territory_key]: TerritoryState } (dynamic campaign state)
 *   players      — CampaignPlayer[] (for color lookup)
 *   selectedKey  — currently selected territory key
 *   highlightKeys — Set<string> of keys to highlight (fortify targets, etc.)
 *   attackableKeys — Set<string> of enemy-owned neighbors
 *   onSelect     — (key: string | null) => void
 *
 * Zoom/pan via pointer events + wheel. No external library needed.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PLAYER_COLORS } from '@/config/theme';
import TerritoryPolygon from './TerritoryPolygon';
import AdjacencyLines from './AdjacencyLines';

function getPlayerHex(players, playerId) {
  if (!playerId) return null;
  const player = players.find(p => p.id === playerId || p.user_id === playerId);
  if (!player) return null;
  const pc = PLAYER_COLORS.find(c => c.id === player.color);
  return pc?.hex ?? null;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4.0;

export default function MapRenderer({
  mapDef,
  stateById = {},
  players = [],
  selectedId = null,
  highlightIds = new Set(),
  attackableIds = new Set(),
  onSelect,
  arrowLayer = null,
}) {
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef(null); // { startX, startY, originX, originY }

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

  // ── Pointer drag (pan) ─────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: 0,
      originY: 0,
      moved: false,
    };
    setTransform(prev => {
      drag.current.originX = prev.x;
      drag.current.originY = prev.y;
      return prev;
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;
    setTransform(prev => ({
      ...prev,
      x: drag.current.originX + dx,
      y: drag.current.originY + dy,
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  // ── Territory click ────────────────────────────────────────────────────────
  const handleTerritoryClick = useCallback((tid) => {
    if (drag.current?.moved) return; // was a pan, not a click
    onSelect?.(selectedId === tid ? null : tid);
  }, [onSelect, selectedId]);

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
        cursor: drag.current ? 'grabbing' : 'grab', 
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Adjacency lines drawn first (below territories) */}
          <AdjacencyLines mapDef={mapDef} />

          {/* Territory polygons */}
          {mapDef.territories.map(territory => {
            const tid    = territory.territory_id;
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
                onClick={() => handleTerritoryClick(tid)}
              />
            );
          })}

          {/* Territory name labels (shown at comfortable zoom levels) */}
          {transform.scale >= 0.7 && mapDef.territories.map(territory => (
            <motion.text
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
                textShadow: '0 1px 3px rgba(0,0,0,0.8)'
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: transform.scale >= 0.7 ? 0.85 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {territory.name}
            </motion.text>
          ))}
        </g>
      </svg>

      {/* Attack arrow overlay — rendered as absolute SVG sibling, same viewBox */}
      {arrowLayer}

      {/* Zoom controls */}
      <motion.div 
        className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <motion.button
          onClick={() => setTransform(t => ({ ...t, scale: Math.min(MAX_ZOOM, t.scale * 1.25) }))}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg font-light flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Zoom in"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >+</motion.button>
        <motion.button
          onClick={() => setTransform(t => ({ ...t, scale: Math.max(MIN_ZOOM, t.scale / 1.25) }))}
          className="w-9 h-9 rounded-lg bg-panel-header border border-panel-border text-foreground text-lg font-light flex items-center justify-center hover:bg-secondary hover:border-primary/50 active:scale-95 transition-all shadow-lg touch-manipulation"
          aria-label="Zoom out"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >−</motion.button>
        <motion.button
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
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >⊡</motion.button>
      </motion.div>
    </div>
  );
}