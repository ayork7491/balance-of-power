/**
 * battlePhase — backend handler for BattleCard lifecycle.
 *
 * Actions:
 *   getBattleCards      — list all battle cards for a campaign round (public, any player)
 *   submitResult        — submit tabletop battle result (admin only)
 *   approveResult       — approve or flag a submitted result (participant)
 *   adminOverride       — admin clears flags and forces result into awaiting_approval (unstuck)
 *   autoResolve         — force auto-resolve a specific battle card (admin)
 *   setDelayed          — admin: delay a battle (pause resolution)
 *   setForfeited        — admin: mark battle as forfeited (winner by forfeit, retains all committed troops)
 *   voteDelay           — participant: vote to delay this battle (requires majority)
 *   processPhaseEnd     — admin: auto-resolve all pending battles, apply all results,
 *                         update territory states, check eliminations, advance phase.
 *
 * ─── RESOLUTION PIPELINE ─────────────────────────────────────────────────────
 *   pending → awaiting_result → result_submitted → awaiting_approval → resolved
 *   pending → auto_resolved (admin force or timeout)
 *   pending → delayed (admin set or majority vote) ← counts as "resolved" for phase advancement
 *   pending → forfeited (admin set)
 *
 * ─── TERRITORY RESOLUTION MATRIX ────────────────────────────────────────────
 *   skirmish            (attackPhase): attacker always wins; troops move into territory.
 *   siege               (battlePhase): winner gains territory; survivors occupy it.
 *   double_siege        (battlePhase): winner gains territory; survivors occupy it.
 *   capture_objectives  (battlePhase): winner gains territory; survivors occupy it.
 *   bloodbath           (battlePhase): if loser had garrison (defender_troops > 0 in card)
 *                         → loser keeps territory, winner survivors return to origin.
 *                         if loser committed ALL troops (defender_troops == 0 in card)
 *                         → winner captures loser's territory, survivors move in.
 *                         In both cases: committed troops already removed from origin (attackPhase).
 *
 * ─── SURVIVOR MATH ───────────────────────────────────────────────────────────
 *   surviving_tabletop_troops (submitted value) ≤ winner's committed tabletop troops
 *   surviving_full_scale = round(surviving_tabletop / tabletop_size * total_troops_in_battle)
 *
 * ─── FORFEIT SURVIVORS ───────────────────────────────────────────────────────
 *   Forfeit winner retains ALL their committed troops (no random reduction).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Pure helpers ──────────────────────────────────────────────────────────────

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
 * Get winner's committed troops (full-scale) for a given player_id.
 * Used for forfeit (winner retains all committed troops).
 */
function getWinnerCommittedTroops(card, winnerPlayerId) {
  if (!winnerPlayerId) return 0;
  // For bloodbath: sum all entries for winner
  const total = (card.attackers ?? [])
    .filter(a => a.player_id === winnerPlayerId)
    .reduce((s, a) => s + (a.committed_troops ?? 0), 0);
  // If winner was the defender (siege), use defender_troops
  if (total === 0 && card.defender_player_id === winnerPlayerId) {
    return card.defender_troops ?? 0;
  }
  return total;
}

/**
 * Convert winner's committed full-scale troops to tabletop scale.
 * survivors_tabletop ≤ this value for validation.
 */
function winnerCommittedTabletop(card, winnerPlayerId) {
  const committed = getWinnerCommittedTroops(card, winnerPlayerId);
  const totalTroops = card.total_troops_in_battle ?? 1;
  const tabletopSize = card.tabletop_size ?? 0;
  if (totalTroops <= 0) return 0;
  return Math.round((committed / totalTroops) * tabletopSize);
}

