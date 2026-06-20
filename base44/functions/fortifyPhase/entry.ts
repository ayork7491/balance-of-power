/**
 * fortifyPhase — backend handler for the fortify & build phase (Round 1+).
 *
 * Actions:
 *   startFortify     — admin: opens phase, creates PhaseDecision stubs
 *   stageMovement    — player stages troop movement between owned territories
 *   deleteMovement   — player removes staged movement
 *   startConstruction — player starts building a structure
 *   lockFortify      — player locks fortify/build decisions
 *   processPhaseEnd  — admin: applies movements, completes construction, advances phase
 *
 * ─── PRIVACY MODEL ────────────────────────────────────────────────────────────
 *   - stageMovement / startConstruction / lockFortify: user-scoped SDK
 *   - processPhaseEnd: asServiceRole + admin-only guard
 *   - Movements and construction are PRIVATE until processPhaseEnd reveals them
 *
 * ─── FORTIFICATION VALIDATION RULES ───────────────────────────────────────────
 *   - origin and destination must be owned by acting player
 *   - territories must be adjacent (or within max_fortification_distance)
 *   - committed_troops >= 1
 *   - committed_troops <= available troops at origin
 *   - total movements <= max_fortifications_per_phase (default 3)
 *
 * ─── STRUCTURE RULES ──────────────────────────────────────────────────────────
 *   - One structure per territory
 *   - One active construction project per player at a time
 *   - V1 structures: castle, barracks, stables
 *   - All structures cost resources and may take multiple rounds
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Inline acting-as validation (services/permissions/actingAsPermissions.js logic)
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_FORTIFICATIONS = 3;
const DEFAULT_MAX_DISTANCE = 4;

// ─── INLINE: Building definitions (Sprint 4C) ──────────────────────────────────
// SOURCE OF TRUTH: src/config/buildingDefinitions.ts
// Each entry includes pillar (for slot enforcement), cost, rounds.
// ─────────────────────────────────────────────────────────────────────────────
const BUILDING_DEFS = {
  // Military
  barracks:        { pillar: 'military',   cost: { gold: 2, iron: 1 },                    rounds: 1 },
  war_council:     { pillar: 'military',   cost: { gold: 3, iron: 2 },                    rounds: 2 },
  logistics_corps: { pillar: 'military',   cost: { gold: 2, iron: 1, timber: 1 },         rounds: 1 },
  // Diplomatic
  embassy:         { pillar: 'diplomatic', cost: { gold: 2, stone: 2 },                   rounds: 2 },
  council_chamber: { pillar: 'diplomatic', cost: { gold: 3, stone: 2 },                   rounds: 2 },
  foreign_office:  { pillar: 'diplomatic', cost: { gold: 2, stone: 1, timber: 1 },        rounds: 1 },
  // Economic
  marketplace:     { pillar: 'economic',   cost: { gold: 2, timber: 1 },                  rounds: 1 },
  builders_guild:  { pillar: 'economic',   cost: { gold: 3, timber: 2 },                  rounds: 2 },
  trade_network:   { pillar: 'economic',   cost: { gold: 2, timber: 2 },                  rounds: 2 },
  resource_hub:    { pillar: 'economic',   cost: { gold: 3, timber: 1, stone: 1 },        rounds: 2 },
  supply_route:    { pillar: 'economic',   cost: { gold: 1, timber: 1 },                  rounds: 1 },
  warehouse:       { pillar: 'economic',   cost: { gold: 2, stone: 1 },                   rounds: 1 },
};

// Legacy V1 structure config kept for processPhaseEnd backward compat only.
// New construction always uses BUILDING_DEFS.
const LEGACY_STRUCTURE_CONFIG = {
  castle:   { pillar: 'military', cost: { gold: 2, iron: 1, stone: 1 }, rounds: 2 },
  barracks: { pillar: 'military', cost: { gold: 1, iron: 1, timber: 1 }, rounds: 1 },
  stables:  { pillar: 'military', cost: { gold: 1, timber: 2, food: 1 }, rounds: 1 },
};

// Get building config from either registry (new buildings first, then legacy).
function getBuildingConfig(structureType) {
  return BUILDING_DEFS[structureType] ?? LEGACY_STRUCTURE_CONFIG[structureType] ?? null;
}

// ─── INLINE: Shattered Crown structure slots (Sprint 4C) ──────────────────────
// SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — structure_slots per territory.
// Do NOT edit manually. Update shatteredCrownConfig.ts, then propagate.
// ─────────────────────────────────────────────────────────────────────────────
const SC_STRUCTURE_SLOTS = {
  I8:['military'],I4:['military','economic'],I6:['economic','military'],I7:['military','diplomatic'],
  I1:['military'],I2:['military','omni'],I3:['diplomatic','diplomatic'],I5:['diplomatic','military'],
  W1:['military','military'],W2:['diplomatic','economic'],W3:['economic'],W4:['military','diplomatic'],
  W5:['omni'],W6:['economic','economic'],W7:['economic','omni'],W8:['military','diplomatic'],
  W9:['military','economic'],
  B1:['military','diplomatic'],B3:['diplomatic','omni'],B2:['diplomatic','diplomatic','omni'],
  B4:['military','diplomatic'],B5:['military','military'],B6:['diplomatic','diplomatic','omni'],
  B7:['military','economic'],B8:['diplomatic','military'],B9:['military','economic'],B10:['omni'],
  S1:['military','diplomatic'],S4:['economic','economic'],S7:['economic','diplomatic'],
  S2:['diplomatic','omni'],S5:['omni'],S8:['economic','economic'],S3:['military','economic'],
  S6:['diplomatic','diplomatic'],S9:['military','omni'],
  C1:['military','diplomatic'],C2:['military','economic'],C3:['military','omni'],C4:['omni'],
  C5:['economic','diplomatic'],C6:['omni'],C7:['diplomatic','diplomatic'],C8:['military','diplomatic'],
};

/**
 * canPlaceBuildingBackend
 * Returns { allowed: true } or { allowed: false, reason: string }.
 * Uses greedy slot matching: exact pillar first, then omni.
 * existingPillars: string[] of 'military'|'economic'|'diplomatic' for already-placed buildings.
 */
