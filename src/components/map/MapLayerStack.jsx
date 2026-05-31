/**
 * MapLayerStack — defines the canonical 9-layer SVG render stack for all maps.
 *
 * Layer hierarchy (bottom → top):
 *
 *   00_ocean_background   — ocean color, gradient, depth shading
 *   01_world_landmasses   — continent silhouettes, coastlines (World Layer v2.0)
 *   02_geography_detail   — Geography Detail v2.0 landforms SVG (mountains, forests, rivers, etc.)
 *   03_atlas_labels       — continent/region names, compass rose (reserved)
 *   04_territory_polygons — territory geometry, ownership fills, interaction
 *   05_territory_labels   — territory name text
 *   06_gameplay_routes    — adjacency lines, route hints, attack/move paths
 *   07_gameplay_markers   — troop counts, structures, objectives (reserved)
 *   08_ui_overlays        — selection glows, hover effects, debug (reserved)
 *
 * Decorative layers (00–03, 07–08) are fully non-interactive:
 *   pointerEvents: none on every element.
 *
 * Only layer 04 (territory_polygons) is interactive — via data-tid delegation
 * in MapRenderer, NOT via child onClick.
 *
 * Props:
 *   mapDef              — full MapDefinition
 *   width / height      — logical SVG coordinate space
 *   oceanBackgroundUrl   — Ocean Background v1.0 SVG URL (00_ocean_background)
 *   underlayUrl          — World Landmasses v2.1 SVG URL (01_world_landmasses)
 *   geographyDetailUrl   — Geography Detail v2.0 SVG URL (02_geography_detail)
 *   atlasLabelsUrl       — Atlas Labels v1.0 SVG URL (03_atlas_labels)
 *   stateById           — { [territory_id]: TerritoryState }
 *   players             — CampaignPlayer[]
 *   selectedId          — selected territory_id
 *   highlightIds        — Set<territory_id>
 *   attackableIds       — Set<territory_id>
 *   hoveredId           — hovered territory_id (for route preview)
 *   attackOriginId      — active attack origin (for route preview)
 *   fortifyOriginId     — active fortify origin (for route preview)
 *   scale               — current zoom scale (for font scaling)
 *   regionColorById     — { [region_id]: hex }
 *   getPlayerHex        — (players, playerId) => hex | null
 *   suppressContinentLayer  — hide programmatic continent atmosphere
 *   suppressConnectionLines — hide adjacency + route layers
 *
 * Children (TerritoryPolygon etc.) are passed as render props to keep
 * this file free of direct game-logic imports.
 */

import RouteHintLayer from './RouteHintLayer';
import AdjacencyLines from './AdjacencyLines';
import TerritoryPolygon from './TerritoryPolygon';

// Shared style for all non-interactive decorative layers
const DECORATIVE = { pointerEvents: 'none', userSelect: 'none' };

// Shared props for SVG <image> asset layers
function AssetImage({ href, width, height }) {
  return (
    <image
      href={href}
      x={0} y={0}
      width={width} height={height}
      preserveAspectRatio="xMidYMid meet"
      opacity={1.0}
      style={{ pointerEvents: 'none', userSelect: 'none', imageRendering: 'auto' }}
    />
  );
}

