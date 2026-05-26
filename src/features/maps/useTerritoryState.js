/**
 * features/maps/useTerritoryState.js
 *
 * Loads and subscribes to TerritoryState records for a campaign.
 * Returns a keyed map: { [territory_key]: TerritoryState }
 * so the renderer can look up state by territory key in O(1).
 *
 * TerritoryState is SEPARATE from the map schema (mapData.ts).
 * Schema = shape/position/adjacency (static, per map).
 * State = owner/troops/structures (dynamic, per campaign instance).
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useTerritoryState(campaignId) {
  const [stateByKey, setStateByKey] = useState({}); // { [territory_key]: TerritoryState }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const records = await base44.entities.TerritoryState.filter({ campaign_id: campaignId });
      const keyed = {};
      for (const r of records) keyed[r.territory_key] = r;
      setStateByKey(keyed);
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
      setStateByKey(prev => {
        const key = event.data?.territory_key ?? event.id;
        if (event.type === 'delete') {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: event.data };
      });
    });
    return unsub;
  }, [campaignId]);

  return { stateByKey, loading, error, reload: load };
}