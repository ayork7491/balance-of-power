/**
 * victoryPhase — Sprint 5A
 *
 * Victory & Scoring framework backend.
 * Called at end of every Consolidation (Fortify) phase, and on-demand for UI.
 *
 * Actions:
 *   calculateScores   — compute MVS / EVS / DVS for all active players, upsert VictoryTracker
 *   checkVictory      — after calculateScores, determine if any player has won; returns winner if so
 *   getScores         — read current VictoryTracker records for display (no recalculation)
 *
 * ─── FORMULA REFERENCE ────────────────────────────────────────────────────────
 *   MVS = Σ (troop_count × MDS) per occupied territory
 *   EVS = gold + 0.30 × Σ (economic building infra value)
 *   DVS = Σ permanent_influence (TerritoryInfluence records — spendable NEVER counts)
 *
 * ─── WINNER DETERMINATION ─────────────────────────────────────────────────────
 *   Single player meets threshold → immediate win
 *   Multiple players meet threshold → highest (score / threshold) percentage wins
 *   Tie on percentage → MVS used as tiebreaker (military supremacy)
 *
 * ─── NOTE ─────────────────────────────────────────────────────────────────────
 *   This file intentionally inlines MDS_BY_TERRITORY and ECONOMIC_BUILDING_INFRA_VALUE
 *   since Deno backend functions cannot import local files.
 *   SOURCE OF TRUTH: src/config/victoryConfig.js — update there first, then propagate here.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── INLINE: Victory thresholds ────────────────────────────────────────────────
// SOURCE OF TRUTH: src/config/victoryConfig.js
const VICTORY_THRESHOLDS = {
  military:   1000,
  economic:    500,
  diplomatic:  250,
};

// ── INLINE: MDS per territory ─────────────────────────────────────────────────
// SOURCE OF TRUTH: src/config/victoryConfig.js — MDS_BY_TERRITORY
const MDS_BY_TERRITORY = {
  I1: 2, I2: 3, I3: 3, I4: 3, I5: 2, I6: 4, I7: 4, I8: 3,
  W1: 2, W2: 4, W3: 2, W4: 3, W5: 5, W6: 3, W7: 4, W8: 3, W9: 3,
  B1: 3, B2: 5, B3: 4, B4: 3, B5: 4, B6: 5, B7: 3, B8: 3, B9: 3, B10: 5,
  S1: 3, S2: 4, S3: 3, S4: 3, S5: 5, S6: 3, S7: 3, S8: 3, S9: 3,
  C1: 2, C2: 3, C3: 3, C4: 4, C5: 3, C6: 5, C7: 2, C8: 4,
};

// ── INLINE: Economic building infra value (gold component) ────────────────────
// SOURCE OF TRUTH: src/config/victoryConfig.js — ECONOMIC_BUILDING_INFRA_VALUE
const ECONOMIC_BUILDING_INFRA_VALUE = {
  marketplace:    2,
  builders_guild: 3,
  trade_network:  2,
  resource_hub:   3,
  supply_route:   1,
  warehouse:      2,
};

const ECONOMIC_INFRA_BONUS_RATE = 0.30;

// ── Score calculators ─────────────────────────────────────────────────────────

function calcMVS(territoryStates, playerId) {
  let mvs = 0;
  for (const ts of territoryStates) {
    if (ts.owner_player_id !== playerId) continue;
    const troops = ts.troop_count ?? 0;
    const mds = MDS_BY_TERRITORY[ts.territory_id] ?? 3; // default MDS=3 for unknown territories
    mvs += troops * mds;
  }
  return mvs;
}

function calcEVS(playerLedger, buildings) {
  const gold = playerLedger?.gold ?? 0;
  let infraValue = 0;
  for (const b of buildings) {
    if (b.status !== 'active') continue;
    infraValue += ECONOMIC_BUILDING_INFRA_VALUE[b.building_type] ?? 0;
  }
  return Math.round(gold + ECONOMIC_INFRA_BONUS_RATE * infraValue);
}

function calcDVS(territoryInfluenceRecords, playerId) {
  // Only permanent influence (TerritoryInfluence.influence_amount).
  // RegionalInfluencePool (spendable) is NEVER included.
  return territoryInfluenceRecords
    .filter(ti => ti.player_id === playerId)
    .reduce((s, ti) => s + (ti.influence_amount ?? 0), 0);
}

// ── Winner determination ──────────────────────────────────────────────────────

function determineWinner(scores, thresholds) {
  const winners = [];
  for (const [playerId, s] of Object.entries(scores)) {
    const milPct  = s.military_score  / thresholds.military;
    const ecoPct  = s.economic_score  / thresholds.economic;
    const dipPct  = s.diplomatic_score / thresholds.diplomatic;
    const maxPct  = Math.max(milPct, ecoPct, dipPct);
    const metConditions = [];
    if (milPct >= 1) metConditions.push({ condition: 'rule_the_world', pct: milPct });
    if (ecoPct >= 1) metConditions.push({ condition: 'own_the_world',  pct: ecoPct });
    if (dipPct >= 1) metConditions.push({ condition: 'lead_the_world', pct: dipPct });
    if (metConditions.length > 0) {
      winners.push({ playerId, maxPct, metConditions, mvs: s.military_score });
    }
  }

  if (winners.length === 0) return null;
  if (winners.length === 1) {
    const w = winners[0];
    const bestCond = w.metConditions.sort((a, b) => b.pct - a.pct)[0];
    return { winner_player_id: w.playerId, winning_condition: bestCond.condition, winning_pct: bestCond.pct };
  }

  // Multiple: highest pct wins; MVS as tiebreaker
  winners.sort((a, b) => b.maxPct - a.maxPct || b.mvs - a.mvs);
  const w = winners[0];
  const bestCond = w.metConditions.sort((a, b) => b.pct - a.pct)[0];
  return { winner_player_id: w.playerId, winning_condition: bestCond.condition, winning_pct: w.maxPct, tiebreaker_used: winners[1].maxPct === w.maxPct };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id } = body;
  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  const [campaigns, players] = await Promise.all([
    base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
    base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
  ]);
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const isAdmin = campaign.admin_user_id === user.id;
  const round = campaign.current_round ?? 1;

  // ── getScores: read current trackers (no recalc) ──────────────────────────
  if (action === 'getScores') {
    const trackers = await base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id });
    return Response.json({ success: true, trackers, thresholds: VICTORY_THRESHOLDS });
  }

  // ── calculateScores: recalculate and upsert VictoryTracker for all players ─
  if (action === 'calculateScores') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const [territoryStates, resourceLedgers, economicBuildings, territoryInfluence] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
    ]);

    const activePlayers = players.filter(p => !p.is_eliminated);
    const existingTrackers = await base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id });
    const scores = {};
    const phase = campaign.current_phase ?? 'fortify';

    for (const player of activePlayers) {
      const ledger = resourceLedgers.find(l => l.player_id === player.id);
      const playerEcoBuildings = economicBuildings.filter(
        b => b.player_id === player.id && b.pillar_type === 'economic'
      );

      const mvs = calcMVS(territoryStates, player.id);
      const evs = calcEVS(ledger, playerEcoBuildings);
      const dvs = calcDVS(territoryInfluence, player.id);

      scores[player.id] = { military_score: mvs, economic_score: evs, diplomatic_score: dvs };

      // Win condition progress
      const activeWinConditions = campaign.settings?.active_win_conditions ?? ['rule_the_world'];
      const winCondJson = {};
      if (activeWinConditions.includes('rule_the_world')) {
        winCondJson.rule_the_world = { score: mvs, threshold: VICTORY_THRESHOLDS.military, met: mvs >= VICTORY_THRESHOLDS.military, pct: mvs / VICTORY_THRESHOLDS.military };
      }
      if (activeWinConditions.includes('own_the_world')) {
        winCondJson.own_the_world = { score: evs, threshold: VICTORY_THRESHOLDS.economic, met: evs >= VICTORY_THRESHOLDS.economic, pct: evs / VICTORY_THRESHOLDS.economic };
      }
      if (activeWinConditions.includes('lead_the_world')) {
        winCondJson.lead_the_world = { score: dvs, threshold: VICTORY_THRESHOLDS.diplomatic, met: dvs >= VICTORY_THRESHOLDS.diplomatic, pct: dvs / VICTORY_THRESHOLDS.diplomatic };
      }

      const existing = existingTrackers.find(t => t.player_id === player.id);
      const trackerData = {
        occupancy_score:          mvs,
        wealth_score:             evs,
        influence_score:          dvs,
        active_win_conditions_json: winCondJson,
        updated_at_round:         round,
        updated_at_phase:         phase,
      };

      if (existing) {
        await base44.asServiceRole.entities.VictoryTracker.update(existing.id, trackerData);
      } else {
        await base44.asServiceRole.entities.VictoryTracker.create({
          campaign_id, player_id: player.id, has_won: false, ...trackerData,
        });
      }
    }

    return Response.json({ success: true, scores, thresholds: VICTORY_THRESHOLDS, round });
  }

  // ── checkVictory: calculate + check for winner, update campaign if won ─────
  if (action === 'checkVictory') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    // First recalculate scores (inline, no double fetch)
    const [territoryStates, resourceLedgers, economicBuildings, territoryInfluence] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
    ]);

    const activePlayers = players.filter(p => !p.is_eliminated);
    const existingTrackers = await base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id });
    const scores = {};
    const phase = campaign.current_phase ?? 'fortify';
    const activeWinConditions = campaign.settings?.active_win_conditions ?? ['rule_the_world'];

    for (const player of activePlayers) {
      const ledger = resourceLedgers.find(l => l.player_id === player.id);
      const playerEcoBuildings = economicBuildings.filter(
        b => b.player_id === player.id && b.pillar_type === 'economic'
      );
      const mvs = calcMVS(territoryStates, player.id);
      const evs = calcEVS(ledger, playerEcoBuildings);
      const dvs = calcDVS(territoryInfluence, player.id);
      scores[player.id] = { military_score: mvs, economic_score: evs, diplomatic_score: dvs };

      const winCondJson = {};
      if (activeWinConditions.includes('rule_the_world')) {
        winCondJson.rule_the_world = { score: mvs, threshold: VICTORY_THRESHOLDS.military, met: mvs >= VICTORY_THRESHOLDS.military, pct: mvs / VICTORY_THRESHOLDS.military };
      }
      if (activeWinConditions.includes('own_the_world')) {
        winCondJson.own_the_world  = { score: evs, threshold: VICTORY_THRESHOLDS.economic, met: evs >= VICTORY_THRESHOLDS.economic, pct: evs / VICTORY_THRESHOLDS.economic };
      }
      if (activeWinConditions.includes('lead_the_world')) {
        winCondJson.lead_the_world = { score: dvs, threshold: VICTORY_THRESHOLDS.diplomatic, met: dvs >= VICTORY_THRESHOLDS.diplomatic, pct: dvs / VICTORY_THRESHOLDS.diplomatic };
      }

      const existing = existingTrackers.find(t => t.player_id === player.id);
      const trackerData = { occupancy_score: mvs, wealth_score: evs, influence_score: dvs, active_win_conditions_json: winCondJson, updated_at_round: round, updated_at_phase: phase };
      if (existing) {
        await base44.asServiceRole.entities.VictoryTracker.update(existing.id, trackerData);
      } else {
        await base44.asServiceRole.entities.VictoryTracker.create({ campaign_id, player_id: player.id, has_won: false, ...trackerData });
      }
    }

    // Determine winner
    const winner = determineWinner(scores, VICTORY_THRESHOLDS);

    if (winner) {
      // Mark winning tracker
      const winTracker = existingTrackers.find(t => t.player_id === winner.winner_player_id);
      if (winTracker) {
        await base44.asServiceRole.entities.VictoryTracker.update(winTracker.id, {
          has_won: true,
          winning_condition: winner.winning_condition,
        });
      }
      // Advance campaign to complete
      await base44.asServiceRole.entities.Campaign.update(campaign_id, {
        current_phase: 'complete',
        status: 'complete',
      });
      // Log
      await base44.asServiceRole.entities.SetupLog.create({
        campaign_id, phase, round,
        event_type: 'campaign_victory',
        player_id: winner.winner_player_id,
        payload: { winning_condition: winner.winning_condition, winning_pct: winner.winning_pct, tiebreaker_used: winner.tiebreaker_used ?? false },
        is_public: true,
      });
    }

    return Response.json({
      success: true,
      winner: winner ?? null,
      scores,
      thresholds: VICTORY_THRESHOLDS,
      campaign_complete: !!winner,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});