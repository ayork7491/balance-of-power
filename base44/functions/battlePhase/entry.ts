/**
 * battlePhase — backend handler for BattleCard lifecycle.
 *
 * Actions:
 *   getBattleCards      — list all battle cards for a campaign round (public, any player)
 *   submitResult        — submit tabletop battle result (admin or participant)
 *   approveResult       — approve or flag a submitted result (participant)
 *   autoResolve         — force auto-resolve a specific battle card (admin)
 *   setDelayed          — admin: delay a battle (pause resolution)
 *   setForfeited        — admin: mark battle as forfeited (winner by forfeit)
 *   voteDelay           — participant: vote to delay this battle (requires majority)
 *   processPhaseEnd     — admin: auto-resolve all pending battles, apply all results,
 *                         update territory states, check eliminations, advance phase.
 *
 * ─── LIFECYCLE ───────────────────────────────────────────────────────────────
 *   pending → awaiting_result → result_submitted → awaiting_approval → resolved
 *   pending → auto_resolved (admin force or timeout)
 *   pending → delayed (admin set or majority vote)
 *   pending → forfeited (admin set)
 *
 * ─── BLOODBAH V1 RULE ────────────────────────────────────────────────────────
 *   Winner captures BOTH contested territories.
 *   Surviving troops are placed in the target_territory_id (lex-first).
 *   The winner's origin territory remains empty/unclaimed unless separately reinforced.
 *   This prevents troop duplication — survivors go to ONE territory only.
 *
 * ─── MULTI-ATTACKER HANDLING ─────────────────────────────────────────────────
 *   double_siege / capture_objectives: each attacker is a separate side.
 *   Winner can be ANY participant (attacker or defender).
 *   If an attacker wins, they capture the target territory.
 *   Multi-attacker cards do NOT collapse to first attacker — winner is explicit.
 *
 * ─── RESULT APPLICATION ──────────────────────────────────────────────────────
 *   result_applied flag prevents double-application during phase end.
 *   Territory updates are applied ONCE when processPhaseEnd runs.
 *
 * ─── SCALING ─────────────────────────────────────────────────────────────────
 *   surviving_full_scale = round(surviving_tabletop / tabletop_size * total_troops_in_battle)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Inline pure rules helpers ───────────────────────────────────────────────

function scaleBackSurvivors(survivingTabletop, tabletopSize, totalTroopsInBattle) {
  if (tabletopSize <= 0) return 0;
  const ratio = Math.max(0, survivingTabletop / tabletopSize);
  return Math.round(ratio * totalTroopsInBattle);
}

function calcBattleScaling(totalTroops, avgBattleSize = 1000) {
  const scaleFactor  = Math.max(totalTroops / avgBattleSize, 1);
  const tabletopSize = Math.round(totalTroops / scaleFactor);
  return { scale_factor: parseFloat(scaleFactor.toFixed(4)), tabletop_size: tabletopSize };
}

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

function autoResolveBattle(card, campaignId) {
  const rng  = seededRandom(`${campaignId}:${card.round}:${card.id}`);
  const sides = buildSides(card);

  if (sides.length === 0) {
    return { winner_player_id: null, surviving_tabletop_troops: 0, notes: 'No participants — auto-resolved.', result_source: 'auto' };
  }

  const totalWeight = sides.reduce((s, side) => s + side.troops, 0);
  let r = rng() * totalWeight;
  let winner = sides[sides.length - 1];
  for (const side of sides) {
    r -= side.troops;
    if (r <= 0) { winner = side; break; }
  }

  const retainRatio    = 0.6 + rng() * 0.3;
  const winnerTabletop = Math.round(winner.tabletop_troops * retainRatio);

  return {
    winner_player_id:          winner.player_id,
    surviving_tabletop_troops: winnerTabletop,
    notes:                     'Auto-resolved: timed out or forced by admin.',
    result_source:             'auto',
  };
}

function buildSides(card) {
  const sides       = [];
  const tabletopSize = card.tabletop_size ?? 0;
  const totalTroops  = card.total_troops_in_battle ?? 1;
  const toTabletop   = (t) => totalTroops > 0 ? Math.round((t / totalTroops) * tabletopSize) : 0;

  if (card.is_mutual) {
    // Bloodbath: each attacker is a separate side
    for (const atk of (card.attackers ?? [])) {
      sides.push({ player_id: atk.player_id, troops: atk.committed_troops, tabletop_troops: toTabletop(atk.committed_troops) });
    }
  } else {
    // siege / double_siege / capture_objectives: each attacker separate, defender separate
    for (const atk of (card.attackers ?? [])) {
      sides.push({ player_id: atk.player_id, troops: atk.committed_troops, tabletop_troops: toTabletop(atk.committed_troops) });
    }
    if (card.defender_player_id && (card.defender_troops ?? 0) > 0) {
      sides.push({ player_id: card.defender_player_id, troops: card.defender_troops, tabletop_troops: toTabletop(card.defender_troops) });
    }
  }
  return sides;
}

function getParticipantIds(card) {
  const ids = new Set();
  for (const atk of (card.attackers ?? [])) { if (atk.player_id) ids.add(atk.player_id); }
  if (card.defender_player_id) ids.add(card.defender_player_id);
  return [...ids];
}

function getBloodbathTerritories(card) {
  const territories = new Set([card.target_territory_id]);
  for (const atk of (card.attackers ?? [])) territories.add(atk.origin_territory_id);
  return [...territories];
}

/**
 * Apply a resolved result to territory states.
 * BLOODBATH V1: Winner captures BOTH territories, survivors placed in target_territory_id ONLY.
 * Winner's origin remains empty unless separately reinforced.
 */
