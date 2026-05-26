/**
 * useInitialDeploy — manages a single player's own initial deployment state.
 *
 * Privacy contract:
 *   - Only fetches the CURRENT player's own PhaseDecision record.
 *   - Never fetches other players' PhaseDecision records or placement data.
 *   - Lock status for other players is obtained separately via useDeployLockStatus.
 *
 * Exposes:
 *   placements       — { [territory_id]: number } staged by this player
 *   decision         — the player's own PhaseDecision record (is_locked, etc.)
 *   troopsRemaining  — startingTroops minus sum of placements
 *   loading / error
 *   handleChange     — update a territory placement locally
 *   handleSave       — stageTroops → server
 *   handleLock       — lockDeploy  → server
 *   reload           — re-fetch from server
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useInitialDeploy({ campaign, myPlayer, myTerritories }) {
  const [placements, setPlacements] = useState({});
  const [decision, setDecision]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [saved, setSaved]           = useState(false);

  const startingTroops = campaign?.settings?.starting_troops ?? 30;

  const totalPlaced    = useMemo(
    () => Object.values(placements).reduce((s, n) => s + (parseInt(n) || 0), 0),
    [placements],
  );
  const troopsRemaining = startingTroops - totalPlaced;

  const reload = useCallback(async () => {
    if (!campaign?.id || !myPlayer?.id) return;
    setLoading(true);
    try {
      const rows = await base44.entities.PhaseDecision.filter({
        campaign_id: campaign.id,
        player_id:   myPlayer.id,
        phase:       'initial_deploy',
      });
      const d = rows[0] ?? null;
      setDecision(d);
      if (d?.data?.placements) {
        setPlacements({ ...d.data.placements });
      } else {
        const init = {};
        for (const t of (myTerritories ?? [])) init[t.territory_id] = 0;
        setPlacements(init);
      }
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, myPlayer?.id, myTerritories]);

  useEffect(() => {
    reload();
  }, [reload]);

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
      const cleanPlacements = {};
      for (const [tid, v] of Object.entries(placements)) {
        cleanPlacements[tid] = parseInt(v) || 0;
      }
      await base44.functions.invoke('initialDeploy', {
        action:      'stageTroops',
        campaign_id: campaign.id,
        placements:  cleanPlacements,
      });
      setSaved(true);
      await reload();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save placements.');
    } finally {
      setSubmitting(false);
    }
  }, [decision?.is_locked, placements, campaign?.id, reload]);

  const handleLock = useCallback(async (onPhaseChanged) => {
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('initialDeploy', {
        action:      'lockDeploy',
        campaign_id: campaign.id,
      });
      await reload();
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to lock deployment.');
    } finally {
      setSubmitting(false);
    }
  }, [campaign?.id, reload]);

  return {
    placements,
    decision,
    troopsRemaining,
    loading,
    submitting,
    saved,
    error,
    handleChange,
    handleSave,
    handleLock,
    reload,
  };
}