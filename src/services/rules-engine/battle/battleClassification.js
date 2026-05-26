/**
 * services/rules-engine/battle/battleClassification.js
 *
 * Pure functions for classifying and scaling battle cards.
 * No side effects, no imports, no DB access — fully testable.
 *
 * Called by attackPhase.js (battle card generation) and battlePhase.js
 * (auto-resolve, result application).
 *
 * ─── CLASSIFICATION RULES ────────────────────────────────────────────────────
 *
 * Input: post-commitment board state (committed troops already removed).
 * A territory is neutral/vacated if owner_player_id is null OR troop_count === 0.
 *
 * skirmish:           1 attacker → neutral/vacated      → auto-resolve, no card
 * siege:              1 attacker → live defender        → battle card
 * double_siege:      2+ attackers → live defender       → battle card
 * capture_objectives: 2+ attackers → neutral/vacated   → battle card
 * bloodbath:          mutual attacks A↔B               → ONE card, special handling
 *
 * ─── SCALING RULES ───────────────────────────────────────────────────────────
 *
 * scale_factor = max(totalTroopsInBattle / avgBattleSize, 1.0)
 * tabletop_size = round(totalTroopsInBattle / scaleFactor)
 *
 * Both values are deterministic given the same inputs.
 * Survivors after the tabletop battle are scaled back:
 *   surviving_full_scale = round(surviving_tabletop / tabletop_size * totalTroopsInBattle)
 *
 * ─── AUTO-RESOLVE RULES ──────────────────────────────────────────────────────
 *
 * Skirmish: attacker captures territory, all committed troops move in. No losses.
 * Timed-out battles: random winner (seeded), proportional losses applied.
 *   - Winner retains 60–90% of their scaled troops.
 *   - Loser retains 0% (eliminated).
 */

/**
 * Classify a non-bloodbath battle from post-commitment state.
 *
 * @param {string}   targetId
 * @param {Array}    attacksOnTarget   - attacks whose target === targetId
 * @param {object}   postCommitStateById - { [territory_id]: { owner_player_id, troop_count } }
 * @returns {'skirmish'|'siege'|'double_siege'|'capture_objectives'}
 */
export function classifyBattle(targetId, attacksOnTarget, postCommitStateById) {
  const state     = postCommitStateById[targetId];
  const isNeutral = !state?.owner_player_id || (state.troop_count ?? 0) === 0;
  const n         = attacksOnTarget.length;

  if (isNeutral && n === 1)  return 'skirmish';
  if (isNeutral && n > 1)   return 'capture_objectives';
  if (!isNeutral && n === 1) return 'siege';
  return 'double_siege';
}

/**
 * Build a canonical pair key for bloodbath deduplication.
 * Sorted so A↔B and B↔A produce the same key.
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function bloodbathKey(a, b) {
  return [a, b].sort().join('↔');
}

/**
 * Calculate tabletop scaling for a battle.
 *
 * @param {number} totalTroopsInBattle  - sum of all troops on both sides
 * @param {number} avgBattleSize        - from TabletopGameProfile.average_battle_size
 * @returns {{ scale_factor: number, tabletop_size: number }}
 */
export function calcBattleScaling(totalTroopsInBattle, avgBattleSize = 1000) {
  const scaleFactor  = Math.max(totalTroopsInBattle / avgBattleSize, 1);
  const tabletopSize = Math.round(totalTroopsInBattle / scaleFactor);
  return {
    scale_factor:  parseFloat(scaleFactor.toFixed(4)),
    tabletop_size: tabletopSize,
  };
}

/**
 * Scale surviving tabletop troops back to full-scale strategic troops.
 * Preserves proportional losses.
 *
 * @param {number} survivingTabletop   - tabletop survivors submitted by players
 * @param {number} tabletopSize        - total tabletop points in the battle
 * @param {number} totalTroopsInBattle - full-scale troop total
 * @returns {number} surviving full-scale troops (integer, minimum 0)
 */
export function scaleBackSurvivors(survivingTabletop, tabletopSize, totalTroopsInBattle) {
  if (tabletopSize <= 0) return 0;
  const ratio = Math.max(0, survivingTabletop / tabletopSize);
  return Math.round(ratio * totalTroopsInBattle);
}

/**
 * Auto-resolve a battle when it times out or is force-resolved.
 * Returns a deterministic result given the same seed.
 *
 * Winner is chosen based on troop weight (higher troops = higher probability).
 * Winner retains 60–90% of their tabletop points.
 * Loser retains 0%.
 *
 * @param {object} card        - BattleCard record
 * @param {string} seed        - deterministic seed (e.g. `${campaign_id}:${round}:${card.id}`)
 * @returns {{ winner_player_id: string|null, surviving_tabletop_troops: number, notes: string }}
 */
export function autoResolveBattle(card, seed) {
  const rng = seededRandom(seed);

  // Gather all sides with their tabletop troop contribution
  const sides = buildSides(card);

  if (sides.length === 0) {
    return { winner_player_id: null, surviving_tabletop_troops: 0, notes: 'No participants — auto-resolved with no result.' };
  }

  // Weighted random winner by troop contribution
  const totalWeight = sides.reduce((s, side) => s + side.troops, 0);
  let r = rng() * totalWeight;
  let winner = sides[sides.length - 1];
  for (const side of sides) {
    r -= side.troops;
    if (r <= 0) { winner = side; break; }
  }

  // Winner retains 60–90% of tabletop points (random in that range)
  const retainRatio     = 0.6 + rng() * 0.3;
  const winnerTabletop  = Math.round(winner.tabletop_troops * retainRatio);

  return {
    winner_player_id:          winner.player_id,
    surviving_tabletop_troops: winnerTabletop,
    notes:                     'Auto-resolved: timed out.',
  };
}

/**
 * Build a list of { player_id, troops, tabletop_troops } sides for a battle card.
 * For bloodbath: each attacker is a side. No "defender" side.
 * For siege/double_siege: attacker(s) + defender.
 *
 * @param {object} card - BattleCard record
 * @returns {Array<{ player_id: string, troops: number, tabletop_troops: number }>}
 */
export function buildSides(card) {
  const sides = [];
  const tabletopSize   = card.tabletop_size   ?? 0;
  const totalTroops    = card.total_troops_in_battle ?? 1;

  // Helper: proportion of tabletop battle
  const toTabletop = (troops) => totalTroops > 0 ? Math.round((troops / totalTroops) * tabletopSize) : 0;

  if (card.is_mutual) {
    // Bloodbath: all attackers are sides
    for (const atk of (card.attackers ?? [])) {
      sides.push({
        player_id:       atk.player_id,
        troops:          atk.committed_troops,
        tabletop_troops: toTabletop(atk.committed_troops),
      });
    }
  } else {
    // Siege / double_siege / capture_objectives: attackers combined + optional defender
    const totalAttacking = card.total_attacking_troops ?? 0;
    if (card.attackers?.length > 0) {
      // For multi-attacker: winner among attackers gets the territory
      // Treat all attackers as a single attacking "side" for simplicity (V1)
      const firstAttacker = card.attackers[0];
      sides.push({
        player_id:       firstAttacker.player_id,
        troops:          totalAttacking,
        tabletop_troops: toTabletop(totalAttacking),
      });
    }
    if (card.defender_player_id && (card.defender_troops ?? 0) > 0) {
      sides.push({
        player_id:       card.defender_player_id,
        troops:          card.defender_troops,
        tabletop_troops: toTabletop(card.defender_troops),
      });
    }
  }
  return sides;
}

// ─── Private: seedable RNG (FNV-1a + xorshift) ───────────────────────────────

function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}