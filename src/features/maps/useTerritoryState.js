/**
 * features/maps/useTerritoryState.js
 *
 * Loads and subscribes to TerritoryState records for a campaign.
 * Returns a keyed map: { [territory_id]: TerritoryState }
 *
 * Canonical identifier: territory_id (matches TerritoryDefinition.territory_id)
 *
 * TerritoryState is SEPARATE from the static map schema (mapData.ts).
 *   Schema = shape/position/adjacency/resources (static, per map definition)
 *   State  = owner/troops/structures (dynamic, per campaign instance)
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useTerritoryState(campaignId) {
  const [stateById, setStateById] = useState({}); // { [territory_id]: TerritoryState }
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const records = await base44.entities.TerritoryState.filter({ campaign_id: campaignId });
      const keyed = {};
      for (const r of records) keyed[r.territory_id] = r;
      setStateById(keyed);
    } catch {
      setError('Failed to load territory state.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription
  useEffect(() => {
    if (!campaignId) return;
    const unsub = base44.entities.TerritoryState.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      setStateById(prev => {
        const tid = event.data?.territory_id;
        if (!tid) return prev;
        if (event.type === 'delete') {
          const next = { ...prev };
          delete next[tid];
          return next;
        }
        return { ...prev, [tid]: event.data };
      });
    });
    return unsub;
  }, [campaignId]);

  return { stateById, loading, error, reload: load };
}