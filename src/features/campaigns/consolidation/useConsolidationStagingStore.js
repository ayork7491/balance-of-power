/**
 * useConsolidationStagingStore — local-first staging state for the Consolidation Phase.
 *
 * All staging is LOCAL ONLY — zero server writes until lock-in.
 * ConsolidationPhaseHeader submits an atomic payload on lock that includes all staged data.
 *
 * Storage keys (per campaign + player + round):
 *   consol_military_staging_{campaignId}_{playerId}_{round}  — fortification movements array
 *   consol_econ_staging_{campaignId}_{playerId}_{round}      — caravans array
 *
 * Usage:
 *   const store = useConsolidationStagingStore({ campaignId, playerId, round });
 *   store.getMilitaryStaging()   → [{ id, origin_territory_id, destination_territory_id, committed_troops }]
 *   store.setMilitaryStaging(arr)
 *   store.getEconomicStaging()   → [{ id, origin, destination, contents, safe, path }]
 *   store.setEconomicStaging(arr)
 *   store.clearAll()             — called after successful lock-in
 */
import { useCallback } from 'react';

export function useConsolidationStagingStore({ campaignId, playerId, round }) {
  const militaryKey = `consol_military_staging_${campaignId}_${playerId}_${round}`;
  const econKey     = `consol_econ_staging_${campaignId}_${playerId}_${round}`;

  const getMilitaryStaging = useCallback(() => {
    try {
      const raw = localStorage.getItem(militaryKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, [militaryKey]);

  const setMilitaryStaging = useCallback((arr) => {
    localStorage.setItem(militaryKey, JSON.stringify(arr ?? []));
  }, [militaryKey]);

  const getEconomicStaging = useCallback(() => {
    try {
      const raw = localStorage.getItem(econKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, [econKey]);

  const setEconomicStaging = useCallback((arr) => {
    localStorage.setItem(econKey, JSON.stringify(arr ?? []));
  }, [econKey]);

  const clearAll = useCallback(() => {
    localStorage.removeItem(militaryKey);
    localStorage.removeItem(econKey);
  }, [militaryKey, econKey]);

  return {
    militaryKey,
    econKey,
    getMilitaryStaging,
    setMilitaryStaging,
    getEconomicStaging,
    setEconomicStaging,
    clearAll,
  };
}