function canPlaceBuildingBackend(territoryId, pillar, existingPillars) {
  const slots = SC_STRUCTURE_SLOTS[territoryId];
  if (!slots) return { allowed: true }; // V1 territory — no slot restriction

  // Build a mutable pool of available slots
  const pool = [...slots];

  // Greedily consume existing pillars
  for (const ep of existingPillars) {
    const exactIdx = pool.findIndex(s => s === ep);
    if (exactIdx >= 0) { pool.splice(exactIdx, 1); continue; }
    const omniIdx = pool.findIndex(s => s === 'omni');
    if (omniIdx >= 0) { pool.splice(omniIdx, 1); }
    // else tolerate orphaned building
  }

  // Check if the new pillar fits
  const exactFits = pool.includes(pillar);
  const omniFits  = pool.includes('omni');

  if (exactFits || omniFits) return { allowed: true };

  if (pool.length === 0) {
    return { allowed: false, reason: 'All structure slots in this territory are occupied.' };
  }
  return { allowed: false, reason: `This territory does not have an available ${pillar} slot.` };
}

// ─── Inline: Map Adjacency by map_id ─────────────────────────────────────────

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
  'map_v1_standard':    V1_ADJACENCY_PAIRS,
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

// BFS to find shortest path and return both distance and path
function findPath(startId, endId, adj, ownedTerritories) {
  if (startId === endId) return { distance: 0, path: [startId] };
  
  const visited = new Set([startId]);
  const queue = [[startId, [startId]]];
  
  while (queue.length > 0) {
    const [current, path] = queue.shift();
    const neighbors = adj[current] || new Set();
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        // V1 RULE: Path must travel only through owned territories
        if (!ownedTerritories.has(neighbor)) {
          continue;
        }
        
        const newPath = [...path, neighbor];
        if (neighbor === endId) {
          return { distance: newPath.length - 1, path: newPath };
        }
        visited.add(neighbor);
        queue.push([neighbor, newPath]);
      }
    }
  }
  return { distance: Infinity, path: [] }; // No valid path found
}

// ─── Inline: Log helper ───────────────────────────────────────────────────────

