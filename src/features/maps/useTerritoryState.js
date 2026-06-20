/**
 * features/maps/useTerritoryState.js
 *
 * COMPATIBILITY SHIM — Sprint 5C Phase View State Refactor.
 *
 * Previously: loaded TerritoryState.filter({ campaign_id }) + subscribed to live updates.
 * Now: delegates to usePhaseViewState (getPhaseViewState backend function).
 *
 * The subscription and direct entity filter have been REMOVED.
 * Components that import useTerritoryState directly continue to work unchanged.
 * ActiveCampaign now uses usePhaseViewState directly for the full unified payload.
 */
import { usePhaseViewState } from './usePhaseViewState';

export function useTerritoryState(campaignId, actingAsPlayerId, phase, round) {
  const { stateById, loading, error, reload } = usePhaseViewState({
    campaignId,
    actingAsPlayerId,
    phase,
    round,
    enabled: !!campaignId,
  });
  return { stateById, loading, error, reload };
}