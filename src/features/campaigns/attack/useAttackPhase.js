/**
 * useAttackPhase — local-first attack staging. Phase 1 Atomic Refactor.
 *
 * Privacy contract:
 *   - Only the calling player's own attacks are ever staged/visible.
 *   - Never fetches other players' attacks.
 *   - Lock status via useAttackLockStatus (is_locked only, no attack data).
 *
 * Architecture:
 *   - Attacks are staged purely in localStorage — zero server writes per staging action.
 *   - On lock, one atomic payload is sent: { attacks: [...] }
 *   - Server validates origins, targets, troop counts, adjacency, and generates battle cards.
 *   - Existing server-side PhaseDecision is read at phase start to restore any prior session.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useActingAsPayload } from '@/features/adminTestMode/useActingAsPayload';

function getStorageKey(campaignId, playerId, round) {
  return `atk_local_${campaignId}_${playerId}_${round}`;
}

function loadLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLocal(key, attacks) {
  try { localStorage.setItem(key, JSON.stringify(attacks)); } catch { /* ignore quota errors */ }
}

function clearLocal(key) {
  try { localStorage.removeItem(key); } catch {}
}

export function useAttackPhase({ campaign, myPlayer }) {
  const { getPayload, actingPlayer } = useActingAsPayload(myPlayer);
  const [attacks, setAttacks]       = useState([]);
  const [decision, setDecision]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const round = campaign?.current_round ?? 1;
  const storageKey = getStorageKey(campaign?.id, actingPlayer?.id, round);
  const isLockedRef = useRef(false);

  // Load once at phase start: restore from localStorage or fetch server decision
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
      isLockedRef.current = d?.is_locked ?? false;

      if (d?.is_locked) {
        // Locked — show committed attacks from server, clear local staging
        clearLocal(storageKey);
        setAttacks(d?.data?.attacks ?? []);
      } else {
        // Not locked — prefer local staging, fall back to server data
        const local = loadLocal(storageKey);
        if (local !== null) {
          setAttacks(local);
        } else {
          const serverAttacks = d?.data?.attacks ?? [];
          setAttacks(serverAttacks);
          if (serverAttacks.length > 0) saveLocal(storageKey, serverAttacks);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayer?.id, round, storageKey]);

  useEffect(() => { reload(); }, [reload]);

  // Stage attack locally — no server write
  const handleStageAttack = useCallback(({ origin_territory_id, target_territory_id, committed_troops }) => {
    setError(null);
    const current = loadLocal(storageKey) ?? attacks;
    const maxAttacks = campaign?.settings?.max_attacks_per_phase ?? 3;
    if (current.length >= maxAttacks) {
      setError(`Max ${maxAttacks} attacks allowed.`);
      return { success: false, error: `Max ${maxAttacks} attacks allowed.` };
    }
    // Prevent duplicate origin→target
    if (current.some(a => a.origin_territory_id === origin_territory_id && a.target_territory_id === target_territory_id)) {
      setError('Attack already staged for this origin→target pair.');
      return { success: false, error: 'Duplicate attack.' };
    }
    const newAttack = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      origin_territory_id,
      target_territory_id,
      committed_troops,
    };
    const updated = [...current, newAttack];
    saveLocal(storageKey, updated);
    setAttacks(updated);
    window.dispatchEvent(new Event('storage'));
    return { success: true };
  }, [attacks, storageKey, campaign?.settings?.max_attacks_per_phase]);

  // Delete attack locally — no server write
  const handleDeleteAttack = useCallback((attackId) => {
    setError(null);
    const current = loadLocal(storageKey) ?? attacks;
    const updated = current.filter(a => a.id !== attackId);
    saveLocal(storageKey, updated);
    setAttacks(updated);
    window.dispatchEvent(new Event('storage'));
  }, [attacks, storageKey]);

  // Lock — one atomic submission of all local attacks
  const handleLock = useCallback(async (onPhaseChanged, actingAsPlayerId = null) => {
    setSubmitting(true);
    setError(null);
    const localAttacks = loadLocal(storageKey) ?? attacks;
    try {
      await base44.functions.invoke('attackPhase', {
        action: 'lockAttack',
        campaign_id: campaign.id,
        attacks: localAttacks, // atomic payload — server validates all at once
        ...(actingAsPlayerId ? { acting_as_player_id: actingAsPlayerId } : getPayload()),
      });
      clearLocal(storageKey);
      await reload();
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to lock attacks.');
    } finally {
      setSubmitting(false);
    }
  }, [campaign?.id, attacks, storageKey, reload, getPayload]);

  const isLocked = decision?.is_locked ?? false;
  const maxAttacks = campaign?.settings?.max_attacks_per_phase ?? 3;

  return {
    attacks, decision, loading, submitting, error,
    isLocked, maxAttacks,
    handleStageAttack, handleDeleteAttack, handleLock,
    reload,
  };
}