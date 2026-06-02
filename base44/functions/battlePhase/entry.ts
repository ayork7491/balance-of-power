/**
 * battlePhase — backend handler for BattleCard lifecycle.
 *
 * Actions:
 *   getBattleCards      — list battle cards for a campaign (current round + any delayed from prior rounds)
 *   submitResult        — submit tabletop battle result (admin only)
 *   approveResult       — approve or flag a submitted result (uses acting_as_player_id for perspective)
 *   adminOverride       — admin clears flags and forces result into awaiting_approval (unstuck)
 *   autoResolve         — force auto-resolve a specific battle card (admin OR unanimous player vote)
 *   setDelayed          — admin: delay a battle (pause resolution)
 *   setForfeited        — admin: mark battle as forfeited (winner by forfeit, retains all committed troops)
 *   voteDelay           — participant: vote to delay this battle (unanimous required)
 *   voteAutoResolve     — participant: vote to auto-resolve this battle (unanimous required)
 *   playerForfeit       — participant: forfeit their own troops (losing player gives up)
 *   processPhaseEnd     — admin: auto-resolve all pending battles, apply all results,
 *                         carry delayed battles to next round, update territory states,
 *                         check eliminations, advance phase.
 *
 * ─── TROOP CONVERSION SAFETY ─────────────────────────────────────────────────
 *   All BOP troop outcomes use getWinnerCommittedTroops() directly.
 *   TT values are helpers only — never source of truth for final BOP counts.
 *   Survivor BOP = round(surviving_TT / tabletop_size * total_troops) — clamped to committed BOP.
 *   Forfeit winner retains EXACTLY their committed BOP troops (no conversion round-trip).
 *
 * ─── DOUBLE SIEGE RESOLUTION MATRIX ─────────────────────────────────────────
 *   Outcome 1 — Defender Wins:
 *     Defender keeps territory + survivors. Both attackers lose committed troops.
 *   Outcome 2 — Defender Loses:
 *     Territory becomes UNCLAIMED. Attacker survivors return to origin. No attacker gains territory.
 *   Auto-resolve: weighted random between "defender wins" and "defender loses".
 *     NEVER awards territory to either attacker.
 *   Forfeit (defender forfeits): territory becomes unclaimed, both attackers keep committed troops.
 *   Forfeit (both attackers): defender keeps territory + all committed troops.
 *   Forfeit (one attacker): forfeiting attacker loses troops; remaining attacker + defender continue.
 *
 * ─── BLOODBATH 0-TROOP SPLIT ─────────────────────────────────────────────────
 *   If winner captures both territories (loser vacated):
 *     survivors split evenly; odd troop stays in origin.
 *   Both territories must have at least 1 troop when controlled.
 *
 * ─── DELAYED BATTLE LIFECYCLE ────────────────────────────────────────────────
 *   Round N: Battle card created → player votes/admin sets delayed
 *   processPhaseEnd(N): delayed cards are NOT resolved; result_applied stays false.
 *   Round N+1: getBattleCards returns BOTH current round cards AND delayed cards.
 *   processPhaseEnd(N+1): delayed cards resolved normally (or carried again).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Scale tabletop survivors back to BOP troops. Clamped to [0, committedBOP].
 * This is the ONLY survivor conversion function — prevents round-trip inflation.
 */
function scaleBackSurvivors(survivingTabletop, tabletopSize, totalTroopsInBattle, committedBOP) {
  if (tabletopSize <= 0 || totalTroopsInBattle <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, survivingTabletop / tabletopSize));
  const raw = Math.round(ratio * totalTroopsInBattle);
  // Clamp to committed BOP to prevent rounding inflation
  return committedBOP != null ? Math.min(raw, committedBOP) : raw;
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
 * Get winner's committed BOP troops — authoritative, no conversion.
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

/**
 * Auto-resolve a battle.
 *
 * For double_siege: only two outcomes — defender wins or defender loses.
 * NEVER awards territory to either attacker.
 */
