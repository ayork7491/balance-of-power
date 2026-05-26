/**
 * useTerritoryHighlights — Memoized territory highlight logic.
 * Extracted from ActiveCampaign.jsx for maintainability.
 */
import { useMemo } from 'react';

export function useTerritoryHighlights({
  phase,
  campaign,
  myPlayer,
  mapDef,
  stateById,
}) {
  // Territory draft: highlight unclaimed territories when it's my turn
  const highlightIds = useMemo(() => {
    if (phase !== 'territory_draft') return new Set();
    
    const setupOrder = campaign?.setup_order ?? [];
    const idx = campaign?.setup_current_index ?? 0;
    
    if (!myPlayer || setupOrder[idx] !== myPlayer.id) return new Set();
    if (!mapDef) return new Set();
    
    const claimed = new Set(Object.keys(stateById));
    return new Set(
      mapDef.territories
        .map(t => t.territory_id)
        .filter(tid => !claimed.has(tid))
    );
  }, [phase, campaign, myPlayer, mapDef, stateById]);

  // Attack phase: highlight attackable (adjacent enemy/neutral) territories
  const attackableIds = useMemo(() => {
    if (phase !== 'attack') return new Set();
    // This requires selectedId and adjacencyMap, passed separately
    return new Set();
  }, [phase]);

  return { highlightIds, attackableIds };
}