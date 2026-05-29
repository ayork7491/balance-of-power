/**
 * TerrainUnderlayLayer — renders the pre-authored SVG map layers as non-interactive
 * visual underlays within the map SVG coordinate space.
 *
 * Layer order (bottom → top within this component):
 *   1. World Layer 2.0   (underlayUrl)     — continent silhouettes, coastlines
 *   2. Terrain Layer 1.0 (terrainLayerUrl) — mountains, forests, rivers, ruins, etc.
 *
 * Both SVGs are rendered verbatim at opacity=1.0 exactly as authored.
 * No opacity overrides. No color changes. No modifications.
 *
 * All layers are fully non-interactive (pointerEvents: none).
 * Coordinate space: x=0, y=0, width×height of the map logical space (1000×1400).
 */

export default function TerrainUnderlayLayer({ underlayUrl, terrainLayerUrl, width, height }) {
  if ((!underlayUrl && !terrainLayerUrl) || !width || !height) return null;

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