function buildSides(card) {
  const sides = [];
  const tabletopSize = card.tabletop_size ?? 0;
  const totalTroops  = card.total_troops_in_battle ?? 1;
  const toTabletop   = (t) => totalTroops > 0 ? Math.round((t / totalTroops) * tabletopSize) : 0;

  if (card.is_mutual) {
    for (const atk of (card.attackers ?? [])) {
      sides.push({ player_id: atk.player_id, troops: atk.committed_troops, tabletop_troops: toTabletop(atk.committed_troops) });
    }
  } else {
    for (const atk of (card.attackers ?? [])) {
      sides.push({ player_id: atk.player_id, troops: atk.committed_troops, tabletop_troops: toTabletop(atk.committed_troops) });
    }
    if (card.defender_player_id && (card.defender_troops ?? 0) > 0) {
      sides.push({ player_id: card.defender_player_id, troops: card.defender_troops, tabletop_troops: toTabletop(card.defender_troops) });
    }
  }
  return sides;
}

function autoResolveBattle(card, campaignId) {
  const rng   = seededRandom(`${campaignId}:${card.round}:${card.id}`);
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

  // surviving_tabletop_troops is in TABLETOP scale, clamped to winner's committed tabletop troops
  const retainRatio    = 0.6 + rng() * 0.3;
  const maxSurvivors   = winnerCommittedTabletop(card, winner.player_id);
  const rawSurvivors   = Math.max(1, Math.round((winner.tabletop_troops || 1) * retainRatio));
  const winnerTabletop = Math.min(rawSurvivors, Math.max(1, maxSurvivors));

  return {
    winner_player_id:          winner.player_id,
    surviving_tabletop_troops: winnerTabletop,
    notes:                     'Auto-resolved: timed out or forced by admin.',
    result_source:             'auto',
  };
}

/**
 * Apply a resolved result to territory states.
 *
 * TERRITORY RESOLUTION MATRIX:
 *   siege/double_siege/capture_objectives:
 *     - Winner always gains target_territory with survivors.
 *
 *   bloodbath (is_mutual):
 *     - card.defender_troops stores the LOSER's territory's original garrison.
 *       Wait — bloodbath has no defender_troops field. Instead we use a different signal:
 *       We compare who won vs who was defending each territory.
 *
 *       Each territory in a bloodbath was attacked FROM (origin) and attacked TO (target).
 *       If a player WINS:
 *         - Their own origin territory: committed troops already removed (attackPhase).
 *           Survivors return to origin territory (they still own it unless they committed all).
 *         - Their opponent's territory: they CAPTURE it if opponent committed ALL their troops
 *           (i.e. opponent has no garrison left). Otherwise opponent keeps it.
 *
 *       For simplicity: bloodbath winner captures the loser's territory ONLY.
 *       The winner's own territory remains owned by winner (they were attacked but won).
 *
 * The `card.attackers` array for bloodbath has entries from BOTH sides.
 * We determine:
 *   - winner's territory = where winner's troops came FROM (origin_territory_id of winner's entry)
 *   - loser's territory  = where loser's troops came FROM (origin_territory_id of loser's entry)
 *
 * Returns an array of { id, owner_player_id, troop_count } to persist.
 */
