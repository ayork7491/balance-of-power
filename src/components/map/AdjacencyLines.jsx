/**
 * AdjacencyLines — renders adjacency edges between territory centroids.
 * Render Pass v2: even fainter, no dashes, purely structural.
 * Only visible at mid-zoom levels.
 */

export default function AdjacencyLines({ mapDef }) {
  const centroidById = {};
  for (const t of mapDef.territories) {
    centroidById[t.territory_id] = [t.cx, t.cy];
  }

  return (
    <g opacity={0.08}>
      {mapDef.adjacency.map(([a, b], i) => {
        const ca = centroidById[a];
        const cb = centroidById[b];
        if (!ca || !cb) return null;
        return (
          <line
            key={i}
            x1={ca[0]} y1={ca[1]}
            x2={cb[0]} y2={cb[1]}
            stroke="#e2e8f0"
            strokeWidth={0.6}
          />
        );
      })}
    </g>
  );
}