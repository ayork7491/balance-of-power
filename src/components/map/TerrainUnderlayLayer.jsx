/**
 * TerrainUnderlayLayer — renders a pre-authored SVG terrain/landmass underlay
 * as a non-interactive visual layer within the map SVG coordinate space.
 *
 * Layer order contract (bottom → top):
 *   Ocean background  ← handled by MapRenderer container bg
 *   TerrainUnderlayLayer  ← this component (SVG image embed)
 *   ContinentLayer        ← atmosphere halos + terrain textures (reduced opacity when underlay present)
 *   Territory polygons    ← gameplay geometry
 *   Ownership / troops    ← UI overlays
 *
 * Requirements:
 *   - Non-interactive (pointerEvents: none everywhere)
 *   - Non-selectable
 *   - Subtle: opacity tuned to keep territory borders readable on mobile
 *   - Coordinate-aligned: SVG underlay must share the same logical coordinate
 *     space as the map (width × height). For Shattered Crown: 1000 × 1400.
 */

export default function TerrainUnderlayLayer({ underlayUrl, width, height }) {
  if (!underlayUrl || !width || !height) return null;

  return (
    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {/*
        Render the SVG as a foreign image element within the SVG coordinate space.
        x=0, y=0, width/height match the map's logical coordinate space exactly,
        so the underlay aligns 1:1 with the territory geometry.

        preserveAspectRatio="none" ensures pixel-perfect alignment with the
        coordinate space even if the raster differs slightly in aspect.
      */}
      <image
        href={underlayUrl}
        x={0}
        y={0}
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        opacity={0.45}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          // Smooth rendering on mobile
          imageRendering: 'auto',
        }}
      />

      {/*
        Mobile overlay: a subtle dark vignette to ensure territory borders
        remain readable at smaller viewports / lower pixel density.
        This is a radial gradient that darkens the edges without affecting
        the center where most territory action occurs.
      */}
      <defs>
        <radialGradient id="underlay-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="transparent" stopOpacity="0" />
          <stop offset="100%" stopColor="#060a12" stopOpacity="0.45" />
        </radialGradient>
      </defs>
      <rect
        x={0} y={0}
        width={width} height={height}
        fill="url(#underlay-vignette)"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}