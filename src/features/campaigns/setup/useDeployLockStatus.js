/**
 * useDeployLockStatus — fetches only lock status (is_locked) for all players
 * in the initial_deploy phase via a dedicated backend function.
 *
 * Privacy contract:
 *   - Returns ONLY { player_id, is_locked } per player.
 *   - No placement data (territory_id, troop counts) is ever returned.
 *   - The server-side function strips all data fields before responding.
 *
 * This hook is safe to call for any player in the campaign — the server
 * enforces the data stripping regardless of who calls it.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useDeployLockStatus({ campaignId, enabled = true }) {
  const [lockStatus, setLockStatus] = useState([]);   // [{ player_id, is_locked }]
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const reload = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getDeployLockStatus', {
        campaign_id: campaignId,
      });
      setLockStatus(res?.data?.lock_status ?? []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load lock status.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Subscribe to PhaseDecision changes to auto-refresh when someone locks
  useEffect(() => {
    if (!campaignId || !enabled) return;
    const unsub = base44.entities.PhaseDecision.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      if (event.data?.phase !== 'initial_deploy') return;
      // A lock happened — refresh lock summary (not placement data)
      if (event.data?.is_locked) reload();
    });
    return unsub;
  }, [campaignId, enabled, reload]);

  return { lockStatus, loading, error, reload };
}