/**
 * useAttackArrows — Attack arrow layer logic.
 * Extracted from ActiveCampaign.jsx for maintainability.
 *
 * During battle phase: also shows delayed carried-over battle arrows (distinct style).
 */
import { useMemo } from 'react';

export function useAttackArrows({
  phase,
  myPlayer,
  myStagedAttacks,
  attackReveals,
  delayedBattleCards = [],
}) {
  return useMemo(() => {
    if (phase === 'attack') {
      // During attack phase: show ONLY own staged attacks
      if (!myPlayer || myStagedAttacks.length === 0) return [];
      return myStagedAttacks.map(a => ({ ...a, player_id: myPlayer.id }));
    }

    // Build base arrows from attack reveals
    const reveals = attackReveals.map(a => ({ ...a, is_delayed: false }));

    // During battle phase: overlay arrows for all unresolved carryover cards
    // Arrow persists through: delayed, active_carryover, pending_approval, result_submitted, awaiting_approval
    if (phase === 'battle' && delayedBattleCards.length > 0) {
      const delayedArrows = [];
      for (const card of delayedBattleCards) {
        for (const atk of (card.attackers ?? [])) {
          delayedArrows.push({
            origin_territory_id: atk.origin_territory_id,
            target_territory_id: card.target_territory_id,
            committed_troops: atk.committed_troops,
            player_id: atk.player_id,
            is_delayed: true,
          });
        }
      }
      return [...reveals, ...delayedArrows];
    }

    return reveals;
  }, [phase, myPlayer, myStagedAttacks, attackReveals, delayedBattleCards]);
}