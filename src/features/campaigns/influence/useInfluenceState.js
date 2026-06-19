/**
 * useInfluenceState — Sprint 4G
 *
 * Fetches all influence data for a campaign:
 *   influenceByTerritory — { [territory_id]: [{ player_id, influence_amount, last_updated_round }] }
 *   influenceByRegion    — { [region_id]: [{ player_id, spendable_influence }] }
 *   playerTotals         — { [player_id]: { permanent, spendable, by_region_permanent } }
 *   spreadThreshold      — number (permanent influence needed to trigger spread)
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useInfluenceState({ campaignId, actingAsPlayerId = null, enabled = true }) {
  const [influenceByTerritory, setInfluenceByTerritory] = useState({});
  const [influenceByRegion, setInfluenceByRegion] = useState({});
  const [playerTotals, setPlayerTotals] = useState({});
  const [spreadThreshold, setSpreadThreshold] = useState(10);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('influencePhase', {
        action: 'getInfluenceState',
        campaign_id: campaignId,
        ...(actingAsPlayerId ? { acting_as_player_id: actingAsPlayerId } : {}),
      });
      const data = res.data ?? {};
      setInfluenceByTerritory(data.by_territory ?? {});
      setInfluenceByRegion(data.by_region ?? {});
      setPlayerTotals(data.player_totals ?? {});
      setSpreadThreshold(data.spread_threshold ?? 10);
    } catch {
      setInfluenceByTerritory({});
      setInfluenceByRegion({});
      setPlayerTotals({});
    } finally {
      setLoading(false);
    }
  }, [campaignId, actingAsPlayerId, enabled]);

  useEffect(() => { load(); }, [load]);

  return {
    influenceByTerritory,
    influenceByRegion,
    playerTotals,
    spreadThreshold,
    loading,
    reload: load,
  };
}