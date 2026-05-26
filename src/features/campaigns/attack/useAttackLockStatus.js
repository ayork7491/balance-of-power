/**
 * useAttackLockStatus — public lock status for all players in the attack phase.
 *
 * Privacy: returns { player_id, is_locked } only.
 * Attack data is never fetched here.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useAttackLockStatus({ campaignId, round, enabled = true }) {
  const [lockStatus, setLockStatus] = useState([]);
  const [loading, setLoading]       = useState(false);

  const reload = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getAttackLockStatus', {
        campaign_id: campaignId,
        round,
      });
      setLockStatus(res.data.lock_status ?? []);
    } catch {
      setLockStatus([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, round, enabled]);

  useEffect(() => { reload(); }, [reload]);

  // Real-time: refresh when any PhaseDecision changes
  useEffect(() => {
    if (!campaignId || !enabled) return;
    const unsub = base44.entities.PhaseDecision.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      if (event.data?.phase       !== 'attack') return;
      reload();
    });
    return unsub;
  }, [campaignId, enabled, reload]);

  return { lockStatus, loading, reload };
}