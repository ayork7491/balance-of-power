/**
 * useDeployPhaseLockStatus — fetches only is_locked status for all players
 * in the current deploy round via the getDeployLockStatus backend function.
 *
 * Privacy contract:
 *   - Returns ONLY { player_id, is_locked } per player.
 *   - No placement data is ever returned.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useDeployPhaseLockStatus({ campaignId, round, enabled = true }) {
  const [lockStatus, setLockStatus] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const reload = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getDeployLockStatus', {
        campaign_id: campaignId,
        phase:       'deploy',
        round,
      });
      setLockStatus(res?.data?.lock_status ?? []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load lock status.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, round, enabled]);

  useEffect(() => { reload(); }, [reload]);

  // Auto-refresh when any PhaseDecision for this round changes lock state
  useEffect(() => {
    if (!campaignId || !enabled) return;
    const unsub = base44.entities.PhaseDecision.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      if (event.data?.phase !== 'deploy') return;
      if (event.data?.is_locked) reload();
    });
    return unsub;
  }, [campaignId, enabled, reload]);

  return { lockStatus, loading, error, reload };
}