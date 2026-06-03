/**
 * services/rules-engine/battle/battleResolution.js
 *
 * ⚠️  DEPRECATED — DO NOT MODIFY OR USE THIS FILE.
 *
 * This was an early frontend-side implementation of battle resolution logic.
 * It is no longer the authoritative battle engine.
 *
 * ─── AUTHORITATIVE ENGINE ─────────────────────────────────────────────────────
 * All battle resolution now lives in: functions/battlePhase (Deno backend)
 *
 * The backend function handles:
 *   - autoResolveBattle()              — seeded RNG, per-type logic
 *   - buildTerritoryUpdates()          — territory change computation
 *   - buildTerritoryUpdatesWithRecovery() — bloodbath + Recovery Siege
 *   - applyTerritoryUpdates()          — persists changes via Base44 SDK
 *   - scaleBackSurvivors()             — tabletop → BOP troop conversion
 *   - All forfeit / delay / carryover logic
 *
 * ─── WHY NOT DELETED ─────────────────────────────────────────────────────────
 * Kept as a reference archive in case frontend-side preview/simulation is added.
 * If you need battle scaling helpers on the frontend, import from:
 *   services/rules-engine/battle/battleClassification.js
 * (that file is still active and used by attackPhase generation).
 *
 * ─── DO NOT ──────────────────────────────────────────────────────────────────
 * ✗ Do not import this file in any component or page
 * ✗ Do not modify combat rules here expecting them to take effect
 * ✗ Do not treat applyBattleResult() as the live resolution path
 *
 * Sprint 3+ note: If a frontend battle preview/simulator is built,
 * resurrect and update this file at that time. Until then, ignore it.
 */

// ─── Archived implementations below — not active ─────────────────────────────

import { scaleBackSurvivors } from './battleClassification.js';

/**
 * @deprecated Use functions/battlePhase → buildTerritoryUpdatesWithRecovery instead.
 */
export function applyBattleResult(card, result, territoryStates) {
  const { winner_player_id, surviving_tabletop_troops } = result;
  const survivingTroops = scaleBackSurvivors(
    surviving_tabletop_troops ?? 0,
    card.tabletop_size ?? 1,
    card.total_troops_in_battle ?? 0,
  );

  const territoryUpdates      = [];
  const eliminationCandidates = [];

  const allParticipantIds = getParticipantIds(card);
  const losers = allParticipantIds.filter(pid => pid !== winner_player_id);
  eliminationCandidates.push(...losers);

  if (card.is_mutual) {
    const territoriesInvolved = getBloodbathTerritories(card);
    for (const tid of territoriesInvolved) {
      const state = territoryStates.find(s => s.territory_id === tid);
      if (!state) continue;
      territoryUpdates.push({
        id: state.id, territory_id: tid,
        owner_player_id: winner_player_id, troop_count: survivingTroops,
      });
    }
  } else {
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (winner_player_id === card.defender_player_id) {
      if (targetState) {
        territoryUpdates.push({
          id: targetState.id, territory_id: card.target_territory_id,
          owner_player_id: card.defender_player_id, troop_count: survivingTroops,
        });
      }
    } else {
      if (targetState) {
        territoryUpdates.push({
          id: targetState.id, territory_id: card.target_territory_id,
          owner_player_id: winner_player_id, troop_count: survivingTroops,
        });
      }
      if (card.defender_player_id) eliminationCandidates.push(card.defender_player_id);
    }
  }

  return { territoryUpdates, eliminationCandidates };
}

/**
 * @deprecated Use post-resolution territory state checks directly.
 */
export function shouldEliminate(playerId, territoryStates) {
  return territoryStates.filter(s => s.owner_player_id === playerId).length === 0;
}

function getParticipantIds(card) {
  const ids = new Set();
  for (const atk of (card.attackers ?? [])) { if (atk.player_id) ids.add(atk.player_id); }
  if (card.defender_player_id) ids.add(card.defender_player_id);
  return [...ids];
}

function getBloodbathTerritories(card) {
  const territories = new Set([card.target_territory_id]);
  for (const atk of (card.attackers ?? [])) { territories.add(atk.origin_territory_id); }
  return [...territories];
}