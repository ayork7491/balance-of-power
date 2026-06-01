/**
 * MapLayerStack — simplified 3-layer render stack.
 *
 * Layer hierarchy (bottom → top):
 *   00_background      — single PNG background image (10240×10240 native)
 *   01_territory_polys — territory polygons + ownership fills
 *   02_labels_routes   — territory labels, adjacency lines, route hints
 *
 * Polygon coordinate space: 1000×1400 (scaled from original 10240×10240 source).
 * A scale transform (sx=10.24, sy=7.3143) maps polygon coords into the 10240×10240 canvas.
 *
 * All clicks handled by MapRenderer via data-tid delegation — no onClick on children.
 */

import TerritoryPolygon from './TerritoryPolygon';

// artistic = full color, tactical = grayscale
const ARTISTIC_BG  = 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/7af44e9bf_SHATTERED_CROWN_MAP_PNG.png';
const TACTICAL_BG  = 'https://media.base44.com/images/public/6a1504188a2a3ce4c5d33e1b/f782aa7ba_SHATTERED_CROWN_MAP_PNG_GRAYSCALE.png';

export default function MapLayerStack({
  mapDef,
  width,
  height,
  stateById,
  players,
  selectedId,
  highlightIds,
  attackableIds,
  lockedIds = new Set(),
  hoveredId,
  attackOriginId,
  fortifyOriginId,
  scale,
  regionColorById,
  getPlayerHex,
  mapView = 'artistic', // 'artistic' | 'tactical'
}) {
  const DECORATIVE = { pointerEvents: 'none', userSelect: 'none' };
  const bgUrl = mapView === 'tactical' ? TACTICAL_BG : ARTISTIC_BG;

  return (
    <g>

      {/* ── 00: Background PNG ── */}
      <g id="layer-00-background" style={DECORATIVE}>
        {bgUrl
          ? <image href={bgUrl} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: 'none', userSelect: 'none' }} />
          : <rect x={0} y={0} width={width} height={height} fill="#04111e" />
        }
      </g>

      {/* ── 01: Territory polygons — native 10240×10240 coords ── */}
      <g id="layer-01-territory-polygons">
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
              isLocked={lockedIds.has(tid)}
              mapView={mapView}
            />
          );
        })}
      </g>

      {/* ── 02: Labels — routes always suppressed ── */}
      <g id="layer-02-labels" style={DECORATIVE}>
        {scale >= 0.05 && mapDef.territories.map(territory => {
          const fontSize = Math.max(30, Math.min(80, 55 / scale));
          const lx = territory.label_x ?? territory.cx;
          const ly = territory.label_y ?? (territory.cy + 18);
          return (
            <text
              key={`label-${territory.territory_id}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize={fontSize}
              fontFamily="'Rajdhani', sans-serif"
              fontWeight="600"
              letterSpacing="0.04em"
              fill="rgba(255,255,255,0.85)"
              stroke="rgba(0,0,0,0.9)"
              strokeWidth={fontSize * 0.06}
              paintOrder="stroke"
            >
              {territory.name}
            </text>
          );
        })}
      </g>

    </g>
  );
}