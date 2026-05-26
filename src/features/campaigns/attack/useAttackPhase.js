/**
 * useAttackPhase — own-player attack decision state and actions.
 *
 * Privacy contract:
 *   - Fetches ONLY the calling player's own PhaseDecision (user-scoped).
 *   - Never fetches other players' attacks or decision data.
 *   - Other players' lock status → use useAttackLockStatus.
 *   - Revealed attacks (post-reveal) → use useAttackReveals.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useActingAsPayload } from '@/features/adminTestMode/useActingAsPayload';

export function useAttackPhase({ campaign, myPlayer }) {
  const { getPayload, actingPlayer } = useActingAsPayload(myPlayer);
  const [attacks, setAttacks]       = useState([]);
  const [decision, setDecision]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const round = campaign?.current_round ?? 1;

  const reload = useCallback(async () => {
    if (!campaign?.id || !actingPlayer?.id) return;
    setLoading(true);
    try {
      const rows = await base44.entities.PhaseDecision.filter({
        campaign_id: campaign.id,
        player_id:   actingPlayer.id,
        phase:       'attack',
        round,
      });
      const d = rows[0] ?? null;
      setDecision(d);
      setAttacks(d?.data?.attacks ?? []);
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayer?.id, round]);

  useEffect(() => { reload(); }, [reload]);

  // Real-time: acting player's decision only.
  useEffect(() => {
    if (!campaign?.id || !actingPlayer?.id) return;
    const unsub = base44.entities.PhaseDecision.subscribe((event) => {
      if (event.data?.campaign_id !== campaign.id) return;
      if (event.data?.player_id   !== actingPlayer.id) return;
      if (event.data?.phase       !== 'attack') return;
      reload();
    });
    return unsub;
  }, [campaign?.id, actingPlayer?.id, reload]);

  const handleStageAttack = useCallback(async ({ origin_territory_id, target_territory_id, committed_troops }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('attackPhase', {
        action: 'stageAttack',
        campaign_id: campaign.id,
        origin_territory_id,
        target_territory_id,
        committed_troops,
        ...getPayload(),
      });
      setAttacks(res.data.attacks ?? []);
      await reload();
      return { success: true };
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to stage attack.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setSubmitting(false);
    }
  }, [campaign?.id, reload, getPayload]);

  const handleDeleteAttack = useCallback(async (attackId) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('attackPhase', {
        action: 'deleteAttack',
        campaign_id: campaign.id,
        attack_id: attackId,
        ...getPayload(),
      });
      setAttacks(res.data.attacks ?? []);
      await reload();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete attack.');
    } finally {
      setSubmitting(false);
    }
  }, [campaign?.id, reload, getPayload]);

  const handleLock = useCallback(async (onPhaseChanged, actingAsPlayerId = null) => {
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('attackPhase', {
        action: 'lockAttack',
        campaign_id: campaign.id,
        ...(actingAsPlayerId ? { acting_as_player_id: actingAsPlayerId } : getPayload()),
      });
      await reload();
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to lock attacks.');
    } finally {
      setSubmitting(false);
    }
  }, [campaign?.id, reload, getPayload]);

  const isLocked = decision?.is_locked ?? false;
  const maxAttacks = campaign?.settings?.max_attacks_per_phase ?? 3;

  return {
    attacks, decision, loading, submitting, error,
    isLocked, maxAttacks,
    handleStageAttack, handleDeleteAttack, handleLock,
    reload,
  };
}