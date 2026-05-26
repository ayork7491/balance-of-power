/**
 * useBattleCards — fetches BattleCard records for a campaign round.
 *
 * Data is public — all players can see all battle cards after attack reveal.
 * Uses polling (every 20s) plus a manual reload function.
 *
 * Returns:
 *   cards        — BattleCard[]
 *   loading      — boolean
 *   error        — string | null
 *   reload       — () => void
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function useBattleCards({ campaignId, round, enabled = true }) {
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const intervalRef           = useRef(null);

  const fetch = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'getBattleCards',
      campaign_id: campaignId,
      round,
    });
    setCards(res.data?.battle_cards ?? []);
    setLoading(false);
  }, [campaignId, round, enabled]);

  useEffect(() => {
    fetch();
    if (enabled) {
      intervalRef.current = setInterval(fetch, 20_000);
    }
    return () => clearInterval(intervalRef.current);
  }, [fetch, enabled]);

  return { cards, loading, error, reload: fetch };
}