/**
 * useDeployPhase — own-player deploy decision state and actions.
 *
 * Privacy contract:
 *   - Fetches ONLY the calling player's own PhaseDecision (user-scoped query).
 *   - Never fetches other players' decisions or placement data.
 *   - Other players' lock status → use useDeployPhaseLockStatus.
 *
 * Exposes:
 *   placements, decision, troopsRemaining, income
 *   loading, submitting, saved, error
 *   handleChange, handleSave, handleLock, reload
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useActingAsPayload } from '@/features/adminTestMode/useActingAsPayload';

export function useDeployPhase({ campaign, myPlayer, myTerritories }) {
  const { getPayload, actingPlayer } = useActingAsPayload(myPlayer);
  const [placements, setPlacements] = useState({});
  const [decision, setDecision]     = useState(null);
  const [income, setIncome]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const round = campaign?.current_round ?? 1;
  const storageKey = `deploy_staging_${campaign?.id}_${actingPlayer?.id}`;

  const totalPlaced = useMemo(
    () => Object.values(placements).reduce((s, n) => s + (parseInt(n) || 0), 0),
    [placements],
  );
  const troopsRemaining = (income?.total ?? 0) - totalPlaced;

  const reload = useCallback(async () => {
    if (!campaign?.id || !myPlayer?.id) return;
    setLoading(true);
    try {
      // Fetch acting player's decision + income in parallel
      const [decisionRows, incomeRows] = await Promise.all([
        base44.entities.PhaseDecision.filter({
          campaign_id: campaign.id,
          player_id:   actingPlayer.id,
          phase:       'deploy',
          round,
        }),
        base44.entities.DeployIncome.filter({
          campaign_id: campaign.id,
          player_id:   actingPlayer.id,
          round,
        }),
      ]);

      const d = decisionRows[0] ?? null;
      const inc = incomeRows[0] ?? null;
      setDecision(d);
      setIncome(inc);

      // Local-first: prefer localStorage staged changes over server state
      const local = localStorage.getItem(storageKey);
      if (local) {
        setPlacements(JSON.parse(local));
      } else if (d?.data?.placements && Object.keys(d.data.placements).length > 0) {
        setPlacements({ ...d.data.placements });
      } else {
        const init = {};
        for (const t of (myTerritories ?? [])) init[t.territory_id] = 0;
        setPlacements(init);
      }
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, myPlayer?.id, actingPlayer?.id, round, myTerritories, storageKey]);

  useEffect(() => { reload(); }, [reload]);

  // No broad PhaseDecision subscription — decisions are loaded once at phase start.
  // Reload is triggered explicitly after lock/save actions to avoid polling storms.

  const handleChange = useCallback((tid, value) => {
    const n = Math.max(0, parseInt(value) || 0);
    setPlacements(prev => {
      const next = { ...prev, [tid]: n };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const handleLock = useCallback(async (onPhaseChanged, actingAsPlayerId = null) => {
    setSubmitting(true);
    setError(null);
    try {
      // Build clean placements from current UI state — same as handleSave.
      // This ensures Lock always reflects what the player sees, even if they
      // never pressed Save first.
      const clean = {};
      for (const [tid, v] of Object.entries(placements)) {
        clean[tid] = parseInt(v) || 0;
      }

      console.log('[handleLock] UI placements:', placements);
      console.log('[handleLock] Payload placements:', clean);

      await base44.functions.invoke('deployPhase', {
        action:      'lockDeploy',
        campaign_id: campaign.id,
        placements:  clean,
        ...(actingAsPlayerId ? { acting_as_player_id: actingAsPlayerId } : getPayload()),
      });
      localStorage.removeItem(storageKey);
      await reload();
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to lock deployment.');
    } finally {
      setSubmitting(false);
    }
  }, [campaign?.id, placements, reload, getPayload]);

  return {
    placements, decision, income, troopsRemaining,
    loading, submitting, error,
    handleChange, handleLock, reload,
  };
}