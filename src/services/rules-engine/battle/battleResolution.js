/**
 * services/rules-engine/battle/battleResolution.js
 *
 * Pure functions for applying battle results to territory state.
 * No DB access — returns explicit change objects that callers persist.
 *
 * ─── RESOLUTION PIPELINE ─────────────────────────────────────────────────────
 *
 * 1. Determine winner and surviving troops (tabletop scale → full scale).
 * 2. Apply territory ownership change (if attacker wins).
 * 3. Apply troop count update (surviving full-scale troops in winning territory).
 * 4. Eliminate losers' committed troops (they are already gone from origin).
 * 5. Return: { territoryChanges, troopChanges, eliminationChecks }
 *
 * ─── TROOP ACCOUNTING ────────────────────────────────────────────────────────
 *
 * Committed troops were already removed from origin territories during attack
 * phase end (Step 1 of processPhaseEnd). They exist "in transit".
 *
 * After resolution:
 *   - Winner's surviving troops are placed in the WINNING territory.
 *   - Loser's committed troops are simply lost (already removed from map).
 *   - Defender's remaining troops stay in place if defender wins.
 *
 * ─── BLOODBATH RESOLUTION ────────────────────────────────────────────────────
 *
 * Both territories were already vacated (troops removed). Winner places
 * surviving troops in their OWN origin territory, not the enemy's.
 * (Players fought over both territories simultaneously — winner holds both.)
 * Actually: spec says winner of bloodbath captures the enemy territory too,
 * placing survivors there. V1: winner gets BOTH territories.
 */

import { scaleBackSurvivors } from './battleClassification.js';

/**
 * Apply a submitted battle result to territory state.
 *
 * @param {object} card        - BattleCard record (from DB)
 * @param {object} result      - { winner_player_id, surviving_tabletop_troops }
 * @param {Array}  territoryStates - all TerritoryState records for the campaign
 * @returns {{
 *   territoryUpdates: Array<{ id, troop_count, owner_player_id }>,
 *   eliminationCandidates: string[]  - player_ids who lost all committed troops
 * }}
 */
export function applyBattleResult(card, result, territoryStates) {
  const { winner_player_id, surviving_tabletop_troops } = result;
  const survivingTroops = scaleBackSurvivors(
    surviving_tabletop_troops ?? 0,
    card.tabletop_size ?? 1,
    card.total_troops_in_battle ?? 0,
  );

  const territoryUpdates   = [];
  const eliminationCandidates = [];

  // Determine losers (all participants who are NOT the winner)
  const allParticipantIds = getParticipantIds(card);
  const losers = allParticipantIds.filter(pid => pid !== winner_player_id);
  eliminationCandidates.push(...losers);

  if (card.is_mutual) {
    // Bloodbath: winner captures BOTH contested territories with surviving troops
    // Both territory_ids involved are: target_territory_id + the other origin
    const territoriesInvolved = getBloodbathTerritories(card);
    for (const tid of territoriesInvolved) {
      const state = territoryStates.find(s => s.territory_id === tid);
      if (!state) continue;
      territoryUpdates.push({
        id:              state.id,
        territory_id:    tid,
        owner_player_id: winner_player_id,
        troop_count:     survivingTroops,
      });
    }
  } else {
    // Siege / double_siege / capture_objectives
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);

    if (winner_player_id === card.defender_player_id) {
      // Defender wins: retain surviving troops in their territory
      if (targetState) {
        territoryUpdates.push({
          id:              targetState.id,
          territory_id:    card.target_territory_id,
          owner_player_id: card.defender_player_id,
          troop_count:     survivingTroops,
        });
      }
    } else {
      // Attacker wins: capture the territory, place surviving troops
      if (targetState) {
        territoryUpdates.push({
          id:              targetState.id,
          territory_id:    card.target_territory_id,
          owner_player_id: winner_player_id,
          troop_count:     survivingTroops,
        });
      }
      // Defender (if any) loses their remaining troops (already deducted committed,
      // defender_troops is what was left — now lost on defeat)
      if (card.defender_player_id) {
        eliminationCandidates.push(card.defender_player_id);
      }
    }
  }

  return { territoryUpdates, eliminationCandidates };
}

/**
 * Check whether a player should be marked as eliminated.
 * A player is eliminated if they own zero territories AND have zero troops.
 *
 * @param {string} playerId
 * @param {Array}  territoryStates - post-resolution territory states
 * @returns {boolean}
 */
export function shouldEliminate(playerId, territoryStates) {
  const owned = territoryStates.filter(s => s.owner_player_id === playerId);
  if (owned.length > 0) return false;
  return true;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function getParticipantIds(card) {
  const ids = new Set();
  for (const atk of (card.attackers ?? [])) {
    if (atk.player_id) ids.add(atk.player_id);
  }
  if (card.defender_player_id) ids.add(card.defender_player_id);
  return [...ids];
}

function getBloodbathTerritories(card) {
  // card.target_territory_id is the lex-first of the pair.
  // The other territory is one of the attacker origins that isn't the target.
  const territories = new Set([card.target_territory_id]);
  for (const atk of (card.attackers ?? [])) {
    territories.add(atk.origin_territory_id);
  }
  return [...territories];
}