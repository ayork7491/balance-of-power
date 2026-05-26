/**
 * useAttackArrows — Attack arrow layer logic.
 * Extracted from ActiveCampaign.jsx for maintainability.
 */
import { useMemo } from 'react';

export function useAttackArrows({
  phase,
  myPlayer,
  myStagedAttacks,
  attackReveals,
}) {
  return useMemo(() => {
    if (phase === 'attack') {
      // During attack phase: show ONLY own staged attacks
      if (!myPlayer || myStagedAttacks.length === 0) return [];
      return myStagedAttacks.map(a => ({ ...a, player_id: myPlayer.id }));
    }
    
    // After reveal: show all AttackReveal records
    return attackReveals;
  }, [phase, myPlayer, myStagedAttacks, attackReveals]);
}