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
 *   skirmish:          1 attacker → neutral/vacated territory → auto-resolve (no battle needed)
 *   siege:             1 attacker → defended territory → battle card
 *   double_siege:      2+ attackers → defended territory → battle card
 *   capture_objectives: 2+ attackers → neutral/vacated territory → battle card
 *   bloodbath:         mutual attacks between same two territories → ONE combined battle card
 *
 * ─── BLOODBATH DEDUPLICATION ─────────────────────────────────────────────────
 *   A bloodbath pair (A→B AND B→A) generates exactly ONE BattleCard.
 *   Canonical: the pair whose origin_territory_id < target_territory_id lexicographically
 *   is chosen as the "primary" card. The secondary target is NOT processed again as a
 *   separate target. A consumed Set tracks which targets have been handled.
 *
 * ─── ABANDONED TERRITORY HANDLING ────────────────────────────────────────────
 *   After troop deduction, if a territory has 0 troops remaining its owner is set
 *   to null (vacated). Incoming attacks against it resolve as skirmish/capture_objectives
 *   regardless of the original owner. This persists to the DB immediately after deduction.
 *
 * ─── MAP ADJACENCY ───────────────────────────────────────────────────────────
 *   Local imports are prohibited in Deno deploy. Adjacency for V1 map is inlined.
 *   See features/maps/mapData.ts for the canonical source.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Inline: Acting-as validation (mirrors services/permissions/actingAsPermissions.js) ──