export default function MapLayerStack({
  mapDef,
  width,
  height,
  oceanBackgroundUrl,
  underlayUrl,
  geographyDetailUrl,
  atlasLabelsUrl,
  atmosphereUrl,
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
  suppressConnectionLines,
}) {

  return (
    <g>

      {/* ════════════════════════════════════════════════════════
          00_ocean_background
          Ocean Background v1.0 — 00_ocean_background_v10.svg
          Contains: ocean base color, gradient, wave texture, water pattern.
          Rendered verbatim. Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-00-ocean-background" style={DECORATIVE}>
        {oceanBackgroundUrl
          ? <AssetImage href={oceanBackgroundUrl} width={width} height={height} />
          : <rect x={0} y={0} width={width} height={height} fill="#04111e" />
        }
      </g>

      {/* ════════════════════════════════════════════════════════
          01_world_landmasses
          World Landmasses v2.1 clean — 01_world_landmasses_v21_clean.svg
          Contains: continent silhouettes, coastlines, major islands only.
          No ocean waves, no gradients, no labels, no test polygons.
          Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-01-world-landmasses" style={DECORATIVE}>
        {underlayUrl && <AssetImage href={underlayUrl} width={width} height={height} />}
      </g>

      {/* ════════════════════════════════════════════════════════
          02_geography_detail
          Geography Detail v2.0 — 02_geography_detail_v20_landforms.svg
          Mountains, forests, rivers, farmland, fracture scars, reefs.
          Rendered verbatim at opacity=1.0. No modification.
          Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-02-geography-detail" style={DECORATIVE}>
        {geographyDetailUrl && <AssetImage href={geographyDetailUrl} width={width} height={height} />}
      </g>

      {/* ════════════════════════════════════════════════════════
          03_atlas_labels
          Atlas Labels v1.0 — 03_atlas_labels_v10.svg
          Contains: continent titles, continent subtitles, central sea title,
          compass rose, decorative atlas rings, decorative atlas arcs.
          Rendered verbatim. Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-03-atlas-labels" style={DECORATIVE}>
        {atlasLabelsUrl && <AssetImage href={atlasLabelsUrl} width={width} height={height} />}
      </g>

      {/* ════════════════════════════════════════════════════════
          03_atmosphere_effects  (SUBLAYER — between atlas_labels and territory_polygons)
          Atmosphere Effects v1.0 — 09_atmosphere_v10.svg
          Contains: atmospheric depth, fog overlay, continent glow halos,
          coastal bloom, vignette. Visual separation between world art and gameplay.
          Rendered verbatim. Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="sublayer-03-atmosphere-effects" style={DECORATIVE}>
        {atmosphereUrl && <AssetImage href={atmosphereUrl} width={width} height={height} />}
      </g>

      {/* ════════════════════════════════════════════════════════
          04_territory_polygons
          Territory geometry + ownership fills + borders.
          PRIMARY GAMEPLAY LAYER.
          All territory clicks originate here via data-tid delegation
          in MapRenderer. No onClick props on children.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-04-territory-polygons">
        {/* Territory polygons — interactive via MapRenderer event delegation */}
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
            />
          );
        })}
      </g>

      {/* ════════════════════════════════════════════════════════
          05_territory_labels
          Territory name text. Separate from polygons so labels
          always render above territory fills and borders.
          Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-05-territory-labels" style={DECORATIVE}>
        {scale >= 0.45 && mapDef.territories.map(territory => {
          const fontSize = Math.max(8, Math.min(14, 11 / scale));
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
              fill="rgba(255,255,255,0.80)"
              stroke="rgba(0,0,0,0.85)"
              strokeWidth={fontSize * 0.06}
              paintOrder="stroke"
            >
              {territory.name}
            </text>
          );
        })}
      </g>

      {/* ════════════════════════════════════════════════════════
          06_gameplay_routes
          Adjacency lines, route hint corridors, attack/move paths.
          Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-06-gameplay-routes" style={DECORATIVE}>
        {!suppressConnectionLines && <RouteHintLayer />}
        {!suppressConnectionLines && (
          <AdjacencyLines
            mapDef={mapDef}
            hoveredId={hoveredId}
            selectedId={selectedId}
            originId={attackOriginId ?? fortifyOriginId ?? null}
          />
        )}
      </g>

      {/* ════════════════════════════════════════════════════════
          07_gameplay_markers
          Troop counts, structures, capitals, resource icons,
          objective markers, status markers.
          Reserved for future content.
          Decorative only. No interaction.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-07-gameplay-markers" style={DECORATIVE}>
        {/* Reserved — gameplay marker components go here */}
      </g>

      {/* ════════════════════════════════════════════════════════
          08_ui_overlays
          Selected territory glow, hover effects, deploy/attack
          indicators, debug panels, temporary UI effects.
          Top-most visual layer.
          Reserved for future content.
          ════════════════════════════════════════════════════════ */}
      <g id="layer-08-ui-overlays" style={DECORATIVE}>
        {/* Reserved — selection glows and UI effect components go here */}
      </g>

    </g>
  );
}