async function log(base44, campaignId, round, phase, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase,
    round,
    event_type: eventType,
    player_id: playerId ?? null,
    payload,
    is_public: isPublic,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
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

  const isInternalCall = body._internal === true;
  const myPlayer = isInternalCall ? null : players.find(p => p.user_id === user.id);
  if (!isInternalCall && !myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  // ── Acting-as delegation ─────────────────────────────────────────────────────
  const { acting_as_player_id } = body;
  let actingPlayer = myPlayer;
  if (!isInternalCall && user) {
    const actingResult = resolveActingCampaignPlayer({
      user, campaign_id, acting_as_player_id, campaignPlayers: players, requireActive: false,
    });
    if (!actingResult.success) return Response.json({ error: actingResult.reason }, { status: 403 });
    actingPlayer = actingResult.actingPlayer;
  }

  const round = campaign.current_round ?? 1;
  const phase = 'fortify';
  const maxFortifications = campaign.settings?.max_fortifications_per_phase ?? DEFAULT_MAX_FORTIFICATIONS;
  const baseMaxDistance = campaign.settings?.max_fortification_distance ?? DEFAULT_MAX_DISTANCE;

  // Sprint 4D: Compute per-player building bonuses (Logistics Corps, Builders Guild).
  // Called lazily — only fetches when the relevant actions need them.
  async function getPlayerBuildingBonuses(playerId) {
    const allStatesForPlayer = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: playerId,
    });
    const playerBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
      campaign_id, player_id: playerId,
    });
    const activeBuildings = playerBuildings.filter(b => b.status === 'active');

    // Logistics Corps: +1 fortification distance per active Logistics Corps
    const logisticsCorpsCount = activeBuildings.filter(b => b.building_type === 'logistics_corps').length;

    // Builders Guild: +1 concurrent construction slot per active Builders Guild
    const buildersGuildCount = activeBuildings.filter(b => b.building_type === 'builders_guild').length;

    return {
      extraFortificationDistance: logisticsCorpsCount,
      extraConstructionSlots: buildersGuildCount,
    };
  }

  const maxDistance = baseMaxDistance; // default; may be overridden per-player below

  // ── ACTION: startFortify ───────────────────────────────────────────────────────
  if (action === 'startFortify') {
    const isAdminUser = user && campaign.admin_user_id === user.id;
    if (!isInternalCall && !isAdminUser) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Campaign is not in fortify phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);

    // Idempotency: check decisions AND snapshot — both must exist for a clean start.
    const [existingDecisions, existingStartSnap] = await Promise.all([
      base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'fortify', round }),
      base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id, phase: 'fortify', round, snapshot_type: 'phase_start' }),
    ]);

    const decisionsExist = existingDecisions.length > 0;
    const snapshotExists = existingStartSnap.length > 0;

    // ── Write phase_start snapshot (idempotent — only if missing) ─────────────
    // This is the authoritative before-snapshot for the consolidation phase.
    // Must be written at phase START so audits have a baseline before any player action.
    if (!snapshotExists) {
      console.log(`[startFortify] Writing fortify phase_start snapshot for round ${round}.`);
      const [snapStates, snapInfluence, snapPools, snapBuildings, snapRoutes, snapObjectives, snapVictory, snapDev] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
        base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
        base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
        base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id }),
        base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
      ]);
      const snapDevMap = {};
      for (const d of snapDev) snapDevMap[d.territory_id] = d;
      await base44.asServiceRole.entities.PhaseSnapshot.create({
        campaign_id, round, phase: 'fortify', snapshot_type: 'phase_start',
        _schema_version: 2,
        territory_states: snapStates.map(ts => {
          const dev = snapDevMap[ts.territory_id] ?? null;
          return {
            territory_id: ts.territory_id, owner_player_id: ts.owner_player_id ?? null,
            troop_count: ts.troop_count ?? 0, resource_storage: ts.resource_storage ?? {},
            has_resource_hub: ts.has_resource_hub ?? false, structures: ts.structures ?? [],
            resource_type: ts.resource_type ?? null,
            development_level: dev?.development_level ?? null, development_progress: dev?.development_progress ?? null,
            food_to_next_level: dev?.food_to_next_level ?? null, total_food_invested: dev?.total_food_invested ?? null,
            is_capital: dev?.is_capital ?? null, unlocked_resources: dev?.unlocked_resources ?? null,
            unlocked_slot_count: dev?.unlocked_slot_count ?? null,
          };
        }),
        player_standings: activePlayers.map(p => {
          const owned = snapStates.filter(ts => ts.owner_player_id === p.id);
          return { player_id: p.id, display_name: p.display_name, territory_count: owned.length, troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0), is_eliminated: p.is_eliminated ?? false };
        }),
        permanent_influence: snapInfluence.map(i => ({ territory_id: i.territory_id, player_id: i.player_id, influence_amount: i.influence_amount ?? 0 })),
        spendable_influence: snapPools.map(p => ({ region_id: p.region_id, player_id: p.player_id, spendable_influence: p.spendable_influence ?? 0 })),
        buildings: snapBuildings.map(b => ({ territory_id: b.territory_id, player_id: b.player_id, building_type: b.building_type, pillar_type: b.pillar_type, status: b.status, started_round: b.started_round, completed_round: b.completed_round, construction_progress: b.construction_progress ?? 0 })),
        supply_routes: snapRoutes.map(r => ({ id: r.id, owner_player_id: r.owner_player_id, hub_territory_id: r.hub_territory_id, source_territory_id: r.source_territory_id, route_status: r.route_status, resource_type: r.resource_type, created_round: r.created_round })),
        objectives: snapObjectives.map(o => ({ player_id: o.player_id, global_influence: o.global_influence ?? 0, objective_cards: o.objective_cards_json ?? {} })),
        victory_scores: snapVictory.map(v => ({ player_id: v.player_id, occupancy_score: v.occupancy_score ?? 0, wealth_score: v.wealth_score ?? 0, influence_score: v.influence_score ?? 0, has_won: v.has_won ?? false, winning_condition: v.winning_condition ?? null })),
      });
      console.log(`[startFortify] phase_start snapshot written for round ${round}.`);
    }

    if (decisionsExist) {
      return Response.json({ success: true, idempotent: true, snapshot_repaired: !snapshotExists, active_players: activePlayers.length });
    }

    // Create PhaseDecision stubs for all active players
    for (const p of activePlayers) {
      await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id,
        player_id: p.id,
        phase: 'fortify',
        round,
        is_locked: false,
        data: { movements: [], construction: null },
      });
    }

    await log(base44, campaign_id, round, phase, 'phase_started', null, {
      active_players: activePlayers.length,
    }, true);

    return Response.json({ success: true, active_players: activePlayers.length });
  }

  // ── ACTION: stageMovement ─────────────────────────────────────────────────────
  if (action === 'stageMovement') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { origin_territory_id, destination_territory_id, committed_troops, submission_id } = body;
    if (!origin_territory_id || !destination_territory_id || committed_troops == null) {
      return Response.json({ error: 'origin_territory_id, destination_territory_id, and committed_troops are required' }, { status: 400 });
    }
    if (!Number.isInteger(committed_troops) || committed_troops < 1) {
      return Response.json({ error: 'committed_troops must be a positive integer' }, { status: 400 });
    }

    // Load territory states
    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const originState = allStates.find(s => s.territory_id === origin_territory_id);
    const destState = allStates.find(s => s.territory_id === destination_territory_id);

    // ── Territory lock check ───────────────────────────────────────────────────
    const lockedIds = new Set(campaign.locked_territory_ids ?? []);
    if (lockedIds.has(origin_territory_id)) {
      return Response.json({ error: `Territory ${origin_territory_id} is locked by a delayed battle and cannot be used to fortify.` }, { status: 400 });
    }
    if (lockedIds.has(destination_territory_id)) {
      return Response.json({ error: `Territory ${destination_territory_id} is locked by a delayed battle and cannot be fortified into.` }, { status: 400 });
    }

    // Validate ownership (acting player)
    if (!originState || originState.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: `You do not own ${origin_territory_id}` }, { status: 400 });
    }
    if (!destState || destState.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: `You do not own ${destination_territory_id}` }, { status: 400 });
    }

    // Validate adjacency/distance with path finding
    // Sprint 4D: Logistics Corps increases max distance per player
    const playerBonuses = await getPlayerBuildingBonuses(actingPlayer.id);
    const effectiveMaxDistance = baseMaxDistance + playerBonuses.extraFortificationDistance;

    const adj = buildAdjacency(campaign.map_id ?? 'map_v1_standard');

    // Get all territories owned by acting player for path validation
    const ownedTerritoryIds = new Set(
      allStates.filter(s => s.owner_player_id === actingPlayer.id).map(s => s.territory_id)
    );
    
    const pathResult = findPath(origin_territory_id, destination_territory_id, adj, ownedTerritoryIds);
    if (pathResult.distance > effectiveMaxDistance) {
      return Response.json({ 
        error: `Distance ${pathResult.distance} exceeds maximum ${effectiveMaxDistance}. Path must travel through owned territories only.`,
      }, { status: 400 });
    }
    if (pathResult.path.length === 0) {
      return Response.json({ 
        error: `No valid path found. Fortification must travel through territories you own.`,
      }, { status: 400 });
    }

    // Load acting player's decision (may differ from myPlayer when admin acts as test player)
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    let decision = decisions[0];
    if (!decision) return Response.json({ error: `No fortify decision found for player ${actingPlayer.display_name}. Phase may not have started yet.` }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your fortifications' }, { status: 400 });

    const currentMovements = decision.data?.movements ?? [];

    // ── Idempotency: submission_id dedup ──────────────────────────────────────
    if (submission_id) {
      const dup = currentMovements.find(m => m.submission_id === submission_id);
      if (dup) {
        return Response.json({ success: true, movement_id: dup.id, movements: currentMovements, idempotent: true });
      }
    }

    if (currentMovements.length >= maxFortifications) {
      return Response.json({ error: `Max ${maxFortifications} movements per phase` }, { status: 400 });
    }

    // Validate troops available (accounting for already-staged movements)
    const alreadyCommittedFromOrigin = currentMovements
      .filter(m => m.origin_territory_id === origin_territory_id)
      .reduce((s, m) => s + (m.committed_troops || 0), 0);
    const availableAtOrigin = (originState.troop_count || 0) - alreadyCommittedFromOrigin;
    
    if (committed_troops > availableAtOrigin) {
      return Response.json({
        error: `Cannot move ${committed_troops} troops — only ${availableAtOrigin} available at ${origin_territory_id}`,
      }, { status: 400 });
    }

    // Upsert movement with path storage
    const existingIdx = currentMovements.findIndex(
      m => m.origin_territory_id === origin_territory_id && m.destination_territory_id === destination_territory_id
    );
    const newMovement = {
      id: existingIdx >= 0 ? currentMovements[existingIdx].id : `mov_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      submission_id: submission_id ?? null,
      origin_territory_id,
      destination_territory_id,
      committed_troops,
      path_territory_ids: pathResult.path, // Store actual path for revealed arrows
    };
    const updatedMovements = existingIdx >= 0
      ? currentMovements.map((m, i) => i === existingIdx ? newMovement : m)
      : [...currentMovements, newMovement];

    await base44.asServiceRole.entities.PhaseDecision.update(decision.id, {
      data: { movements: updatedMovements, construction: decision.data?.construction ?? null },
    });

    await log(base44, campaign_id, round, phase, 'movement_staged', actingPlayer.id, {
      movement_id: newMovement.id,
      movement_count: updatedMovements.length,
      origin_territory_id,
      destination_territory_id,
      committed_troops,
      path: pathResult.path,
    }, false);

    return Response.json({ success: true, movement_id: newMovement.id, movements: updatedMovements });
  }

  // ── ACTION: deleteMovement ────────────────────────────────────────────────────
  if (action === 'deleteMovement') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { movement_id } = body;
    if (!movement_id) return Response.json({ error: 'movement_id is required' }, { status: 400 });

    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No fortify decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const updatedMovements = (decision.data?.movements ?? []).filter(m => m.id !== movement_id);
    await base44.asServiceRole.entities.PhaseDecision.update(decision.id, {
      data: { movements: updatedMovements, construction: decision.data?.construction ?? null },
    });

    return Response.json({ success: true, movements: updatedMovements });
  }

  // ── ACTION: startConstruction ─────────────────────────────────────────────────
  if (action === 'startConstruction') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { territory_id, structure_type, submission_id: constructionSubmissionId } = body;
    if (!territory_id || !structure_type) {
      return Response.json({ error: 'territory_id and structure_type are required' }, { status: 400 });
    }

    const buildingConfig = getBuildingConfig(structure_type);
    if (!buildingConfig) {
      return Response.json({ error: `Unknown building type: ${structure_type}` }, { status: 400 });
    }

    // ── Territory lock check ───────────────────────────────────────────────────
    const lockedIdsConst = new Set(campaign.locked_territory_ids ?? []);
    if (lockedIdsConst.has(territory_id)) {
      return Response.json({ error: `Territory ${territory_id} is locked by a delayed battle and cannot be built on.` }, { status: 400 });
    }

    // Validate territory ownership (acting player)
    const territoryState = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, territory_id,
    });
    const ts = territoryState[0];
    if (!ts || ts.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: `You do not own ${territory_id}` }, { status: 400 });
    }

    // ── Sprint 4C: Structure slot enforcement ──────────────────────────────────
    // Determine existing building pillars for this territory.
    // Sources: TerritoryState.structures (legacy) + TerritoryBuilding (new Sprint 3B+)
    const legacyPillars = (ts.structures ?? []).map(s => {
      const cfg = getBuildingConfig(s);
      return cfg?.pillar ?? 'military'; // legacy structures default to military
    });
    const existingBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
      campaign_id, territory_id,
    });
    const newBuildingPillars = existingBuildings
      .filter(b => b.status !== 'destroyed')
      .map(b => b.pillar_type ?? 'military');
    const allExistingPillars = [...legacyPillars, ...newBuildingPillars];

    const slotCheck = canPlaceBuildingBackend(territory_id, buildingConfig.pillar, allExistingPillars);
    if (!slotCheck.allowed) {
      return Response.json({ error: slotCheck.reason }, { status: 400 });
    }
    // ── End slot enforcement ───────────────────────────────────────────────────

    // Load acting player's decision
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: `No fortify decision found for player ${actingPlayer.display_name}. Phase may not have started yet.` }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your fortifications' }, { status: 400 });
    // Sprint 4D: Builders Guild increases max concurrent construction slots
    const constructionBonuses = await getPlayerBuildingBonuses(actingPlayer.id);
    const baseConstructionSlots = 1;
    const effectiveConstructionSlots = baseConstructionSlots + constructionBonuses.extraConstructionSlots;

    // Count how many construction projects are already staged this phase
    // (PhaseDecision.data.construction is a single slot in V1; with Builders Guild it expands)
    // For simplicity, check against active ConstructionProjects from previous rounds too
    const activeProjects = await base44.asServiceRole.entities.ConstructionProject.filter({
      campaign_id,
      player_id: actingPlayer.id,
      status: 'in_progress',
    });
    // Current phase staged construction also counts
    const stagedThisPhase = decision.data?.construction ? 1 : 0;
    const totalActive = activeProjects.length + stagedThisPhase;

    if (totalActive >= effectiveConstructionSlots) {
      return Response.json({
        error: `You already have ${totalActive} active construction project${totalActive !== 1 ? 's' : ''}. Max allowed: ${effectiveConstructionSlots}${constructionBonuses.extraConstructionSlots > 0 ? ` (base 1 + ${constructionBonuses.extraConstructionSlots} from Builders Guild)` : ''}.`,
      }, { status: 400 });
    }

    // ── Idempotency: if already staged the exact same construction, return early ─
    const existingConstruction = decision.data?.construction;
    if (
      existingConstruction &&
      existingConstruction.territory_id === territory_id &&
      existingConstruction.structure_type === structure_type
    ) {
      return Response.json({ success: true, construction_staged: true, pillar: buildingConfig.pillar, idempotent: true });
    }
    if (constructionSubmissionId && existingConstruction?.submission_id === constructionSubmissionId) {
      return Response.json({ success: true, construction_staged: true, pillar: buildingConfig.pillar, idempotent: true });
    }

    // Store construction choice privately in PhaseDecision (revealed at processPhaseEnd)
    await base44.asServiceRole.entities.PhaseDecision.update(decision.id, {
      data: {
        movements: decision.data?.movements ?? [],
        construction: {
          territory_id,
          structure_type,
          pillar: buildingConfig.pillar,
          submission_id: constructionSubmissionId ?? null,
          staged_at: new Date().toISOString(),
        },
      },
    });

    await log(base44, campaign_id, round, phase, 'construction_staged', actingPlayer.id, {
      structure_type,
      territory_id,
      pillar: buildingConfig.pillar,
    }, false);

    return Response.json({ success: true, construction_staged: true, pillar: buildingConfig.pillar });
  }

  // ── ACTION: lockFortify ───────────────────────────────────────────────────────
  // Accepts optional _local_movements and _local_caravans from local-first staging.
  // These are validated and written to the PhaseDecision before locking.
  if (action === 'lockFortify') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }

    const localMovements = Array.isArray(body._local_movements) ? body._local_movements : null;
    const localCaravans  = Array.isArray(body._local_caravans)  ? body._local_caravans  : null;

    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    let decision = decisions[0];

    // If local staging was provided, validate movements and build the decision data
    let finalMovements = decision?.data?.movements ?? [];
    let finalCaravans  = decision?.data?.caravans  ?? [];

    if (localMovements !== null && localMovements.length > 0) {
      // Validate each movement server-side (ownership, troop count)
      const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      const ownedIds = new Set(allStates.filter(s => s.owner_player_id === actingPlayer.id).map(s => s.territory_id));
      const validated = [];
      for (const mov of localMovements) {
        if (!mov.origin_territory_id || !mov.destination_territory_id || !mov.committed_troops) continue;
        if (!ownedIds.has(mov.origin_territory_id) || !ownedIds.has(mov.destination_territory_id)) continue;
        if (mov.committed_troops < 1) continue;
        validated.push({
          id: mov.id ?? `mov_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          origin_territory_id: mov.origin_territory_id,
          destination_territory_id: mov.destination_territory_id,
          committed_troops: Math.floor(mov.committed_troops),
        });
      }
      finalMovements = validated;
    }

    if (localCaravans !== null && localCaravans.length > 0) {
      // Validate caravan ownership and resources
      const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      const ownedIds = new Set(allStates.filter(s => s.owner_player_id === actingPlayer.id).map(s => s.territory_id));
      // Route safety: compute inline BFS
      const adj = buildAdjacency(campaign.map_id ?? 'shattered_crown_v1');
      function findAnyPathLocal(startId, endId) {
        if (startId === endId) return [startId];
        const visited = new Set([startId]);
        const queue = [[startId, [startId]]];
        while (queue.length > 0) {
          const [current, path] = queue.shift();
          const neighbors = adj[current] || new Set();
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              const newPath = [...path, neighbor];
              if (neighbor === endId) return newPath;
              visited.add(neighbor);
              queue.push([neighbor, newPath]);
            }
          }
        }
        return null;
      }
      const validated = [];
      for (const c of localCaravans) {
        if (!c.origin || !c.destination || !c.contents) continue;
        if (!ownedIds.has(c.origin) || !ownedIds.has(c.destination)) continue;
        const hasContents = Object.values(c.contents).some(v => v > 0);
        if (!hasContents) continue;
        // Re-compute route safety server-side
        const path = findAnyPathLocal(c.origin, c.destination);
        const traversed = path ? path.slice(1, -1) : [];
        const enemyTs = traversed.filter(tid => {
          const ts = allStates.find(s => s.territory_id === tid);
          return ts?.owner_player_id && ts.owner_player_id !== actingPlayer.id;
        });
        validated.push({
          id: c.id ?? `caravan_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          origin: c.origin,
          destination: c.destination,
          contents: c.contents,
          path: path ?? [],
          safe: enemyTs.length === 0,
          enemy_territories: enemyTs,
          staged_at: c.staged_at ?? new Date().toISOString(),
        });
      }
      finalCaravans = validated;
    }

    const decisionData = {
      movements: finalMovements,
      construction: decision?.data?.construction ?? null,
      caravans: finalCaravans,
    };

    if (!decision) {
      await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
        is_locked: true,
        locked_at: new Date().toISOString(),
        data: decisionData,
      });
    } else if (!decision.is_locked) {
      await base44.asServiceRole.entities.PhaseDecision.update(decision.id, {
        is_locked: true,
        locked_at: new Date().toISOString(),
        data: decisionData,
      });
    }

    await log(base44, campaign_id, round, phase, 'player_locked', actingPlayer.id, {
      display_name: actingPlayer.display_name,
      movements_count: finalMovements.length,
      caravans_count: finalCaravans.length,
    }, true);

    return Response.json({ success: true });
  }

  // ── ACTION: unlockFortify ─────────────────────────────────────────────────────
  if (action === 'unlockFortify') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    const decision = decisions[0];
    if (!decision?.is_locked) {
      return Response.json({ success: true, idempotent: true, message: 'Not locked.' });
    }
    await base44.asServiceRole.entities.PhaseDecision.update(decision.id, {
      is_locked: false,
      locked_at: null,
    });
    return Response.json({ success: true, message: `Consolidation unlocked for ${actingPlayer.display_name}.` });
  }

  // ── ACTION: processPhaseEnd ───────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }

    // ── Verify before-snapshot exists (hard guard) ────────────────────────────
    // The fortify phase_start snapshot MUST have been written by startFortify.
    // If it is missing here, startFortify was never called — we repair it now
    // rather than silently proceeding, so audits always have a valid baseline.
    const existingBeforeSnapsF = await base44.asServiceRole.entities.PhaseSnapshot.filter({
      campaign_id, round, phase: 'fortify', snapshot_type: 'phase_start',
    });
    if (existingBeforeSnapsF.length === 0) {
      console.warn(`[fortifyPhase.processPhaseEnd] WARNING: fortify phase_start snapshot missing for round ${round} — calling startFortify to repair.`);
      try {
        await base44.asServiceRole.functions.invoke('fortifyPhase', {
          action: 'startFortify', campaign_id, _internal: true,
        });
        console.log(`[fortifyPhase.processPhaseEnd] Repair: phase_start snapshot written.`);
      } catch (repairErr) {
        // Log the failure but do NOT block phase completion.
        // The snapshot will be missing from the audit but the game must continue.
        console.error(`[fortifyPhase.processPhaseEnd] REPAIR FAILED: ${repairErr?.message}. Phase proceeding without before-snapshot.`);
        await log(base44, campaign_id, round, phase, 'phase_start_snapshot_missing_at_phase_end', null, {
          round, phase: 'fortify',
          error: repairErr?.message ?? 'unknown',
          severity: 'critical',
          message: 'fortify phase_start snapshot was missing when processPhaseEnd ran. Repair attempted but failed. Audit exports will show missing before-snapshot.',
        }, false);
      }
    }

    // Expire stale trade proposals from previous round at start of Consolidation
    try {
      await base44.asServiceRole.functions.invoke('diplomaticPhase', {
        action: 'expireTradeProposals',
        campaign_id,
      });
    } catch (_) { /* non-fatal */ }

    // DUPLICATE PHASE-END PROTECTION: Check if already processed
    const existingSnapshot = await base44.asServiceRole.entities.PhaseSnapshot.filter({
      campaign_id,
      round,
      phase: 'fortify',
      snapshot_type: 'phase_end',
    });
    if (existingSnapshot.length > 0) {
      return Response.json({ 
        error: 'Fortify phase already processed for this round',
        already_processed: true,
      }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const allDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'fortify', round,
    });

    // All players auto-submitted (no hidden data to randomize)
    for (const p of activePlayers) {
      const dec = allDecisions.find(d => d.player_id === p.id);
      if (!dec || !dec.is_locked) {
        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true, is_auto_submitted: true,
          });
        } else {
          await base44.asServiceRole.entities.PhaseDecision.create({
            campaign_id, player_id: p.id, phase: 'fortify', round,
            is_locked: true, is_auto_submitted: true,
            data: { movements: [], construction: null },
          });
        }
        await log(base44, campaign_id, round, phase, 'auto_submitted', p.id, {
          display_name: p.display_name,
        }, false);
      }
    }

    // Reload finalized decisions
    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'fortify', round,
    });

    // REVEAL: Apply all troop movements
    const troopChanges = {}; // territory_id -> net change

    for (const dec of finalDecisions) {
      const movements = dec.data?.movements ?? [];
      for (const mov of movements) {
        // Subtract from origin
        troopChanges[mov.origin_territory_id] = (troopChanges[mov.origin_territory_id] || 0) - mov.committed_troops;
        // Add to destination
        troopChanges[mov.destination_territory_id] = (troopChanges[mov.destination_territory_id] || 0) + mov.committed_troops;
      }
    }

    // REVEAL: Process safe caravans — move resources between territories
    const RESOURCES = ['gold','iron','timber','stone','food'];
    const resourceChanges = {}; // territory_id -> { gold, iron, ... } delta
    for (const dec of finalDecisions) {
      const caravans = dec.data?.caravans ?? [];
      for (const caravan of caravans) {
        if (!caravan.safe) continue; // unsafe caravans only move after battle resolution
        const { origin, destination, contents } = caravan;
        if (!origin || !destination || !contents) continue;
        if (!resourceChanges[origin])      resourceChanges[origin]      = {};
        if (!resourceChanges[destination]) resourceChanges[destination] = {};
        for (const r of RESOURCES) {
          const amt = contents[r] ?? 0;
          if (amt <= 0) continue;
          resourceChanges[origin][r]      = (resourceChanges[origin][r] ?? 0) - amt;
          resourceChanges[destination][r] = (resourceChanges[destination][r] ?? 0) + amt;
        }
        await log(base44, campaign_id, round, phase, 'caravan_delivered', dec.player_id, {
          origin, destination, contents, caravan_id: caravan.id,
        }, false);
      }
    }

    // Apply troop changes
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    for (const [tid, change] of Object.entries(troopChanges)) {
      if (change === 0) continue;
      const existing = allTerritoryStates.find(s => s.territory_id === tid);
      if (existing) {
        await base44.asServiceRole.entities.TerritoryState.update(existing.id, {
          troop_count: Math.max(0, (existing.troop_count || 0) + change),
        });
      }
    }

    // Apply caravan resource changes
    if (Object.keys(resourceChanges).length > 0) {
      // Re-fetch states after troop updates to get fresh storage values
      const statesAfterTroops = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      for (const [tid, delta] of Object.entries(resourceChanges)) {
        const ts = statesAfterTroops.find(s => s.territory_id === tid);
        if (!ts) continue;
        const storage = { gold:0, iron:0, timber:0, stone:0, food:0, ...(ts.resource_storage ?? {}) };
        for (const r of RESOURCES) {
          storage[r] = Math.max(0, (storage[r] ?? 0) + (delta[r] ?? 0));
        }
        await base44.asServiceRole.entities.TerritoryState.update(ts.id, { resource_storage: storage });
      }
    }

    // REVEAL: Process staged construction choices and create ConstructionProjects
    // C2 fix: deduct costs from PlayerResourceLedger (actual territory storage), not DeployIncome.
    const constructionsToCreate = [];
    
    for (const dec of finalDecisions) {
      const construction = dec.data?.construction;
      if (!construction || !construction.territory_id || !construction.structure_type) continue;
      
      const config = getBuildingConfig(construction.structure_type);
      if (!config) continue; // Unknown type — skip gracefully

      // C2 fix: validate resources against PlayerResourceLedger (actual player resources)
      const playerLedgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({
        campaign_id, player_id: dec.player_id,
      });
      const ledger = playerLedgers[0];
      const ledgerResources = {
        gold: ledger?.gold ?? 0,
        iron: ledger?.iron ?? 0,
        timber: ledger?.timber ?? 0,
        stone: ledger?.stone ?? 0,
        food: ledger?.food ?? 0,
      };

      // Also check capital territory storage as fallback (resources may be stored there)
      const devRecs = await base44.asServiceRole.entities.TerritoryDevelopment.filter({
        campaign_id, owner_player_id: dec.player_id,
      });
      const capitalDev = devRecs.find(d => d.is_capital) ?? devRecs[0] ?? null;
      const capitalTs = capitalDev
        ? allTerritoryStates.find(s => s.territory_id === capitalDev.territory_id)
        : null;
      const capitalStorage = capitalTs?.resource_storage ?? {};

      // Combined resources: ledger + capital storage
      const combined = {
        gold:   (ledgerResources.gold   ?? 0) + (capitalStorage.gold   ?? 0),
        iron:   (ledgerResources.iron   ?? 0) + (capitalStorage.iron   ?? 0),
        timber: (ledgerResources.timber ?? 0) + (capitalStorage.timber ?? 0),
        stone:  (ledgerResources.stone  ?? 0) + (capitalStorage.stone  ?? 0),
        food:   (ledgerResources.food   ?? 0) + (capitalStorage.food   ?? 0),
      };

      const canAfford = Object.entries(config.cost).every(([res, amount]) => {
        if (amount === 0) return true;
        return (combined[res] ?? 0) >= amount;
      });
      
      if (!canAfford) {
        await log(base44, campaign_id, round, phase, 'construction_failed', dec.player_id, {
          structure_type: construction.structure_type,
          territory_id: construction.territory_id,
          reason: 'insufficient_resources',
          cost: config.cost,
          available: combined,
        }, false);
        continue;
      }

      // C2 fix: deduct resources from capital storage first, then ledger
      let remainingCost = { ...config.cost };
      // Deduct from capital storage first
      if (capitalTs) {
        const newCapStorage = { ...capitalStorage };
        for (const [res, amount] of Object.entries(remainingCost)) {
          if (amount <= 0) continue;
          const avail = newCapStorage[res] ?? 0;
          const take = Math.min(avail, amount);
          newCapStorage[res] = avail - take;
          remainingCost[res] = amount - take;
        }
        await base44.asServiceRole.entities.TerritoryState.update(capitalTs.id, {
          resource_storage: newCapStorage,
        });
      }
      // Deduct remainder from ledger
      if (ledger) {
        const newLedger = { ...ledgerResources };
        for (const [res, amount] of Object.entries(remainingCost)) {
          if (amount <= 0) continue;
          newLedger[res] = Math.max(0, (newLedger[res] ?? 0) - amount);
        }
        await base44.asServiceRole.entities.PlayerResourceLedger.update(ledger.id, {
          gold: newLedger.gold, iron: newLedger.iron, timber: newLedger.timber,
          stone: newLedger.stone, food: newLedger.food,
          updated_at_round: round, updated_at_phase: 'fortify',
        });
      }
      
      // Create ConstructionProject (now visible to all)
      const project = await base44.asServiceRole.entities.ConstructionProject.create({
        campaign_id,
        round_started: round,
        player_id: dec.player_id,
        territory_id: construction.territory_id,
        structure_type: construction.structure_type,
        total_cost: config.cost,
        resources_paid: config.cost,
        rounds_required: config.rounds,
        rounds_completed: 0,
        status: 'in_progress',
      });
      
      constructionsToCreate.push(project);
      
      await log(base44, campaign_id, round, phase, 'construction_revealed', dec.player_id, {
        structure_type: construction.structure_type,
        territory_id: construction.territory_id,
        cost_deducted: config.cost,
      }, false);
    }
    
    // Process existing and new construction projects
    const allProjects = await base44.asServiceRole.entities.ConstructionProject.filter({
      campaign_id, status: 'in_progress',
    });

    for (const project of allProjects) {
      const newRoundsCompleted = project.rounds_completed + 1;
      const isComplete = newRoundsCompleted >= project.rounds_required;

      if (isComplete) {
        // Add structure to territory
        const territoryStates = allTerritoryStates.filter(ts => ts.territory_id === project.territory_id);
        const ts = territoryStates[0];
        if (ts) {
          const structures = ts.structures ?? [];
          if (!structures.includes(project.structure_type)) {
            structures.push(project.structure_type);
            await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
              structures,
            });
          }
        }

        await base44.asServiceRole.entities.ConstructionProject.update(project.id, {
          rounds_completed: newRoundsCompleted,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

        await log(base44, campaign_id, round, phase, 'construction_completed', project.player_id, {
          structure_type: project.structure_type,
          territory_id: project.territory_id,
        }, true);
      } else {
        await base44.asServiceRole.entities.ConstructionProject.update(project.id, {
          rounds_completed: newRoundsCompleted,
        });
      }
    }

    // ── TerritoryBuilding lifecycle: planned → under_construction → active ──────
    // Buildings created during Operations lock-in start as 'planned'.
    // At end of first Consolidation they become 'under_construction'.
    // After rounds_required more rounds, they become 'active'.
    // V1: all buildings complete in 1 round (planned→active immediately).
    const BUILDING_ROUNDS = {
      barracks: 1, war_council: 2, logistics_corps: 1,
      embassy: 1, council_chamber: 2, foreign_office: 1, monument: 2,
      marketplace: 1, builders_guild: 1, trade_network: 2,
      resource_hub: 1, supply_route: 1, warehouse: 1,
    };
    const allTerritoryBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id });
    for (const bld of allTerritoryBuildings) {
      if (bld.status === 'planned') {
        const requiredRounds = BUILDING_ROUNDS[bld.building_type] ?? 1;
        const progress = (bld.construction_progress ?? 0) + 1;
        if (progress >= requiredRounds) {
          await base44.asServiceRole.entities.TerritoryBuilding.update(bld.id, {
            status: 'active',
            construction_progress: progress,
            completed_round: round,
          });
          // Set has_resource_hub flag if applicable
          if (bld.building_type === 'resource_hub') {
            const ts = allTerritoryStates.find(s => s.territory_id === bld.territory_id);
            if (ts) {
              await base44.asServiceRole.entities.TerritoryState.update(ts.id, { has_resource_hub: true });
            }
          }
          await log(base44, campaign_id, round, phase, 'building_activated', bld.player_id, {
            building_type: bld.building_type, territory_id: bld.territory_id,
            started_round: bld.started_round, completed_round: round,
          }, true);
        } else {
          await base44.asServiceRole.entities.TerritoryBuilding.update(bld.id, {
            status: 'under_construction',
            construction_progress: progress,
          });
          await log(base44, campaign_id, round, phase, 'building_under_construction', bld.player_id, {
            building_type: bld.building_type, territory_id: bld.territory_id,
            construction_progress: progress, rounds_required: requiredRounds,
          }, false);
        }
      } else if (bld.status === 'under_construction') {
        const requiredRounds = BUILDING_ROUNDS[bld.building_type] ?? 1;
        const progress = (bld.construction_progress ?? 0) + 1;
        if (progress >= requiredRounds) {
          await base44.asServiceRole.entities.TerritoryBuilding.update(bld.id, {
            status: 'active',
            construction_progress: progress,
            completed_round: round,
          });
          if (bld.building_type === 'resource_hub') {
            const ts = allTerritoryStates.find(s => s.territory_id === bld.territory_id);
            if (ts) {
              await base44.asServiceRole.entities.TerritoryState.update(ts.id, { has_resource_hub: true });
            }
          }
          await log(base44, campaign_id, round, phase, 'building_activated', bld.player_id, {
            building_type: bld.building_type, territory_id: bld.territory_id,
            started_round: bld.started_round, completed_round: round,
          }, true);
        } else {
          await base44.asServiceRole.entities.TerritoryBuilding.update(bld.id, {
            construction_progress: progress,
          });
        }
      }
    }

    // Phase snapshot — full v2 schema
    const [finalStates, fortEndInfluence, fortEndRegionalPools, fortEndBuildings, fortEndSupplyRoutes, fortEndObjectives, fortEndVictory, fortEndDev] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
      base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id }),
      base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
    ]);
    const fortEndDevMap = {};
    for (const d of fortEndDev) fortEndDevMap[d.territory_id] = d;
    await base44.asServiceRole.entities.PhaseSnapshot.create({
      campaign_id, round, phase: 'fortify', snapshot_type: 'phase_end',
      _schema_version: 2,
      territory_states: finalStates.map(ts => {
        const dev = fortEndDevMap[ts.territory_id] ?? null;
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
      permanent_influence: fortEndInfluence.map(i => ({ territory_id: i.territory_id, player_id: i.player_id, influence_amount: i.influence_amount ?? 0 })),
      spendable_influence: fortEndRegionalPools.map(p => ({ region_id: p.region_id, player_id: p.player_id, spendable_influence: p.spendable_influence ?? 0 })),
      buildings: fortEndBuildings.map(b => ({ territory_id: b.territory_id, player_id: b.player_id, building_type: b.building_type, pillar_type: b.pillar_type, status: b.status, started_round: b.started_round, completed_round: b.completed_round, construction_progress: b.construction_progress ?? 0 })),
      supply_routes: fortEndSupplyRoutes.map(r => ({ id: r.id, owner_player_id: r.owner_player_id, hub_territory_id: r.hub_territory_id, source_territory_id: r.source_territory_id, route_status: r.route_status, resource_type: r.resource_type, created_round: r.created_round })),
      objectives: fortEndObjectives.map(o => ({ player_id: o.player_id, global_influence: o.global_influence ?? 0, objective_cards: o.objective_cards_json ?? {} })),
      victory_scores: fortEndVictory.map(v => ({ player_id: v.player_id, occupancy_score: v.occupancy_score ?? 0, wealth_score: v.wealth_score ?? 0, influence_score: v.influence_score ?? 0, has_won: v.has_won ?? false, winning_condition: v.winning_condition ?? null })),
    });

    await log(base44, campaign_id, round, phase, 'phase_advanced', null, {
      next_phase: campaign.current_round >= 1 ? 'deploy' : 'deploy', // Loop back to deploy for next round
      round,
      movements_applied: Object.keys(troopChanges).length / 2,
      constructions_completed: allProjects.filter(p => 
        (p.rounds_completed + 1) >= p.rounds_required
      ).length,
    }, true);

    // ── Sprint 5A: Victory check at end of Consolidation (Fortify) Phase ────
    // Invoke victoryPhase.checkVictory. If a winner is found, it sets
    // campaign.current_phase = 'complete' — we skip the deploy advance.
    let victoryResult = null;
    try {
      const victoryRes = await base44.asServiceRole.functions.invoke('victoryPhase', {
        action: 'checkVictory',
        campaign_id,
      });
      victoryResult = victoryRes?.data ?? null;
    } catch (vErr) {
      // Non-fatal: victory check failure should not block phase advance
      await log(base44, campaign_id, round, phase, 'victory_check_error', null, {
        error: vErr?.message ?? 'unknown',
      }, false);
    }

    if (victoryResult?.campaign_complete) {
      // Winner declared — campaign already set to 'complete' by victoryPhase
      return Response.json({
        success: true,
        next_phase: 'complete',
        next_round: round,
        movements_applied: Object.keys(troopChanges).length / 2,
        victory: victoryResult.winner,
      });
    }

    // Advance to next round's deploy phase
    const nextRound = round + 1;
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_round: nextRound,
      current_phase: 'deploy',
    });

    return Response.json({
      success: true,
      next_phase: 'deploy',
      next_round: nextRound,
      movements_applied: Object.keys(troopChanges).length / 2,
    });
  }

  // ── ACTION: getCaravans ───────────────────────────────────────────────────────
  // Returns staged supply caravans for the acting player this round/phase.
  if (action === 'getCaravans') {
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    const caravans = decisions[0]?.data?.caravans ?? [];
    return Response.json({ success: true, caravans });
  }

  // ── ACTION: stageCaravan ──────────────────────────────────────────────────────
  // Stages a supply caravan to move stored resources between territories.
  // Does NOT require a Supply Route. May cross non-friendly territories (triggers Escort card).
  if (action === 'stageCaravan') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { origin_territory_id, destination_territory_id, shipment_contents, submission_id: caravanSubmissionId } = body;
    if (!origin_territory_id || !destination_territory_id) {
      return Response.json({ error: 'origin_territory_id and destination_territory_id are required' }, { status: 400 });
    }
    if (!shipment_contents || Object.values(shipment_contents).every(v => !v)) {
      return Response.json({ error: 'shipment_contents must include at least one resource' }, { status: 400 });
    }

    // Validate origin AND destination ownership
    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const originState = allStates.find(s => s.territory_id === origin_territory_id);
    if (!originState || originState.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: 'You do not own the origin territory' }, { status: 400 });
    }
    const destState = allStates.find(s => s.territory_id === destination_territory_id);
    if (!destState || destState.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: 'You do not own the destination territory. Resources can only be moved to territories you own.' }, { status: 400 });
    }

    // Validate resource availability at origin
    const storage = originState.resource_storage ?? {};
    const RESOURCES = ['gold','iron','timber','stone','food'];
    for (const r of RESOURCES) {
      const requested = shipment_contents[r] ?? 0;
      if (requested > 0 && (storage[r] ?? 0) < requested) {
        return Response.json({ error: `Not enough ${r} at origin. Have ${storage[r] ?? 0}, requesting ${requested}.` }, { status: 400 });
      }
    }

    // Load or create PhaseDecision
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    let decision = decisions[0];
    if (!decision) {
      decision = await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
        is_locked: false,
        data: { movements: [], construction: null, caravans: [] },
      });
    }
    if (decision.is_locked) return Response.json({ error: 'You have already locked your decisions' }, { status: 400 });

    // ── Idempotency: submission_id dedup ──────────────────────────────────────
    if (caravanSubmissionId) {
      const existingCaravansForDedup = decision.data?.caravans ?? [];
      const dup = existingCaravansForDedup.find(c => c.submission_id === caravanSubmissionId);
      if (dup) {
        return Response.json({ success: true, caravan: dup, caravans: existingCaravansForDedup, idempotent: true });
      }
    }

    // Route safety analysis using inline BFS
    const adj = buildAdjacency(campaign.map_id ?? 'shattered_crown_v1');
    function findAnyPath(startId, endId) {
      if (startId === endId) return [startId];
      const visited = new Set([startId]);
      const queue = [[startId, [startId]]];
      while (queue.length > 0) {
        const [current, path] = queue.shift();
        const neighbors = adj[current] || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            const newPath = [...path, neighbor];
            if (neighbor === endId) return newPath;
            visited.add(neighbor);
            queue.push([neighbor, newPath]);
          }
        }
      }
      return null;
    }
    const path = findAnyPath(origin_territory_id, destination_territory_id);
    const traversed = path ? path.slice(1, -1) : [];
    const enemyTerritories = traversed.filter(tid => {
      const ts = allStates.find(s => s.territory_id === tid);
      return ts?.owner_player_id && ts.owner_player_id !== actingPlayer.id;
    });
    const isSafe = enemyTerritories.length === 0;

    const caravan = {
      id: `caravan_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      submission_id: caravanSubmissionId ?? null,
      origin: origin_territory_id,
      destination: destination_territory_id,
      contents: shipment_contents,
      path: path ?? [],
      safe: isSafe,
      enemy_territories: enemyTerritories,
      staged_at: new Date().toISOString(),
    };

    const existingCaravans = decision.data?.caravans ?? [];
    await base44.asServiceRole.entities.PhaseDecision.update(decision.id, {
      data: {
        movements: decision.data?.movements ?? [],
        construction: decision.data?.construction ?? null,
        caravans: [...existingCaravans, caravan],
      },
    });

    return Response.json({ success: true, caravan, caravans: [...existingCaravans, caravan] });
  }

  // ── ACTION: removeCaravan ─────────────────────────────────────────────────────
  if (action === 'removeCaravan') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { caravan_id } = body;
    if (!caravan_id) return Response.json({ error: 'caravan_id is required' }, { status: 400 });

    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'fortify', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No fortify decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const updatedCaravans = (decision.data?.caravans ?? []).filter(c => c.id !== caravan_id);
    await base44.asServiceRole.entities.PhaseDecision.update(decision.id, {
      data: { ...decision.data, caravans: updatedCaravans },
    });
    return Response.json({ success: true, caravans: updatedCaravans });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[fortifyPhase] Unhandled error:', err?.message ?? err);
    return Response.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
});