function buildTerritoryUpdates(card, result, territoryStates) {
  const { winner_player_id, surviving_tabletop_troops } = result;
  if (!winner_player_id) return []; // draw → no territory change

  // surviving_tabletop_troops is in tabletop scale → convert to full scale
  const survivingTroops = scaleBackSurvivors(
    surviving_tabletop_troops ?? 0,
    card.tabletop_size ?? 1,
    card.total_troops_in_battle ?? 0,
  );

  const updates = [];

  if (card.is_mutual) {
    // ── Bloodbath resolution ──────────────────────────────────────────────────
    // Find winner's and loser's origin territories from attackers array.
    const winnerEntry  = (card.attackers ?? []).find(a => a.player_id === winner_player_id);
    const loserEntries = (card.attackers ?? []).filter(a => a.player_id !== winner_player_id);

    // Winner's origin territory: survivors return there (winner still owns it).
    if (winnerEntry) {
      const winnerOriginState = territoryStates.find(s => s.territory_id === winnerEntry.origin_territory_id);
      if (winnerOriginState) {
        updates.push({
          id: winnerOriginState.id,
          territory_id: winnerEntry.origin_territory_id,
          owner_player_id: winner_player_id,
          troop_count: survivingTroops,
        });
      }
    }

    // Loser's origin territories: winner captures them (committed troops already removed by attackPhase).
    // The loser's territory is now empty (troops were committed out), so winner captures it.
    for (const loserEntry of loserEntries) {
      const loserOriginState = territoryStates.find(s => s.territory_id === loserEntry.origin_territory_id);
      if (loserOriginState) {
        // If the loser's territory still has garrison troops (they didn't commit all), winner can't capture it.
        // We check current state: if troop_count > 0 and owner is still the loser, they have a garrison.
        const loserHasGarrison = (loserOriginState.troop_count ?? 0) > 0 &&
          loserOriginState.owner_player_id === loserEntry.player_id;

        if (loserHasGarrison) {
          // Loser keeps territory — attacker survivors return to WINNER's origin, already handled above.
          // No change to loser's territory.
        } else {
          // Loser committed all troops (or territory is now empty) — winner captures it.
          // Place 1 troop minimum in captured territory (survivors are at origin, this is capture placeholder).
          // Actually: place 0 there — winner's survivors stay at origin. Territory ownership changes.
          updates.push({
            id: loserOriginState.id,
            territory_id: loserEntry.origin_territory_id,
            owner_player_id: winner_player_id,
            troop_count: 0, // survivors already placed at origin; this just transfers ownership
          });
        }
      }
    }
  } else {
    // ── Siege / double_siege / capture_objectives ─────────────────────────────
    // Winner gains target_territory with survivors.
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) {
      updates.push({
        id:              targetState.id,
        territory_id:    card.target_territory_id,
        owner_player_id: winner_player_id,
        troop_count:     survivingTroops,
      });
    }

    // If defender won a siege (they held their territory), survivors stay in the territory.
    // This is already handled above since winner_player_id = defender and survivors go to target_territory.
    // Nothing extra needed for loser — their committed troops were removed in attackPhase.
  }

  return updates;
}

/**
 * Persist territory updates to the DB.
 */
