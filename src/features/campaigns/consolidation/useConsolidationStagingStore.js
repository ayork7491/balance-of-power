/**
 * useConsolidationStagingStore — local-first staging state for the Consolidation Phase.
 *
 * Mirrors the server-side fortify PhaseDecision in localStorage so
 * ConsolidationPhaseHeader can reflect local changes instantly without server round-trips.
 *
 * Storage keys (per campaign + player + round):
 *   consol_military_staging_{campaignId}_{playerId}_{round}  — fortification movements array
 *   consol_econ_staging_{campaignId}_{playerId}_{round}      — caravans array
 *
 * Usage:
 *   const store = useConsolidationStagingStore({ campaignId, playerId, round });
 *   store.getMilitaryStaging()   → [{ origin_territory_id, destination_territory_id, committed_troops }]
 *   store.setMilitaryStaging(arr)
 *   store.getEconomicStaging()   → [{ origin, destination, contents }]
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
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [militaryKey]);

  const setMilitaryStaging = useCallback((arr) => {
    localStorage.setItem(militaryKey, JSON.stringify(arr));
  }, [militaryKey]);

  const getEconomicStaging = useCallback(() => {
    try {
      const raw = localStorage.getItem(econKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [econKey]);

  const setEconomicStaging = useCallback((arr) => {
    localStorage.setItem(econKey, JSON.stringify(arr));
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