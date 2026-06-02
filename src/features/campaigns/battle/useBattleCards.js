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

  // Cards that are actively being carried over or awaiting approval from prior rounds
  const ACTIVE_CARRYOVER_STATUSES = ['delayed', 'active_carryover', 'pending_approval', 'awaiting_approval', 'result_submitted'];
  const delayedCards = cards.filter(c => c.round !== round && ACTIVE_CARRYOVER_STATUSES.includes(c.status) && !c.result_applied);

  return { cards, delayedCards, loading, error, reload: fetchCards };
}