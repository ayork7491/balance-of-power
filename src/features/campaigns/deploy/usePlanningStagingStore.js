/**
 * usePlanningStagingStore — local-first staging state for the Planning Phase.
 *
 * Provides a unified read/write interface to localStorage for all three pillars
 * (military, economic, diplomatic) so the PlanningPhaseLockBar can reflect local
 * changes without waiting for a server round-trip.
 *
 * Storage keys (per campaign + player + round):
 *   deploy_staging_{campaignId}_{playerId}          — military troop placements (existing)
 *   planning_econ_staging_{campaignId}_{playerId}_{round}  — economic territory selections
 *   planning_diplo_staging_{campaignId}_{playerId}_{round} — diplomatic card staging
 *
 * Usage:
 *   const store = usePlanningStagingStore({ campaignId, playerId, round });
 *   store.getMilitaryPlacements()   → { [tid]: number }
 *   store.getEconomicSelections()   → string[]
 *   store.setEconomicSelections(ids)
 *   store.getDiplomaticStaging()    → { kept_card_id, replace_card_id } | null
 *   store.setDiplomaticStaging(obj)
 *   store.getCapitalStaging()       → string | null   (territory_id)
 *   store.setCapitalStaging(tid)
 *   store.clearAll()                — called after successful lock-in
 */
import { useCallback } from 'react';

export function usePlanningStagingStore({ campaignId, playerId, round }) {
  const militaryKey   = `deploy_staging_${campaignId}_${playerId}`;
  const economicKey   = `planning_econ_staging_${campaignId}_${playerId}_${round}`;
  const diplomaticKey = `planning_diplo_staging_${campaignId}_${playerId}_${round}`;
  const capitalKey    = `planning_capital_staging_${campaignId}_${playerId}_${round}`;

  const getMilitaryPlacements = useCallback(() => {
    try {
      const raw = localStorage.getItem(militaryKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [militaryKey]);

  const getEconomicSelections = useCallback(() => {
    try {
      const raw = localStorage.getItem(economicKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [economicKey]);

  const setEconomicSelections = useCallback((ids) => {
    localStorage.setItem(economicKey, JSON.stringify(ids));
  }, [economicKey]);

  const getDiplomaticStaging = useCallback(() => {
    try {
      const raw = localStorage.getItem(diplomaticKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [diplomaticKey]);

  const setDiplomaticStaging = useCallback((obj) => {
    localStorage.setItem(diplomaticKey, JSON.stringify(obj));
  }, [diplomaticKey]);

  const getCapitalStaging = useCallback(() => {
    try {
      const raw = localStorage.getItem(capitalKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [capitalKey]);

  const setCapitalStaging = useCallback((territoryId) => {
    localStorage.setItem(capitalKey, JSON.stringify(territoryId));
    window.dispatchEvent(new Event('storage'));
  }, [capitalKey]);

  const clearAll = useCallback(() => {
    localStorage.removeItem(militaryKey);
    localStorage.removeItem(economicKey);
    localStorage.removeItem(diplomaticKey);
    localStorage.removeItem(capitalKey);
  }, [militaryKey, economicKey, diplomaticKey, capitalKey]);

  return {
    militaryKey,
    economicKey,
    diplomaticKey,
    capitalKey,
    getMilitaryPlacements,
    getEconomicSelections,
    setEconomicSelections,
    getDiplomaticStaging,
    setDiplomaticStaging,
    getCapitalStaging,
    setCapitalStaging,
    clearAll,
  };
}