async function applyTerritoryUpdates(base44, updates) {
  for (const upd of updates) {
    await base44.asServiceRole.entities.TerritoryState.update(upd.id, {
      owner_player_id: upd.owner_player_id,
      troop_count:     upd.troop_count,
    });
  }
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

// ─── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
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

  const round   = campaign.current_round ?? 1;
  const isAdmin = campaign.admin_user_id === user.id;

  // ── getBattleCards ────────────────────────────────────────────────────────────
  if (action === 'getBattleCards') {
    const queryRound = body.round ?? round;
    const cards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: queryRound });
    return Response.json({ battle_cards: cards });
  }

  // ── submitResult ─────────────────────────────────────────────────────────────
  // Admin-only: only campaign admin may enter manual results.
  if (action === 'submitResult') {
    if (!isAdmin) {
      return Response.json({ error: 'Only the campaign admin can submit battle results' }, { status: 403 });
    }

    const { battle_card_id, winner_player_id, surviving_tabletop_troops, notes } = body;
    if (!battle_card_id || winner_player_id == null || surviving_tabletop_troops == null) {
      return Response.json({ error: 'battle_card_id, winner_player_id, surviving_tabletop_troops required' }, { status: 400 });
    }

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    if (!['pending', 'awaiting_result', 'delayed', 'result_submitted', 'awaiting_approval'].includes(card.status)) {
      return Response.json({ error: `Cannot submit result for card in status: ${card.status}` }, { status: 400 });
    }

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(winner_player_id)) {
      return Response.json({ error: 'Winner must be a participant in this battle' }, { status: 400 });
    }

    // ── Survivor validation: cannot exceed winner's committed tabletop troops ──
    const maxTabletop = winnerCommittedTabletop(card, winner_player_id);
    const clampedSurvivors = Math.min(
      Math.max(0, Math.round(surviving_tabletop_troops)),
      Math.max(1, maxTabletop),
    );

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status:    'result_submitted',
      approvals: [],
      result: {
        winner_player_id,
        surviving_tabletop_troops: clampedSurvivors,
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
      surviving_tabletop_troops: clampedSurvivors,
    }, true);

    return Response.json({ success: true, status: 'result_submitted' });
  }

  // ── approveResult ─────────────────────────────────────────────────────────────
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

    const submittedBy       = card.result?.submitted_by;
    const reviewers         = participantIds.filter(pid => pid !== submittedBy);
    const anyFlagged        = updatedApprovals.some(a => a.flagged);
    const allReviewersApproved = reviewers.length === 0 || reviewers.every(
      pid => updatedApprovals.find(a => a.player_id === pid && a.approved && !a.flagged)
    );

    let newStatus = anyFlagged ? 'awaiting_approval' : (allReviewersApproved ? 'resolved' : 'awaiting_approval');

    const updatePayload = {
      approvals: updatedApprovals,
      status:    newStatus,
    };
    if (newStatus === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
    }

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, updatePayload);

    // Apply territory changes immediately when all approve
    if (newStatus === 'resolved' && !card.result_applied) {
      const result = card.result;
      if (result?.winner_player_id) {
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const updates = buildTerritoryUpdates(card, result, territoryStates);
        await applyTerritoryUpdates(base44, updates);
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          result_applied: true,
          result: { ...result, applied_at: new Date().toISOString() },
        });

        await log(base44, campaign_id, round, 'battle_result_applied', null, {
          battle_card_id,
          target_territory_id: card.target_territory_id,
          winner_player_id: result.winner_player_id,
          territory_updates: updates.length,
        }, true);
      }
    }

    await log(base44, campaign_id, round, 'battle_result_approved', myPlayer.id, {
      battle_card_id, approved, flagged: !!flagged, new_status: newStatus,
    }, true);

    return Response.json({ success: true, status: newStatus, all_approved: allReviewersApproved });
  }

  // ── adminOverride ─────────────────────────────────────────────────────────────
  if (action === 'adminOverride') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id, force_resolve } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });

    if (!['awaiting_approval', 'result_submitted'].includes(card.status)) {
      return Response.json({ error: `Cannot override card in status: ${card.status}` }, { status: 400 });
    }

    if (!card.result?.winner_player_id) {
      return Response.json({ error: 'No result to override with — submit a result first' }, { status: 400 });
    }

    if (force_resolve) {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        approvals: [...(card.approvals ?? []), { player_id: myPlayer.id, approved: true, flagged: false, admin_override: true, at: new Date().toISOString() }],
      });

      if (!card.result_applied) {
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const updates = buildTerritoryUpdates(card, card.result, territoryStates);
        await applyTerritoryUpdates(base44, updates);
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          result_applied: true,
          result: { ...card.result, applied_at: new Date().toISOString() },
        });
      }

      await log(base44, campaign_id, round, 'battle_admin_override_resolved', myPlayer.id, {
        battle_card_id, winner_player_id: card.result.winner_player_id,
      }, true);

      return Response.json({ success: true, status: 'resolved' });
    } else {
      const clearedApprovals = (card.approvals ?? []).map(a => ({ ...a, flagged: false }));
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status:    'result_submitted',
        approvals: clearedApprovals,
      });

      await log(base44, campaign_id, round, 'battle_flags_cleared', myPlayer.id, { battle_card_id }, true);

      return Response.json({ success: true, status: 'result_submitted' });
    }
  }

  // ── autoResolve ───────────────────────────────────────────────────────────────
  if (action === 'autoResolve') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });

    if (['resolved', 'auto_resolved', 'forfeited'].includes(card.status) && card.result_applied) {
      return Response.json({ error: 'Battle already resolved and applied' }, { status: 400 });
    }

    const autoResult = autoResolveBattle(card, campaign_id);
    const now = new Date().toISOString();

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status:      'auto_resolved',
      resolved_at: now,
      result:      { ...autoResult, submitted_by: 'system', submitted_at: now, applied_at: null },
    });

    const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const updates = buildTerritoryUpdates(card, autoResult, territoryStates);
    await applyTerritoryUpdates(base44, updates);

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      result_applied: true,
      result: { ...autoResult, submitted_by: 'system', submitted_at: now, applied_at: new Date().toISOString() },
    });

    await log(base44, campaign_id, round, 'battle_auto_resolved', null, {
      battle_card_id,
      target_territory_id: card.target_territory_id,
      winner_player_id: autoResult.winner_player_id,
    }, true);

    return Response.json({ success: true, result: autoResult });
  }

  // ── setDelayed ────────────────────────────────────────────────────────────────
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

    await log(base44, campaign_id, round, 'battle_delay_toggled', null, { battle_card_id, delayed }, true);

    return Response.json({ success: true, status: newStatus });
  }

  // ── setForfeited ──────────────────────────────────────────────────────────────
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

      // Forfeit: winner retains ALL their committed troops (no random reduction).
      // surviving_tabletop_troops = winner's full committed tabletop troops.
      const tabletopSurvivors = winnerCommittedTabletop(card, winner_player_id);

      const forfeitResult = {
        winner_player_id,
        surviving_tabletop_troops: Math.max(1, tabletopSurvivors),
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

      const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      const updates = buildTerritoryUpdates(card, forfeitResult, territoryStates);
      await applyTerritoryUpdates(base44, updates);

      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        result_applied: true,
        result: { ...forfeitResult, applied_at: new Date().toISOString() },
      });

      await log(base44, campaign_id, round, 'battle_forfeited', null, {
        battle_card_id, winner_player_id,
      }, true);

      return Response.json({ success: true, result: forfeitResult });
    } else {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'pending',
        resolved_at: null,
        result: {},
        result_applied: false,
      });
      await log(base44, campaign_id, round, 'battle_forfeit_cleared', null, { battle_card_id }, true);
      return Response.json({ success: true, status: 'pending' });
    }
  }

  // ── voteDelay ─────────────────────────────────────────────────────────────────
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
    if (!participantIds.includes(myPlayer.id) && !isAdmin) {
      return Response.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    if (!['pending', 'awaiting_result'].includes(card.status)) {
      return Response.json({ error: `Cannot vote delay for card in status: ${card.status}` }, { status: 400 });
    }

    const currentVotes = { ...(card.delay_votes ?? {}) };
    currentVotes[myPlayer.id] = vote;

    const yesVotes = Object.values(currentVotes).filter(v => v === 'yes').length;
    const noVotes  = Object.values(currentVotes).filter(v => v === 'no').length;
    const requiredMajority = Math.ceil(participantIds.length / 2);

    let newStatus = card.status;
    if (yesVotes >= requiredMajority) newStatus = 'delayed';
    else if (noVotes >= requiredMajority) newStatus = 'awaiting_result';

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status: newStatus,
      delay_votes: currentVotes,
      ...(newStatus === 'delayed' ? { delayed_at: new Date().toISOString() } : {}),
    });

    await log(base44, campaign_id, round, 'battle_delay_vote', myPlayer.id, {
      battle_card_id, vote, yes_count: yesVotes, no_count: noVotes, new_status: newStatus,
    }, true);

    return Response.json({
      success: true, status: newStatus, delay_votes: currentVotes,
      majority_reached: yesVotes >= requiredMajority || noVotes >= requiredMajority,
    });
  }

  // ── processPhaseEnd ───────────────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    if (campaign.current_phase !== 'battle') {
      return Response.json({ error: 'Not in battle phase' }, { status: 400 });
    }

    const allCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round });

    let resolvedCount     = 0;
    let autoResolvedCount = 0;
    let forfeitedCount    = 0;
    let delayedCount      = 0;

    for (const card of allCards) {
      // Skip cards that were already fully applied
      if (card.result_applied) {
        if (['resolved', 'auto_resolved', 'forfeited'].includes(card.status)) resolvedCount++;
        if (card.status === 'delayed') delayedCount++;
        continue;
      }

      if (card.status === 'delayed') {
        delayedCount++;
        // Delayed battles: mark as applied with no territory change, allow phase to proceed.
        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          result_applied: true,
          result: {
            winner_player_id: null,
            surviving_tabletop_troops: 0,
            notes: 'Battle delayed — territories locked pending next battle phase.',
            result_source: 'delayed',
            applied_at: new Date().toISOString(),
          },
        });
        await log(base44, campaign_id, round, 'battle_delayed_carried', null, {
          battle_card_id: card.id, target_territory_id: card.target_territory_id,
        }, true);
        continue;
      }

      let resultToApply = null;

      if (card.status === 'forfeited' && card.result?.winner_player_id) {
        resultToApply = card.result;
        forfeitedCount++;
      } else if (['resolved', 'auto_resolved'].includes(card.status) && card.result?.winner_player_id) {
        resultToApply = card.result;
        resolvedCount++;
      } else {
        // Auto-resolve anything still pending
        const autoResult = autoResolveBattle(card, campaign_id);
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          status:      'auto_resolved',
          resolved_at: now,
          result:      { ...autoResult, submitted_by: 'system', submitted_at: now, applied_at: null },
        });
        resultToApply = autoResult;
        autoResolvedCount++;

        await log(base44, campaign_id, round, 'battle_auto_resolved', null, {
          battle_card_id:      card.id,
          target_territory_id: card.target_territory_id,
          winner_player_id:    autoResult.winner_player_id,
        }, true);
      }

      // Reload territory states fresh before each card so updates are sequential
      if (resultToApply?.winner_player_id) {
        const freshStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const updates = buildTerritoryUpdates(card, resultToApply, freshStates);
        await applyTerritoryUpdates(base44, updates);

        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          result_applied: true,
          result: { ...resultToApply, applied_at: new Date().toISOString() },
        });
      }
    }

    // Final state for snapshot + elimination check
    const finalStates   = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const activePlayers = players.filter(p => !p.is_eliminated);

    // Elimination check
    const eliminatedNow = [];
    for (const p of activePlayers) {
      const owned = finalStates.filter(s => s.owner_player_id === p.id);
      if (owned.length === 0) {
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
      campaign_id, round, phase: 'battle', snapshot_type: 'phase_end',
      territory_states: finalStates.map(ts => ({
        territory_id: ts.territory_id, owner_player_id: ts.owner_player_id ?? null, troop_count: ts.troop_count ?? 0,
      })),
      player_standings: activePlayers.map(p => {
        const owned = finalStates.filter(ts => ts.owner_player_id === p.id);
        return {
          player_id: p.id, display_name: p.display_name,
          territory_count: owned.length,
          troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0),
          is_eliminated: eliminatedNow.includes(p.id) || p.is_eliminated,
        };
      }),
    });

    await log(base44, campaign_id, round, 'phase_advanced', null, {
      next_phase: 'fortify', round,
      battles_resolved: resolvedCount, battles_auto_resolved: autoResolvedCount,
      battles_forfeited: forfeitedCount, battles_delayed: delayedCount,
      players_eliminated: eliminatedNow.length,
    }, true);

    // Victory detection
    const remainingAfterElim = activePlayers.filter(p => !eliminatedNow.includes(p.id) && !p.is_eliminated);
    let nextPhase = 'fortify';
    let campaignComplete = false;

    if (remainingAfterElim.length <= 1) {
      nextPhase = 'complete';
      campaignComplete = true;
      if (remainingAfterElim.length === 1) {
        const victor = remainingAfterElim[0];
        await log(base44, campaign_id, round, 'campaign_victory', victor.id, {
          display_name: victor.display_name, rounds_played: round, condition: 'domination',
        }, true);
      }
      await base44.asServiceRole.entities.Campaign.update(campaign_id, {
        current_phase: 'complete', status: 'complete',
      });
    } else {
      await base44.asServiceRole.entities.Campaign.update(campaign_id, { current_phase: 'fortify' });
    }

    return Response.json({
      success: true, next_phase: nextPhase, campaign_complete: campaignComplete,
      battles_resolved: resolvedCount, battles_auto_resolved: autoResolvedCount,
      battles_forfeited: forfeitedCount, battles_delayed: delayedCount,
      players_eliminated: eliminatedNow,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});