function autoResolveBattle(card, campaignId) {
  const rng   = seededRandom(`${campaignId}:${card.round}:${card.id}`);
  const sides = buildSides(card);

  if (sides.length === 0) {
    return { winner_player_id: null, surviving_tabletop_troops: 0, notes: 'No participants — auto-resolved.', result_source: 'auto' };
  }

  // ── Double siege: only defender-wins or defender-loses outcome ─────────────
  if (card.battle_type === 'double_siege') {
    const defenderTroops  = card.defender_troops ?? 0;
    const totalAttacking  = card.total_attacking_troops ?? 0;
    const totalWeight     = defenderTroops + totalAttacking;
    const defenderHeld    = totalWeight > 0 ? rng() < (defenderTroops / totalWeight) : rng() < 0.5;

    const retainRatio = 0.6 + rng() * 0.3;

    if (defenderHeld) {
      // Defender wins — survivors stay in territory
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
      // Defender loses — territory unclaimed, attackers get some survivors back
      const attackerSurvivors = (card.attackers ?? []).map(a => {
        const atkTT = winnerCommittedTabletop(card, a.player_id);
        const survivors = Math.round(atkTT * (0.3 + rng() * 0.4)); // attackers take losses too
        return { player_id: a.player_id, tabletop_survivors: Math.max(0, survivors) };
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

  // ── Standard / bloodbath: weighted random ─────────────────────────────────
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
 * All BOP survivor counts are clamped to committed BOP to prevent rounding errors.
 *
 * ─── TERRITORY RESOLUTION MATRIX ─────────────────────────────────────────────
 * siege / double_siege:
 *   - Defender wins: keeps territory + BOP survivors. Attackers lose committed troops.
 *   - Attacker wins (siege): gains territory + survivors.
 *   - Double siege defender loses: territory unclaimed. Attacker survivors return to origin. NO attacker gains territory.
 * capture_objectives: winner gains territory. Losers return declared survivors to origin.
 * bloodbath: winner captures loser territory if loser vacated.
 *   - Split survivors between both controlled territories (min 1 each if >1 total).
 */
function buildTerritoryUpdates(card, result, territoryStates) {
  const { winner_player_id, surviving_tabletop_troops } = result;
  const isDoubleSiegeResult = card.battle_type === 'double_siege' && result.double_siege_result != null;
  if (!winner_player_id && !isDoubleSiegeResult) return [];

  // ── Compute authoritative BOP survivors (clamped to committed BOP) ─────────
  let survivingTroops = 0;
  if (winner_player_id) {
    const committedBOP = getWinnerCommittedTroops(card, winner_player_id);
    if ((card.tabletop_size ?? 0) <= 0) {
      survivingTroops = committedBOP;
    } else {
      survivingTroops = scaleBackSurvivors(
        surviving_tabletop_troops ?? 0,
        card.tabletop_size,
        card.total_troops_in_battle ?? 0,
        committedBOP,
      );
    }
  }

  const updates = [];

  console.log(`[buildTerritoryUpdates] battle_card_id=${card.id} battle_type=${card.battle_type} is_mutual=${card.is_mutual}`);
  console.log(`[buildTerritoryUpdates] winner=${winner_player_id} surviving_tabletop=${surviving_tabletop_troops} bop_survivors=${survivingTroops}`);

  if (card.is_mutual) {
    // ── Bloodbath ──────────────────────────────────────────────────────────────
    const winnerEntry  = (card.attackers ?? []).find(a => a.player_id === winner_player_id);
    const loserEntries = (card.attackers ?? []).filter(a => a.player_id !== winner_player_id);

    let winnerCaptures = false;

    for (const loserEntry of loserEntries) {
      const loserOriginState = territoryStates.find(s => s.territory_id === loserEntry.origin_territory_id);
      if (loserOriginState) {
        const loserHasGarrison = (loserOriginState.troop_count ?? 0) > 0 &&
          loserOriginState.owner_player_id === loserEntry.player_id;

        if (!loserHasGarrison) {
          winnerCaptures = true;
          const capturedTerritoryId = loserEntry.origin_territory_id;

          // ── FIX 5: split survivors evenly between origin and captured territory ──
          // Prevents 0-troop controlled territory.
          const splitCapture = Math.floor(survivingTroops / 2);
          const splitOrigin  = survivingTroops - splitCapture; // odd troop stays at origin

          console.log(`[bloodbath split] survivors=${survivingTroops} origin=${splitOrigin} captured=${splitCapture}`);

          updates.push({
            id:              loserOriginState.id,
            territory_id:    capturedTerritoryId,
            owner_player_id: winner_player_id,
            troop_count:     Math.max(survivingTroops > 0 ? 1 : 0, splitCapture),
          });

          // Winner's origin gets the remaining split
          if (winnerEntry) {
            const winnerOriginState = territoryStates.find(s => s.territory_id === winnerEntry.origin_territory_id);
            if (winnerOriginState) {
              const before = winnerOriginState.troop_count ?? 0;
              updates.push({
                id:              winnerOriginState.id,
                territory_id:    winnerEntry.origin_territory_id,
                owner_player_id: winner_player_id,
                troop_count:     before + splitOrigin,
              });
            }
          }
        }
      }
    }

    // If winner didn't capture (loser had garrison), add survivors to own origin
    if (!winnerCaptures && winnerEntry) {
      const winnerOriginState = territoryStates.find(s => s.territory_id === winnerEntry.origin_territory_id);
      if (winnerOriginState) {
        const before = winnerOriginState.troop_count ?? 0;
        updates.push({
          id:              winnerOriginState.id,
          territory_id:    winnerEntry.origin_territory_id,
          owner_player_id: winner_player_id,
          troop_count:     before + survivingTroops,
        });
      }
    }

  } else if (card.battle_type === 'skirmish') {
    // ── Skirmish ──────────────────────────────────────────────────────────────
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    const troopsToPlace = survivingTroops > 0 ? survivingTroops : getWinnerCommittedTroops(card, winner_player_id);
    if (targetState) {
      updates.push({
        id:              targetState.id,
        territory_id:    card.target_territory_id,
        owner_player_id: winner_player_id,
        troop_count:     troopsToPlace,
      });
    }

  } else if (card.battle_type === 'capture_objectives') {
    // ── Capture Objectives ────────────────────────────────────────────────────
    const winnerCommitted = getWinnerCommittedTroops(card, winner_player_id);
    const clampedSurvivors = Math.max(1, Math.min(survivingTroops, winnerCommitted));

    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) {
      updates.push({
        id:              targetState.id,
        territory_id:    card.target_territory_id,
        owner_player_id: winner_player_id,
        troop_count:     clampedSurvivors,
      });
    } else {
      updates.push({
        _create: true,
        campaign_id:     card.campaign_id,
        map_id:          card.map_id ?? null,
        territory_id:    card.target_territory_id,
        owner_player_id: winner_player_id,
        troop_count:     clampedSurvivors,
      });
    }

    // Losers: return declared survivors to their origin
    const loserTTSurvivors = result.loser_tabletop_survivors ?? {};
    for (const atk of (card.attackers ?? [])) {
      if (atk.player_id === winner_player_id) continue;
      const loserOriginState = territoryStates.find(s => s.territory_id === atk.origin_territory_id);
      if (loserOriginState) {
        const loserTT = loserTTSurvivors[atk.player_id] ?? 0;
        const loserCommitted = atk.committed_troops ?? 0;
        const loserBopSurvivors = scaleBackSurvivors(loserTT, card.tabletop_size ?? 0, card.total_troops_in_battle ?? 0, loserCommitted);
        const before = loserOriginState.troop_count ?? 0;
        updates.push({
          id:              loserOriginState.id,
          territory_id:    atk.origin_territory_id,
          owner_player_id: atk.player_id,
          troop_count:     before + loserBopSurvivors,
        });
      }
    }

  } else if (card.battle_type === 'double_siege' && result.double_siege_result != null) {
    // ── Double Siege ──────────────────────────────────────────────────────────
    // RULE: Only two outcomes — defender wins or defender loses.
    // NEVER awards territory to either attacker.
    const ds = result.double_siege_result;
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);

    if (ds.defender_held) {
      // Defender wins: survivors stay in territory
      const defenderCommitted = getWinnerCommittedTroops(card, card.defender_player_id);
      const defenderBOP = scaleBackSurvivors(
        ds.defender_surviving_tabletop ?? 0,
        card.tabletop_size ?? 0,
        card.total_troops_in_battle ?? 0,
        defenderCommitted,
      );
      console.log(`[double_siege] defender held. territory=${card.target_territory_id} bop_survivors=${defenderBOP}`);
      if (targetState) {
        updates.push({
          id:              targetState.id,
          territory_id:    card.target_territory_id,
          owner_player_id: card.defender_player_id,
          troop_count:     Math.max(1, defenderBOP),
        });
      }
      // Attackers lose all committed troops — already removed in attackPhase, no return
    } else {
      // Defender loses: territory becomes unclaimed. Attacker survivors return to origin.
      console.log(`[double_siege] defender lost. territory=${card.target_territory_id} becomes unclaimed.`);
      if (targetState) {
        updates.push({
          id:              targetState.id,
          territory_id:    card.target_territory_id,
          owner_player_id: null,
          troop_count:     0,
        });
      }
      // Each attacker's survivors return to their origin territory
      for (const atkSurvivor of (ds.attacker_survivors ?? [])) {
        const atk = (card.attackers ?? []).find(a => a.player_id === atkSurvivor.player_id);
        if (!atk) continue;
        const atkOriginState = territoryStates.find(s => s.territory_id === atk.origin_territory_id);
        if (atkOriginState) {
          const atkCommitted = atk.committed_troops ?? 0;
          const atkBOP = scaleBackSurvivors(
            atkSurvivor.tabletop_survivors ?? 0,
            card.tabletop_size ?? 0,
            card.total_troops_in_battle ?? 0,
            atkCommitted,
          );
          const before = atkOriginState.troop_count ?? 0;
          updates.push({
            id:              atkOriginState.id,
            territory_id:    atk.origin_territory_id,
            owner_player_id: atk.player_id,
            troop_count:     before + atkBOP,
          });
        }
      }
    }

  } else {
    // ── Siege ─────────────────────────────────────────────────────────────────
    const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
    if (targetState) {
      console.log(`[siege] winner=${winner_player_id} target=${card.target_territory_id} bop_survivors=${survivingTroops}`);
      updates.push({
        id:              targetState.id,
        territory_id:    card.target_territory_id,
        owner_player_id: winner_player_id,
        troop_count:     survivingTroops,
      });
    }
  }

  console.log(`[buildTerritoryUpdates] updates=${JSON.stringify(updates)}`);
  return updates;
}

async function applyTerritoryUpdates(base44, updates) {
  for (const upd of updates) {
    if (upd._create) {
      await base44.asServiceRole.entities.TerritoryState.create({
        campaign_id:     upd.campaign_id,
        map_id:          upd.map_id ?? '',
        territory_id:    upd.territory_id,
        owner_player_id: upd.owner_player_id,
        troop_count:     upd.troop_count,
      });
    } else {
      await base44.asServiceRole.entities.TerritoryState.update(upd.id, {
        owner_player_id: upd.owner_player_id,
        troop_count:     upd.troop_count,
      });
    }
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

  function resolveEffectivePlayer(acting_as_player_id) {
    if (!acting_as_player_id) return { ok: true, player: myPlayer };
    const target = players.find(p => p.id === acting_as_player_id);
    if (!target) {
      return { ok: false, error: 'Invalid acting_as_player_id' };
    }
    if (target.id === myPlayer.id) return { ok: true, player: myPlayer };
    if (myPlayer.is_admin) return { ok: true, player: target };
    if (user.role === 'admin') return { ok: true, player: target };
    return { ok: false, error: 'Only campaign admins can act as other players' };
  }

  // ── Shared apply-and-resolve helper ─────────────────────────────────────────
  async function applyAutoResolve(card, autoResult, base44Ref, campaign_idRef, roundRef) {
    const now = new Date().toISOString();
    await base44Ref.asServiceRole.entities.BattleCard.update(card.id, {
      status:      'auto_resolved',
      resolved_at: now,
      result:      { ...autoResult, submitted_by: 'system', submitted_at: now, applied_at: null },
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
      battle_card_id: card.id,
      target_territory_id: card.target_territory_id,
      winner_player_id: autoResult.winner_player_id,
    }, true);
  }

  // ── getBattleCards ────────────────────────────────────────────────────────────
  if (action === 'getBattleCards') {
    const queryRound = body.round ?? round;
    const currentCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: queryRound });

    let delayedFromPriorRounds = [];
    if (queryRound > 1) {
      for (let r = queryRound - 1; r >= Math.max(1, queryRound - 10); r--) {
        const priorCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: r });
        const delayed = priorCards.filter(c => c.status === 'delayed' && !c.result_applied);
        delayedFromPriorRounds = [...delayedFromPriorRounds, ...delayed];
        if (priorCards.length === 0) break;
      }
    }

    return Response.json({ battle_cards: [...currentCards, ...delayedFromPriorRounds] });
  }

  // ── submitResult ─────────────────────────────────────────────────────────────
  if (action === 'submitResult') {
    if (!isAdmin) {
      return Response.json({ error: 'Only the campaign admin can submit battle results' }, { status: 403 });
    }

    const {
      battle_card_id, winner_player_id, surviving_tabletop_troops, notes,
      loser_tabletop_survivors,
      double_siege_result,
    } = body;

    if (!battle_card_id) {
      return Response.json({ error: 'battle_card_id required' }, { status: 400 });
    }

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    if (!['pending', 'awaiting_result', 'delayed', 'result_submitted', 'awaiting_approval'].includes(card.status)) {
      return Response.json({ error: `Cannot submit result for card in status: ${card.status}` }, { status: 400 });
    }

    // ── double_siege special path ──────────────────────────────────────────────
    if (card.battle_type === 'double_siege' && double_siege_result != null) {
      const { defender_held, defender_surviving_tabletop, attacker_survivors } = double_siege_result;
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'result_submitted',
        approvals: [],
        result: {
          double_siege_result: {
            defender_held: !!defender_held,
            defender_surviving_tabletop: defender_held ? Math.max(0, Math.round(defender_surviving_tabletop ?? 0)) : 0,
            attacker_survivors: (attacker_survivors ?? []).map(a => ({
              player_id: a.player_id,
              tabletop_survivors: Math.max(0, Math.round(a.tabletop_survivors ?? 0)),
            })),
          },
          winner_player_id: defender_held ? (card.defender_player_id ?? null) : null,
          surviving_tabletop_troops: defender_held ? Math.max(0, Math.round(defender_surviving_tabletop ?? 0)) : 0,
          notes: notes ?? '',
          submitted_by: myPlayer.id,
          submitted_at: now,
          result_source: 'manual',
          applied_at: null,
        },
      });
      await log(base44, campaign_id, card.round, 'battle_result_submitted', myPlayer.id, {
        battle_card_id, target_territory_id: card.target_territory_id, battle_type: 'double_siege',
        defender_held: !!defender_held,
      }, true);
      return Response.json({ success: true, status: 'result_submitted' });
    }

    // ── standard path ──────────────────────────────────────────────────────────
    if (winner_player_id == null || surviving_tabletop_troops == null) {
      return Response.json({ error: 'winner_player_id and surviving_tabletop_troops required' }, { status: 400 });
    }

    const participantIds = getParticipantIds(card);
    if (!participantIds.includes(winner_player_id)) {
      return Response.json({ error: 'Winner must be a participant in this battle' }, { status: 400 });
    }

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
      status:    'result_submitted',
      approvals: [],
      result: {
        winner_player_id,
        surviving_tabletop_troops: clampedSurvivors,
        loser_tabletop_survivors: clampedLoserSurvivors ?? null,
        notes: notes ?? '',
        submitted_by: myPlayer.id,
        submitted_at: now,
        result_source: 'manual',
        applied_at: null,
      },
    });

    await log(base44, campaign_id, card.round, 'battle_result_submitted', myPlayer.id, {
      battle_card_id, target_territory_id: card.target_territory_id,
      winner_player_id, surviving_tabletop_troops: clampedSurvivors,
    }, true);

    return Response.json({ success: true, status: 'result_submitted' });
  }

  // ── approveResult ─────────────────────────────────────────────────────────────
  if (action === 'approveResult') {
    const { battle_card_id, approved, flagged, acting_as_player_id } = body;
    if (!battle_card_id || approved == null) {
      return Response.json({ error: 'battle_card_id and approved required' }, { status: 400 });
    }

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
    const updatePayload = { approvals: updatedApprovals, status: newStatus };
    if (newStatus === 'resolved') updatePayload.resolved_at = new Date().toISOString();

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, updatePayload);

    if (newStatus === 'resolved' && !card.result_applied) {
      const result = card.result;
      const isDoubleSiegeResult = card.battle_type === 'double_siege' && result?.double_siege_result != null;
      const hasApplicableResult = result?.winner_player_id || isDoubleSiegeResult;

      if (hasApplicableResult) {
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const updates = buildTerritoryUpdates(card, result, territoryStates);
        await applyTerritoryUpdates(base44, updates);
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          result_applied: true,
          result: { ...result, applied_at: new Date().toISOString() },
        });
        await log(base44, campaign_id, card.round, 'battle_result_applied', null, {
          battle_card_id, target_territory_id: card.target_territory_id,
          winner_player_id: result.winner_player_id ?? null,
        }, true);
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

    const hasResult = card.result?.winner_player_id ||
      (card.battle_type === 'double_siege' && card.result?.double_siege_result != null);
    if (!hasResult) {
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

      await log(base44, campaign_id, card.round, 'battle_admin_override_resolved', myPlayer.id, { battle_card_id }, true);
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
  // Admin-direct auto-resolve (not vote-based)
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

  // ── voteAutoResolve ───────────────────────────────────────────────────────────
  // Participant vote to auto-resolve. Unanimous required.
  if (action === 'voteAutoResolve') {
    const { battle_card_id, vote, acting_as_player_id } = body;
    if (!battle_card_id || !['yes', 'no'].includes(vote)) {
      return Response.json({ error: 'battle_card_id and vote (yes|no) required' }, { status: 400 });
    }

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
      return Response.json({ error: `Cannot vote for card in status: ${card.status}` }, { status: 400 });
    }

    const currentVotes = { ...(card.auto_resolve_votes ?? {}) };
    currentVotes[effectivePlayer.id] = vote;

    const participantVotes = Object.fromEntries(
      Object.entries(currentVotes).filter(([pid]) => participantIds.includes(pid))
    );
    const yesVotes      = Object.values(participantVotes).filter(v => v === 'yes').length;
    const totalRequired = participantIds.length;
    const unanimous     = yesVotes >= totalRequired;

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      auto_resolve_votes: currentVotes,
    });

    await log(base44, campaign_id, card.round, 'battle_auto_resolve_vote', effectivePlayer.id, {
      battle_card_id, vote, yes_count: yesVotes, total_participants: totalRequired, unanimous,
    }, true);

    if (unanimous) {
      // Reload card with freshest data for auto-resolve
      const freshCards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
      const freshCard  = { ...freshCards[0], auto_resolve_votes: currentVotes };
      const autoResult = autoResolveBattle(freshCard, campaign_id);
      await applyAutoResolve(freshCard, autoResult, base44, campaign_id, round);
      return Response.json({ success: true, status: 'auto_resolved', unanimous: true, result: autoResult, auto_resolve_votes: currentVotes });
    }

    return Response.json({
      success: true,
      status: card.status,
      auto_resolve_votes: currentVotes,
      votes_needed: Math.max(0, totalRequired - yesVotes),
      unanimous: false,
    });
  }

  // ── playerForfeit ─────────────────────────────────────────────────────────────
  // A player forfeits their own troops in this battle.
  // Forfeit = that player loses. If ALL participants forfeit → auto-resolve.
  // For double_siege:
  //   Defender forfeits → territory unclaimed, attackers keep troops.
  //   Both attackers forfeit → defender keeps territory + committed troops.
  //   One attacker forfeits → that attacker loses troops; other attacker + defender continue (card remains open).
  if (action === 'playerForfeit') {
    const { battle_card_id, acting_as_player_id } = body;
    if (!battle_card_id) return Response.json({ error: 'battle_card_id required' }, { status: 400 });

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
    if (!['pending', 'awaiting_result'].includes(card.status)) {
      return Response.json({ error: `Cannot forfeit for card in status: ${card.status}` }, { status: 400 });
    }

    // Track forfeits on the card
    const currentForfeits = { ...(card.player_forfeits ?? {}) };
    currentForfeits[effectivePlayer.id] = true;

    const forfeitedIds = participantIds.filter(pid => currentForfeits[pid]);
    const activePlayers = participantIds.filter(pid => !currentForfeits[pid]);

    await log(base44, campaign_id, card.round, 'battle_player_forfeit', effectivePlayer.id, {
      battle_card_id, forfeited_ids: forfeitedIds, active_players: activePlayers,
    }, true);

    // ── Double siege forfeit rules ───────────────────────────────────────────
    if (card.battle_type === 'double_siege') {
      const attackerPlayerIds = [...new Set((card.attackers ?? []).map(a => a.player_id))];
      const defenderForfeited = currentForfeits[card.defender_player_id ?? ''];
      const allAttackersForfeited = attackerPlayerIds.every(pid => currentForfeits[pid]);

      if (defenderForfeited) {
        // Defender forfeits: territory becomes unclaimed, attackers keep all committed troops
        const now = new Date().toISOString();
        const forfeitResult = {
          winner_player_id: null,
          surviving_tabletop_troops: 0,
          notes: 'Defender forfeited. Territory unclaimed. Attacker troops return to origin.',
          submitted_by: effectivePlayer.id,
          submitted_at: now,
          result_source: 'forfeit',
          applied_at: null,
          double_siege_result: {
            defender_held: false,
            defender_surviving_tabletop: 0,
            attacker_survivors: attackerPlayerIds.map(pid => ({
              player_id: pid,
              // Attackers keep ALL their committed troops
              tabletop_survivors: winnerCommittedTabletop(card, pid),
            })),
          },
        };
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          status: 'forfeited', resolved_at: now,
          player_forfeits: currentForfeits, result: forfeitResult,
        });
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const updates = buildTerritoryUpdates(card, forfeitResult, territoryStates);
        await applyTerritoryUpdates(base44, updates);
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() },
        });
        await refreshLockedTerritories(base44, campaign_id);
        return Response.json({ success: true, status: 'forfeited', result: forfeitResult });

      } else if (allAttackersForfeited) {
        // Both attackers forfeit: defender wins, keeps territory + all committed troops
        const defenderCommitted = getWinnerCommittedTroops(card, card.defender_player_id);
        const now = new Date().toISOString();
        const forfeitResult = {
          winner_player_id: card.defender_player_id,
          surviving_tabletop_troops: winnerCommittedTabletop(card, card.defender_player_id),
          notes: 'All attackers forfeited. Defender holds territory.',
          submitted_by: effectivePlayer.id,
          submitted_at: now,
          result_source: 'forfeit',
          applied_at: null,
          double_siege_result: {
            defender_held: true,
            defender_surviving_tabletop: winnerCommittedTabletop(card, card.defender_player_id),
            attacker_survivors: attackerPlayerIds.map(pid => ({ player_id: pid, tabletop_survivors: 0 })),
          },
        };
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          status: 'forfeited', resolved_at: now,
          player_forfeits: currentForfeits, result: forfeitResult,
        });
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        // Winner (defender) keeps exact committed BOP troops
        const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
        if (targetState) {
          await base44.asServiceRole.entities.TerritoryState.update(targetState.id, {
            owner_player_id: card.defender_player_id,
            troop_count: defenderCommitted,
          });
        }
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() },
        });
        await refreshLockedTerritories(base44, campaign_id);
        return Response.json({ success: true, status: 'forfeited', result: forfeitResult });

      } else {
        // One attacker forfeited but battle continues with remaining participants
        // Just record the forfeit — card stays open
        await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
          player_forfeits: currentForfeits,
        });
        return Response.json({
          success: true, status: card.status, player_forfeits: currentForfeits,
          message: 'Forfeit recorded. Battle continues with remaining participants.',
          active_players: activePlayers,
        });
      }
    }

    // ── Standard / capture_objectives / bloodbath forfeit ────────────────────
    // All participants forfeited → auto-resolve
    if (forfeitedIds.length >= participantIds.length) {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        player_forfeits: currentForfeits,
      });
      const freshCards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
      const autoResult = autoResolveBattle(freshCards[0], campaign_id);
      await applyAutoResolve(freshCards[0], autoResult, base44, campaign_id, round);
      return Response.json({ success: true, status: 'auto_resolved', all_forfeited: true, result: autoResult });
    }

    // One player forfeited — that player loses, winner is the remaining active participant.
    // For 1v1 battles (siege/bloodbath): immediately resolve.
    if (activePlayers.length === 1) {
      const winnerId = activePlayers[0];
      const winnerCommitted = getWinnerCommittedTroops(card, winnerId);
      const now = new Date().toISOString();
      const forfeitResult = {
        winner_player_id: winnerId,
        // Winner keeps EXACTLY their committed BOP troops (no TT round-trip)
        surviving_tabletop_troops: winnerCommittedTabletop(card, winnerId),
        notes: `${effectivePlayer.display_name} forfeited.`,
        submitted_by: effectivePlayer.id,
        submitted_at: now,
        result_source: 'forfeit',
        applied_at: null,
        winner_bop_survivors: winnerCommitted, // authoritative BOP count stored for display
      };
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'forfeited', resolved_at: now,
        player_forfeits: currentForfeits, result: forfeitResult,
      });
      const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      // Use direct BOP for territory update, not the TT conversion
      const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
      if (card.battle_type === 'bloodbath') {
        // Bloodbath: winner gets both territories if loser vacated
        const loserEntry = (card.attackers ?? []).find(a => a.player_id === effectivePlayer.id);
        const winnerEntry = (card.attackers ?? []).find(a => a.player_id === winnerId);
        if (loserEntry && winnerEntry) {
          const loserState = territoryStates.find(s => s.territory_id === loserEntry.origin_territory_id);
          const winnerState = territoryStates.find(s => s.territory_id === winnerEntry.origin_territory_id);
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
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() },
      });
      await refreshLockedTerritories(base44, campaign_id);
      return Response.json({ success: true, status: 'forfeited', result: forfeitResult });
    }

    // Multiple active players remain — record forfeit, card stays open
    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      player_forfeits: currentForfeits,
    });
    return Response.json({
      success: true, status: card.status, player_forfeits: currentForfeits,
      message: 'Forfeit recorded. Battle continues.',
      active_players: activePlayers,
    });
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

      // FIX 1: Winner keeps EXACTLY their committed BOP troops — no TT conversion round-trip.
      const winnerCommittedBOP = getWinnerCommittedTroops(card, winner_player_id);

      const forfeitResult = {
        winner_player_id,
        // Store TT value for display compatibility but BOP is authoritative
        surviving_tabletop_troops: winnerCommittedTabletop(card, winner_player_id),
        winner_bop_survivors: winnerCommittedBOP, // authoritative
        notes: 'Victory by forfeit.',
        submitted_by: 'admin',
        submitted_at: new Date().toISOString(),
        result_source: 'forfeit',
        applied_at: null,
      };

      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'forfeited', resolved_at: new Date().toISOString(), result: forfeitResult,
      });

      // Apply territory: winner gets territory with EXACT committed BOP troops
      const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      const targetState = territoryStates.find(s => s.territory_id === card.target_territory_id);
      if (targetState) {
        await base44.asServiceRole.entities.TerritoryState.update(targetState.id, {
          owner_player_id: winner_player_id,
          troop_count: winnerCommittedBOP,
        });
      }
      // For bloodbath: also handle loser territory
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

      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        result_applied: true, result: { ...forfeitResult, applied_at: new Date().toISOString() },
      });
      await refreshLockedTerritories(base44, campaign_id);
      await log(base44, campaign_id, card.round, 'battle_forfeited', null, { battle_card_id, winner_player_id, winner_bop_survivors: winnerCommittedBOP }, true);
      return Response.json({ success: true, result: forfeitResult });
    } else {
      await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
        status: 'awaiting_result', resolved_at: null, result: {}, result_applied: false,
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

    const effective = resolveEffectivePlayer(acting_as_player_id);
    if (!effective.ok) return Response.json({ error: effective.error }, { status: 403 });
    const effectivePlayer = effective.player;

    const cards = await base44.asServiceRole.entities.BattleCard.filter({ id: battle_card_id });
    const card  = cards[0];
    if (!card) return Response.json({ error: 'Battle card not found' }, { status: 404 });
    if (card.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });

    const participantIds = getParticipantIds(card);
    const isEffectiveParticipant = participantIds.includes(effectivePlayer.id);

    if (!isEffectiveParticipant && !isAdmin) {
      return Response.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    if (!['pending', 'awaiting_result'].includes(card.status)) {
      return Response.json({ error: `Cannot vote delay for card in status: ${card.status}` }, { status: 400 });
    }

    const currentVotes = { ...(card.delay_votes ?? {}) };
    currentVotes[effectivePlayer.id] = vote;

    const participantVotes = Object.fromEntries(
      Object.entries(currentVotes).filter(([pid]) => participantIds.includes(pid))
    );
    const yesVotes      = Object.values(participantVotes).filter(v => v === 'yes').length;
    const noVotes       = Object.values(participantVotes).filter(v => v === 'no').length;
    const totalRequired = participantIds.length;

    let newStatus = card.status;
    if (noVotes > 0) {
      newStatus = 'awaiting_result';
    } else if (yesVotes >= totalRequired) {
      newStatus = 'delayed';
    }

    await base44.asServiceRole.entities.BattleCard.update(battle_card_id, {
      status: newStatus,
      delay_votes: currentVotes,
      ...(newStatus === 'delayed' ? { delayed_at: new Date().toISOString() } : {}),
    });

    if (newStatus === 'delayed') {
      await refreshLockedTerritories(base44, campaign_id);
    }

    const allVoted = (yesVotes + noVotes) >= totalRequired;
    await log(base44, campaign_id, card.round, 'battle_delay_vote', effectivePlayer.id, {
      battle_card_id, vote, yes_count: yesVotes, no_count: noVotes,
      total_participants: totalRequired, all_voted: allVoted, new_status: newStatus,
    }, true);

    return Response.json({
      success: true, status: newStatus, delay_votes: currentVotes,
      votes_needed: Math.max(0, totalRequired - yesVotes), all_voted: allVoted,
    });
  }

  // ── processPhaseEnd ───────────────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
    if (campaign.current_phase !== 'battle') {
      return Response.json({ error: 'Not in battle phase' }, { status: 400 });
    }

    const currentRoundCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round });

    let priorDelayedCards = [];
    for (let r = round - 1; r >= Math.max(1, round - 10); r--) {
      const priorCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: r });
      const delayed = priorCards.filter(c => c.status === 'delayed' && !c.result_applied);
      priorDelayedCards = [...priorDelayedCards, ...delayed];
      if (priorCards.length === 0) break;
    }

    const allCards = [...currentRoundCards, ...priorDelayedCards];

    let resolvedCount = 0, autoResolvedCount = 0, forfeitedCount = 0, delayedCount = 0;

    for (const card of allCards) {
      if (card.result_applied) {
        if (['resolved', 'auto_resolved', 'forfeited'].includes(card.status)) resolvedCount++;
        if (card.status === 'delayed') delayedCount++;
        continue;
      }

      if (card.status === 'delayed') {
        delayedCount++;
        await log(base44, campaign_id, round, 'battle_delayed_carried', null, {
          battle_card_id: card.id, target_territory_id: card.target_territory_id,
          original_round: card.round, carrying_to_round: round + 1,
        }, true);
        continue;
      }

      let resultToApply = null;

      const isDoubleSiegeDefenderLost = card.battle_type === 'double_siege'
        && card.result?.double_siege_result != null
        && card.result.double_siege_result.defender_held === false;

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
        await log(base44, campaign_id, round, 'battle_auto_resolved', null, {
          battle_card_id: card.id, target_territory_id: card.target_territory_id,
          winner_player_id: autoResult.winner_player_id,
        }, true);
      }

      const resultIsDoubleSiegeDefenderLost = card.battle_type === 'double_siege'
        && resultToApply?.double_siege_result != null
        && resultToApply.double_siege_result.defender_held === false;

      if (resultToApply?.winner_player_id || resultIsDoubleSiegeDefenderLost) {
        const freshStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const updates = buildTerritoryUpdates(card, resultToApply, freshStates);
        await applyTerritoryUpdates(base44, updates);
        await base44.asServiceRole.entities.BattleCard.update(card.id, {
          result_applied: true,
          result: { ...resultToApply, applied_at: new Date().toISOString() },
        });
      }
    }

    await refreshLockedTerritories(base44, campaign_id);

    const finalStates   = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const activePlayers = players.filter(p => !p.is_eliminated);
    const eliminatedNow = [];

    for (const p of activePlayers) {
      const owned = finalStates.filter(s => s.owner_player_id === p.id);
      if (owned.length === 0) {
        await base44.asServiceRole.entities.CampaignPlayer.update(p.id, {
          is_eliminated: true, eliminated_at: new Date().toISOString(),
        });
        eliminatedNow.push(p.id);
        await log(base44, campaign_id, round, 'player_eliminated', p.id, { display_name: p.display_name }, true);
      }
    }

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
    }, true);

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
      await base44.asServiceRole.entities.Campaign.update(campaign_id, { current_phase: 'complete', status: 'complete' });
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

async function refreshLockedTerritories(base44, campaign_id) {
  const allCampaignCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id });
  const delayedCards = allCampaignCards.filter(c => c.status === 'delayed' && !c.result_applied);
  const lockedIds = computeLockedTerritoryIds(delayedCards);
  await base44.asServiceRole.entities.Campaign.update(campaign_id, { locked_territory_ids: lockedIds });
}