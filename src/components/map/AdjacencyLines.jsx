/**
 * AdjacencyLines — conditional adjacency edge renderer.
 *
 * Lines are only shown when contextually relevant:
 *   - hoveredId:   edges from the hovered territory
 *   - selectedId:  edges from the selected territory
 *   - originId:    edges from an attack/fortify origin (phase previews)
 *
 * No permanent "all edges" rendering.
 */

export default function AdjacencyLines({ mapDef, hoveredId = null, selectedId = null, originId = null }) {
  if (!mapDef) return null;

  const centroidById = {};
  for (const t of mapDef.territories) {
    centroidById[t.territory_id] = [t.cx, t.cy];
  }

  // Collect adjacency pairs for each active source
  const activeSources = new Set([hoveredId, selectedId, originId].filter(Boolean));
  if (activeSources.size === 0) return null;

  // Build adjacency lookup: id → Set of adjacent ids
  const adjacencyMap = {};
  for (const [a, b] of mapDef.adjacency) {
    if (!adjacencyMap[a]) adjacencyMap[a] = new Set();
    if (!adjacencyMap[b]) adjacencyMap[b] = new Set();
    adjacencyMap[a].add(b);
    adjacencyMap[b].add(a);
  }

  // Collect unique edges to render (deduplicate by sorted pair key)
  const edgesToRender = new Map(); // key → { x1, y1, x2, y2, isPrimary }

  for (const sourceId of activeSources) {
    const neighbors = adjacencyMap[sourceId] ?? new Set();
    const ca = centroidById[sourceId];
    if (!ca) continue;

    for (const neighborId of neighbors) {
      const cb = centroidById[neighborId];
      if (!cb) continue;

      const key = [sourceId, neighborId].sort().join('|');
      // isPrimary = attack/fortify origin has priority styling
      const isPrimary = sourceId === originId || neighborId === originId;
      if (!edgesToRender.has(key)) {
        edgesToRender.set(key, { x1: ca[0], y1: ca[1], x2: cb[0], y2: cb[1], isPrimary });
      } else if (isPrimary) {
        // Upgrade existing edge to primary if now connected to origin
        edgesToRender.get(key).isPrimary = true;
      }
    }
  }

  if (edgesToRender.size === 0) return null;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {Array.from(edgesToRender.entries()).map(([key, { x1, y1, x2, y2, isPrimary }]) => (
        <line
          key={key}
          x1={x1} y1={y1}
          x2={x2} y2={y2}
          stroke={isPrimary ? '#fde047' : '#e2e8f0'}
          strokeWidth={isPrimary ? 1.2 : 0.8}
          strokeOpacity={isPrimary ? 0.55 : 0.30}
          strokeDasharray={isPrimary ? '6 4' : '4 6'}
        />
      ))}
    </g>
  );
}