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
  const [saved, setSaved]           = useState(false);

  const round = campaign?.current_round ?? 1;

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

      if (d?.data?.placements && Object.keys(d.data.placements).length > 0) {
        // Restore saved placements keyed by territory_id — exact mapping preserved.
        setPlacements({ ...d.data.placements });
      } else {
        // No saved placements yet: initialise zero-map from acting player's territories
        // so the UI shows their territories (not the real user's when acting as someone else).
        const init = {};
        for (const t of (myTerritories ?? [])) init[t.territory_id] = 0;
        setPlacements(init);
      }
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, myPlayer?.id, actingPlayer?.id, round, myTerritories]);

  useEffect(() => { reload(); }, [reload]);

  // No broad PhaseDecision subscription — decisions are loaded once at phase start.
  // Reload is triggered explicitly after lock/save actions to avoid polling storms.

  const handleChange = useCallback((tid, value) => {
    const n = Math.max(0, parseInt(value) || 0);
    setPlacements(prev => ({ ...prev, [tid]: n }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (decision?.is_locked) return;
    setSubmitting(true);
    setError(null);
    try {
      const clean = {};
      for (const [tid, v] of Object.entries(placements)) {
        clean[tid] = parseInt(v) || 0;
      }
      await base44.functions.invoke('deployPhase', {
        action:      'stageTroops',
        campaign_id: campaign.id,
        placements:  clean,
        ...getPayload(),
      });
      setSaved(true);
      await reload();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save placements.');
    } finally {
      setSubmitting(false);
    }
  }, [decision?.is_locked, placements, campaign?.id, reload, getPayload]);

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
    loading, submitting, saved, error,
    handleChange, handleSave, handleLock, reload,
  };
}