function applyResultToTerritories(card, result, territoryStates) {
  const { winner_player_id, surviving_tabletop_troops } = result;
  const survivingTroops = scaleBackSurvivors(
    surviving_tabletop_troops ?? 0,
    card.tabletop_size ?? 1,
    card.total_troops_in_battle ?? 0,
  );

  const updates = [];

  if (card.is_mutual) {
    // BLOODBATH V1: Winner captures both, survivors go to target_territory_id ONLY
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) {
      updates.push({ id: targetState.id, owner_player_id: winner_player_id, troop_count: survivingTroops });
    }
    // Winner's origin territory is NOT updated here — it remains empty/unclaimed
    // (already vacated during attack phase end)
  } else {
    // siege / double_siege / capture_objectives
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) {
      updates.push({
        id:              targetState.id,
        owner_player_id: winner_player_id,
        troop_count:     survivingTroops,
      });
    }
  }
  return updates;
}

async function log(base44, campaignId, round, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase: 'battle',
    round,
    event_type: eventType,
    player_id: playerId ?? null,
    payload,
    is_public: isPublic,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id } = body;
  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  let campaigns = [], players = [];
  try {
    [campaigns, players] = await Promise.all([
      base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
      base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
    ]);
  } catch (_) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const round    = campaign.current_round ?? 1;
  const isAdmin  = campaign.admin_user_id === user.id;

  // ── ACTION: getBattleCards ────────────────────────────────────────────────────
  if (action === 'getBattleCards') {
    const queryRound = body.round ?? round;
    const cards = await base44.asServiceRole.entities.BattleCard.filter({
      campaign_id,
      round: queryRound,
    });
    return Response.json({ battle_cards: cards });
  }

  // ── ACTION: submitResult ──────────────────────────────────────────────────────
  if (action === 'submitResult') {
    const { battle_card_id, winner_player_id, surviving_tabletop_troops, notes } = body;
    if (!battle_card_id || winner_player_id == null || surviving_tabletop_troops == null) {
      return Response.json({ error: 'battle_card_id, winner_player_id, surviving_tabletop_troops required' }, { status: 400 });
    }

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    if (!isAdmin && !participantIds.includes(myPlayer.id)) {
      return Response.json({ error: 'You are not a participant in this battle' }, { status: 403 });
    }

    if (!['pending', 'awaiting_result', 'delayed'].includes(card.status)) {
      return Response.json({ error: `Cannot submit result for card in status: ${card.status}` }, { status: 400 });
    }

    if (!participantIds.includes(winner_player_id)) {
      return Response.json({ error: 'Winner must be a participant in this battle' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status: 'result_submitted',
      result: {
        winner_player_id,
        surviving_tabletop_troops: Math.max(0, Math.round(surviving_tabletop_troops)),
        notes: notes ?? '',
        submitted_by: myPlayer.id,
        submitted_at: now,
        result_source: 'manual',
        applied_at: null,
      },
    });

    await log(base44, campaign_id, round, 'battle_result_submitted', myPlayer.id, {
      battle_card_id,
      target_territory_id: card.target_territory_id,
      winner_player_id,
      surviving_tabletop_troops,
    }, true);

    return Response.json({ success: true, status: 'result_submitted' });
  }

  // ── ACTION: approveResult ─────────────────────────────────────────────────────
  if (action === 'approveResult') {
    const { battle_card_id, approved, flagged } = body;
    if (!battle_card_id || approved == null) {
      return Response.json({ error: 'battle_card_id and approved required' }, { status: 400 });
    }

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(myPlayer.id) && !isAdmin) {
      return Response.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    if (!['result_submitted', 'awaiting_approval'].includes(card.status)) {
      return Response.json({ error: `Cannot approve card in status: ${card.status}` }, { status: 400 });
    }

    const currentApprovals = card.approvals ?? [];
    const existingIdx = currentApprovals.findIndex(a => a.player_id === myPlayer.id);
    const approvalRecord = { player_id: myPlayer.id, approved: !!approved, flagged: !!flagged, at: new Date().toISOString() };
    const updatedApprovals = existingIdx >= 0
      ? currentApprovals.map((a, i) => i === existingIdx ? approvalRecord : a)
      : [...currentApprovals, approvalRecord];

    const submittedBy  = card.result?.submitted_by;
    const otherParticipants = participantIds.filter(pid => pid !== submittedBy);
    const allApproved  = otherParticipants.every(pid => updatedApprovals.find(a => a.player_id === pid && a.approved));
    const anyFlagged   = updatedApprovals.some(a => a.flagged);

    let newStatus = anyFlagged ? 'awaiting_approval' : (allApproved ? 'resolved' : 'awaiting_approval');

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      approvals: updatedApprovals,
      status:    newStatus,
      ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    });

    await log(base44, campaign_id, round, 'battle_result_approved', myPlayer.id, {
      battle_card_id,
      approved,
      flagged: !!flagged,
      new_status: newStatus,
    }, true);

    return Response.json({ success: true, status: newStatus, all_approved: allApproved });
  }

  // ── ACTION: autoResolve ───────────────────────────────────────────────────────
  if (action === 'autoResolve') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });

    const autoResult = autoResolveBattle(card, campaign_id);

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status:      'auto_resolved',
      resolved_at: new Date().toISOString(),
      result:      { ...autoResult, submitted_by: 'system', submitted_at: new Date().toISOString(), applied_at: null },
    });

    // Apply territory changes immediately for admin auto-resolve
    const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const updates = applyResultToTerritories(card, autoResult, territoryStates);
    for (const upd of updates) {
      await base44.asServiceRole.entities.TerritoryState.update(upd.id, {
        owner_player_id: upd.owner_player_id,
        troop_count:     upd.troop_count,
      });
    }

    // Mark result as applied
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { result_applied: true });

    await log(base44, campaign_id, round, 'battle_auto_resolved', null, {
      battle_card_id,
      target_territory_id: card.target_territory_id,
      winner_player_id: autoResult.winner_player_id,
    }, true);

    return Response.json({ success: true, result: autoResult });
  }

  // ── ACTION: setDelayed ────────────────────────────────────────────────────────
  if (action === 'setDelayed') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id, delayed } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });

    const newStatus = delayed ? 'delayed' : 'pending';
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status: newStatus,
      ...(delayed ? { resolved_at: null } : {}),
    });

    await log(base44, campaign_id, round, 'battle_delay_toggled', null, {
      battle_card_id,
      delayed,
    }, true);

    return Response.json({ success: true, status: newStatus });
  }

  // ── ACTION: setForfeited ──────────────────────────────────────────────────────
  if (action === 'setForfeited') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id, forfeited, winner_player_id } = body;
    if (!battle_card_id || forfeited == null) {
      return Response.json({ error: 'battle_card_id and forfeited required' }, { status: 400 });
    }

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });

    if (forfeited) {
      if (!winner_player_id) {
        return Response.json({ error: 'winner_player_id required for forfeit' }, { status: 400 });
      }
      const participantIds = getParticipantIds(card);
      if (!participantIds.includes(winner_player_id)) {
        return Response.json({ error: 'Winner must be a participant' }, { status: 400 });
      }

      const forfeitResult = {
        winner_player_id,
        surviving_tabletop_troops: Math.round(card.total_troops_in_battle * 0.8), // 80% survive forfeit
        notes: 'Victory by forfeit.',
        submitted_by: 'admin',
        submitted_at: new Date().toISOString(),
        result_source: 'forfeit',
        applied_at: null,
      };

      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status:      'forfeited',
        resolved_at: new Date().toISOString(),
        result:      forfeitResult,
      });

      // Apply territory changes immediately
      const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      const updates = applyResultToTerritories(card, forfeitResult, territoryStates);
      for (const upd of updates) {
        await base44.asServiceRole.entities.TerritoryState.update(upd.id, {
          owner_player_id: upd.owner_player_id,
          troop_count:     upd.troop_count,
        });
      }

      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { result_applied: true });

      await log(base44, campaign_id, round, 'battle_forfeited', null, {
        battle_card_id,
        winner_player_id,
      }, true);

      return Response.json({ success: true, result: forfeitResult });
    } else {
      // Clear forfeit status
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'pending',
        resolved_at: null,
        result: {},
        result_applied: false,
      });

      await log(base44, campaign_id, round, 'battle_forfeit_cleared', null, {
        battle_card_id,
      }, true);

      return Response.json({ success: true, status: 'pending' });
    }
  }

  // ── ACTION: voteDelay ─────────────────────────────────────────────────────────
  if (action === 'voteDelay') {
    const { battle_card_id, vote } = body;
    if (!battle_card_id || !['yes', 'no'].includes(vote)) {
      return Response.json({ error: 'battle_card_id and vote (yes|no) required' }, { status: 400 });
    }

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(myPlayer.id)) {
      return Response.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    if (!['pending', 'awaiting_result'].includes(card.status)) {
      return Response.json({ error: `Cannot vote delay for card in status: ${card.status}` }, { status: 400 });
    }

    const currentVotes = card.delay_votes ?? {};
    currentVotes[myPlayer.id] = vote;

    // Count votes
    const yesVotes = Object.values(currentVotes).filter(v => v === 'yes').length;
    const noVotes  = Object.values(currentVotes).filter(v => v === 'no').length;
    const totalVotes = yesVotes + noVotes;
    const requiredMajority = Math.ceil(participantIds.length / 2);

    let newStatus = card.status;
    if (yesVotes >= requiredMajority) {
      newStatus = 'delayed';
    } else if (noVotes >= requiredMajority) {
      newStatus = 'awaiting_result'; // Continue normal flow
    }

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status:     newStatus,
      delay_votes: currentVotes,
      ...(newStatus === 'delayed' ? { delayed_at: new Date().toISOString() } : {}),
    });

    await log(base44, campaign_id, round, 'battle_delay_vote', myPlayer.id, {
      battle_card_id,
      vote,
      yes_count: yesVotes,
      no_count: noVotes,
      new_status: newStatus,
    }, true);

    return Response.json({ 
      success: true, 
      status: newStatus, 
      delay_votes: currentVotes,
      majority_reached: yesVotes >= requiredMajority || noVotes >= requiredMajority,
    });
  }

  // ── ACTION: processPhaseEnd ───────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    if (campaign.current_phase !== 'battle') {
      return Response.json({ error: 'Not in battle phase' }, { status: 400 });
    }

    const allCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round });
    const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });

    let resolvedCount   = 0;
    let autoResolvedCount = 0;
    let forfeitedCount = 0;
    let delayedCount = 0;
    const territoryUpdates = [];

    for (const card of allCards) {
      // Skip if already applied or delayed
      if (card.result_applied) {
        continue;
      }

      if (card.status === 'delayed') {
        delayedCount++;
        continue; // Skip delayed battles
      }

      let resultToApply = card.result;

      // Handle forfeited
      if (card.status === 'forfeited' && resultToApply) {
        forfeitedCount++;
        // Apply forfeit result
      }
      // Auto-resolve if not yet resolved
      else if (!resultToApply || !['resolved', 'auto_resolved', 'forfeited'].includes(card.status)) {
        const autoResult = autoResolveBattle(card, campaign_id);
        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          status:      'auto_resolved',
          resolved_at: new Date().toISOString(),
          result:      { ...autoResult, submitted_by: 'system', submitted_at: new Date().toISOString(), result_source: 'auto', applied_at: null },
        });
        resultToApply = autoResult;
        autoResolvedCount++;

        await log(base44, campaign_id, round, 'battle_auto_resolved', null, {
          battle_card_id:      card.id,
          target_territory_id: card.target_territory_id,
          winner_player_id:    autoResult.winner_player_id,
        }, true);
      } else {
        resolvedCount++;
      }

      // Apply territory updates
      if (resultToApply?.winner_player_id != null) {
        const updates = applyResultToTerritories(card, resultToApply, territoryStates);
        territoryUpdates.push(...updates);

        // Mark as applied
        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          result_applied: true,
          result: { ...resultToApply, applied_at: new Date().toISOString() },
        });
      }
    }

    // Apply all territory updates to DB
    for (const upd of territoryUpdates) {
      await base44.asServiceRole.entities.TerritoryState.update(upd.id, {
        owner_player_id: upd.owner_player_id,
        troop_count:     upd.troop_count,
      });
    }

    // Reload updated territory states for elimination check + snapshot
    const finalStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const activePlayers = players.filter(p => !p.is_eliminated);

    // Check eliminations
    const eliminatedNow = [];
    for (const p of activePlayers) {
      const ownedTerritories = finalStates.filter(s => s.owner_player_id === p.id);
      if (ownedTerritories.length === 0) {
        await base44.asServiceRole.entities.CampaignPlayer.update(p.id, {
          is_eliminated: true,
          eliminated_at: new Date().toISOString(),
        });
        eliminatedNow.push(p.id);
        await log(base44, campaign_id, round, 'player_eliminated', p.id, {
          display_name: p.display_name,
        }, true);
      }
    }

    // Phase-end snapshot
    await base44.asServiceRole.entities.PhaseSnapshot.create({
      campaign_id,
      round,
      phase: 'battle',
      snapshot_type: 'phase_end',
      territory_states: finalStates.map(ts => ({
        territory_id:    ts.territory_id,
        owner_player_id: ts.owner_player_id ?? null,
        troop_count:     ts.troop_count ?? 0,
      })),
      player_standings: activePlayers.map(p => {
        const owned = finalStates.filter(ts => ts.owner_player_id === p.id);
        return {
          player_id:       p.id,
          display_name:    p.display_name,
          territory_count: owned.length,
          troop_total:     owned.reduce((s, ts) => s + (ts.troop_count || 0), 0),
          is_eliminated:   eliminatedNow.includes(p.id) || p.is_eliminated,
        };
      }),
    });

    await log(base44, campaign_id, round, 'phase_advanced', null, {
      next_phase:          'fortify',
      round,
      battles_resolved:    resolvedCount,
      battles_auto_resolved: autoResolvedCount,
      battles_forfeited:   forfeitedCount,
      battles_delayed:     delayedCount,
      players_eliminated:  eliminatedNow.length,
    }, true);

    // Advance to fortify phase
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_phase: 'fortify',
    });

    return Response.json({
      success: true,
      next_phase: 'fortify',
      battles_resolved: resolvedCount,
      battles_auto_resolved: autoResolvedCount,
      battles_forfeited: forfeitedCount,
      battles_delayed: delayedCount,
      players_eliminated: eliminatedNow,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});