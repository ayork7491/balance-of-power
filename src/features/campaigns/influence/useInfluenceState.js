/**
 * useInfluenceState — Sprint 4F
 *
 * Fetches all influence records for a campaign, indexed by territory_id.
 * Each entry is an array of { player_id, influence_amount, last_updated_round }.
 *
 * Usage:
 *   const { influenceByTerritory, loading, reload } = useInfluenceState({ campaignId });
 *   const records = influenceByTerritory['B2'] ?? [];
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useInfluenceState({ campaignId, enabled = true }) {
  const [influenceByTerritory, setInfluenceByTerritory] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('influencePhase', {
        action: 'getInfluenceState',
        campaign_id: campaignId,
      });
      setInfluenceByTerritory(res.data?.by_territory ?? {});
    } catch {
      setInfluenceByTerritory({});
    } finally {
      setLoading(false);
    }
  }, [campaignId, enabled]);

  useEffect(() => { load(); }, [load]);

  return { influenceByTerritory, loading, reload: load };
}