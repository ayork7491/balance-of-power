/**
 * AdjacencyLines — renders adjacency edges between territory centroids.
 * Drawn as faint SVG lines below territory polygons.
 * Schema-driven: reads from mapDef.adjacency + territory cx/cy.
 */

export default function AdjacencyLines({ mapDef }) {
  const centroidByKey = {};
  for (const t of mapDef.territories) {
    centroidByKey[t.key] = [t.cx, t.cy];
  }

  return (
    <g opacity={0.18}>
      {mapDef.adjacency.map(([a, b], i) => {
        const ca = centroidByKey[a];
        const cb = centroidByKey[b];
        if (!ca || !cb) return null;
        return (
          <line
            key={i}
            x1={ca[0]} y1={ca[1]}
            x2={cb[0]} y2={cb[1]}
            stroke="#ffffff"
            strokeWidth={0.8}
            strokeDasharray="3,4"
          />
        );
      })}
    </g>
  );
}