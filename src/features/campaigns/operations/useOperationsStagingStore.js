/**
 * useOperationsStagingStore — local-first staging state for the Operations Phase.
 *
 * Mirrors the server-side operations_stage PhaseDecision in localStorage so
 * OperationsPhaseHeader can reflect local changes instantly without server round-trips.
 *
 * Storage keys (per campaign + player + round):
 *   ops_diplo_staging_{campaignId}_{playerId}_{round}  — diplomatic actions array
 *   ops_econ_staging_{campaignId}_{playerId}_{round}   — economic projects array
 *
 * Usage:
 *   const store = useOperationsStagingStore({ campaignId, playerId, round });
 *   store.getDiplomaticStaging()          → [{ action_type, region_id, cost, ... }]
 *   store.setDiplomaticStaging(arr)
 *   store.getEconomicStaging()            → [{ building_type, territory_id, ... }]
 *   store.setEconomicStaging(arr)
 *   store.clearAll()                      — called after successful lock-in
 */
import { useCallback } from 'react';

export function useOperationsStagingStore({ campaignId, playerId, round }) {
  const diploKey  = `ops_diplo_staging_${campaignId}_${playerId}_${round}`;
  const econKey   = `ops_econ_staging_${campaignId}_${playerId}_${round}`;

  const getDiplomaticStaging = useCallback(() => {
    try {
      const raw = localStorage.getItem(diploKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [diploKey]);

  const setDiplomaticStaging = useCallback((arr) => {
    localStorage.setItem(diploKey, JSON.stringify(arr));
  }, [diploKey]);

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
    localStorage.removeItem(diploKey);
    localStorage.removeItem(econKey);
  }, [diploKey, econKey]);

  return {
    diploKey,
    econKey,
    getDiplomaticStaging,
    setDiplomaticStaging,
    getEconomicStaging,
    setEconomicStaging,
    clearAll,
  };
}