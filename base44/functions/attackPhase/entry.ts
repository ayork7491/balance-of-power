/**
 * attackPhase — backend handler for the attack phase (Round 1+).
 *
 * Actions:
 *   stageAttack      — player adds/updates a staged attack (private until reveal).
 *   deleteAttack     — player removes a staged attack.
 *   lockAttack       — player locks all staged attacks.
 *   processPhaseEnd  — admin: auto-submits unlocked players, deducts committed troops,
 *                      generates battle cards, auto-resolves skirmishes, advances phase.
 *
 * ─── PRIVACY MODEL ────────────────────────────────────────────────────────────
 *   - stageAttack / deleteAttack / lockAttack: user-scoped SDK.
 *     Own PhaseDecision only — other players' attacks are NEVER returned.
 *   - getAttackLockStatus (separate function): strips attack data, returns is_locked only.
 *   - processPhaseEnd: asServiceRole + admin-only guard.
 *   - Attacks are stored in PhaseDecision.data.attacks[] — PRIVATE until processPhaseEnd.
 *   - After processPhaseEnd: attacks are written to public AttackDecision records
 *     which all players can see.
 *
 * ─── ATTACK VALIDATION RULES ─────────────────────────────────────────────────
 *   - origin must be owned by acting player
 *   - target must be adjacent (adjacency from inline V1 map adjacency data)
 *   - committed_troops >= 1
 *   - committed_troops <= available troops at origin
 *   - total attacks for player <= max_attacks_per_phase (default 3)
 *   - player cannot attack same target twice from same origin
 *
 * ─── COMMITTED TROOP PROCESSING (CRITICAL) ───────────────────────────────────
 *   Per spec: committed troops are REMOVED from origin territories BEFORE
 *   battle cards are generated. This enables:
 *     - territory abandonment (all troops committed)
 *     - opportunistic attacks (enemy moves away first)
 *     - simultaneous maneuver warfare
 *
 * ─── BATTLE CARD TYPES ───────────────────────────────────────────────────────
 *   Skirmish:       1 attacker → neutral territory → auto-resolve (no battle needed)
 *   Siege:          1 attacker → defended territory → battle card
 *   Double Siege:   2+ attackers → defended territory → battle card
 *   Capture Obj:    2+ attackers → neutral territory → battle card
 *   Bloodbath:      mutual attacks between 2 territories → battle card
 *
 * ─── MAP ADJACENCY ───────────────────────────────────────────────────────────
 *   Local imports are prohibited in Deno deploy. Adjacency for V1 map is inlined.
 *   See features/maps/mapData.ts for the canonical source.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Inline: V1 Map Adjacency ─────────────────────────────────────────────────
// Must stay in sync with features/maps/mapData.ts adjacency array.

const V1_ADJACENCY_PAIRS = [
  ['frost_peak','irongate'],['irongate','tundra_flats'],['tundra_flats','glacier_pass'],
  ['glacier_pass','stormwatch'],['stormwatch','crow_harbor'],['irongate','pale_cliffs'],
  ['glacier_pass','veil_crossing'],['stormwatch','veil_crossing'],
  ['frost_peak','ashwood'],['pale_cliffs','redstone_ridge'],
  ['tundra_flats','heartlands'],['glacier_pass','golden_citadel'],
  ['veil_crossing','deepstone'],['veil_crossing','the_crossing'],
  ['stormwatch','blackstone'],['crow_harbor','ember_coast'],['veil_crossing','ashfen_coast'],
  ['ashwood','redstone_ridge'],['ashwood','dustmarsh'],['redstone_ridge','saltfen'],
  ['redstone_ridge','greywood'],['dustmarsh','saltfen'],['dustmarsh','verdant_vale'],
  ['saltfen','greywood'],['saltfen','verdant_vale'],['greywood','verdant_vale'],
  ['pale_cliffs','heartlands'],['redstone_ridge','heartlands'],['greywood','ember_vale'],
  ['saltfen','stonefield'],
  ['verdant_vale','sunken_delta'],['verdant_vale','dustplains'],
  ['heartlands','golden_citadel'],['heartlands','iron_ridge'],['heartlands','stonefield'],
  ['heartlands','ember_vale'],['golden_citadel','iron_ridge'],['golden_citadel','the_crossing'],
  ['golden_citadel','deepstone'],['iron_ridge','stonefield'],['iron_ridge','the_crossing'],
  ['ember_vale','stonefield'],
  ['deepstone','blackstone'],['the_crossing','ashfen_coast'],['the_crossing','ridgeline'],
  ['stonefield','sunspire'],['iron_ridge','verdant_basin'],['the_crossing','sea_gate'],
  ['ember_coast','blackstone'],['ember_coast','iron_coast'],['blackstone','scalewood'],
  ['blackstone','ashfen_coast'],['iron_coast','scalewood'],['iron_coast','the_bastion'],
  ['scalewood','the_bastion'],['scalewood','ridgeline'],['ashfen_coast','ridgeline'],
  ['ridgeline','the_bastion'],
  ['the_bastion','crimson_shore'],['the_bastion','southern_reach'],['ridgeline','sea_gate'],
  ['sunken_delta','dustplains'],['dustplains','amber_fields'],['amber_fields','sunspire'],
  ['sunspire','verdant_basin'],['verdant_basin','sea_gate'],
  ['sea_gate','crimson_shore'],['crimson_shore','southern_reach'],
  ['verdant_basin','crimson_shore'],
];

function buildAdjacency() {
  const adj = {};
  for (const [a, b] of V1_ADJACENCY_PAIRS) {
    if (!adj[a]) adj[a] = new Set();
    if (!adj[b]) adj[b] = new Set();
    adj[a].add(b);
    adj[b].add(a);
  }
  return adj;
}

function areAdjacent(a, b, adj) {
  return adj[a]?.has(b) ?? false;
}

// ─── Inline: Seedable RNG ─────────────────────────────────────────────────────

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

// ─── Inline: Log helper ───────────────────────────────────────────────────────

async function log(base44, campaignId, round, phase, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase,
    round,
    event_type:  eventType,
    player_id:   playerId ?? null,
    payload,
    is_public:   isPublic,
  });
}

// ─── Battle card generation ───────────────────────────────────────────────────

/**
 * Classify battle type from post-commitment board state.
 *
 * @param {string} targetId
 * @param {Array} attacksOnTarget  - all attacks whose target === targetId
 * @param {object} postCommitStateById  - territory state AFTER committed troops removed
 * @param {boolean} hasMutualReturn  - whether any attacker is also being attacked from target
 */
