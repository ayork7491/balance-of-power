/**
 * useIntelReports — fetches intelligence reports for the acting player,
 * indexed by territory_id for fast lookup in TerritoryDetailPanel.
 *
 * Returns:
 *   reportsByTerritory — { [territory_id]: IntelligenceReport[] } sorted newest-first
 *   latestByTerritory  — { [territory_id]: IntelligenceReport } most recent per territory
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useIntelReports({ campaignId, actingAsPlayerId = null, enabled = true }) {
  const [reportsByTerritory, setReportsByTerritory] = useState({});
  const [latestByTerritory, setLatestByTerritory] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('intelligencePhase', {
        action: 'getReports',
        campaign_id: campaignId,
        ...(actingAsPlayerId ? { acting_as_player_id: actingAsPlayerId } : {}),
      });
      const reports = res.data?.reports ?? [];

      // Index by territory_id, sorted newest-first
      const byTerritory = {};
      for (const r of reports) {
        if (!r.target_territory_id) continue;
        if (!byTerritory[r.target_territory_id]) byTerritory[r.target_territory_id] = [];
        byTerritory[r.target_territory_id].push(r);
      }
      for (const tid of Object.keys(byTerritory)) {
        byTerritory[tid].sort((a, b) => (b.generated_round ?? 0) - (a.generated_round ?? 0));
      }

      // Latest report per territory (any type)
      const latest = {};
      for (const [tid, reps] of Object.entries(byTerritory)) {
        latest[tid] = reps[0];
      }

      setReportsByTerritory(byTerritory);
      setLatestByTerritory(latest);
    } catch {
      setReportsByTerritory({});
      setLatestByTerritory({});
    } finally {
      setLoading(false);
    }
  }, [campaignId, actingAsPlayerId, enabled]);

  useEffect(() => { load(); }, [load]);

  return { reportsByTerritory, latestByTerritory, loading, reload: load };
}