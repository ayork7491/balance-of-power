/**
 * battlePhase — backend handler for BattleCard lifecycle.
 *
 * Actions:
 *   getBattleCards      — list battle cards for a campaign (current round + any delayed from prior rounds)
 *   submitResult        — submit tabletop battle result (admin only)
 *   approveResult       — approve or flag a submitted result (uses acting_as_player_id for perspective)
 *   adminOverride       — admin clears flags and forces result into awaiting_approval (unstuck)
 *   autoResolve         — force auto-resolve a specific battle card (admin)
 *   setDelayed          — admin: delay a battle (pause resolution)
 *   setForfeited        — admin: mark battle as forfeited (winner by forfeit, retains all committed troops)
 *   voteDelay           — participant: vote to delay this battle (uses acting_as_player_id for perspective)
 *   processPhaseEnd     — admin: auto-resolve all pending battles, apply all results,
 *                         carry delayed battles to next round, update territory states,
 *                         check eliminations, advance phase.
 *
 * ─── RESOLUTION PIPELINE ─────────────────────────────────────────────────────
 *   pending → awaiting_result → result_submitted → awaiting_approval → resolved
 *   pending → auto_resolved (admin force or timeout)
 *   pending → delayed (admin set or majority vote) → carried to next battle phase
 *   pending → forfeited (admin set)
 *
 * ─── TERRITORY RESOLUTION MATRIX ────────────────────────────────────────────
 *   skirmish            (attackPhase): attacker always wins if target is neutral/vacated.
 *                         If target is defended (defender has troops left) → auto-resolved here:
 *                         Winner gains territory + survivors. Loser troops are lost.
 *   siege               (battlePhase): winner gains territory + survivors occupy it.
 *                         If defender wins, they keep territory + survivors stay.
 *                         Attacker's committed troops were already removed from origin.
 *   double_siege        (battlePhase): same as siege.
 *   capture_objectives  (battlePhase): winner gains territory + survivors occupy it.
 *                         LOSER survivors return to their origin territory.
 *                         (No single "defender" — multiple attackers vs neutral/vacated.)
 *   bloodbath           (battlePhase): if loser had garrison (territory still has troops)
 *                         → loser keeps territory, winner survivors return to origin.
 *                         if loser committed ALL troops (territory is empty)
 *                         → winner captures loser's territory, survivors at origin.
 *
 * ─── SURVIVOR MATH ───────────────────────────────────────────────────────────
 *   surviving_tabletop_troops (submitted value) ≤ winner's committed tabletop troops
 *   surviving_full_scale = round(surviving_tabletop / tabletop_size * total_troops_in_battle)
 *
 * ─── FORFEIT SURVIVORS ───────────────────────────────────────────────────────
 *   Forfeit winner retains ALL their committed troops (no random reduction).
 *
 * ─── DELAYED BATTLE LIFECYCLE ────────────────────────────────────────────────
 *   Round N: Battle card created → player votes/admin sets delayed
 *   processPhaseEnd(N): delayed cards are NOT resolved; result_applied stays false.
 *                       Card status remains 'delayed'. Phase advances normally.
 *   Round N+1: getBattleCards returns BOTH current round cards AND delayed cards.
 *              Delayed cards are active again and can be resolved.
 *   processPhaseEnd(N+1): delayed cards resolved normally (or carried again).
 *
 * ─── TERRITORY LOCKING ───────────────────────────────────────────────────────
 *   Territories involved in delayed battles are locked (stored in campaign.locked_territory_ids).
 *   Deploy, attack, fortify, and construction must check this list.
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

/**
 * Get winner's committed troops (full-scale) for a given player_id.
 */