function resolveActingCampaignPlayer({ user, campaign_id, acting_as_player_id, campaignPlayers, requireActive = true }) {
  const ownPlayer = campaignPlayers.find(p => p.user_id === user.id);
  if (!acting_as_player_id) {
    if (!ownPlayer) return { success: false, actingPlayer: null, reason: 'You are not a member of this campaign.', code: 'NOT_CAMPAIGN_MEMBER' };
    if (requireActive && ownPlayer.is_eliminated) return { success: false, actingPlayer: ownPlayer, reason: 'Your player has been eliminated.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: ownPlayer, reason: 'Acting as yourself.', code: 'ACTING_AS_SELF' };
  }
  const requestedPlayer = campaignPlayers.find(p => p.id === acting_as_player_id);
  if (!requestedPlayer) return { success: false, actingPlayer: null, reason: 'Invalid player ID.', code: 'INVALID_PLAYER_ID' };
  if (requestedPlayer.campaign_id !== campaign_id) return { success: false, actingPlayer: null, reason: 'Player not in this campaign.', code: 'PLAYER_NOT_IN_CAMPAIGN' };
  if (requestedPlayer.id === ownPlayer?.id) {
    if (requireActive && requestedPlayer.is_eliminated) return { success: false, actingPlayer: requestedPlayer, reason: 'Your player has been eliminated.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: requestedPlayer, reason: 'Acting as yourself.', code: 'ACTING_AS_SELF' };
  }
  const isTestPlayer = requestedPlayer.is_test_player === true || (requestedPlayer.user_id && requestedPlayer.user_id.startsWith('test_player_'));
  if (user.role === 'admin') {
    if (requireActive && requestedPlayer.is_eliminated) return { success: false, actingPlayer: requestedPlayer, reason: 'Cannot act as eliminated players.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: requestedPlayer, reason: 'Platform admin override.', code: 'PLATFORM_ADMIN_OVERRIDE' };
  }
  if (ownPlayer?.is_admin) {
    if (!isTestPlayer) return { success: false, actingPlayer: null, reason: 'Campaign admins can only act as test players.', code: 'CANNOT_ACT_AS_REAL_PLAYER' };
    if (requireActive && requestedPlayer.is_eliminated) return { success: false, actingPlayer: requestedPlayer, reason: 'Cannot act as eliminated test players.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: requestedPlayer, reason: 'Campaign admin acting as test player.', code: 'ADMIN_ACTING_AS_TEST' };
  }
  return { success: false, actingPlayer: null, reason: 'Only admins can act as other players.', code: 'NOT_ADMIN' };
}

// ─── Inline: Map Adjacency by map_id ─────────────────────────────────────────
// Local imports are prohibited in Deno deploy, so adjacency for each map is
// inlined here. Keep in sync with features/maps/mapData.ts and mapData.shattered_crown.ts.

// V1 Standard map (map_v1_standard)
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

// ─── INLINE: Shattered Crown typed adjacency ──────────────────────────────────
// SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_ADJACENCY
// This block is mechanically derived from that file. Do NOT edit manually.
// To update: edit shatteredCrownConfig.ts, then regenerate this block.
// Sprint 4A: all adjacency types (land, maritime, river_crossing) are traversable.
// ─────────────────────────────────────────────────────────────────────────────
const SC_ADJACENCY_TYPED = [
  // ── IRONSPINE internal ───────────────────────────────────────────────────
  {from:'I8',to:'I4',type:'land'},{from:'I4',to:'I3',type:'land'},
  {from:'I4',to:'I7',type:'land'},{from:'I6',to:'I3',type:'land'},
  {from:'I6',to:'I5',type:'land'},{from:'I6',to:'I7',type:'land'},
  {from:'I1',to:'I2',type:'land'},{from:'I1',to:'I5',type:'land'},
  {from:'I2',to:'I3',type:'land'},{from:'I2',to:'I5',type:'land'},
  // ── IRONSPINE ↔ FRACTURE BASIN ────────────────────────────────────────
  {from:'I6',to:'B1',type:'land'},{from:'I7',to:'B1',type:'land'},
  {from:'I7',to:'B3',type:'land'},
  // ── IRONSPINE ↔ SHATTERED COAST ───────────────────────────────────────
  {from:'I8',to:'C1',type:'maritime'},
  // ── WILD FRONTIER internal ────────────────────────────────────────────
  {from:'W1',to:'W2',type:'land'},{from:'W2',to:'W3',type:'land'},
  {from:'W2',to:'W4',type:'land'},{from:'W2',to:'W5',type:'land'},
  {from:'W3',to:'W5',type:'land'},{from:'W3',to:'W6',type:'land'},
  {from:'W4',to:'W5',type:'land'},{from:'W4',to:'W7',type:'land'},
  {from:'W5',to:'W6',type:'land'},{from:'W5',to:'W7',type:'land'},
  {from:'W5',to:'W8',type:'land'},{from:'W6',to:'W9',type:'land'},
  {from:'W7',to:'W8',type:'land'},{from:'W8',to:'W9',type:'land'},
  // ── WILD FRONTIER ↔ SUNFIELDS ─────────────────────────────────────────
  {from:'W7',to:'S1',type:'land'},{from:'W9',to:'S2',type:'land'},
  // ── FRACTURE BASIN internal ───────────────────────────────────────────
  {from:'B1',to:'B3',type:'land'},{from:'B1',to:'B2',type:'land'},
  {from:'B3',to:'B2',type:'land'},{from:'B3',to:'B4',type:'land'},
  {from:'B2',to:'B4',type:'land'},{from:'B2',to:'B5',type:'land'},
  {from:'B2',to:'B6',type:'land'},{from:'B4',to:'B7',type:'land'},
  {from:'B5',to:'B6',type:'land'},{from:'B5',to:'B8',type:'land'},
  {from:'B6',to:'B7',type:'land'},{from:'B6',to:'B8',type:'land'},
  {from:'B6',to:'B9',type:'land'},{from:'B7',to:'B10',type:'land'},
  {from:'B8',to:'B9',type:'land'},{from:'B9',to:'B10',type:'land'},
  // ── FRACTURE BASIN ↔ SHATTERED COAST ──────────────────────────────────
  {from:'B10',to:'C6',type:'maritime'},{from:'B10',to:'C4',type:'maritime'},
  // ── FRACTURE BASIN ↔ SUNFIELDS ────────────────────────────────────────
  {from:'B10',to:'S3',type:'river_crossing'}, // The single river crossing
  // ── SUNFIELDS internal ────────────────────────────────────────────────
  {from:'S1',to:'S2',type:'land'},{from:'S1',to:'S4',type:'land'},
  {from:'S4',to:'S5',type:'land'},{from:'S4',to:'S7',type:'land'},
  {from:'S7',to:'S5',type:'land'},{from:'S7',to:'S8',type:'land'},
  {from:'S2',to:'S3',type:'land'},{from:'S2',to:'S5',type:'land'},
  {from:'S5',to:'S8',type:'land'},{from:'S5',to:'S6',type:'land'},
  {from:'S3',to:'S6',type:'land'},{from:'S6',to:'S9',type:'land'},
  // ── SUNFIELDS ↔ SHATTERED COAST ───────────────────────────────────────
  {from:'S6',to:'C8',type:'maritime'},{from:'S9',to:'C8',type:'maritime'},
  // ── SHATTERED COAST internal ──────────────────────────────────────────
  {from:'C1',to:'C2',type:'maritime'},{from:'C2',to:'C3',type:'land'},
  {from:'C3',to:'C4',type:'maritime'},{from:'C3',to:'C5',type:'maritime'},
  {from:'C4',to:'C5',type:'maritime'},{from:'C4',to:'C6',type:'maritime'},
  {from:'C5',to:'C6',type:'maritime'},{from:'C5',to:'C7',type:'maritime'},
  {from:'C6',to:'C7',type:'maritime'},{from:'C6',to:'C8',type:'maritime'},
  {from:'C7',to:'C8',type:'maritime'},
];

// Build flat pairs from typed adjacency (Sprint 4A: all types traversable)
const SHATTERED_CROWN_ADJACENCY_PAIRS = SC_ADJACENCY_TYPED.map(({from,to}) => [from,to]);

const ADJACENCY_BY_MAP_ID = {
  'map_v1_standard':   V1_ADJACENCY_PAIRS,
  'shattered_crown_v1': SHATTERED_CROWN_ADJACENCY_PAIRS,
};

function buildAdjacency(mapId) {
  const pairs = ADJACENCY_BY_MAP_ID[mapId] ?? V1_ADJACENCY_PAIRS;
  const adj = {};
  for (const [a, b] of pairs) {
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

// ─── Battle card generation helpers ──────────────────────────────────────────

/**
 * Classify battle type from post-commitment board state.
 *
 * Called only for non-bloodbath targets. Bloodbath detection and card generation
 * is handled separately in the main loop using a consumed-pairs Set.
 *
 * A territory is treated as neutral/vacated if:
 *   - it has no owner (never owned), OR
 *   - its troop_count dropped to 0 after committed-troop deduction (abandoned)
 *
 * @param {string} targetId
 * @param {Array}  attacksOnTarget  - attacks whose target === targetId
 * @param {object} postCommitStateById - territory state AFTER committed troop deduction
 *                                       AND after vacating abandoned territories
 */
function classifyBattle(targetId, attacksOnTarget, postCommitStateById) {
  const state = postCommitStateById[targetId];
  // Treat vacated (0 troops after deduction) the same as neutral
  const isNeutral = !state?.owner_player_id || (state.troop_count ?? 0) === 0;
  const attackerCount = attacksOnTarget.length;

  if (isNeutral && attackerCount === 1) return 'skirmish';
  if (isNeutral && attackerCount > 1)  return 'capture_objectives';
  if (!isNeutral && attackerCount === 1) return 'siege';
  return 'double_siege';
}

/**
 * Build a canonical key for a mutual-attack pair so each bloodbath is only
 * processed once. Sort lexicographically so A→B and B→A share the same key.
 */
function bloodbathKey(a, b) {
  return [a, b].sort().join('↔');
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

  // ── Acting-as delegation ─────────────────────────────────────────────────────
  const { acting_as_player_id } = body;
  const actingResult = resolveActingCampaignPlayer({
    user,
    campaign_id,
    acting_as_player_id,
    campaignPlayers: players,
    requireActive: false,
  });
  if (!actingResult.success) {
    return Response.json({ error: actingResult.reason }, { status: 403 });
  }
  const actingPlayer = actingResult.actingPlayer;

  const round = campaign.current_round ?? 1;
  const phase = 'attack';
  const baseMaxAttacks = campaign.settings?.max_attacks_per_phase ?? 3;

  // Sprint 4D: War Council — +1 attack declaration per active War Council owned by acting player.
  // Computed lazily inside stageAttack where it's needed.
  async function getEffectiveMaxAttacksForPlayer(playerId) {
    const playerBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
      campaign_id,
      player_id: playerId,
      building_type: 'war_council',
    });
    const activeWarCouncils = playerBuildings.filter(b => b.status === 'active').length;
    return baseMaxAttacks + activeWarCouncils;
  }

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

    // ── Territory lock check ───────────────────────────────────────────────────
    // Territories involved in delayed battles are locked — cannot attack from or into them.
    const lockedIds = new Set(campaign.locked_territory_ids ?? []);
    if (lockedIds.has(origin_territory_id)) {
      return Response.json({ error: `Territory ${origin_territory_id} is locked by a delayed battle and cannot be used to attack.` }, { status: 400 });
    }
    if (lockedIds.has(target_territory_id)) {
      return Response.json({ error: `Territory ${target_territory_id} is locked by a delayed battle and cannot be attacked.` }, { status: 400 });
    }

    // Build adjacency from the campaign's actual map_id
    const mapId = campaign.map_id ?? 'map_v1_standard';
    const adj = buildAdjacency(mapId);
    const originAdjList = adj[origin_territory_id] ? [...adj[origin_territory_id]] : [];
    const targetFound = areAdjacent(origin_territory_id, target_territory_id, adj);

    console.log('[attackPhase] adjacency debug', {
      campaign_map_id: mapId,
      adjacency_source: ADJACENCY_BY_MAP_ID[mapId] ? mapId : 'fallback_v1',
      origin_territory_id,
      target_territory_id,
      origin_adjacency_list: originAdjList,
      target_found: targetFound,
    });

    if (!targetFound) {
      return Response.json({
        error: `${target_territory_id} is not adjacent to ${origin_territory_id}`,
        debug: {
          campaign_map_id: mapId,
          adjacency_source: ADJACENCY_BY_MAP_ID[mapId] ? mapId : 'fallback_v1',
          origin_territory_id,
          target_territory_id,
          origin_adjacency_list: originAdjList,
          target_found: false,
        },
      }, { status: 400 });
    }

    // Load territory states for validation
    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const originState = allStates.find(s => s.territory_id === origin_territory_id);
    const targetState = allStates.find(s => s.territory_id === target_territory_id);

    if (!originState || originState.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: `You do not own ${origin_territory_id}` }, { status: 400 });
    }
    if (targetState?.owner_player_id === actingPlayer.id) {
      return Response.json({ error: 'Cannot attack your own territory' }, { status: 400 });
    }

    // Load acting player's decision (user-scoped — privacy enforced)
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'attack', round,
    });
    let decision = decisions[0];

    const currentAttacks = decision?.data?.attacks ?? [];
    if (decision?.is_locked) {
      return Response.json({ error: 'You have already locked your attacks' }, { status: 400 });
    }

    // Check max attacks (War Council may increase this per-player)
    const maxAttacks = await getEffectiveMaxAttacksForPlayer(actingPlayer.id);
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

    // ── Idempotency: if exact same submission_id already processed, return it ──
    const { submission_id } = body;
    if (submission_id) {
      const dupIdx = currentAttacks.findIndex(a => a.submission_id === submission_id);
      if (dupIdx >= 0) {
        return Response.json({ success: true, attack_id: currentAttacks[dupIdx].id, attacks: currentAttacks, idempotent: true });
      }
    }

    // Upsert attack: if same origin→target exists, replace it
    const existingIdx = currentAttacks.findIndex(
      a => a.origin_territory_id === origin_territory_id && a.target_territory_id === target_territory_id
    );
    const newAttack = {
      id: existingIdx >= 0 ? currentAttacks[existingIdx].id : `atk_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      submission_id: submission_id ?? null,
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
        campaign_id, player_id: actingPlayer.id, phase: 'attack', round,
        is_locked: false,
        data: { attacks: updatedAttacks },
      });
    }

    // Private log
    await log(base44, campaign_id, round, phase, 'attack_staged', actingPlayer.id, {
      attack_id: newAttack.id,
      attack_count: updatedAttacks.length,
      origin_territory_id,
      target_territory_id,
      committed_troops,
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
      campaign_id, player_id: actingPlayer.id, phase: 'attack', round,
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
      campaign_id, player_id: actingPlayer.id, phase: 'attack', round,
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
        campaign_id, player_id: actingPlayer.id, phase: 'attack', round,
        is_locked: true,
        locked_at: new Date().toISOString(),
        data: { attacks: [] },
      });
    }

    // Public lock log (no attack data revealed)
    await log(base44, campaign_id, round, phase, 'player_locked', actingPlayer.id, {
      display_name: actingPlayer.display_name,
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

    // ── DUPLICATE PHASE-END PROTECTION ───────────────────────────────────────
    // Check if a phase_end snapshot already exists — if so, this call is a duplicate.
    const existingAttackEndSnap = await base44.asServiceRole.entities.PhaseSnapshot.filter({
      campaign_id, round, phase: 'attack', snapshot_type: 'phase_end',
    });
    if (existingAttackEndSnap.length > 0) {
      return Response.json({ error: 'Attack phase already processed for this round', already_processed: true }, { status: 400 });
    }

    // ── Write authoritative before-snapshot for the attack phase ─────────────
    // Written here (at processPhaseEnd start, before any troop mutations) so audits
    // always have a before-snapshot that precedes attack commitments.
    // Idempotent: only write if no before-snapshot exists for this round/phase.
    const existingBeforeSnapshots = await base44.asServiceRole.entities.PhaseSnapshot.filter({
      campaign_id, round, phase: 'attack', snapshot_type: 'phase_start',
    });
    if (existingBeforeSnapshots.length === 0) {
      console.log(`[attackPhase.processPhaseEnd] Writing attack phase_start snapshot for round ${round}.`);
      const [beforeStates, atkInfluence, atkRegionalPools, atkBuildings, atkSupplyRoutes, atkObjectives, atkVictory, atkDev] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
        base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
        base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
        base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id }),
        base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
      ]);
      const atkDevMap = {};
      for (const d of atkDev) atkDevMap[d.territory_id] = d;
      const activePBefore = players.filter(p => !p.is_eliminated);
      await base44.asServiceRole.entities.PhaseSnapshot.create({
        campaign_id, round, phase: 'attack', snapshot_type: 'phase_start',
        _schema_version: 2,
        territory_states: beforeStates.map(ts => {
          const dev = atkDevMap[ts.territory_id] ?? null;
          return {
            territory_id: ts.territory_id, owner_player_id: ts.owner_player_id ?? null, troop_count: ts.troop_count ?? 0,
            resource_storage: ts.resource_storage ?? {}, has_resource_hub: ts.has_resource_hub ?? false,
            structures: ts.structures ?? [], resource_type: ts.resource_type ?? null,
            development_level: dev?.development_level ?? null, development_progress: dev?.development_progress ?? null,
            food_to_next_level: dev?.food_to_next_level ?? null, total_food_invested: dev?.total_food_invested ?? null,
            is_capital: dev?.is_capital ?? null, unlocked_resources: dev?.unlocked_resources ?? null,
            unlocked_slot_count: dev?.unlocked_slot_count ?? null,
          };
        }),
        player_standings: activePBefore.map(p => {
          const owned = beforeStates.filter(ts => ts.owner_player_id === p.id);
          return { player_id: p.id, display_name: p.display_name, territory_count: owned.length, troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0), is_eliminated: p.is_eliminated ?? false };
        }),
        permanent_influence: atkInfluence.map(i => ({ territory_id: i.territory_id, player_id: i.player_id, influence_amount: i.influence_amount ?? 0 })),
        spendable_influence: atkRegionalPools.map(p => ({ region_id: p.region_id, player_id: p.player_id, spendable_influence: p.spendable_influence ?? 0 })),
        buildings: atkBuildings.map(b => ({ territory_id: b.territory_id, player_id: b.player_id, building_type: b.building_type, pillar_type: b.pillar_type, status: b.status, started_round: b.started_round, completed_round: b.completed_round })),
        supply_routes: atkSupplyRoutes.map(r => ({ id: r.id, owner_player_id: r.owner_player_id, hub_territory_id: r.hub_territory_id, source_territory_id: r.source_territory_id, route_status: r.route_status, resource_type: r.resource_type, created_round: r.created_round })),
        objectives: atkObjectives.map(o => ({ player_id: o.player_id, global_influence: o.global_influence ?? 0, objective_cards: o.objective_cards_json ?? {} })),
        victory_scores: atkVictory.map(v => ({ player_id: v.player_id, occupancy_score: v.occupancy_score ?? 0, wealth_score: v.wealth_score ?? 0, influence_score: v.influence_score ?? 0, has_won: v.has_won ?? false, winning_condition: v.winning_condition ?? null })),
      });
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

    // Flatten all attacks across all players — preserve attack id for audit traceability
    const allAttacks = [];
    const rejectedAttacks = [];
    for (const dec of finalDecisions) {
      for (const atk of (dec.data?.attacks ?? [])) {
        // Ensure each attack has a stable id (should already have one from stageAttack)
        allAttacks.push({ ...atk, player_id: dec.player_id, id: atk.id ?? `atk_${dec.player_id}_${atk.origin_territory_id}_${atk.target_territory_id}` });
      }
    }

    // ── DEFENSIVE RE-VALIDATION: check each attack against live board state ──
    // This guards against stale staged attacks, double-submissions, and impossible states.
    const liveStatesForValidation = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const liveStateMap = {};
    for (const ts of liveStatesForValidation) liveStateMap[ts.territory_id] = ts;

    // Track troops already committed per origin (within this processPhaseEnd run)
    const committedPerOrigin = {};
    // Track duplicate submission_ids
    const seenSubmissionIds = new Set();

    const validAttacks = [];
    for (const atk of allAttacks) {
      const originState = liveStateMap[atk.origin_territory_id];
      const targetState = liveStateMap[atk.target_territory_id];
      const alreadyCommitted = committedPerOrigin[atk.origin_territory_id] ?? 0;

      let rejectionReason = null;

      if (atk.submission_id && seenSubmissionIds.has(atk.submission_id)) {
        rejectionReason = 'duplicate_submission';
      } else if (!originState || originState.owner_player_id !== atk.player_id) {
        rejectionReason = 'origin_not_owned_by_attacker';
      } else if (targetState?.owner_player_id === atk.player_id) {
        rejectionReason = 'target_owned_by_attacker';
      } else if ((originState.troop_count ?? 0) <= 0) {
        rejectionReason = 'insufficient_troops_zero';
      } else if ((atk.committed_troops ?? 0) > ((originState.troop_count ?? 0) - alreadyCommitted)) {
        rejectionReason = 'insufficient_troops';
      } else if ((atk.committed_troops ?? 0) < 1) {
        rejectionReason = 'zero_troops_committed';
      }

      if (rejectionReason) {
        rejectedAttacks.push({
          ...atk,
          validation_result: 'rejected',
          rejection_reason: rejectionReason,
        });
        await log(base44, campaign_id, round, phase, `attack_rejected_${rejectionReason}`, atk.player_id, {
          origin_territory_id: atk.origin_territory_id,
          target_territory_id: atk.target_territory_id,
          committed_troops: atk.committed_troops,
          rejection_reason: rejectionReason,
        }, false);
      } else {
        if (atk.submission_id) seenSubmissionIds.add(atk.submission_id);
        committedPerOrigin[atk.origin_territory_id] = alreadyCommitted + (atk.committed_troops ?? 0);
        validAttacks.push(atk);
      }
    }

    // Replace allAttacks with only valid ones
    const validatedAttacks = validAttacks;

    // ── STEP 1: Remove committed troops from origin territories ──────────────
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const postCommitStateById = {};
    for (const ts of allTerritoryStates) {
      postCommitStateById[ts.territory_id] = { ...ts };
    }

    for (const atk of validatedAttacks) {
      if (postCommitStateById[atk.origin_territory_id]) {
        postCommitStateById[atk.origin_territory_id].troop_count = Math.max(
          0,
          (postCommitStateById[atk.origin_territory_id].troop_count || 0) - (atk.committed_troops || 0)
        );
      }
    }

    // ── STEP 2: Mark abandoned territories as vacated (owner_player_id = null) ─
    // If ALL troops were committed out of a territory, it has no defender.
    // Incoming attacks treat it as neutral (skirmish/capture_objectives).
    const vacatedIds = new Set();
    for (const [tid, state] of Object.entries(postCommitStateById)) {
      if (state.owner_player_id && (state.troop_count ?? 0) === 0) {
        // Only vacate if anyone was there originally and all troops left
        const original = allTerritoryStates.find(s => s.territory_id === tid);
        if (original?.owner_player_id && original.troop_count > 0) {
          postCommitStateById[tid].owner_player_id = null;
          vacatedIds.add(tid);
        }
      }
    }

    // ── STEP 3: Persist troop deductions + vacations to DB ────────────────────
    for (const [tid, state] of Object.entries(postCommitStateById)) {
      const original = allTerritoryStates.find(s => s.territory_id === tid);
      if (!original) continue;
      const troopChanged  = original.troop_count !== state.troop_count;
      const ownerChanged  = original.owner_player_id !== state.owner_player_id;
      if (troopChanged || ownerChanged) {
        await base44.asServiceRole.entities.TerritoryState.update(original.id, {
          troop_count:      state.troop_count,
          owner_player_id:  state.owner_player_id ?? null,
        });
      }
    }

    // ── STEP 3B: Re-fetch territory states from DB after persisting deductions ─
    // This ensures battle cards use the AUTHORITATIVE persisted troop counts,
    // not the in-memory postCommitStateById which may have stale values for
    // territories that were both attackers and defenders in the same round.
    const persistedStatesAfterDeductions = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const persistedStateMap = {};
    for (const ts of persistedStatesAfterDeductions) persistedStateMap[ts.territory_id] = ts;

    // ── STEP 4: Load scaling profile ──────────────────────────────────────────
    let avgBattleSize = 1000;
    if (campaign.game_profile_id) {
      const profiles = await base44.asServiceRole.entities.TabletopGameProfile.filter({ id: campaign.game_profile_id });
      if (profiles[0]?.average_battle_size) avgBattleSize = profiles[0].average_battle_size;
    }

    // ── STEP 5: Generate battle cards ─────────────────────────────────────────
    // Track which targets have been consumed into a bloodbath so we don't also
    // generate a second card for the "return" direction.
    const targetIds     = [...new Set(validatedAttacks.map(a => a.target_territory_id))];
    const battleCards   = [];
    const skirmishResults = [];
    const consumedTargets = new Set(); // bloodbath targets already processed

    for (const targetId of targetIds) {
      if (consumedTargets.has(targetId)) continue; // already handled as the non-target side of a bloodbath pair

      let attacksOnTarget = validatedAttacks.filter(a => a.target_territory_id === targetId);

      // ── Bloodbath detection ──
      // A bloodbath exists when at least one attacker's origin is ALSO a target
      // of an attack coming back from targetId. Find all such mutual-attack origins.
      const mutualOrigins = attacksOnTarget
        .map(atk => atk.origin_territory_id)
        .filter(originId =>
          validatedAttacks.some(a =>
            a.origin_territory_id === targetId &&
            a.target_territory_id === originId
          )
        );

      const isBloodbath = mutualOrigins.length > 0;

      if (isBloodbath) {
        // Generate ONE bloodbath card per mutual pair.
        // IMPORTANT: only mark the *other* territory (originId) as consumed —
        // NOT targetId itself. This ensures non-mutual attacks against targetId
        // (e.g. C→B when A↔B is a bloodbath) still get their own battle card.
        const pairedOrigins = new Set();
        for (const originId of mutualOrigins) {
          const pairKey = bloodbathKey(targetId, originId);
          if (pairedOrigins.has(pairKey)) continue;
          pairedOrigins.add(pairKey);

          // Only consume originId so it isn't processed again as a target.
          // targetId is NOT consumed here — non-mutual attacks on it proceed below.
          consumedTargets.add(originId);

          // Combine all attacks involved in this mutual pair
          const attacksFromTarget = validatedAttacks.filter(
            a => a.origin_territory_id === targetId && a.target_territory_id === originId
          );
          const attacksFromOrigin = validatedAttacks.filter(
            a => a.origin_territory_id === originId && a.target_territory_id === targetId
          );
          const allBloodbathAttacks = [...attacksFromOrigin, ...attacksFromTarget];

          const totalTroops = allBloodbathAttacks.reduce((s, a) => s + (a.committed_troops || 0), 0);
          const { scale_factor, tabletop_size } = calcBattleScaling(totalTroops, avgBattleSize);

          const card = await base44.asServiceRole.entities.BattleCard.create({
            campaign_id,
            round,
            battle_type: 'bloodbath',
            // target_territory_id is the lexicographically first of the pair
            target_territory_id: [targetId, originId].sort()[0],
            defender_player_id:  null, // bloodbath has no single defender
            defender_troops:     0,
            attackers: allBloodbathAttacks.map(a => ({
              player_id:           a.player_id,
              origin_territory_id: a.origin_territory_id,
              committed_troops:    a.committed_troops,
            })),
            total_attacking_troops: totalTroops,
            total_troops_in_battle: totalTroops,
            scale_factor,
            tabletop_size,
            status: 'pending',
            is_mutual: true,
          });
          battleCards.push(card);

          await log(base44, campaign_id, round, phase, 'battle_card_generated', null, {
            battle_type:        'bloodbath',
            target_territory_id: card.target_territory_id,
            pair:               [targetId, originId],
            scale_factor,
            tabletop_size,
          }, true);
        }

        // After generating bloodbath cards, check whether there are any NON-mutual
        // attacks on this same targetId (e.g. C→B when A↔B bloodbath was just processed).
        // If so, fall through to generate a separate battle card for those.
        const mutualOriginSet = new Set(mutualOrigins);
        const nonMutualAttacks = attacksOnTarget.filter(
          atk => !mutualOriginSet.has(atk.origin_territory_id)
        );
        if (nonMutualAttacks.length === 0) continue; // all attacks were part of bloodbath pairs

        // Re-scope to only non-mutual attacks and fall through to card generation
        attacksOnTarget = nonMutualAttacks;
      }

      // ── Normal (non-bloodbath) card generation ──
      const battleType = classifyBattle(targetId, attacksOnTarget, postCommitStateById);

      const totalAttackingTroops = attacksOnTarget.reduce((s, a) => s + (a.committed_troops || 0), 0);
      // Use authoritative persisted state for defender troops — guaranteed to match
      // what's in the DB at card-generation time. This is the single source of truth.
      const defenderTroops       = persistedStateMap[targetId]?.troop_count ?? postCommitStateById[targetId]?.troop_count ?? 0;
      const defenderPlayerId     = persistedStateMap[targetId]?.owner_player_id ?? postCommitStateById[targetId]?.owner_player_id ?? null;
      const totalTroopsInBattle  = totalAttackingTroops + defenderTroops;
      const { scale_factor, tabletop_size } = calcBattleScaling(totalTroopsInBattle, avgBattleSize);

      if (battleType === 'skirmish') {
        // Auto-resolve: attacker captures, committed troops move in.
        // Origin troops were already deducted in Step 1 (postCommitStateById).
        // The DB update in Step 3 already persisted origin deduction.
        // Here we only need to set target territory ownership + troop count.
        const attacker    = attacksOnTarget[0];
        const targetState = allTerritoryStates.find(s => s.territory_id === targetId);
        const originStateBefore = allTerritoryStates.find(s => s.territory_id === attacker.origin_territory_id);
        const originAfter = postCommitStateById[attacker.origin_territory_id]?.troop_count ?? 0;
        const targetBefore = targetState?.troop_count ?? 0;
        const targetOwnerBefore = targetState?.owner_player_id ?? 'null';

        if (targetState) {
          // Territory has an existing TerritoryState record — update it
          await base44.asServiceRole.entities.TerritoryState.update(targetState.id, {
            owner_player_id: attacker.player_id,
            troop_count:     attacker.committed_troops,
          });
        } else {
          // Territory has never been owned — no TerritoryState record exists yet. Create one.
          await base44.asServiceRole.entities.TerritoryState.create({
            campaign_id,
            map_id:          campaign.map_id ?? '',
            territory_id:    targetId,
            owner_player_id: attacker.player_id,
            troop_count:     attacker.committed_troops,
          });
        }

        console.log(`[skirmish PROOF] battle_type=skirmish card_id=inline player=${attacker.player_id}`);
        console.log(`[skirmish PROOF]   origin=${attacker.origin_territory_id} before=${originStateBefore?.troop_count ?? 0} committed=${attacker.committed_troops} after=${originAfter}`);
        console.log(`[skirmish PROOF]   target=${targetId} owner_before=${targetOwnerBefore} troops_before=${targetBefore} owner_after=${attacker.player_id} troops_after=${attacker.committed_troops}`);

        skirmishResults.push({
          target_territory_id: targetId,
          attacker_player_id:  attacker.player_id,
          troops_moved:        attacker.committed_troops,
          origin_troops_after: originAfter,
        });
        await log(base44, campaign_id, round, phase, 'skirmish_resolved', attacker.player_id, {
          target_territory_id: targetId,
          origin_territory_id: attacker.origin_territory_id,
          committed_troops:    attacker.committed_troops,
          origin_troops_after: originAfter,
          target_troops_after: attacker.committed_troops,
          was_vacated:         vacatedIds.has(targetId),
        }, true);
        continue;
      }

      // Primary attacker = first attacker entry (single attacker for siege)
      const primaryAttacker = attacksOnTarget[0];

      // Create BattleCard for siege / double_siege / capture_objectives
      const card = await base44.asServiceRole.entities.BattleCard.create({
        campaign_id,
        round,
        battle_type: battleType,
        battle_pillar: 'military',
        target_territory_id: targetId,
        defender_player_id:  defenderPlayerId,
        defender_troops:     defenderTroops,
        attackers: attacksOnTarget.map(a => ({
          player_id:           a.player_id,
          origin_territory_id: a.origin_territory_id,
          committed_troops:    a.committed_troops,
          attack_id:           a.id ?? null,
        })),
        total_attacking_troops: totalAttackingTroops,
        total_troops_in_battle: totalTroopsInBattle,
        scale_factor,
        tabletop_size,
        status: 'pending',
        is_mutual: false,
        source_player_id: primaryAttacker.player_id,
        source_player_name: players.find(p => p.id === primaryAttacker.player_id)?.display_name ?? null,
        battle_card_source: 'military_attack',
        source_operation_metadata: {
          origin_action_id:   primaryAttacker.id ?? null,
          origin_action_type: 'military_attack',
          origin_phase:       'attack',
          origin_round:       round,
        },
      });

      battleCards.push(card);

      await log(base44, campaign_id, round, phase, 'battle_card_generated', null, {
        battle_type:         battleType,
        target_territory_id: targetId,
        scale_factor,
        tabletop_size,
        attacker_count:      attacksOnTarget.length,
      }, true);
    }

    // Write public AttackReveal records (only valid attacks — include attack_id for audit traceability)
    for (const atk of validatedAttacks) {
      await base44.asServiceRole.entities.AttackReveal.create({
        campaign_id,
        round,
        player_id: atk.player_id,
        origin_territory_id: atk.origin_territory_id,
        target_territory_id: atk.target_territory_id,
        committed_troops: atk.committed_troops,
        attack_id: atk.id ?? null,
      });
    }

    // Log rejected attacks summary for audit
    if (rejectedAttacks.length > 0) {
      await log(base44, campaign_id, round, phase, 'attacks_rejected_at_resolution', null, {
        rejected_count: rejectedAttacks.length,
        rejected: rejectedAttacks.map(a => ({
          player_id: a.player_id,
          origin_territory_id: a.origin_territory_id,
          target_territory_id: a.target_territory_id,
          committed_troops: a.committed_troops,
          rejection_reason: a.rejection_reason,
        })),
      }, false);
    }

    // Phase snapshot — full enriched
    const [finalStates, atkEndInfluence, atkEndRegionalPools, atkEndBuildings, atkEndSupplyRoutes, atkEndObjectives, atkEndVictory, atkEndDev] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
      base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id }),
      base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
    ]);
    const atkEndDevMap = {};
    for (const d of atkEndDev) atkEndDevMap[d.territory_id] = d;
    await base44.asServiceRole.entities.PhaseSnapshot.create({
      campaign_id, round, phase: 'attack', snapshot_type: 'phase_end',
      _schema_version: 2,
      territory_states: finalStates.map(ts => {
        const dev = atkEndDevMap[ts.territory_id] ?? null;
        return {
          territory_id: ts.territory_id, owner_player_id: ts.owner_player_id ?? null, troop_count: ts.troop_count ?? 0,
          resource_storage: ts.resource_storage ?? {}, has_resource_hub: ts.has_resource_hub ?? false,
          structures: ts.structures ?? [], resource_type: ts.resource_type ?? null,
          development_level: dev?.development_level ?? null, development_progress: dev?.development_progress ?? null,
          food_to_next_level: dev?.food_to_next_level ?? null, total_food_invested: dev?.total_food_invested ?? null,
          is_capital: dev?.is_capital ?? null, unlocked_resources: dev?.unlocked_resources ?? null,
          unlocked_slot_count: dev?.unlocked_slot_count ?? null,
        };
      }),
      player_standings: activePlayers.map(p => {
        const owned = finalStates.filter(ts => ts.owner_player_id === p.id);
        return { player_id: p.id, display_name: p.display_name, territory_count: owned.length, troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0), is_eliminated: p.is_eliminated ?? false };
      }),
      permanent_influence: atkEndInfluence.map(i => ({ territory_id: i.territory_id, player_id: i.player_id, influence_amount: i.influence_amount ?? 0 })),
      spendable_influence: atkEndRegionalPools.map(p => ({ region_id: p.region_id, player_id: p.player_id, spendable_influence: p.spendable_influence ?? 0 })),
      buildings: atkEndBuildings.map(b => ({ territory_id: b.territory_id, player_id: b.player_id, building_type: b.building_type, pillar_type: b.pillar_type, status: b.status, started_round: b.started_round, completed_round: b.completed_round })),
      supply_routes: atkEndSupplyRoutes.map(r => ({ id: r.id, owner_player_id: r.owner_player_id, hub_territory_id: r.hub_territory_id, source_territory_id: r.source_territory_id, route_status: r.route_status, resource_type: r.resource_type, created_round: r.created_round })),
      objectives: atkEndObjectives.map(o => ({ player_id: o.player_id, global_influence: o.global_influence ?? 0, objective_cards: o.objective_cards_json ?? {} })),
      victory_scores: atkEndVictory.map(v => ({ player_id: v.player_id, occupancy_score: v.occupancy_score ?? 0, wealth_score: v.wealth_score ?? 0, influence_score: v.influence_score ?? 0, has_won: v.has_won ?? false, winning_condition: v.winning_condition ?? null })),
    });

    await log(base44, campaign_id, round, phase, 'phase_advanced', null, {
      next_phase: 'battle',
      round,
      total_attacks: validatedAttacks.length,
      rejected_attacks: rejectedAttacks.length,
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
      total_attacks: validatedAttacks.length,
      rejected_attacks: rejectedAttacks.length,
      rejected_details: rejectedAttacks,
      battle_cards: battleCards.length,
      skirmishes: skirmishResults.length,
      round,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});