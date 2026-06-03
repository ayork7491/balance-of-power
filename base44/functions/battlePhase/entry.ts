/**
 * battlePhase — backend handler for BattleCard lifecycle.
 *
 * Actions:
 *   getBattleCards      — list cards (current round + carryover from prior rounds)
 *   setPreference       — participant sets battle resolution preference (replaces voteDelay/voteAutoResolve/playerForfeit)
 *   closeBattleVoting   — admin tallies preferences and applies unanimous outcomes
 *   submitResult        — admin submits tabletop battle result
 *   approveResult       — participant approves/flags a submitted result
 *   adminOverride       — admin force-resolves or clears flags on a stuck card
 *   autoResolve         — admin force-auto-resolves a specific card
 *   setDelayed          — admin directly delays/resumes a card
 *   setForfeited        — admin marks winner by forfeit
 *   voteDelay           — legacy: still supported, maps to setPreference internally
 *   voteAutoResolve     — legacy: still supported, maps to setPreference internally
 *   playerForfeit       — legacy: still supported, maps to setPreference internally
 *   processPhaseEnd     — admin: resolve all pending, carry delayed to next round, advance phase
 *
 * ─── BATTLE PREFERENCE MODEL ─────────────────────────────────────────────────
 *   Each participant has one preference per card: play_tabletop | auto_resolve | delay | forfeit
 *   Default: play_tabletop
 *   Unanimous auto_resolve → auto-resolve card immediately on tally
 *   Unanimous delay        → card set to delayed on tally
 *   Any forfeit            → applied per forfeit rules; remaining players continue
 *   Otherwise              → card stays as tabletop battle
 *
 * ─── CARRYOVER STATE MACHINE ─────────────────────────────────────────────────
 *   Round N:  card created → pending/awaiting_result/delayed
 *   processPhaseEnd(N):  delayed cards → active_carryover (not resolved)
 *   Round N+1: active_carryover cards visible alongside current-round cards
 *   After result submitted on carryover: status → pending_approval
 *   After approval: resolved
 *   Admin cannot advance phase if any active_carryover or pending_approval card exists
 *
 * ─── DOUBLE SIEGE PARTIAL FORFEIT ────────────────────────────────────────────
 *   Defender forfeits: territory unclaimed, both attackers keep troops → resolved
 *   Both attackers forfeit: defender keeps territory + troops → resolved
 *   One attacker forfeits: that attacker loses troops; card converts to normal siege
 *     (remaining attacker vs defender). A new siege BattleCard is created.
 *     Original card is marked forfeited with note about conversion.
 *
 * ─── TROOP CONVERSION SAFETY ─────────────────────────────────────────────────
 *   All BOP outcomes use getWinnerCommittedTroops() directly.
 *   TT values are helpers only — never source of truth.
 *   Forfeit winner retains EXACTLY committed BOP troops (no TT round-trip).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function scaleBackSurvivors(survivingTabletop, tabletopSize, totalTroopsInBattle, committedBOP) {
  if (tabletopSize <= 0 || totalTroopsInBattle <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, survivingTabletop / tabletopSize));
  const raw = Math.round(ratio * totalTroopsInBattle);
  return committedBOP != null ? Math.min(raw, committedBOP) : raw;
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
    return { winner_player_id: null, surviving_tabletop_troops: 0, notes: 'No participants.', result_source: 'auto' };
  }

  if (card.battle_type === 'double_siege') {
    const defenderTroops = card.defender_troops ?? 0;
    const totalAttacking = card.total_attacking_troops ?? 0;
    const totalWeight    = defenderTroops + totalAttacking;
    const defenderHeld   = totalWeight > 0 ? rng() < (defenderTroops / totalWeight) : rng() < 0.5;
    const retainRatio    = 0.6 + rng() * 0.3;

    if (defenderHeld) {
      const defenderCommittedTT = winnerCommittedTabletop(card, card.defender_player_id);
      const defenderSurvivingTT = Math.max(1, Math.round(defenderCommittedTT * retainRatio));
      return {
        winner_player_id: card.defender_player_id,
        surviving_tabletop_troops: defenderSurvivingTT,
        notes: 'Auto-resolved: defender held.',
        result_source: 'auto',
        double_siege_result: {
          defender_held: true,
          defender_surviving_tabletop: defenderSurvivingTT,
          attacker_survivors: (card.attackers ?? []).map(a => ({ player_id: a.player_id, tabletop_survivors: 0 })),
        },
      };
    } else {
      const attackerSurvivors = (card.attackers ?? []).map(a => {
        const atkTT = winnerCommittedTabletop(card, a.player_id);
        return { player_id: a.player_id, tabletop_survivors: Math.max(0, Math.round(atkTT * (0.3 + rng() * 0.4))) };
      });
      return {
        winner_player_id: null,
        surviving_tabletop_troops: 0,
        notes: 'Auto-resolved: defender lost. Territory unclaimed.',
        result_source: 'auto',
        double_siege_result: {
          defender_held: false,
          defender_surviving_tabletop: 0,
          attacker_survivors: attackerSurvivors,
        },
      };
    }
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
    winner_player_id: winner.player_id,
    surviving_tabletop_troops: winnerTabletop,
    notes: 'Auto-resolved.',
    result_source: 'auto',
  };
}

function buildTerritoryUpdates(card, result, territoryStates) {
  const { winner_player_id, surviving_tabletop_troops } = result;
  const isDoubleSiegeResult = card.battle_type === 'double_siege' && result.double_siege_result != null;
  if (!winner_player_id && !isDoubleSiegeResult) return [];

  let survivingTroops = 0;
  if (winner_player_id) {
    const committedBOP = getWinnerCommittedTroops(card, winner_player_id);
    if ((card.tabletop_size ?? 0) <= 0) {
      survivingTroops = committedBOP;
    } else {
      survivingTroops = scaleBackSurvivors(surviving_tabletop_troops ?? 0, card.tabletop_size, card.total_troops_in_battle ?? 0, committedBOP);
    }
  }

  const updates = [];

  if (card.is_mutual) {
    // ── Bloodbath ──────────────────────────────────────────────────────────────
    const winnerEntry  = (card.attackers ?? []).find(a => a.player_id === winner_player_id);
    const loserEntries = (card.attackers ?? []).filter(a => a.player_id !== winner_player_id);
    let winnerCaptures = false;

    for (const loserEntry of loserEntries) {
      const loserOriginState = territoryStates.find(s => s.territory_id === loserEntry.origin_territory_id);
      if (loserOriginState) {
        const loserHasGarrison = (loserOriginState.troop_count ?? 0) > 0 && loserOriginState.owner_player_id === loserEntry.player_id;
        if (!loserHasGarrison) {
          winnerCaptures = true;
          const splitCapture = Math.floor(survivingTroops / 2);
          const splitOrigin  = survivingTroops - splitCapture;
          updates.push({ id: loserOriginState.id, territory_id: loserEntry.origin_territory_id, owner_player_id: winner_player_id, troop_count: Math.max(survivingTroops > 0 ? 1 : 0, splitCapture) });
          if (winnerEntry) {
            const winnerOriginState = territoryStates.find(s => s.territory_id === winnerEntry.origin_territory_id);
            if (winnerOriginState) updates.push({ id: winnerOriginState.id, territory_id: winnerEntry.origin_territory_id, owner_player_id: winner_player_id, troop_count: (winnerOriginState.troop_count ?? 0) + splitOrigin });
          }
        }
      }
    }

    if (!winnerCaptures && winnerEntry) {
      const winnerOriginState = territoryStates.find(s => s.territory_id === winnerEntry.origin_territory_id);
      if (winnerOriginState) updates.push({ id: winnerOriginState.id, territory_id: winnerEntry.origin_territory_id, owner_player_id: winner_player_id, troop_count: (winnerOriginState.troop_count ?? 0) + survivingTroops });
    }

  } else if (card.battle_type === 'skirmish') {
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    const troopsToPlace = survivingTroops > 0 ? survivingTroops : getWinnerCommittedTroops(card, winner_player_id);
    if (targetState) updates.push({ id: targetState.id, territory_id: card.target_territory_id, owner_player_id: winner_player_id, troop_count: troopsToPlace });

  } else if (card.battle_type === 'capture_objectives') {
    const winnerCommitted = getWinnerCommittedTroops(card, winner_player_id);
    const clampedSurvivors = Math.max(1, Math.min(survivingTroops, winnerCommitted));
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) {
      updates.push({ id: targetState.id, territory_id: card.target_territory_id, owner_player_id: winner_player_id, troop_count: clampedSurvivors });
    } else {
      updates.push({ _create: true, campaign_id: card.campaign_id, map_id: card.map_id ?? null, territory_id: card.target_territory_id, owner_player_id: winner_player_id, troop_count: clampedSurvivors });
    }
    const loserTTSurvivors = result.loser_tabletop_survivors ?? {};
    for (const atk of (card.attackers ?? [])) {
      if (atk.player_id === winner_player_id) continue;
      const loserOriginState = territoryStates.find(s => s.territory_id === atk.origin_territory_id);
      if (loserOriginState) {
        const loserBopSurvivors = scaleBackSurvivors(loserTTSurvivors[atk.player_id] ?? 0, card.tabletop_size ?? 0, card.total_troops_in_battle ?? 0, atk.committed_troops ?? 0);
        updates.push({ id: loserOriginState.id, territory_id: atk.origin_territory_id, owner_player_id: atk.player_id, troop_count: (loserOriginState.troop_count ?? 0) + loserBopSurvivors });
      }
    }

  } else if (card.battle_type === 'double_siege' && result.double_siege_result != null) {
    const ds = result.double_siege_result;
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (ds.defender_held) {
      const defenderCommitted = getWinnerCommittedTroops(card, card.defender_player_id);
      const defenderBOP = scaleBackSurvivors(ds.defender_surviving_tabletop ?? 0, card.tabletop_size ?? 0, card.total_troops_in_battle ?? 0, defenderCommitted);
      if (targetState) updates.push({ id: targetState.id, territory_id: card.target_territory_id, owner_player_id: card.defender_player_id, troop_count: Math.max(1, defenderBOP) });
    } else {
      if (targetState) updates.push({ id: targetState.id, territory_id: card.target_territory_id, owner_player_id: null, troop_count: 0 });
      for (const atkSurvivor of (ds.attacker_survivors ?? [])) {
        const atk = (card.attackers ?? []).find(a => a.player_id === atkSurvivor.player_id);
        if (!atk) continue;
        const atkOriginState = territoryStates.find(s => s.territory_id === atk.origin_territory_id);
        if (atkOriginState) {
          const atkBOP = scaleBackSurvivors(atkSurvivor.tabletop_survivors ?? 0, card.tabletop_size ?? 0, card.total_troops_in_battle ?? 0, atk.committed_troops ?? 0);
          updates.push({ id: atkOriginState.id, territory_id: atk.origin_territory_id, owner_player_id: atk.player_id, troop_count: (atkOriginState.troop_count ?? 0) + atkBOP });
        }
      }
    }

  } else {
    // ── Siege ──────────────────────────────────────────────────────────────────
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) updates.push({ id: targetState.id, territory_id: card.target_territory_id, owner_player_id: winner_player_id, troop_count: survivingTroops });
  }

  return updates;
}

async function applyTerritoryUpdates(base44, updates) {
  for (const upd of updates) {
    if (upd._create) {
      await base44.asServiceRole.entities.TerritoryState.create({
        campaign_id: upd.campaign_id, map_id: upd.map_id ?? '',
        territory_id: upd.territory_id, owner_player_id: upd.owner_player_id, troop_count: upd.troop_count,
      });
    } else {
      await base44.asServiceRole.entities.TerritoryState.update(upd.id, {
        owner_player_id: upd.owner_player_id, troop_count: upd.troop_count,
      });
    }
  }
}

async function log(base44, campaignId, round, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId, phase: 'battle', round,
    event_type: eventType, player_id: playerId ?? null, payload, is_public: isPublic,
  });
}

function computeLockedTerritoryIds(allCarryoverCards) {
  const locked = new Set();
  for (const card of allCarryoverCards) {
    locked.add(card.target_territory_id);
    for (const atk of (card.attackers ?? [])) locked.add(atk.origin_territory_id);
  }
  return [...locked];
}

async function refreshLockedTerritories(base44, campaign_id) {
  const allCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id });
  const carryoverCards = allCards.filter(c =>
    ['delayed', 'active_carryover', 'pending_approval'].includes(c.status) && !c.result_applied
  );
  const lockedIds = computeLockedTerritoryIds(carryoverCards);
  await base44.asServiceRole.entities.Campaign.update(campaign_id, { locked_territory_ids: lockedIds });
}

// ─── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id } = body;
  if (!campaign_id || !action) return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });

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

  function resolveEffectivePlayer(acting_as_player_id) {
    if (!acting_as_player_id) return { ok: true, player: myPlayer };
    const target = players.find(p => p.id === acting_as_player_id);
    if (!target) return { ok: false, error: 'Invalid acting_as_player_id' };
    if (target.id === myPlayer.id) return { ok: true, player: myPlayer };
    if (myPlayer.is_admin || user.role === 'admin') return { ok: true, player: target };
    return { ok: false, error: 'Only campaign admins can act as other players' };
  }

  async function applyAutoResolve(card, autoResult, base44Ref, campaign_idRef, roundRef) {
    const now = new Date().toISOString();
    await base44Ref.asServiceRole.entities.BattleCard.update(card.id, {
      status: 'auto_resolved', resolved_at: now,
      result: { ...autoResult, submitted_by: 'system', submitted_at: now, applied_at: null },
    });
    const territoryStates = await base44Ref.asServiceRole.entities.TerritoryState.filter({ campaign_id: campaign_idRef });
    const updates = buildTerritoryUpdates(card, autoResult, territoryStates);
    await applyTerritoryUpdates(base44Ref, updates);
    await base44Ref.asServiceRole.entities.BattleCard.update(card.id, {
      result_applied: true,
      result: { ...autoResult, submitted_by: 'system', submitted_at: now, applied_at: new Date().toISOString() },
    });
    await refreshLockedTerritories(base44Ref, campaign_idRef);
    await log(base44Ref, campaign_idRef, roundRef, 'battle_auto_resolved', null, {
      battle_card_id: card.id, target_territory_id: card.target_territory_id, winner_player_id: autoResult.winner_player_id,
    }, true);
  }

  // ── getBattleCards ─────────────────────────────────────────────────────────
  if (action === 'getBattleCards') {
    const queryRound = body.round ?? round;
    const currentCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: queryRound });

    // Fetch unresolved carryover cards from prior rounds (delayed, active_carryover, pending_approval)
    let carryoverCards = [];
    if (queryRound > 1) {
      for (let r = queryRound - 1; r >= Math.max(1, queryRound - 10); r--) {
        const priorCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: r });
        const unresolved = priorCards.filter(c =>
          ['delayed', 'active_carryover', 'pending_approval', 'result_submitted', 'awaiting_approval'].includes(c.status) &&
          !c.result_applied
        );
        carryoverCards = [...carryoverCards, ...unresolved];
        if (priorCards.length === 0) break;
      }
    }

    return Response.json({ battle_cards: [...currentCards, ...carryoverCards] });
  }

  // ── setPreference — unified player preference action ───────────────────────
  if (action === 'setPreference') {
    const { battle_card_id, preference, acting_as_player_id } = body;
    const VALID_PREFS = ['play_tabletop', 'auto_resolve', 'delay', 'forfeit'];

    if (!battle_card_id || !VALID_PREFS.includes(preference)) {
      return Response.json({ error: `battle_card_id and preference (${VALID_PREFS.join('|')}) required` }, { status: 400 });
    }

    const effective = resolveEffectivePlayer(acting_as_player_id);
    if (!effective.ok) return Response.json({ error: effective.error }, { status: 403 });
    const effectivePlayer = effective.player;

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(effectivePlayer.id)) {
      return Response.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }
    if (!['pending', 'awaiting_result', 'active_carryover'].includes(card.status)) {
      return Response.json({ error: `Cannot set preference for card in status: ${card.status}` }, { status: 400 });
    }
    if (card.voting_closed) {
      return Response.json({ error: 'Voting is closed for this battle' }, { status: 400 });
    }

    // One preference per player — replaces any previous choice
    const currentPrefs = { ...(card.battle_preferences ?? {}) };
    currentPrefs[effectivePlayer.id] = preference;

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      battle_preferences: currentPrefs,
    });

    await log(base44, campaign_id, card.round, 'battle_preference_set', effectivePlayer.id, {
      battle_card_id, preference, acting_as: acting_as_player_id ?? null,
    }, true);

    return Response.json({ success: true, status: card.status, battle_preferences: currentPrefs });
  }

  // ── closeBattleVoting — tally preferences and apply unanimous outcomes ──────
  if (action === 'closeBattleVoting') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    if (!['pending', 'awaiting_result', 'active_carryover'].includes(card.status)) {
      return Response.json({ error: `Cannot close voting for card in status: ${card.status}` }, { status: 400 });
    }

    const participantIds = getParticipantIds(card);
    const prefs = card.battle_preferences ?? {};
    const now   = new Date().toISOString();

    // Count preferences (default = play_tabletop)
    const prefCounts = { play_tabletop: 0, auto_resolve: 0, delay: 0, forfeit: 0 };
    for (const pid of participantIds) {
      const p = prefs[pid] ?? 'play_tabletop';
      prefCounts[p] = (prefCounts[p] ?? 0) + 1;
    }

    const totalPlayers   = participantIds.length;
    const allAutoResolve = prefCounts.auto_resolve === totalPlayers;
    const allDelay       = prefCounts.delay === totalPlayers;
    const hasForfeit     = prefCounts.forfeit > 0;
    const forfeitPlayers = participantIds.filter(pid => (prefs[pid] ?? 'play_tabletop') === 'forfeit');

    let outcome = 'tabletop';
    if (allAutoResolve) {
      outcome = 'auto_resolve';
    } else if (allDelay) {
      outcome = 'delay';
    } else if (hasForfeit) {
      outcome = 'forfeit_only';
    }

    // Mark voting closed first
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      voting_closed: true,
      tally_result: { outcome, tallied_at: now, pref_counts: prefCounts },
    });

    await log(base44, campaign_id, card.round, 'battle_voting_closed', myPlayer.id, {
      battle_card_id, outcome, pref_counts: prefCounts,
    }, true);

    // ── Apply tally outcomes ────────────────────────────────────────────────────

    if (allAutoResolve) {
      const freshCards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
      const autoResult = autoResolveBattle(freshCards[0], campaign_id);
      await applyAutoResolve(freshCards[0], autoResult, base44, campaign_id, round);
      return Response.json({ success: true, outcome, status: 'auto_resolved', result: autoResult });
    }

    if (allDelay) {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'delayed', delayed_at: now,
      });
      await refreshLockedTerritories(base44, campaign_id);
      return Response.json({ success: true, outcome, status: 'delayed' });
    }

    if (hasForfeit) {
      // Apply each forfeit — reuse existing forfeit logic per player
      // For simplicity: if a single player forfeits in 1v1, resolve immediately
      const activePlayers = participantIds.filter(pid => (prefs[pid] ?? 'play_tabletop') !== 'forfeit');
      const currentForfeits = {};
      for (const pid of forfeitPlayers) currentForfeits[pid] = true;

      // Double siege special cases
      if (card.battle_type === 'double_siege') {
        const attackerPlayerIds = [...new Set((card.attackers ?? []).map(a => a.player_id))];
        const defenderForfeited = currentForfeits[card.defender_player_id ?? ''];
        const allAttackersForfeited = attackerPlayerIds.every(pid => currentForfeits[pid]);

        if (defenderForfeited) {
          const forfeitResult = {
            winner_player_id: null, surviving_tabletop_troops: 0,
            notes: 'Defender forfeited. Territory unclaimed. Attacker troops return.',
            submitted_by: myPlayer.id, submitted_at: now, result_source: 'forfeit', applied_at: null,
            double_siege_result: {
              defender_held: false, defender_surviving_tabletop: 0,
              attacker_survivors: attackerPlayerIds.map(pid => ({ player_id: pid, tabletop_survivors: winnerCommittedTabletop(card, pid) })),
            },
          };
          await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { status: 'forfeited', resolved_at: now, player_forfeits: currentForfeits, result: forfeitResult });
          const ts = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
          await applyTerritoryUpdates(base44, buildTerritoryUpdates(card, forfeitResult, ts));
          await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() } });
          await refreshLockedTerritories(base44, campaign_id);
          return Response.json({ success: true, outcome, status: 'forfeited' });

        } else if (allAttackersForfeited) {
          const defenderCommitted = getWinnerCommittedTroops(card, card.defender_player_id);
          const forfeitResult = {
            winner_player_id: card.defender_player_id, surviving_tabletop_troops: winnerCommittedTabletop(card, card.defender_player_id),
            notes: 'All attackers forfeited. Defender holds.', submitted_by: myPlayer.id, submitted_at: now, result_source: 'forfeit', applied_at: null,
            double_siege_result: {
              defender_held: true, defender_surviving_tabletop: winnerCommittedTabletop(card, card.defender_player_id),
              attacker_survivors: attackerPlayerIds.map(pid => ({ player_id: pid, tabletop_survivors: 0 })),
            },
          };
          await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { status: 'forfeited', resolved_at: now, player_forfeits: currentForfeits, result: forfeitResult });
          const ts = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
          const targetState = ts.find(s => s.territory_id === card.target_territory_id);
          if (targetState) await base44.asServiceRole.entities.TerritoryState.update(targetState.id, { owner_player_id: card.defender_player_id, troop_count: defenderCommitted });
          await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() } });
          await refreshLockedTerritories(base44, campaign_id);
          return Response.json({ success: true, outcome, status: 'forfeited' });

        } else if (forfeitPlayers.length === 1) {
          // One attacker forfeits → convert the SAME card to a normal siege (no new card)
          const forfeitingAttackerId = forfeitPlayers[0];
          const remainingAttacker = attackerPlayerIds.find(pid => pid !== forfeitingAttackerId);
          if (!remainingAttacker) {
            return Response.json({ error: 'Cannot determine remaining attacker for double siege conversion' }, { status: 400 });
          }

          const forfeitingAtkEntry  = (card.attackers ?? []).find(a => a.player_id === forfeitingAttackerId);
          const remainingAtkEntry   = (card.attackers ?? []).find(a => a.player_id === remainingAttacker);
          const remainingAtkTroops  = remainingAtkEntry?.committed_troops ?? 0;
          const defenderTroops      = card.defender_troops ?? 0;
          const newTotalTroops      = remainingAtkTroops + defenderTroops;
          const avgSize             = campaign.settings?.average_battle_size ?? 1000;
          const newScaleFactor      = parseFloat(Math.max(newTotalTroops / avgSize, 1).toFixed(4));
          const newTabletopSize     = Math.round(newTotalTroops / newScaleFactor);

          const forfeitingAtkName   = players.find(p => p.id === forfeitingAttackerId)?.display_name ?? forfeitingAttackerId;

          // Mutate the existing card in place: convert to siege, preserve conversion history
          await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
            battle_type: 'siege',
            attackers: remainingAtkEntry
              ? [{ player_id: remainingAttacker, origin_territory_id: remainingAtkEntry.origin_territory_id, committed_troops: remainingAtkTroops }]
              : [],
            total_attacking_troops: remainingAtkTroops,
            total_troops_in_battle: newTotalTroops,
            scale_factor: newScaleFactor,
            tabletop_size: newTabletopSize,
            is_mutual: false,
            status: card.status, // preserve active_carryover / pending / etc.
            player_forfeits: currentForfeits,
            battle_preferences: {}, // reset preferences for remaining participants
            voting_closed: false,
            // Preserve conversion history in result field (not applied)
            result: {
              conversion_history: {
                original_type: 'double_siege',
                converted_at: now,
                converted_by: 'forfeit',
                forfeiting_player_id: forfeitingAttackerId,
                forfeiting_player_name: forfeitingAtkName,
                forfeiting_troops_lost: forfeitingAtkEntry?.committed_troops ?? 0,
                reason: `${forfeitingAtkName} forfeited. Double siege converted to siege.`,
              },
            },
          });

          await refreshLockedTerritories(base44, campaign_id);
          await log(base44, campaign_id, card.round, 'double_siege_converted_to_siege', myPlayer.id, {
            battle_card_id, forfeiting_player: forfeitingAttackerId, remaining_attacker: remainingAttacker,
            troops_lost: forfeitingAtkEntry?.committed_troops ?? 0,
          }, true);
          return Response.json({ success: true, outcome, status: card.status, converted_to_siege: true, battle_card_id });
        }
      }

      // Standard 1v1 forfeit (siege, bloodbath)
      if (activePlayers.length === 1 && forfeitPlayers.length === 1) {
        const winnerId = activePlayers[0];
        const winnerCommitted = getWinnerCommittedTroops(card, winnerId);
        const forfeitResult = {
          winner_player_id: winnerId,
          surviving_tabletop_troops: winnerCommittedTabletop(card, winnerId),
          winner_bop_survivors: winnerCommitted,
          notes: `Forfeit by preference tally.`,
          submitted_by: myPlayer.id, submitted_at: now, result_source: 'forfeit', applied_at: null,
        };
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { status: 'forfeited', resolved_at: now, player_forfeits: currentForfeits, result: forfeitResult });
        const ts = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const targetState = ts.find(s => s.territory_id === card.target_territory_id);
        if (card.battle_type === 'bloodbath') {
          const loserEntry = (card.attackers ?? []).find(a => a.player_id === forfeitPlayers[0]);
          const winnerEntry = (card.attackers ?? []).find(a => a.player_id === winnerId);
          if (loserEntry && winnerEntry) {
            const loserState = ts.find(s => s.territory_id === loserEntry.origin_territory_id);
            const winnerState = ts.find(s => s.territory_id === winnerEntry.origin_territory_id);
            if (loserState && (loserState.troop_count ?? 0) === 0) {
              const splitCapture = Math.floor(winnerCommitted / 2);
              const splitOrigin  = winnerCommitted - splitCapture;
              if (loserState) await base44.asServiceRole.entities.TerritoryState.update(loserState.id, { owner_player_id: winnerId, troop_count: Math.max(winnerCommitted > 0 ? 1 : 0, splitCapture) });
              if (winnerState) await base44.asServiceRole.entities.TerritoryState.update(winnerState.id, { owner_player_id: winnerId, troop_count: (winnerState.troop_count ?? 0) + splitOrigin });
            } else if (winnerState) {
              await base44.asServiceRole.entities.TerritoryState.update(winnerState.id, { owner_player_id: winnerId, troop_count: (winnerState.troop_count ?? 0) + winnerCommitted });
            }
          }
        } else if (targetState) {
          await base44.asServiceRole.entities.TerritoryState.update(targetState.id, { owner_player_id: winnerId, troop_count: winnerCommitted });
        }
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() } });
        await refreshLockedTerritories(base44, campaign_id);
        return Response.json({ success: true, outcome, status: 'forfeited' });
      }

      // Mixed forfeits + remaining players → card stays open for tabletop (forfeits noted)
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { player_forfeits: currentForfeits });
      return Response.json({ success: true, outcome: 'tabletop', status: card.status, player_forfeits: currentForfeits, message: 'Forfeit(s) recorded. Remaining players play tabletop.' });
    }

    // Default: play_tabletop — card stays open
    return Response.json({ success: true, outcome, status: card.status });
  }

  // ── submitResult ─────────────────────────────────────────────────────────────
  if (action === 'submitResult') {
    if (!isAdmin) return Response.json({ error: 'Only the campaign admin can submit battle results' }, { status: 403 });

    const { battle_card_id, winner_player_id, surviving_tabletop_troops, notes, loser_tabletop_survivors, double_siege_result } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const allowedStatuses = ['pending', 'awaiting_result', 'delayed', 'active_carryover', 'result_submitted', 'awaiting_approval', 'pending_approval'];
    if (!allowedStatuses.includes(card.status)) {
      return Response.json({ error: `Cannot submit result for card in status: ${card.status}` }, { status: 400 });
    }

    // Carryover cards get pending_approval status instead of result_submitted
    const isCarryover = ['active_carryover', 'pending_approval'].includes(card.status);
    const newStatus = isCarryover ? 'pending_approval' : 'result_submitted';

    if (card.battle_type === 'double_siege' && double_siege_result != null) {
      const { defender_held, defender_surviving_tabletop, attacker_survivors } = double_siege_result;
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: newStatus, approvals: [],
        result: {
          double_siege_result: {
            defender_held: !!defender_held,
            defender_surviving_tabletop: defender_held ? Math.max(0, Math.round(defender_surviving_tabletop ?? 0)) : 0,
            attacker_survivors: (attacker_survivors ?? []).map(a => ({ player_id: a.player_id, tabletop_survivors: Math.max(0, Math.round(a.tabletop_survivors ?? 0)) })),
          },
          winner_player_id: defender_held ? (card.defender_player_id ?? null) : null,
          surviving_tabletop_troops: defender_held ? Math.max(0, Math.round(defender_surviving_tabletop ?? 0)) : 0,
          notes: notes ?? '', submitted_by: myPlayer.id, submitted_at: now, result_source: 'manual', applied_at: null,
        },
      });
      await log(base44, campaign_id, card.round, 'battle_result_submitted', myPlayer.id, { battle_card_id, battle_type: 'double_siege', defender_held: !!defender_held }, true);
      return Response.json({ success: true, status: newStatus });
    }

    if (winner_player_id == null || surviving_tabletop_troops == null) {
      return Response.json({ error: 'winner_player_id and surviving_tabletop_troops required' }, { status: 400 });
    }

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(winner_player_id)) return Response.json({ error: 'Winner must be a participant' }, { status: 400 });

    const maxTabletop = winnerCommittedTabletop(card, winner_player_id);
    const clampedSurvivors = Math.min(Math.max(0, Math.round(surviving_tabletop_troops)), Math.max(1, maxTabletop));

    let clampedLoserSurvivors = null;
    if (card.battle_type === 'capture_objectives' && loser_tabletop_survivors != null) {
      clampedLoserSurvivors = {};
      for (const atk of (card.attackers ?? [])) {
        if (atk.player_id === winner_player_id) continue;
        const submitted = loser_tabletop_survivors[atk.player_id] ?? null;
        if (submitted != null) {
          const loserMaxTabletop = winnerCommittedTabletop(card, atk.player_id);
          clampedLoserSurvivors[atk.player_id] = Math.min(Math.max(0, Math.round(submitted)), loserMaxTabletop);
        }
      }
    }

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status: newStatus, approvals: [],
      result: {
        winner_player_id, surviving_tabletop_troops: clampedSurvivors,
        loser_tabletop_survivors: clampedLoserSurvivors ?? null,
        notes: notes ?? '', submitted_by: myPlayer.id, submitted_at: now, result_source: 'manual', applied_at: null,
      },
    });
    await log(base44, campaign_id, card.round, 'battle_result_submitted', myPlayer.id, { battle_card_id, winner_player_id, surviving_tabletop_troops: clampedSurvivors }, true);
    return Response.json({ success: true, status: newStatus });
  }

  // ── approveResult ─────────────────────────────────────────────────────────────
  if (action === 'approveResult') {
    const { battle_card_id, approved, flagged, acting_as_player_id } = body;
    if (!battle_card_id || approved == null) return Response.json({ error: 'battle_card_id and approved required' }, { status: 400 });

    const effective = resolveEffectivePlayer(acting_as_player_id);
    if (!effective.ok) return Response.json({ error: effective.error }, { status: 403 });
    const effectivePlayer = effective.player;

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(effectivePlayer.id) && !isAdmin) return Response.json({ error: 'Not a participant' }, { status: 403 });

    const approvableStatuses = ['result_submitted', 'awaiting_approval', 'pending_approval'];
    if (!approvableStatuses.includes(card.status)) {
      return Response.json({ error: `Cannot approve card in status: ${card.status}` }, { status: 400 });
    }

    const currentApprovals = card.approvals ?? [];
    const existingIdx = currentApprovals.findIndex(a => a.player_id === effectivePlayer.id);
    const approvalRecord = { player_id: effectivePlayer.id, approved: !!approved, flagged: !!flagged, at: new Date().toISOString() };
    const updatedApprovals = existingIdx >= 0
      ? currentApprovals.map((a, i) => i === existingIdx ? approvalRecord : a)
      : [...currentApprovals, approvalRecord];

    const submittedBy    = card.result?.submitted_by;
    const reviewers      = participantIds.filter(pid => pid !== submittedBy);
    const anyFlagged     = updatedApprovals.some(a => a.flagged);
    const allApproved    = reviewers.length === 0 || reviewers.every(pid => updatedApprovals.find(a => a.player_id === pid && a.approved && !a.flagged));

    let newStatus = anyFlagged ? 'awaiting_approval' : (allApproved ? 'resolved' : 'awaiting_approval');
    const updatePayload = { approvals: updatedApprovals, status: newStatus };
    if (newStatus === 'resolved') updatePayload.resolved_at = new Date().toISOString();

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, updatePayload);

    if (newStatus === 'resolved' && !card.result_applied) {
      const result = card.result;
      const isDoubleSiegeResult = card.battle_type === 'double_siege' && result?.double_siege_result != null;
      if (result?.winner_player_id || isDoubleSiegeResult) {
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const updates = buildTerritoryUpdates(card, result, territoryStates);
        await applyTerritoryUpdates(base44, updates);
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          result_applied: true, result: { ...result, applied_at: new Date().toISOString() },
        });
        await refreshLockedTerritories(base44, campaign_id);
        await log(base44, campaign_id, card.round, 'battle_result_applied', null, { battle_card_id, winner_player_id: result.winner_player_id ?? null }, true);
      }
    }

    await log(base44, campaign_id, card.round, 'battle_result_approved', effectivePlayer.id, { battle_card_id, approved, flagged: !!flagged, new_status: newStatus }, true);
    return Response.json({ success: true, status: newStatus, all_approved: allApproved });
  }

  // ── adminOverride ─────────────────────────────────────────────────────────────
  if (action === 'adminOverride') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id, force_resolve } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });

    const overridableStatuses = ['awaiting_approval', 'result_submitted', 'pending_approval'];
    if (!overridableStatuses.includes(card.status)) return Response.json({ error: `Cannot override card in status: ${card.status}` }, { status: 400 });

    const hasResult = card.result?.winner_player_id || (card.battle_type === 'double_siege' && card.result?.double_siege_result != null);
    if (!hasResult) return Response.json({ error: 'No result to override with' }, { status: 400 });

    if (force_resolve) {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'resolved', resolved_at: new Date().toISOString(),
        approvals: [...(card.approvals ?? []), { player_id: myPlayer.id, approved: true, flagged: false, admin_override: true, at: new Date().toISOString() }],
      });
      if (!card.result_applied) {
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        await applyTerritoryUpdates(base44, buildTerritoryUpdates(card, card.result, territoryStates));
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { result_applied: true, result: { ...card.result, applied_at: new Date().toISOString() } });
        await refreshLockedTerritories(base44, campaign_id);
      }
      await log(base44, campaign_id, card.round, 'battle_admin_override_resolved', myPlayer.id, { battle_card_id }, true);
      return Response.json({ success: true, status: 'resolved' });
    } else {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'result_submitted', approvals: (card.approvals ?? []).map(a => ({ ...a, flagged: false })),
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
    await applyAutoResolve(card, autoResult, base44, campaign_id, round);
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
    await refreshLockedTerritories(base44, campaign_id);
    await log(base44, campaign_id, card.round, 'battle_delay_toggled', null, { battle_card_id, delayed }, true);
    return Response.json({ success: true, status: newStatus });
  }

  // ── setForfeited (admin) ──────────────────────────────────────────────────────
  if (action === 'setForfeited') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    const { battle_card_id, forfeited, winner_player_id } = body;
    if (!battle_card_id || forfeited == null) return Response.json({ error: 'battle_card_id and forfeited required' }, { status: 400 });

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });

    if (forfeited) {
      if (!winner_player_id) return Response.json({ error: 'winner_player_id required for forfeit' }, { status: 400 });
      const participantIds = getParticipantIds(card);
      if (!participantIds.includes(winner_player_id)) return Response.json({ error: 'Winner must be a participant' }, { status: 400 });

      const winnerCommittedBOP = getWinnerCommittedTroops(card, winner_player_id);
      const forfeitResult = {
        winner_player_id, surviving_tabletop_troops: winnerCommittedTabletop(card, winner_player_id),
        winner_bop_survivors: winnerCommittedBOP, notes: 'Victory by forfeit.',
        submitted_by: 'admin', submitted_at: new Date().toISOString(), result_source: 'forfeit', applied_at: null,
      };
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { status: 'forfeited', resolved_at: new Date().toISOString(), result: forfeitResult });

      const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
      if (targetState) await base44.asServiceRole.entities.TerritoryState.update(targetState.id, { owner_player_id: winner_player_id, troop_count: winnerCommittedBOP });

      if (card.is_mutual) {
        const loserEntry = (card.attackers ?? []).find(a => a.player_id !== winner_player_id);
        if (loserEntry) {
          const loserState = territoryStates.find(s => s.territory_id === loserEntry.origin_territory_id);
          if (loserState && (loserState.troop_count ?? 0) === 0) {
            const splitCapture = Math.floor(winnerCommittedBOP / 2);
            const splitOrigin  = winnerCommittedBOP - splitCapture;
            const winnerEntry  = (card.attackers ?? []).find(a => a.player_id === winner_player_id);
            const winnerOriginState = winnerEntry ? territoryStates.find(s => s.territory_id === winnerEntry.origin_territory_id) : null;
            await base44.asServiceRole.entities.TerritoryState.update(loserState.id, { owner_player_id: winner_player_id, troop_count: Math.max(winnerCommittedBOP > 0 ? 1 : 0, splitCapture) });
            if (winnerOriginState) await base44.asServiceRole.entities.TerritoryState.update(winnerOriginState.id, { owner_player_id: winner_player_id, troop_count: (winnerOriginState.troop_count ?? 0) + splitOrigin });
          }
        }
      }

      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() } });
      await refreshLockedTerritories(base44, campaign_id);
      await log(base44, campaign_id, card.round, 'battle_forfeited', null, { battle_card_id, winner_player_id }, true);
      return Response.json({ success: true, result: forfeitResult });
    } else {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { status: 'awaiting_result', resolved_at: null, result: {}, result_applied: false });
      await refreshLockedTerritories(base44, campaign_id);
      return Response.json({ success: true, status: 'awaiting_result' });
    }
  }

  // ── tallyAllCards — close voting and tally preferences for ALL active cards ───
  if (action === 'tallyAllCards') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    // Gather all active (votable) cards for current round + carryovers
    const currentRoundCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round });
    let priorCards = [];
    for (let r = round - 1; r >= Math.max(1, round - 10); r--) {
      const pc = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: r });
      const unresolved = pc.filter(c =>
        ['active_carryover'].includes(c.status) && !c.result_applied
      );
      priorCards = [...priorCards, ...unresolved];
      if (pc.length === 0) break;
    }

    const votableStatuses = ['pending', 'awaiting_result', 'active_carryover'];
    const votableCards = [...currentRoundCards, ...priorCards].filter(c =>
      votableStatuses.includes(c.status) && !c.voting_closed
    );

    if (votableCards.length === 0) {
      return Response.json({ success: true, tallied: 0, message: 'No votable cards found.' });
    }

    const results = [];
    const now = new Date().toISOString();

    for (const card of votableCards) {
      const participantIds = getParticipantIds(card);
      const prefs = card.battle_preferences ?? {};

      const prefCounts = { play_tabletop: 0, auto_resolve: 0, delay: 0, forfeit: 0 };
      for (const pid of participantIds) {
        const p = prefs[pid] ?? 'play_tabletop';
        prefCounts[p] = (prefCounts[p] ?? 0) + 1;
      }

      const totalPlayers   = participantIds.length;
      const allAutoResolve = prefCounts.auto_resolve === totalPlayers;
      const allDelay       = prefCounts.delay === totalPlayers;
      const hasForfeit     = prefCounts.forfeit > 0;
      const forfeitPlayers = participantIds.filter(pid => (prefs[pid] ?? 'play_tabletop') === 'forfeit');

      let outcome = 'tabletop';
      if (allAutoResolve) outcome = 'auto_resolve';
      else if (allDelay) outcome = 'delay';
      else if (hasForfeit) outcome = 'forfeit_only';

      // Mark voting closed
      await base44.asServiceRole.entities.BattleCard.update(card.id, {
        voting_closed: true,
        tally_result: { outcome, tallied_at: now, pref_counts: prefCounts },
      });

      await log(base44, campaign_id, card.round, 'battle_voting_closed', myPlayer.id, {
        battle_card_id: card.id, outcome, pref_counts: prefCounts,
      }, true);

      // ── Apply outcomes ──────────────────────────────────────────────────────

      if (allAutoResolve) {
        const freshCards = await base44.asServiceRole.entities.BattleCard.filter({ id: card.id });
        const autoResult = autoResolveBattle(freshCards[0], campaign_id);
        await applyAutoResolve(freshCards[0], autoResult, base44, campaign_id, round);
        results.push({ card_id: card.id, outcome: 'auto_resolved' });
        continue;
      }

      if (allDelay) {
        await base44.asServiceRole.entities.BattleCard.update(card.id, { status: 'delayed', delayed_at: now });
        results.push({ card_id: card.id, outcome: 'delayed' });
        continue;
      }

      if (hasForfeit) {
        const activePlayers = participantIds.filter(pid => (prefs[pid] ?? 'play_tabletop') !== 'forfeit');
        const currentForfeits = {};
        for (const pid of forfeitPlayers) currentForfeits[pid] = true;

        if (card.battle_type === 'double_siege') {
          const attackerPlayerIds = [...new Set((card.attackers ?? []).map(a => a.player_id))];
          const defenderForfeited = currentForfeits[card.defender_player_id ?? ''];
          const allAttackersForfeited = attackerPlayerIds.every(pid => currentForfeits[pid]);

          if (defenderForfeited) {
            const forfeitResult = {
              winner_player_id: null, surviving_tabletop_troops: 0,
              notes: 'Defender forfeited. Territory unclaimed.',
              submitted_by: myPlayer.id, submitted_at: now, result_source: 'forfeit', applied_at: null,
              double_siege_result: {
                defender_held: false, defender_surviving_tabletop: 0,
                attacker_survivors: attackerPlayerIds.map(pid => ({ player_id: pid, tabletop_survivors: winnerCommittedTabletop(card, pid) })),
              },
            };
            await base44.asServiceRole.entities.BattleCard.update(card.id, { status: 'forfeited', resolved_at: now, player_forfeits: currentForfeits, result: forfeitResult });
            const ts = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
            await applyTerritoryUpdates(base44, buildTerritoryUpdates(card, forfeitResult, ts));
            await base44.asServiceRole.entities.BattleCard.update(card.id, { result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() } });
            results.push({ card_id: card.id, outcome: 'forfeited' });
            continue;
          } else if (allAttackersForfeited) {
            const defenderCommitted = getWinnerCommittedTroops(card, card.defender_player_id);
            const forfeitResult = {
              winner_player_id: card.defender_player_id, surviving_tabletop_troops: winnerCommittedTabletop(card, card.defender_player_id),
              notes: 'All attackers forfeited. Defender holds.',
              submitted_by: myPlayer.id, submitted_at: now, result_source: 'forfeit', applied_at: null,
              double_siege_result: {
                defender_held: true, defender_surviving_tabletop: winnerCommittedTabletop(card, card.defender_player_id),
                attacker_survivors: attackerPlayerIds.map(pid => ({ player_id: pid, tabletop_survivors: 0 })),
              },
            };
            await base44.asServiceRole.entities.BattleCard.update(card.id, { status: 'forfeited', resolved_at: now, player_forfeits: currentForfeits, result: forfeitResult });
            const ts = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
            const targetState = ts.find(s => s.territory_id === card.target_territory_id);
            if (targetState) await base44.asServiceRole.entities.TerritoryState.update(targetState.id, { owner_player_id: card.defender_player_id, troop_count: defenderCommitted });
            await base44.asServiceRole.entities.BattleCard.update(card.id, { result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() } });
            results.push({ card_id: card.id, outcome: 'forfeited' });
            continue;
          } else if (forfeitPlayers.length === 1) {
            // One attacker forfeits → convert same card to siege
            const forfeitingAttackerId = forfeitPlayers[0];
            const remainingAttacker = attackerPlayerIds.find(pid => pid !== forfeitingAttackerId);
            if (remainingAttacker) {
              const forfeitingAtkEntry = (card.attackers ?? []).find(a => a.player_id === forfeitingAttackerId);
              const remainingAtkEntry  = (card.attackers ?? []).find(a => a.player_id === remainingAttacker);
              const remainingAtkTroops = remainingAtkEntry?.committed_troops ?? 0;
              const defenderTroops     = card.defender_troops ?? 0;
              const newTotalTroops     = remainingAtkTroops + defenderTroops;
              const avgSize            = campaign.settings?.average_battle_size ?? 1000;
              const newScaleFactor     = parseFloat(Math.max(newTotalTroops / avgSize, 1).toFixed(4));
              const newTabletopSize    = Math.round(newTotalTroops / newScaleFactor);
              const forfeitingAtkName  = players.find(p => p.id === forfeitingAttackerId)?.display_name ?? forfeitingAttackerId;

              await base44.asServiceRole.entities.BattleCard.update(card.id, {
                battle_type: 'siege',
                attackers: remainingAtkEntry ? [{ player_id: remainingAttacker, origin_territory_id: remainingAtkEntry.origin_territory_id, committed_troops: remainingAtkTroops }] : [],
                total_attacking_troops: remainingAtkTroops,
                total_troops_in_battle: newTotalTroops,
                scale_factor: newScaleFactor,
                tabletop_size: newTabletopSize,
                is_mutual: false,
                player_forfeits: currentForfeits,
                battle_preferences: {},
                voting_closed: false,
                tally_result: {},
                result: {
                  conversion_history: {
                    original_type: 'double_siege',
                    converted_at: now,
                    converted_by: 'forfeit',
                    forfeiting_player_id: forfeitingAttackerId,
                    forfeiting_player_name: forfeitingAtkName,
                    forfeiting_troops_lost: forfeitingAtkEntry?.committed_troops ?? 0,
                    reason: `${forfeitingAtkName} forfeited. Double siege converted to siege.`,
                  },
                },
              });
              await log(base44, campaign_id, card.round, 'double_siege_converted_to_siege', myPlayer.id, {
                battle_card_id: card.id, forfeiting_player: forfeitingAttackerId, remaining_attacker: remainingAttacker,
              }, true);
              results.push({ card_id: card.id, outcome: 'converted_to_siege' });
              continue;
            }
          }
        }

        // Standard 1v1 forfeit
        if (activePlayers.length === 1 && forfeitPlayers.length === 1) {
          const winnerId = activePlayers[0];
          const winnerCommitted = getWinnerCommittedTroops(card, winnerId);
          const forfeitResult = {
            winner_player_id: winnerId,
            surviving_tabletop_troops: winnerCommittedTabletop(card, winnerId),
            winner_bop_survivors: winnerCommitted,
            notes: 'Forfeit by preference tally.',
            submitted_by: myPlayer.id, submitted_at: now, result_source: 'forfeit', applied_at: null,
          };
          await base44.asServiceRole.entities.BattleCard.update(card.id, { status: 'forfeited', resolved_at: now, player_forfeits: currentForfeits, result: forfeitResult });
          const ts = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
          const targetState = ts.find(s => s.territory_id === card.target_territory_id);
          if (card.battle_type === 'bloodbath') {
            const loserEntry  = (card.attackers ?? []).find(a => a.player_id === forfeitPlayers[0]);
            const winnerEntry = (card.attackers ?? []).find(a => a.player_id === winnerId);
            if (loserEntry && winnerEntry) {
              const loserState  = ts.find(s => s.territory_id === loserEntry.origin_territory_id);
              const winnerState = ts.find(s => s.territory_id === winnerEntry.origin_territory_id);
              if (loserState && (loserState.troop_count ?? 0) === 0) {
                const splitCapture = Math.floor(winnerCommitted / 2);
                const splitOrigin  = winnerCommitted - splitCapture;
                if (loserState) await base44.asServiceRole.entities.TerritoryState.update(loserState.id, { owner_player_id: winnerId, troop_count: Math.max(winnerCommitted > 0 ? 1 : 0, splitCapture) });
                if (winnerState) await base44.asServiceRole.entities.TerritoryState.update(winnerState.id, { owner_player_id: winnerId, troop_count: (winnerState.troop_count ?? 0) + splitOrigin });
              } else if (winnerState) {
                await base44.asServiceRole.entities.TerritoryState.update(winnerState.id, { owner_player_id: winnerId, troop_count: (winnerState.troop_count ?? 0) + winnerCommitted });
              }
            }
          } else if (targetState) {
            await base44.asServiceRole.entities.TerritoryState.update(targetState.id, { owner_player_id: winnerId, troop_count: winnerCommitted });
          }
          await base44.asServiceRole.entities.BattleCard.update(card.id, { result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() } });
          results.push({ card_id: card.id, outcome: 'forfeited' });
          continue;
        }

        // Mixed forfeits — record and stay tabletop
        await base44.asServiceRole.entities.BattleCard.update(card.id, { player_forfeits: currentForfeits });
        results.push({ card_id: card.id, outcome: 'tabletop_with_forfeits' });
        continue;
      }

      // play_tabletop — stays open
      results.push({ card_id: card.id, outcome: 'tabletop' });
    }

    await refreshLockedTerritories(base44, campaign_id);
    return Response.json({ success: true, tallied: votableCards.length, results });
  }

  // ── Legacy: voteDelay → setPreference(delay/play_tabletop) ───────────────────
  if (action === 'voteDelay') {
    const { battle_card_id, vote, acting_as_player_id } = body;
    const mapped = vote === 'yes' ? 'delay' : 'play_tabletop';
    return await handleSetPreferenceDirect(base44, campaign_id, battle_card_id, mapped, acting_as_player_id, round, isAdmin, myPlayer, players, resolveEffectivePlayer, log);
  }

  // ── Legacy: voteAutoResolve → setPreference(auto_resolve/play_tabletop) ──────
  if (action === 'voteAutoResolve') {
    const { battle_card_id, vote, acting_as_player_id } = body;
    const mapped = vote === 'yes' ? 'auto_resolve' : 'play_tabletop';
    return await handleSetPreferenceDirect(base44, campaign_id, battle_card_id, mapped, acting_as_player_id, round, isAdmin, myPlayer, players, resolveEffectivePlayer, log);
  }

  // ── Legacy: playerForfeit → setPreference(forfeit) ───────────────────────────
  if (action === 'playerForfeit') {
    const { battle_card_id, acting_as_player_id } = body;
    return await handleSetPreferenceDirect(base44, campaign_id, battle_card_id, 'forfeit', acting_as_player_id, round, isAdmin, myPlayer, players, resolveEffectivePlayer, log);
  }

  // ── processPhaseEnd ───────────────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    if (campaign.current_phase !== 'battle') return Response.json({ error: 'Not in battle phase' }, { status: 400 });

    const currentRoundCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round });

    // Collect all unresolved carryover cards
    let priorCarryoverCards = [];
    for (let r = round - 1; r >= Math.max(1, round - 10); r--) {
      const priorCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: r });
      const unresolved = priorCards.filter(c =>
        ['delayed', 'active_carryover', 'pending_approval', 'result_submitted', 'awaiting_approval'].includes(c.status) &&
        !c.result_applied
      );
      priorCarryoverCards = [...priorCarryoverCards, ...unresolved];
      if (priorCards.length === 0) break;
    }

    // Block advance if any active_carryover or pending_approval cards remain
    const blockers = priorCarryoverCards.filter(c => ['active_carryover', 'pending_approval', 'awaiting_approval', 'result_submitted'].includes(c.status));
    if (blockers.length > 0 && !body.force) {
      return Response.json({
        error: `Cannot advance: ${blockers.length} carried-over battle(s) still require resolution. Use force=true to override.`,
        blocking_cards: blockers.map(c => ({ id: c.id, status: c.status, target: c.target_territory_id })),
      }, { status: 400 });
    }

    const allCards = [...currentRoundCards, ...priorCarryoverCards];
    let resolvedCount = 0, autoResolvedCount = 0, forfeitedCount = 0, delayedCount = 0;

    for (const card of allCards) {
      if (card.result_applied) {
        if (['resolved', 'auto_resolved', 'forfeited'].includes(card.status)) resolvedCount++;
        if (['delayed', 'active_carryover'].includes(card.status)) delayedCount++;
        continue;
      }

      // Delayed cards from this round → promote to active_carryover for next round
      if (card.status === 'delayed') {
        await base44.asServiceRole.entities.BattleCard.update(card.id, { status: 'active_carryover' });
        delayedCount++;
        await log(base44, campaign_id, round, 'battle_carried_over', null, {
          battle_card_id: card.id, target_territory_id: card.target_territory_id, original_round: card.round, carry_to_round: round + 1,
        }, true);
        continue;
      }

      // active_carryover that wasn't resolved — carry again
      if (card.status === 'active_carryover') {
        delayedCount++;
        await log(base44, campaign_id, round, 'battle_carried_over_again', null, { battle_card_id: card.id, original_round: card.round }, true);
        continue;
      }

      let resultToApply = null;
      const isDoubleSiegeDefenderLost = card.battle_type === 'double_siege' && card.result?.double_siege_result?.defender_held === false;

      if (card.status === 'forfeited' && (card.result?.winner_player_id || isDoubleSiegeDefenderLost)) {
        resultToApply = card.result;
        forfeitedCount++;
      } else if (['resolved', 'auto_resolved'].includes(card.status) && (card.result?.winner_player_id || isDoubleSiegeDefenderLost)) {
        resultToApply = card.result;
        resolvedCount++;
      } else {
        const autoResult = autoResolveBattle(card, campaign_id);
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          status: 'auto_resolved', resolved_at: now,
          result: { ...autoResult, submitted_by: 'system', submitted_at: now, applied_at: null },
        });
        resultToApply = autoResult;
        autoResolvedCount++;
        await log(base44, campaign_id, round, 'battle_auto_resolved', null, { battle_card_id: card.id, winner_player_id: autoResult.winner_player_id }, true);
      }

      const resultIsDS = card.battle_type === 'double_siege' && resultToApply?.double_siege_result?.defender_held === false;
      if (resultToApply?.winner_player_id || resultIsDS) {
        const freshStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        await applyTerritoryUpdates(base44, buildTerritoryUpdates(card, resultToApply, freshStates));
        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          result_applied: true, result: { ...resultToApply, applied_at: new Date().toISOString() },
        });
      }
    }

    await refreshLockedTerritories(base44, campaign_id);

    const finalStates   = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const activePlayers = players.filter(p => !p.is_eliminated);
    const eliminatedNow = [];

    for (const p of activePlayers) {
      if (finalStates.filter(s => s.owner_player_id === p.id).length === 0) {
        await base44.asServiceRole.entities.CampaignPlayer.update(p.id, { is_eliminated: true, eliminated_at: new Date().toISOString() });
        eliminatedNow.push(p.id);
        await log(base44, campaign_id, round, 'player_eliminated', p.id, { display_name: p.display_name }, true);
      }
    }

    await base44.asServiceRole.entities.PhaseSnapshot.create({
      campaign_id, round, phase: 'battle', snapshot_type: 'phase_end',
      territory_states: finalStates.map(ts => ({ territory_id: ts.territory_id, owner_player_id: ts.owner_player_id ?? null, troop_count: ts.troop_count ?? 0 })),
      player_standings: activePlayers.map(p => {
        const owned = finalStates.filter(ts => ts.owner_player_id === p.id);
        return { player_id: p.id, display_name: p.display_name, territory_count: owned.length, troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0), is_eliminated: eliminatedNow.includes(p.id) || p.is_eliminated };
      }),
    });

    await log(base44, campaign_id, round, 'phase_advanced', null, { next_phase: 'fortify', round, battles_resolved: resolvedCount, battles_auto_resolved: autoResolvedCount, battles_forfeited: forfeitedCount, battles_delayed: delayedCount }, true);

    const remainingAfterElim = activePlayers.filter(p => !eliminatedNow.includes(p.id) && !p.is_eliminated);
    let nextPhase = 'fortify';
    let campaignComplete = false;
    if (remainingAfterElim.length <= 1) {
      nextPhase = 'complete';
      campaignComplete = true;
      if (remainingAfterElim.length === 1) {
        await log(base44, campaign_id, round, 'campaign_victory', remainingAfterElim[0].id, { display_name: remainingAfterElim[0].display_name, rounds_played: round, condition: 'domination' }, true);
      }
      await base44.asServiceRole.entities.Campaign.update(campaign_id, { current_phase: 'complete', status: 'complete' });
    } else {
      await base44.asServiceRole.entities.Campaign.update(campaign_id, { current_phase: 'fortify' });
    }

    return Response.json({ success: true, next_phase: nextPhase, campaign_complete: campaignComplete, battles_resolved: resolvedCount, battles_auto_resolved: autoResolvedCount, battles_forfeited: forfeitedCount, battles_delayed: delayedCount, players_eliminated: eliminatedNow });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});

// ── Legacy setPreference helper (used by voteDelay, voteAutoResolve, playerForfeit) ──
async function handleSetPreferenceDirect(base44, campaign_id, battle_card_id, preference, acting_as_player_id, round, isAdmin, myPlayer, players, resolveEffectivePlayer, logFn) {
  if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

  const effective = resolveEffectivePlayer(acting_as_player_id);
  if (!effective.ok) return Response.json({ error: effective.error }, { status: 403 });
  const effectivePlayer = effective.player;

  const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
  const card  = cards[0];
  if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
  if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

  const participantIds = [];
  for (const atk of (card.attackers ?? [])) { if (atk.player_id) participantIds.push(atk.player_id); }
  if (card.defender_player_id) participantIds.push(card.defender_player_id);

  if (!participantIds.includes(effectivePlayer.id)) return Response.json({ error: 'Not a participant' }, { status: 403 });
  if (!['pending', 'awaiting_result', 'active_carryover'].includes(card.status)) return Response.json({ error: `Cannot set preference for card in status: ${card.status}` }, { status: 400 });

  const currentPrefs = { ...(card.battle_preferences ?? {}) };
  currentPrefs[effectivePlayer.id] = preference;

  await base44.asServiceRole.entities.BattleCard.update(battle_card_id, { battle_preferences: currentPrefs });
  await logFn(base44, campaign_id, card.round, 'battle_preference_set_legacy', effectivePlayer.id, { battle_card_id, preference }, true);

  return Response.json({ success: true, status: card.status, battle_preferences: currentPrefs });
}