function getWinnerCommittedTroops(card, winnerPlayerId) {
  if (!winnerPlayerId) return 0;
  const total = (card.attackers ?? [])
    .filter(a => a.player_id === winnerPlayerId)
    .reduce((s, a) => s + (a.committed_troops ?? 0), 0);
  if (total === 0 && card.defender_player_id === winnerPlayerId) {
    return card.defender_troops ?? 0;
  }
  return total;
}

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
 * TERRITORY RESOLUTION MATRIX (full):
 *
 * siege / double_siege:
 *   - Winner gains target_territory with survivors.
 *   - If winner is attacker: survivors placed in target territory.
 *   - If winner is defender: survivors stay in target territory (they held it).
 *   - Attacker's committed troops were already removed from origin (attackPhase).
 *
 * capture_objectives (no defender — neutral/vacated territory):
 *   - Winner gains target_territory with survivors.
 *   - ALL LOSERS: their committed troops return to their origin territories.
 *     (Losers aren't fully eliminated — they just lose the contest.)
 *
 * bloodbath (is_mutual):
 *   - winner's origin territory: survivors return there.
 *   - loser's origin territory:
 *     - if still has garrison → loser keeps it, no change.
 *     - if vacated (loser committed all troops) → winner captures it with 0 troops there
 *       (survivors are already placed at winner's origin above).
 *
 * Returns an array of { id, owner_player_id, troop_count } to persist.
 */
function buildTerritoryUpdates(card, result, territoryStates) {
  const { winner_player_id, surviving_tabletop_troops } = result;
  if (!winner_player_id) return [];

  const survivingTroops = scaleBackSurvivors(
    surviving_tabletop_troops ?? 0,
    card.tabletop_size ?? 1,
    card.total_troops_in_battle ?? 0,
  );

  const updates = [];

  if (card.is_mutual) {
    // ── Bloodbath ──────────────────────────────────────────────────────────────
    const winnerEntry  = (card.attackers ?? []).find(a => a.player_id === winner_player_id);
    const loserEntries = (card.attackers ?? []).filter(a => a.player_id !== winner_player_id);

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

    for (const loserEntry of loserEntries) {
      const loserOriginState = territoryStates.find(s => s.territory_id === loserEntry.origin_territory_id);
      if (loserOriginState) {
        const loserHasGarrison = (loserOriginState.troop_count ?? 0) > 0 &&
          loserOriginState.owner_player_id === loserEntry.player_id;

        if (!loserHasGarrison) {
          // Loser committed all troops — winner captures the empty territory
          updates.push({
            id: loserOriginState.id,
            territory_id: loserEntry.origin_territory_id,
            owner_player_id: winner_player_id,
            troop_count: 0,
          });
        }
        // If loser has garrison: no change to loser's territory
      }
    }

  } else if (card.battle_type === 'capture_objectives') {
    // ── Capture Objectives ────────────────────────────────────────────────────
    // Winner gains target territory with survivors.
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) {
      updates.push({
        id:              targetState.id,
        territory_id:    card.target_territory_id,
        owner_player_id: winner_player_id,
        troop_count:     survivingTroops,
      });
    }

    // Losers: committed troops return to their origin territories.
    // Losers are all attackers except the winner.
    for (const atk of (card.attackers ?? [])) {
      if (atk.player_id === winner_player_id) continue;
      // Return loser's committed troops to their origin territory
      const loserOriginState = territoryStates.find(s => s.territory_id === atk.origin_territory_id);
      if (loserOriginState) {
        // Scale loser survivors: full committed troops (they lost the battle but weren't eliminated)
        // Loser survivors = their committed troops (no reduction — they just lose the capture contest)
        const loserSurvivors = atk.committed_troops ?? 0;
        updates.push({
          id:              loserOriginState.id,
          territory_id:    atk.origin_territory_id,
          owner_player_id: atk.player_id,
          troop_count:     (loserOriginState.troop_count ?? 0) + loserSurvivors,
        });
      }
    }

  } else {
    // ── Siege / double_siege ──────────────────────────────────────────────────
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
    // Loser's committed troops were already removed from origin in attackPhase — no further action.
  }

  return updates;
}

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

/**
 * Compute the set of territory_ids that should be locked due to delayed battles.
 * Includes all territories involved in any unresolved delayed battle card.
 */
function computeLockedTerritoryIds(allDelayedCards) {
  const locked = new Set();
  for (const card of allDelayedCards) {
    locked.add(card.target_territory_id);
    for (const atk of (card.attackers ?? [])) {
      locked.add(atk.origin_territory_id);
    }
  }
  return [...locked];
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

  // ── Resolve effective player (perspective selector support) ──────────────────
  // For participant-scoped actions (approve, vote), acting_as_player_id overrides myPlayer.
  // Admin can act as test players.
  function resolveEffectivePlayer(acting_as_player_id) {
    if (!acting_as_player_id) return { ok: true, player: myPlayer };
    const target = players.find(p => p.id === acting_as_player_id);
    if (!target) return { ok: false, error: 'Invalid acting_as_player_id' };
    if (target.id === myPlayer.id) return { ok: true, player: myPlayer };
    const isTestPlayer = target.is_test_player === true;
    if (user.role === 'admin') return { ok: true, player: target };
    if (myPlayer.is_admin && isTestPlayer) return { ok: true, player: target };
    return { ok: false, error: 'You can only act as test players' };
  }

  // ── getBattleCards ────────────────────────────────────────────────────────────
  // Returns current-round cards PLUS any unresolved delayed cards from prior rounds.
  if (action === 'getBattleCards') {
    const queryRound = body.round ?? round;
    const currentCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: queryRound });

    // Also fetch delayed cards from prior rounds that haven't been resolved yet
    let delayedFromPriorRounds = [];
    if (queryRound > 1) {
      // Fetch all cards for this campaign (we'll filter client-side for delayed status)
      // Use a simple approach: check recent prior rounds (up to 10 rounds back)
      for (let r = queryRound - 1; r >= Math.max(1, queryRound - 10); r--) {
        const priorCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: r });
        const delayed = priorCards.filter(c => c.status === 'delayed' && !c.result_applied);
        delayedFromPriorRounds = [...delayedFromPriorRounds, ...delayed];
        if (delayed.length === 0 && priorCards.length === 0) break; // no cards in this round, stop searching
      }
    }

    return Response.json({ battle_cards: [...currentCards, ...delayedFromPriorRounds] });
  }

  // ── submitResult ─────────────────────────────────────────────────────────────
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

    await log(base44, campaign_id, card.round, 'battle_result_submitted', myPlayer.id, {
      battle_card_id,
      target_territory_id: card.target_territory_id,
      winner_player_id,
      surviving_tabletop_troops: clampedSurvivors,
    }, true);

    return Response.json({ success: true, status: 'result_submitted' });
  }

  // ── approveResult ─────────────────────────────────────────────────────────────
  if (action === 'approveResult') {
    const { battle_card_id, approved, flagged, acting_as_player_id } = body;
    if (!battle_card_id || approved == null) {
      return Response.json({ error: 'battle_card_id and approved required' }, { status: 400 });
    }

    // Resolve effective player via perspective selector
    const effective = resolveEffectivePlayer(acting_as_player_id);
    if (!effective.ok) return Response.json({ error: effective.error }, { status: 403 });
    const effectivePlayer = effective.player;

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(effectivePlayer.id) && !isAdmin) {
      return Response.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    if (!['result_submitted', 'awaiting_approval'].includes(card.status)) {
      return Response.json({ error: `Cannot approve card in status: ${card.status}` }, { status: 400 });
    }

    const currentApprovals = card.approvals ?? [];
    const existingIdx = currentApprovals.findIndex(a => a.player_id === effectivePlayer.id);
    const approvalRecord = { player_id: effectivePlayer.id, approved: !!approved, flagged: !!flagged, at: new Date().toISOString() };
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

        await log(base44, campaign_id, card.round, 'battle_result_applied', null, {
          battle_card_id,
          target_territory_id: card.target_territory_id,
          winner_player_id: result.winner_player_id,
          territory_updates: updates.length,
        }, true);

        // Refresh locked territories after resolution
        await refreshLockedTerritories(base44, campaign_id);
      }
    }

    await log(base44, campaign_id, card.round, 'battle_result_approved', effectivePlayer.id, {
      battle_card_id, approved, flagged: !!flagged, new_status: newStatus,
      acting_as: acting_as_player_id ?? null,
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
        await refreshLockedTerritories(base44, campaign_id);
      }

      await log(base44, campaign_id, card.round, 'battle_admin_override_resolved', myPlayer.id, {
        battle_card_id, winner_player_id: card.result.winner_player_id,
      }, true);

      return Response.json({ success: true, status: 'resolved' });
    } else {
      const clearedApprovals = (card.approvals ?? []).map(a => ({ ...a, flagged: false }));
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status:    'result_submitted',
        approvals: clearedApprovals,
      });

      await log(base44, campaign_id, card.round, 'battle_flags_cleared', myPlayer.id, { battle_card_id }, true);

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

    await refreshLockedTerritories(base44, campaign_id);

    await log(base44, campaign_id, card.round, 'battle_auto_resolved', null, {
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

    const newStatus = delayed ? 'delayed' : 'awaiting_result';
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status: newStatus,
      ...(delayed ? { delayed_at: new Date().toISOString() } : { delayed_at: null }),
    });

    // Refresh locked territories whenever a battle is delayed/undelayed
    await refreshLockedTerritories(base44, campaign_id);

    await log(base44, campaign_id, card.round, 'battle_delay_toggled', null, { battle_card_id, delayed }, true);

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

      await refreshLockedTerritories(base44, campaign_id);

      await log(base44, campaign_id, card.round, 'battle_forfeited', null, {
        battle_card_id, winner_player_id,
      }, true);

      return Response.json({ success: true, result: forfeitResult });
    } else {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'awaiting_result',
        resolved_at: null,
        result: {},
        result_applied: false,
      });
      await refreshLockedTerritories(base44, campaign_id);
      await log(base44, campaign_id, card.round, 'battle_forfeit_cleared', null, { battle_card_id }, true);
      return Response.json({ success: true, status: 'awaiting_result' });
    }
  }

  // ── voteDelay ─────────────────────────────────────────────────────────────────
  if (action === 'voteDelay') {
    const { battle_card_id, vote, acting_as_player_id } = body;
    if (!battle_card_id || !['yes', 'no'].includes(vote)) {
      return Response.json({ error: 'battle_card_id and vote (yes|no) required' }, { status: 400 });
    }

    // Resolve effective player via perspective selector
    const effective = resolveEffectivePlayer(acting_as_player_id);
    if (!effective.ok) return Response.json({ error: effective.error }, { status: 403 });
    const effectivePlayer = effective.player;

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(effectivePlayer.id) && !isAdmin) {
      return Response.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    if (!['pending', 'awaiting_result'].includes(card.status)) {
      return Response.json({ error: `Cannot vote delay for card in status: ${card.status}` }, { status: 400 });
    }

    const currentVotes = { ...(card.delay_votes ?? {}) };
    currentVotes[effectivePlayer.id] = vote;

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

    // If battle just became delayed, refresh locked territories
    if (newStatus === 'delayed') {
      await refreshLockedTerritories(base44, campaign_id);
    }

    await log(base44, campaign_id, card.round, 'battle_delay_vote', effectivePlayer.id, {
      battle_card_id, vote, yes_count: yesVotes, no_count: noVotes, new_status: newStatus,
      acting_as: acting_as_player_id ?? null,
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

    // Fetch current-round cards + any active delayed cards from prior rounds
    const currentRoundCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round });

    // Fetch delayed cards from prior rounds
    let priorDelayedCards = [];
    for (let r = round - 1; r >= Math.max(1, round - 10); r--) {
      const priorCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: r });
      const delayed = priorCards.filter(c => c.status === 'delayed' && !c.result_applied);
      priorDelayedCards = [...priorDelayedCards, ...delayed];
      if (priorCards.length === 0) break;
    }

    const allCards = [...currentRoundCards, ...priorDelayedCards];

    let resolvedCount     = 0;
    let autoResolvedCount = 0;
    let forfeitedCount    = 0;
    let delayedCount      = 0;

    for (const card of allCards) {
      if (card.result_applied) {
        if (['resolved', 'auto_resolved', 'forfeited'].includes(card.status)) resolvedCount++;
        if (card.status === 'delayed') delayedCount++;
        continue;
      }

      if (card.status === 'delayed') {
        // Delayed battle: carry forward to next round.
        // Do NOT set result_applied — keep it unresolved so it appears in the next battle phase.
        // Simply log the carry and move on.
        delayedCount++;
        await log(base44, campaign_id, round, 'battle_delayed_carried', null, {
          battle_card_id: card.id,
          target_territory_id: card.target_territory_id,
          original_round: card.round,
          carrying_to_round: round + 1,
        }, true);
        continue; // Do NOT mark result_applied — it needs to be active next round
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

    // After resolving, recompute locked territories (only remaining delayed cards stay locked)
    await refreshLockedTerritories(base44, campaign_id);

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

/**
 * Recompute and persist the locked territory list for a campaign.
 * Locked = territories involved in any currently-delayed (unresolved) battle card.
 * Persisted to campaign.locked_territory_ids for fast client-side checks.
 */
async function refreshLockedTerritories(base44, campaign_id) {
  // Gather all unresolved delayed cards across all rounds for this campaign
  const allCampaignCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id });
  const delayedCards = allCampaignCards.filter(c => c.status === 'delayed' && !c.result_applied);
  const lockedIds = computeLockedTerritoryIds(delayedCards);
  await base44.asServiceRole.entities.Campaign.update(campaign_id, {
    locked_territory_ids: lockedIds,
  });
}