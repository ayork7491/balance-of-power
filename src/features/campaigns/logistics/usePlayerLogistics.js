/**
 * usePlayerLogistics — Sprint 4E
 *
 * Fetches logistics state for the current player:
 *   - Resource Hubs with route capacity
 *   - Active Supply Routes
 *   - Supply Caravan capacity (from Trade Network buildings)
 *   - Warehouse protection states
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const EMPTY_STATE = {
  hubs: [],
  hub_count: 0,
  caravan_capacity: 0,
  active_routes: 0,
  total_route_capacity: 0,
  routes: [],
  warehouse_territories: [],
};

export function usePlayerLogistics({ campaignId, playerId, enabled = false }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!campaignId || !playerId || !enabled) {
      setState(EMPTY_STATE);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('logisticsPhase', {
        action: 'getLogisticsState',
        campaign_id: campaignId,
      });
      setState(res.data ?? EMPTY_STATE);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load logistics');
      setState(EMPTY_STATE);
    } finally {
      setLoading(false);
    }
  }, [campaignId, playerId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, loading, error, reload: load };
}