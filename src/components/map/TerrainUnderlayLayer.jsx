/**
 * TerrainUnderlayLayer — SUPERSEDED by MapLayerStack (layers 01 + 02).
 *
 * Retained for backwards compatibility. MapRenderer no longer uses this
 * component directly — asset rendering is now handled by:
 *   layer-01-world-landmasses  (underlayUrl)
 *   layer-02-geography-detail  (terrainLayerUrl + biomeLayerUrl)
 *
 * This file is safe to delete once all call sites are confirmed removed.
 */

export default function TerrainUnderlayLayer({ underlayUrl, terrainLayerUrl, biomeLayerUrl, width, height }) {
  if ((!underlayUrl && !terrainLayerUrl && !biomeLayerUrl) || !width || !height) return null;

  const imgStyle = {
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    imageRendering: 'auto',
  };

  return (
    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {/* ── World Layer 2.0: continent silhouettes + coastlines ── */}
      {underlayUrl && (
        <image
          href={underlayUrl}
          x={0} y={0}
          width={width} height={height}
          preserveAspectRatio="xMidYMid meet"
          opacity={1.0}
          style={imgStyle}
        />
      )}

      {/* ── Terrain Layer 1.0: mountains, forests, rivers, ruins, etc. ──
          Rendered verbatim above the world layer.
          Opacity authored into the SVG — no override applied here. */}
      {terrainLayerUrl && (
        <image
          href={terrainLayerUrl}
          x={0} y={0}
          width={width} height={height}
          preserveAspectRatio="xMidYMid meet"
          opacity={1.0}
          style={imgStyle}
        />
      )}

      {/* ── Biome Layer 1.0: biome regions rendered above terrain, below territories. ──
          Rendered verbatim. No opacity, color, or geometry changes. */}
      {biomeLayerUrl && (
        <image
          href={biomeLayerUrl}
          x={0} y={0}
          width={width} height={height}
          preserveAspectRatio="xMidYMid meet"
          opacity={1.0}
          style={imgStyle}
        />
      )}

      {/* ── Edge vignette ── subtle darkening at map borders only,
          does not affect interior terrain features. */}
      <defs>
        <radialGradient id="underlay-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="transparent" stopOpacity="0" />
          <stop offset="100%" stopColor="#060a12"     stopOpacity="0.40" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height}
        fill="url(#underlay-vignette)"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}