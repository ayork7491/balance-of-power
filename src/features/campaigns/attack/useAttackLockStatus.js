/**
 * useAttackLockStatus — public lock status for all players in the attack phase.
 *
 * Privacy contract:
 *   - Polls getAttackLockStatus backend function — returns { player_id, is_locked } ONLY.
 *   - NEVER subscribes to PhaseDecision directly. A client-side subscription to
 *     PhaseDecision would expose all players' attack data (including staged targets
 *     and troop counts) before the reveal. Polling the safe backend function is the
 *     only compliant channel for cross-player lock visibility.
 *
 * Polling interval: 15s — aggressive enough to feel responsive without hammering the API.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const POLL_INTERVAL_MS = 15_000;

export function useAttackLockStatus({ campaignId, round, enabled = true }) {
  const [lockStatus, setLockStatus] = useState([]);
  const [loading, setLoading]       = useState(false);
  const intervalRef = useRef(null);

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

  // Initial load
  useEffect(() => { reload(); }, [reload]);

  // Poll every 15s — NO PhaseDecision subscription (privacy boundary)
  useEffect(() => {
    if (!campaignId || !enabled) return;
    intervalRef.current = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [campaignId, enabled, reload]);

  return { lockStatus, loading, reload };
}