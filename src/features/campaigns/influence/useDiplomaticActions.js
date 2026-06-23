/**
 * useDiplomaticActions — Sprint 4H
 *
 * Fetches diplomatic action state for a player in a campaign:
 *   actionsRemaining   — number of actions the player can still submit this round
 *   maxActions         — total allowed actions (base + council chambers)
 *   actionsUsed        — how many have been submitted this round
 *   regionPools        — { [region_id]: spendable_influence }
 *   activeEffects      — all DiplomaticAction records active this round
 *   actionCosts        — { [action_type]: cost } from backend
 *   loading
 *   reload
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useDiplomaticActions({ campaignId, playerId, actingAsPlayerId, enabled = true }) {
  const [actionsRemaining, setActionsRemaining] = useState(0);
  const [maxActions, setMaxActions] = useState(1);
  const [actionsUsed, setActionsUsed] = useState(0);
  const [councilChambers, setCouncilChambers] = useState(0);
  const [regionPools, setRegionPools] = useState({});
  const [activeEffects, setActiveEffects] = useState([]);
  const [actionCosts, setActionCosts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!campaignId || !playerId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('diplomaticPhase', {
        action: 'getDiplomaticState',
        campaign_id: campaignId,
        acting_as_player_id: actingAsPlayerId ?? null,
      });
      const data = res.data ?? {};
      setActionsRemaining(data.actions_remaining ?? 0);
      setMaxActions(data.max_actions ?? 1);
      setActionsUsed(data.actions_used ?? 0);
      setCouncilChambers(data.council_chambers ?? 0);
      setRegionPools(data.region_pools ?? {});
      setActiveEffects(data.active_effects ?? []);
      setActionCosts(data.action_costs ?? {});
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load diplomatic state');
    } finally {
      setLoading(false);
    }
  }, [campaignId, playerId, actingAsPlayerId, enabled]);

  // Debounced load — stagger panel fetches to avoid thundering-herd 429s
  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 800);
    return () => clearTimeout(timer);
  }, [load]);

  const submitAction = useCallback(async (params) => {
    const res = await base44.functions.invoke('diplomaticPhase', {
      action: 'submitAction',
      campaign_id: campaignId,
      acting_as_player_id: actingAsPlayerId ?? null,
      ...params,
    });
    return res.data;
  }, [campaignId, actingAsPlayerId]);

  return {
    actionsRemaining,
    maxActions,
    actionsUsed,
    councilChambers,
    regionPools,
    activeEffects,
    actionCosts,
    loading,
    error,
    reload: load,
    submitAction,
  };
}