function classifyBattle(targetId, attacksOnTarget, postCommitStateById, hasMutualReturn) {
  const defenderOwner = postCommitStateById[targetId]?.owner_player_id ?? null;
  const defenderTroops = postCommitStateById[targetId]?.troop_count ?? 0;
  const isNeutral = !defenderOwner;
  const attackerCount = attacksOnTarget.length;

  if (hasMutualReturn) return 'bloodbath';
  if (isNeutral && attackerCount === 1) return 'skirmish';
  if (isNeutral && attackerCount > 1)  return 'capture_objectives';
  if (!isNeutral && attackerCount === 1) return 'siege';
  return 'double_siege'; // multiple attackers, defended
}

/**
 * Calculate tabletop scaling factor.
 * scale_factor = max(total_troops_in_battle / avg_battle_size, 1)
 * tabletop_size = round(total_troops / scale_factor)
 */
function calcBattleScaling(totalTroops, avgBattleSize = 1000) {
  const scaleFactor = Math.max(totalTroops / avgBattleSize, 1);
  const tabletopSize = Math.round(totalTroops / scaleFactor);
  return { scale_factor: parseFloat(scaleFactor.toFixed(2)), tabletop_size: tabletopSize };
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

  const [campaigns, players] = await Promise.all([
    base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
    base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
  ]);
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const round = campaign.current_round ?? 1;
  const phase = 'attack';
  const maxAttacks = campaign.settings?.max_attacks_per_phase ?? 3;

  // ── ACTION: stageAttack ───────────────────────────────────────────────────────
  if (action === 'stageAttack') {
    if (campaign.current_phase !== 'attack') {
      return Response.json({ error: 'Not in attack phase' }, { status: 400 });
    }
    const { origin_territory_id, target_territory_id, committed_troops } = body;
    if (!origin_territory_id || !target_territory_id || committed_troops == null) {
      return Response.json({ error: 'origin_territory_id, target_territory_id, and committed_troops are required' }, { status: 400 });
    }
    if (!Number.isInteger(committed_troops) || committed_troops < 1) {
      return Response.json({ error: 'committed_troops must be a positive integer' }, { status: 400 });
    }

    // Build adjacency
    const adj = buildAdjacency();
    if (!areAdjacent(origin_territory_id, target_territory_id, adj)) {
      return Response.json({ error: `${target_territory_id} is not adjacent to ${origin_territory_id}` }, { status: 400 });
    }

    // Load territory states for validation
    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const originState = allStates.find(s => s.territory_id === origin_territory_id);
    const targetState = allStates.find(s => s.territory_id === target_territory_id);

    if (!originState || originState.owner_player_id !== myPlayer.id) {
      return Response.json({ error: `You do not own ${origin_territory_id}` }, { status: 400 });
    }
    if (targetState?.owner_player_id === myPlayer.id) {
      return Response.json({ error: 'Cannot attack your own territory' }, { status: 400 });
    }

    // Load own decision (user-scoped — privacy enforced)
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'attack', round,
    });
    let decision = decisions[0];

    const currentAttacks = decision?.data?.attacks ?? [];
    if (decision?.is_locked) {
      return Response.json({ error: 'You have already locked your attacks' }, { status: 400 });
    }

    // Check max attacks
    if (currentAttacks.length >= maxAttacks) {
      return Response.json({ error: `Max ${maxAttacks} attacks per round` }, { status: 400 });
    }

    // Validate committed troops vs available at origin (accounting for already-staged attacks from this origin)
    const alreadyCommittedFromOrigin = currentAttacks
      .filter(a => a.origin_territory_id === origin_territory_id)
      .reduce((s, a) => s + (a.committed_troops || 0), 0);
    const availableAtOrigin = (originState.troop_count || 0) - alreadyCommittedFromOrigin;
    if (committed_troops > availableAtOrigin) {
      return Response.json({
        error: `Cannot commit ${committed_troops} troops — only ${availableAtOrigin} available at ${origin_territory_id} (accounting for other staged attacks)`,
      }, { status: 400 });
    }

    // Upsert attack: if same origin→target exists, replace it
    const existingIdx = currentAttacks.findIndex(
      a => a.origin_territory_id === origin_territory_id && a.target_territory_id === target_territory_id
    );
    const newAttack = {
      id: existingIdx >= 0 ? currentAttacks[existingIdx].id : `atk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      origin_territory_id,
      target_territory_id,
      committed_troops,
    };
    const updatedAttacks = existingIdx >= 0
      ? currentAttacks.map((a, i) => i === existingIdx ? newAttack : a)
      : [...currentAttacks, newAttack];

    if (decision) {
      await base44.entities.PhaseDecision.update(decision.id, {
        data: { attacks: updatedAttacks },
      });
    } else {
      await base44.entities.PhaseDecision.create({
        campaign_id, player_id: myPlayer.id, phase: 'attack', round,
        is_locked: false,
        data: { attacks: updatedAttacks },
      });
    }

    // Private log
    await log(base44, campaign_id, round, phase, 'attack_staged', myPlayer.id, {
      attack_count: updatedAttacks.length,
    }, false);

    return Response.json({ success: true, attack_id: newAttack.id, attacks: updatedAttacks });
  }

  // ── ACTION: deleteAttack ──────────────────────────────────────────────────────
  if (action === 'deleteAttack') {
    if (campaign.current_phase !== 'attack') {
      return Response.json({ error: 'Not in attack phase' }, { status: 400 });
    }
    const { attack_id } = body;
    if (!attack_id) return Response.json({ error: 'attack_id is required' }, { status: 400 });

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'attack', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No attack decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const updatedAttacks = (decision.data?.attacks ?? []).filter(a => a.id !== attack_id);
    await base44.entities.PhaseDecision.update(decision.id, {
      data: { attacks: updatedAttacks },
    });

    return Response.json({ success: true, attacks: updatedAttacks });
  }

  // ── ACTION: lockAttack ────────────────────────────────────────────────────────
  if (action === 'lockAttack') {
    if (campaign.current_phase !== 'attack') {
      return Response.json({ error: 'Not in attack phase' }, { status: 400 });
    }

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'attack', round,
    });
    let decision = decisions[0];

    if (decision?.is_locked) {
      return Response.json({ error: 'Already locked' }, { status: 400 });
    }

    if (decision) {
      await base44.entities.PhaseDecision.update(decision.id, {
        is_locked: true,
        locked_at: new Date().toISOString(),
      });
    } else {
      // Player skipping — create a locked empty decision
      await base44.entities.PhaseDecision.create({
        campaign_id, player_id: myPlayer.id, phase: 'attack', round,
        is_locked: true,
        locked_at: new Date().toISOString(),
        data: { attacks: [] },
      });
    }

    // Public lock log (no attack data revealed)
    await log(base44, campaign_id, round, phase, 'player_locked', myPlayer.id, {
      display_name: myPlayer.display_name,
    }, true);

    return Response.json({ success: true });
  }

  // ── ACTION: processPhaseEnd ───────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'attack') {
      return Response.json({ error: 'Not in attack phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const allDecisions  = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'attack', round,
    });

    // Auto-submit (skip) any players who did not lock
    for (const p of activePlayers) {
      const dec = allDecisions.find(d => d.player_id === p.id);
      if (!dec || !dec.is_locked) {
        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true, is_auto_submitted: true,
            data: { attacks: dec.data?.attacks ?? [] },
          });
        } else {
          await base44.asServiceRole.entities.PhaseDecision.create({
            campaign_id, player_id: p.id, phase: 'attack', round,
            is_locked: true, is_auto_submitted: true,
            data: { attacks: [] },
          });
        }
        await log(base44, campaign_id, round, phase, 'auto_submitted', p.id, {
          display_name: p.display_name,
        }, false);
      }
    }

    // Reload all finalized decisions
    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'attack', round,
    });

    // Flatten all attacks across all players
    const allAttacks = [];
    for (const dec of finalDecisions) {
      for (const atk of (dec.data?.attacks ?? [])) {
        allAttacks.push({ ...atk, player_id: dec.player_id });
      }
    }

    // CRITICAL: Remove committed troops from origin territories BEFORE battle generation
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const postCommitStateById = {};
    for (const ts of allTerritoryStates) {
      postCommitStateById[ts.territory_id] = { ...ts };
    }

    // Deduct committed troops from origins (in-memory; persist after)
    for (const atk of allAttacks) {
      if (postCommitStateById[atk.origin_territory_id]) {
        postCommitStateById[atk.origin_territory_id].troop_count = Math.max(
          0,
          (postCommitStateById[atk.origin_territory_id].troop_count || 0) - (atk.committed_troops || 0)
        );
      }
    }

    // Persist troop deductions to DB
    for (const [tid, state] of Object.entries(postCommitStateById)) {
      const original = allTerritoryStates.find(s => s.territory_id === tid);
      if (original && original.troop_count !== state.troop_count) {
        await base44.asServiceRole.entities.TerritoryState.update(original.id, {
          troop_count: state.troop_count,
        });
      }
    }

    // Load TabletopGameProfile for battle scaling
    let avgBattleSize = 1000;
    if (campaign.game_profile_id) {
      const profiles = await base44.asServiceRole.entities.TabletopGameProfile.filter({ id: campaign.game_profile_id });
      if (profiles[0]?.average_battle_size) avgBattleSize = profiles[0].average_battle_size;
    }

    const adj = buildAdjacency();

    // Generate battle cards
    const targetIds = [...new Set(allAttacks.map(a => a.target_territory_id))];
    const battleCards = [];
    const skirmishResults = [];

    for (const targetId of targetIds) {
      const attacksOnTarget = allAttacks.filter(a => a.target_territory_id === targetId);

      // Detect bloodbath: any attacker's origin is also being attacked from target
      const hasMutualReturn = attacksOnTarget.some(atk =>
        allAttacks.some(a =>
          a.origin_territory_id === targetId &&
          a.target_territory_id === atk.origin_territory_id
        )
      );

      const battleType = classifyBattle(
        targetId, attacksOnTarget, postCommitStateById, hasMutualReturn
      );

      const totalAttackingTroops = attacksOnTarget.reduce((s, a) => s + (a.committed_troops || 0), 0);
      const defenderTroops = postCommitStateById[targetId]?.troop_count ?? 0;
      const totalTroopsInBattle = totalAttackingTroops + defenderTroops;
      const { scale_factor, tabletop_size } = calcBattleScaling(totalTroopsInBattle, avgBattleSize);

      if (battleType === 'skirmish') {
        // Auto-resolve: move attacking troops in, assign ownership
        const attacker = attacksOnTarget[0];
        const targetState = allTerritoryStates.find(s => s.territory_id === targetId);
        if (targetState) {
          await base44.asServiceRole.entities.TerritoryState.update(targetState.id, {
            owner_player_id: attacker.player_id,
            troop_count: attacker.committed_troops,
          });
        }
        skirmishResults.push({
          target_territory_id: targetId,
          attacker_player_id: attacker.player_id,
          troops_moved: attacker.committed_troops,
        });
        await log(base44, campaign_id, round, phase, 'skirmish_resolved', attacker.player_id, {
          target_territory_id: targetId,
          troops_moved: attacker.committed_troops,
          auto_resolved: true,
        }, true);
        continue;
      }

      // Create BattleCard entity record
      const card = await base44.asServiceRole.entities.BattleCard.create({
        campaign_id,
        round,
        battle_type: battleType,
        target_territory_id: targetId,
        defender_player_id:  postCommitStateById[targetId]?.owner_player_id ?? null,
        defender_troops:     defenderTroops,
        attackers: attacksOnTarget.map(a => ({
          player_id: a.player_id,
          origin_territory_id: a.origin_territory_id,
          committed_troops: a.committed_troops,
        })),
        total_attacking_troops: totalAttackingTroops,
        total_troops_in_battle: totalTroopsInBattle,
        scale_factor,
        tabletop_size,
        status: 'pending',
        is_mutual: hasMutualReturn,
      });

      battleCards.push(card);

      await log(base44, campaign_id, round, phase, 'battle_card_generated', null, {
        battle_type: battleType,
        target_territory_id: targetId,
        scale_factor,
        tabletop_size,
        attacker_count: attacksOnTarget.length,
      }, true);
    }

    // Write public AttackReveal records (one per attack, now publicly visible)
    for (const atk of allAttacks) {
      await base44.asServiceRole.entities.AttackReveal.create({
        campaign_id,
        round,
        player_id: atk.player_id,
        origin_territory_id: atk.origin_territory_id,
        target_territory_id: atk.target_territory_id,
        committed_troops: atk.committed_troops,
      });
    }

    // Phase snapshot
    const finalStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    await base44.asServiceRole.entities.PhaseSnapshot.create({
      campaign_id,
      round,
      phase: 'attack',
      snapshot_type: 'phase_end',
      territory_states: finalStates.map(ts => ({
        territory_id: ts.territory_id,
        owner_player_id: ts.owner_player_id ?? null,
        troop_count: ts.troop_count ?? 0,
      })),
      player_standings: activePlayers.map(p => {
        const owned = finalStates.filter(ts => ts.owner_player_id === p.id);
        return {
          player_id: p.id,
          display_name: p.display_name,
          territory_count: owned.length,
          troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0),
          is_eliminated: p.is_eliminated ?? false,
        };
      }),
    });

    await log(base44, campaign_id, round, phase, 'phase_advanced', null, {
      next_phase: 'battle',
      round,
      total_attacks: allAttacks.length,
      battle_cards_generated: battleCards.length,
      skirmishes_auto_resolved: skirmishResults.length,
    }, true);

    // Advance to battle phase
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_phase: 'battle',
    });

    return Response.json({
      success: true,
      next_phase: 'battle',
      total_attacks: allAttacks.length,
      battle_cards: battleCards.length,
      skirmishes: skirmishResults.length,
      round,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});