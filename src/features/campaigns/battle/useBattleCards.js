/**
 * useBattleCards — fetches BattleCard records for a campaign.
 *
 * Returns current-round cards PLUS any unresolved delayed cards from prior rounds.
 * Data is public — all players can see all battle cards after attack reveal.
 * Uses polling (every 20s) plus a manual reload function.
 *
 * Returns:
 *   cards           — BattleCard[] (current round + prior delayed)
 *   delayedCards    — BattleCard[] subset: only the delayed-from-prior-rounds cards
 *   loading         — boolean
 *   error           — string | null
 *   reload          — () => void
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function useBattleCards({ campaignId, round, enabled = true }) {
  const [cards, setCards]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const intervalRef               = useRef(null);

  const fetchCards = useCallback(async () => {
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
    fetchCards();
    if (enabled) {
      intervalRef.current = setInterval(fetchCards, 20_000);
    }
    return () => clearInterval(intervalRef.current);
  }, [fetchCards, enabled]);

  // Separate out the delayed-from-prior-rounds cards for UI callouts
  const delayedCards = cards.filter(c => c.status === 'delayed' && c.round !== round);

  return { cards, delayedCards, loading, error, reload: fetchCards };
}