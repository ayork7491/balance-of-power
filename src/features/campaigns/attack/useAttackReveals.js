/**
 * useAttackReveals — public revealed attacks for a round.
 *
 * Fetches AttackReveal records (public — created after processPhaseEnd).
 * These are visible to ALL players. Used for map arrow rendering after reveal.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useAttackReveals({ campaignId, round, enabled = true }) {
  const [reveals, setReveals] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    try {
      const rows = await base44.entities.AttackReveal.filter({ campaign_id: campaignId, round });
      setReveals(rows);
    } catch {
      setReveals([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, round, enabled]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!campaignId || !enabled) return;
    const unsub = base44.entities.AttackReveal.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      reload();
    });
    return unsub;
  }, [campaignId, enabled, reload]);

  return { reveals, loading, reload };
}