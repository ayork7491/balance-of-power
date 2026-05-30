/**
 * deployPhase — backend handler for the standard deploy phase (Round 1+).
 *
 * Actions:
 *   startDeploy     — admin (or internal system call): calculates income + resources,
 *                     creates PhaseDecision stubs, writes phase_start snapshot.
 *                     Accepts _internal=true to allow being called from initialDeploy.
 *   stageTroops     — player saves staged placements (private, editable until locked).
 *   lockDeploy      — player locks; auto-fills remaining troops if any.
 *   processPhaseEnd — admin: auto-submits missing players, applies all placements,
 *                     writes phase_end snapshot + public log, advances to attack phase.
 *
 * IDEMPOTENCY: startDeploy is idempotent — returns success if already started for this round.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

const DEFAULT_AVG_BATTLE_SIZE  = 1000;
const DEFAULT_PER_TROOP        = 3;    // territories per 1 troop (at base 1000pt battle size)
const DEFAULT_MIN_TROOPS       = 3;
const DEFAULT_TROOP_DIVISOR    = 2000;
const DEFAULT_TROOP_BONUS_ON   = false;
// Scale factor: at avg_battle_size=1000, 1 territory = 1/DEFAULT_PER_TROOP troops.
// Formula: floor(territories / perTroop * (avgBattleSize / 1000))
// So at avg=1000 and perTroop=3: 9 territories → 3 troops (+region bonuses)
// Region/continent bonuses are also scaled by the same factor.
const INCOME_SCALE_DIVISOR     = 1000; // base scale reference

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

const RES = {
  mountains: { brick: 10, lumber: 5,  wool: 5,  grain: 10, ore: 70 },
  forest:    { brick: 5,  lumber: 60, wool: 15, grain: 10, ore: 10 },
  swamp:     { brick: 15, lumber: 20, wool: 30, grain: 25, ore: 10 },
  tundra:    { brick: 20, lumber: 10, wool: 15, grain: 15, ore: 40 },
  coastal:   { brick: 10, lumber: 10, wool: 35, grain: 30, ore: 15 },
  desert:    { brick: 30, lumber: 5,  wool: 10, grain: 15, ore: 40 },
  urban:     { brick: 25, lumber: 15, wool: 15, grain: 15, ore: 30 },
  plains:    { brick: 10, lumber: 15, wool: 20, grain: 50, ore: 5  },
};

const V1_MAP_META = {
  continents: [
    { id: 'northlands', control_bonus: 7 },
    { id: 'southlands', control_bonus: 9 },
  ],
  regions: [
    { id: 'north_coast',  continent_id: 'northlands', control_bonus: 2 },
    { id: 'west_reach',   continent_id: 'northlands', control_bonus: 2 },
    { id: 'heartland',    continent_id: 'northlands', control_bonus: 3 },
    { id: 'east_shore',   continent_id: 'northlands', control_bonus: 2 },
    { id: 'south_plains', continent_id: 'southlands', control_bonus: 3 },
    { id: 'far_south',    continent_id: 'southlands', control_bonus: 2 },
  ],
  territories: {
    frost_peak:    { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.mountains },
    irongate:      { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.urban     },
    tundra_flats:  { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.tundra    },
    glacier_pass:  { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.tundra    },
    stormwatch:    { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.coastal   },
    crow_harbor:   { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.coastal   },
    pale_cliffs:   { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.coastal   },
    veil_crossing: { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.plains    },
    ashwood:          { region_id: 'west_reach', continent_id: 'northlands', rd: RES.forest    },
    redstone_ridge:   { region_id: 'west_reach', continent_id: 'northlands', rd: RES.mountains },
    dustmarsh:        { region_id: 'west_reach', continent_id: 'northlands', rd: RES.swamp     },
    saltfen:          { region_id: 'west_reach', continent_id: 'northlands', rd: RES.swamp     },
    verdant_vale:     { region_id: 'west_reach', continent_id: 'northlands', rd: RES.plains    },
    greywood:         { region_id: 'west_reach', continent_id: 'northlands', rd: RES.forest    },
    heartlands:       { region_id: 'heartland',  continent_id: 'northlands', rd: RES.plains    },
    golden_citadel:   { region_id: 'heartland',  continent_id: 'northlands', rd: RES.urban     },
    iron_ridge:       { region_id: 'heartland',  continent_id: 'northlands', rd: RES.mountains },
    stonefield:       { region_id: 'heartland',  continent_id: 'northlands', rd: RES.plains    },
    the_crossing:     { region_id: 'heartland',  continent_id: 'northlands', rd: RES.plains    },
    ember_vale:       { region_id: 'heartland',  continent_id: 'northlands', rd: RES.plains    },
    deepstone:        { region_id: 'heartland',  continent_id: 'northlands', rd: RES.mountains },
    ember_coast:      { region_id: 'east_shore', continent_id: 'northlands', rd: RES.coastal   },
    blackstone:       { region_id: 'east_shore', continent_id: 'northlands', rd: RES.mountains },
    iron_coast:       { region_id: 'east_shore', continent_id: 'northlands', rd: RES.coastal   },
    scalewood:        { region_id: 'east_shore', continent_id: 'northlands', rd: RES.forest    },
    the_bastion:      { region_id: 'east_shore', continent_id: 'northlands', rd: RES.urban     },
    ashfen_coast:     { region_id: 'east_shore', continent_id: 'northlands', rd: RES.coastal   },
    ridgeline:        { region_id: 'east_shore', continent_id: 'northlands', rd: RES.mountains },
    sunken_delta:     { region_id: 'south_plains', continent_id: 'southlands', rd: RES.swamp   },
    dustplains:       { region_id: 'south_plains', continent_id: 'southlands', rd: RES.desert  },
    amber_fields:     { region_id: 'south_plains', continent_id: 'southlands', rd: RES.plains  },
    sunspire:         { region_id: 'south_plains', continent_id: 'southlands', rd: RES.desert  },
    verdant_basin:    { region_id: 'south_plains', continent_id: 'southlands', rd: RES.plains  },
    sea_gate:         { region_id: 'far_south', continent_id: 'southlands', rd: RES.coastal   },
    crimson_shore:    { region_id: 'far_south', continent_id: 'southlands', rd: RES.coastal   },
    southern_reach:   { region_id: 'far_south', continent_id: 'southlands', rd: RES.plains    },
  },
};

// Shattered Crown map metadata — regions and continents for income calculation
const SHATTERED_CROWN_MAP_META = {
  continents: [
    { id: 'ironspine',       control_bonus: 7  },
    { id: 'wild_frontier',   control_bonus: 8  },
    { id: 'fracture_basin',  control_bonus: 10 },
    { id: 'sunfields',       control_bonus: 8  },
    { id: 'shattered_coast', control_bonus: 7  },
  ],
  regions: [
    { id: 'outer_passes',       continent_id: 'ironspine',       control_bonus: 2 },
    { id: 'high_crown',         continent_id: 'ironspine',       control_bonus: 3 },
    { id: 'northern_wilds',     continent_id: 'wild_frontier',   control_bonus: 3 },
    { id: 'deepwoods',          continent_id: 'wild_frontier',   control_bonus: 3 },
    { id: 'northern_ruins',     continent_id: 'fracture_basin',  control_bonus: 3 },
    { id: 'central_crossroads', continent_id: 'fracture_basin',  control_bonus: 4 },
    { id: 'southern_ruins',     continent_id: 'fracture_basin',  control_bonus: 3 },
    { id: 'western_plains',     continent_id: 'sunfields',       control_bonus: 2 },
    { id: 'eastern_granaries',  continent_id: 'sunfields',       control_bonus: 3 },
    { id: 'northern_isles',     continent_id: 'shattered_coast', control_bonus: 2 },
    { id: 'southern_fractures', continent_id: 'shattered_coast', control_bonus: 3 },
  ],
  // Shattered Crown territory metadata (region + continent + terrain-based resource dist)
  territories: {
    I1: { region_id: 'outer_passes', continent_id: 'ironspine', rd: RES.mountains },
    I2: { region_id: 'outer_passes', continent_id: 'ironspine', rd: RES.mountains },
    I3: { region_id: 'outer_passes', continent_id: 'ironspine', rd: RES.coastal   },
    I4: { region_id: 'high_crown',   continent_id: 'ironspine', rd: RES.mountains },
    I5: { region_id: 'high_crown',   continent_id: 'ironspine', rd: RES.mountains },
    I6: { region_id: 'outer_passes', continent_id: 'ironspine', rd: RES.mountains },
    I7: { region_id: 'high_crown',   continent_id: 'ironspine', rd: RES.mountains },
    I8: { region_id: 'high_crown',   continent_id: 'ironspine', rd: RES.mountains },
    W1: { region_id: 'northern_wilds', continent_id: 'wild_frontier', rd: RES.forest  },
    W2: { region_id: 'northern_wilds', continent_id: 'wild_frontier', rd: RES.forest  },
    W3: { region_id: 'northern_wilds', continent_id: 'wild_frontier', rd: RES.forest  },
    W4: { region_id: 'deepwoods',      continent_id: 'wild_frontier', rd: RES.swamp   },
    W5: { region_id: 'deepwoods',      continent_id: 'wild_frontier', rd: RES.forest  },
    W6: { region_id: 'northern_wilds', continent_id: 'wild_frontier', rd: RES.forest  },
    W7: { region_id: 'deepwoods',      continent_id: 'wild_frontier', rd: RES.plains  },
    W8: { region_id: 'deepwoods',      continent_id: 'wild_frontier', rd: RES.plains  },
    W9: { region_id: 'deepwoods',      continent_id: 'wild_frontier', rd: RES.plains  },
    B1: { region_id: 'northern_ruins',     continent_id: 'fracture_basin', rd: RES.plains   },
    B2: { region_id: 'northern_ruins',     continent_id: 'fracture_basin', rd: RES.plains   },
    B3: { region_id: 'northern_ruins',     continent_id: 'fracture_basin', rd: RES.plains   },
    B4: { region_id: 'central_crossroads', continent_id: 'fracture_basin', rd: RES.mountains},
    B5: { region_id: 'central_crossroads', continent_id: 'fracture_basin', rd: RES.plains   },
    B6: { region_id: 'central_crossroads', continent_id: 'fracture_basin', rd: RES.plains   },
    B7: { region_id: 'central_crossroads', continent_id: 'fracture_basin', rd: RES.plains   },
    B8: { region_id: 'southern_ruins',     continent_id: 'fracture_basin', rd: RES.plains   },
    B9: { region_id: 'southern_ruins',     continent_id: 'fracture_basin', rd: RES.plains   },
    B10:{ region_id: 'southern_ruins',     continent_id: 'fracture_basin', rd: RES.plains   },
    S1: { region_id: 'western_plains',    continent_id: 'sunfields', rd: RES.plains  },
    S2: { region_id: 'western_plains',    continent_id: 'sunfields', rd: RES.plains  },
    S3: { region_id: 'western_plains',    continent_id: 'sunfields', rd: RES.plains  },
    S4: { region_id: 'western_plains',    continent_id: 'sunfields', rd: RES.plains  },
    S5: { region_id: 'eastern_granaries', continent_id: 'sunfields', rd: RES.plains  },
    S6: { region_id: 'eastern_granaries', continent_id: 'sunfields', rd: RES.plains  },
    S7: { region_id: 'eastern_granaries', continent_id: 'sunfields', rd: RES.plains  },
    S8: { region_id: 'eastern_granaries', continent_id: 'sunfields', rd: RES.plains  },
    S9: { region_id: 'eastern_granaries', continent_id: 'sunfields', rd: RES.coastal },
    C1: { region_id: 'northern_isles',     continent_id: 'shattered_coast', rd: RES.coastal },
    C2: { region_id: 'northern_isles',     continent_id: 'shattered_coast', rd: RES.coastal },
    C3: { region_id: 'northern_isles',     continent_id: 'shattered_coast', rd: RES.coastal },
    C4: { region_id: 'southern_fractures', continent_id: 'shattered_coast', rd: RES.coastal },
    C5: { region_id: 'southern_fractures', continent_id: 'shattered_coast', rd: RES.coastal },
    C6: { region_id: 'southern_fractures', continent_id: 'shattered_coast', rd: RES.coastal },
    C7: { region_id: 'southern_fractures', continent_id: 'shattered_coast', rd: RES.coastal },
    C8: { region_id: 'southern_fractures', continent_id: 'shattered_coast', rd: RES.coastal },
  },
};

function getMapMeta(mapId) {
  if (mapId === 'shattered_crown_v1') return SHATTERED_CROWN_MAP_META;
  return V1_MAP_META;
}

function getMapTerritories(mapMeta) {
  return Object.entries(mapMeta.territories).map(([tid, d]) => ({
    territory_id: tid, region_id: d.region_id, continent_id: d.continent_id,
    resource_distribution: d.rd,
  }));
}

function calcTerritoryBonus(territoriesOwned, settings, avgBattleSize) {
  const perTroop  = settings?.territories_per_bonus_troop ?? DEFAULT_PER_TROOP;
  const minTroops = settings?.min_troops_per_turn ?? DEFAULT_MIN_TROOPS;
  // Scale: (territories / perTroop) gives base troops at 1000pt avg_battle_size.
  // Multiply by (avgBattleSize / 1000) to scale up/down with the game's battle size.
  const scale = (avgBattleSize ?? DEFAULT_AVG_BATTLE_SIZE) / INCOME_SCALE_DIVISOR;
  const raw   = Math.floor((territoriesOwned / perTroop) * scale);
  return Math.max(minTroops, raw);
}

function calcRegionBonusScaled(playerId, allStates, mapTerritories, regions, avgBattleSize) {
  const scale = (avgBattleSize ?? DEFAULT_AVG_BATTLE_SIZE) / INCOME_SCALE_DIVISOR;
  let bonus = 0;
  for (const region of (regions ?? [])) {
    const regionTerrs = mapTerritories.filter(t => t.region_id === region.id);
    if (!regionTerrs.length) continue;
    const allOwned = regionTerrs.every(t => {
      const s = allStates.find(st => st.territory_id === t.territory_id);
      return s?.owner_player_id === playerId;
    });
    if (allOwned) bonus += Math.ceil((region.control_bonus ?? 0) * scale);
  }
  return bonus;
}

function calcContinentBonusScaled(playerId, allStates, mapTerritories, continents, avgBattleSize) {
  const scale = (avgBattleSize ?? DEFAULT_AVG_BATTLE_SIZE) / INCOME_SCALE_DIVISOR;
  let bonus = 0;
  for (const continent of (continents ?? [])) {
    const contTerrs = mapTerritories.filter(t => t.continent_id === continent.id);
    if (!contTerrs.length) continue;
    const allOwned = contTerrs.every(t => {
      const s = allStates.find(st => st.territory_id === t.territory_id);
      return s?.owner_player_id === playerId;
    });
    if (allOwned) bonus += Math.ceil((continent.control_bonus ?? 0) * scale);
  }
  return bonus;
}

function calcTroopBonus(totalTroops, settings, avgBattleSize) {
  const enabled = settings?.troop_bonus_enabled ?? DEFAULT_TROOP_BONUS_ON;
  if (!enabled) return 0;
  const divisor = settings?.troop_bonus_divisor ?? DEFAULT_TROOP_DIVISOR;
  return Math.floor((totalTroops / divisor) * avgBattleSize);
}

function calcRegionBonus(playerId, allStates, mapTerritories, regions) {
  let bonus = 0;
  for (const region of (regions ?? [])) {
    const regionTerrs = mapTerritories.filter(t => t.region_id === region.id);
    if (!regionTerrs.length) continue;
    const allOwned = regionTerrs.every(t => {
      const s = allStates.find(st => st.territory_id === t.territory_id);
      return s?.owner_player_id === playerId;
    });
    if (allOwned) bonus += region.control_bonus ?? 0;
  }
  return bonus;
}

function calcContinentBonus(playerId, allStates, mapTerritories, continents) {
  let bonus = 0;
  for (const continent of (continents ?? [])) {
    const contTerrs = mapTerritories.filter(t => t.continent_id === continent.id);
    if (!contTerrs.length) continue;
    const allOwned = contTerrs.every(t => {
      const s = allStates.find(st => st.territory_id === t.territory_id);
      return s?.owner_player_id === playerId;
    });
    if (allOwned) bonus += continent.control_bonus ?? 0;
  }
  return bonus;
}

function rollWeightedResource(dist, roll) {
  const roll100 = roll * 100;
  let cumulative = 0;
  for (const [resource, weight] of Object.entries(dist)) {
    cumulative += weight;
    if (roll100 < cumulative) return resource;
  }
  return Object.keys(dist).at(-1);
}

function generateResourcesForPlayer(playerId, round, allStates, mapTerritories, campaignId) {
  const ownedStates = allStates.filter(s => s.owner_player_id === playerId);
  const totals = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
  for (const ts of ownedStates) {
    const def = mapTerritories.find(t => t.territory_id === ts.territory_id);
    if (!def?.resource_distribution) continue;
    const seed     = `${campaignId}_${playerId}_${ts.territory_id}_r${round}`;
    const rng      = seededRandom(seed);
    const resource = rollWeightedResource(def.resource_distribution, rng());
    totals[resource] = (totals[resource] || 0) + 1;
  }
  return totals;
}

function autoRandomizePlacements(ownedIds, remaining, seed) {
  if (!ownedIds.length || remaining <= 0) return {};
  const rng = seededRandom(seed);
  const additions = {};
  let i = 0;
  while (remaining > 0) {
    const tid = ownedIds[Math.floor(rng() * ownedIds.length)];
    additions[tid] = (additions[tid] || 0) + 1;
    remaining--;
    if (++i > 100000) break;
  }
  return additions;
}

function mergePlacements(base, additions) {
  const result = { ...base };
  for (const [tid, count] of Object.entries(additions)) {
    result[tid] = (result[tid] || 0) + count;
  }
  return result;
}

function buildSnapshot({ campaignId, round, phase, snapshotType, territoryStates, activePlayers, deployIncomes }) {
  return {
    campaign_id: campaignId, round, phase, snapshot_type: snapshotType,
    territory_states: territoryStates.map(ts => ({
      territory_id: ts.territory_id, owner_player_id: ts.owner_player_id ?? null, troop_count: ts.troop_count ?? 0,
    })),
    player_standings: activePlayers.map(p => {
      const owned = territoryStates.filter(ts => ts.owner_player_id === p.id);
      const troopTotal = owned.reduce((s, ts) => s + (ts.troop_count || 0), 0);
      const inc = deployIncomes?.[p.id];
      return { player_id: p.id, display_name: p.display_name, territory_count: owned.length, troop_total: troopTotal, deploy_income: inc?.total ?? null, is_eliminated: p.is_eliminated ?? false };
    }),
    deploy_incomes: deployIncomes ?? {},
  };
}

async function log(base44, campaignId, round, phase, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId, phase, round, event_type: eventType, player_id: playerId ?? null, payload, is_public: isPublic,
  });
}

function validateDeployPlacements(placements, ownedIds, allowedTroops) {
  let totalPlaced = 0;
  for (const [tid, count] of Object.entries(placements)) {
    if (!ownedIds.has(tid)) return { valid: false, error: `Territory ${tid} is not owned by you` };
    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) return { valid: false, error: `Invalid troop count for ${tid}` };
    totalPlaced += count;
  }
  if (totalPlaced > allowedTroops) return { valid: false, error: `Total placements (${totalPlaced}) exceed your income (${allowedTroops})` };
  return { valid: true, totalPlaced };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { action, campaign_id, placements } = body;
  const isInternalCall = body._internal === true;

  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  // Internal system calls (e.g. from initialDeploy) skip user auth
  let user = null;
  if (!isInternalCall) {
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [campaigns, players] = await Promise.all([
    base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
    base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
  ]);

  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
  if (!players.length) return Response.json({ error: 'No players found' }, { status: 400 });

  const myPlayer = user ? players.find(p => p.user_id === user.id) : null;

  // For non-internal calls, require player membership
  if (!isInternalCall && !myPlayer) {
    return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });
  }

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
  const phase = 'deploy';

  // ── ACTION: startDeploy ───────────────────────────────────────────────────────
  if (action === 'startDeploy') {
    // Allow internal calls OR admin user calls
    const isAdminUser = user && campaign.admin_user_id === user.id;
    if (!isInternalCall && !isAdminUser) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Campaign is not in deploy phase' }, { status: 400 });
    }

    // Idempotency guard — return success if already started
    const existingDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });
    if (existingDecisions.length > 0) {
      console.log('[startDeploy] Already started for round', round, '— idempotent return');
      const existingIncomes = await base44.asServiceRole.entities.DeployIncome.filter({ campaign_id, round });
      const incomesMap = {};
      for (const inc of existingIncomes) incomesMap[inc.player_id] = inc;
      return Response.json({ success: true, idempotent: true, incomes: incomesMap });
    }

    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const mapMeta = getMapMeta(campaign.map_id);
    const mapTerritories = getMapTerritories(mapMeta);

    let avgBattleSize = DEFAULT_AVG_BATTLE_SIZE;
    if (campaign.game_profile_id) {
      const profiles = await base44.asServiceRole.entities.TabletopGameProfile.filter({ id: campaign.game_profile_id });
      if (profiles[0]?.average_battle_size) avgBattleSize = profiles[0].average_battle_size;
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const deployIncomes = {};

    for (const p of activePlayers) {
      const ownedStates      = allTerritoryStates.filter(s => s.owner_player_id === p.id);
      const territoriesOwned = ownedStates.length;
      const totalTroops      = ownedStates.reduce((sum, s) => sum + (s.troop_count || 0), 0);

      const territory_bonus = calcTerritoryBonus(territoriesOwned, campaign.settings, avgBattleSize);
      const troop_bonus     = calcTroopBonus(totalTroops, campaign.settings, avgBattleSize);
      const region_bonus    = calcRegionBonusScaled(p.id, allTerritoryStates, mapTerritories, mapMeta.regions, avgBattleSize);
      const continent_bonus = calcContinentBonusScaled(p.id, allTerritoryStates, mapTerritories, mapMeta.continents, avgBattleSize);
      const total           = territory_bonus + troop_bonus + region_bonus + continent_bonus;

      const resources_generated = generateResourcesForPlayer(p.id, round, allTerritoryStates, mapTerritories, campaign_id);
      deployIncomes[p.id] = { territory_bonus, troop_bonus, region_bonus, continent_bonus, total };

      await base44.asServiceRole.entities.DeployIncome.create({
        campaign_id, round, player_id: p.id,
        territory_bonus, troop_bonus, region_bonus, continent_bonus, total, resources_generated,
      });

      await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id, player_id: p.id, phase: 'deploy', round,
        is_locked: false, data: { placements: {}, troops_remaining: total },
      });
    }

    const snapshot = buildSnapshot({
      campaignId: campaign_id, round, phase, snapshotType: 'phase_start',
      territoryStates: allTerritoryStates, activePlayers, deployIncomes,
    });
    await base44.asServiceRole.entities.PhaseSnapshot.create(snapshot);

    await log(base44, campaign_id, round, phase, 'phase_started', null, {
      avg_battle_size: avgBattleSize,
      player_incomes: Object.entries(deployIncomes).map(([pid, inc]) => ({ player_id: pid, ...inc })),
    }, true);

    return Response.json({ success: true, incomes: deployIncomes, avg_battle_size: avgBattleSize });
  }

  // ── ACTION: stageTroops ───────────────────────────────────────────────────────
  if (action === 'stageTroops') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }
    if (!placements || typeof placements !== 'object') {
      return Response.json({ error: 'placements must be an object { territory_id: number }' }, { status: 400 });
    }

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'deploy', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision found. Has deploy phase been started?' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your deployment' }, { status: 400 });

    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
      campaign_id, player_id: actingPlayer.id, round,
    });
    const income = incomeRecords[0];
    if (!income) return Response.json({ error: 'Income record not found' }, { status: 404 });

    const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: actingPlayer.id,
    });
    const ownedIds = new Set(ownedStates.map(t => t.territory_id));

    const validation = validateDeployPlacements(placements, ownedIds, income.total);
    if (!validation.valid) return Response.json({ error: validation.error }, { status: 400 });

    const troopsRemaining = income.total - validation.totalPlaced;
    await base44.entities.PhaseDecision.update(decision.id, {
      data: { placements, troops_remaining: troopsRemaining },
    });

    await log(base44, campaign_id, round, phase, 'troop_staged', actingPlayer.id, {
      troops_placed: validation.totalPlaced, troops_remaining: troopsRemaining,
    }, false);

    return Response.json({ success: true, troops_remaining: troopsRemaining });
  }

  // ── ACTION: lockDeploy ────────────────────────────────────────────────────────
  if (action === 'lockDeploy') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'deploy', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
      campaign_id, player_id: actingPlayer.id, round,
    });
    const allowedTroops = incomeRecords[0]?.total ?? 0;

    const currentPlacements = decision.data?.placements ?? {};
    const totalPlaced = Object.values(currentPlacements).reduce((s, n) => s + n, 0);
    let remaining = allowedTroops - totalPlaced;

    let finalPlacements = { ...currentPlacements };
    if (remaining > 0) {
      const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
        campaign_id, owner_player_id: actingPlayer.id,
      });
      const additions = autoRandomizePlacements(
        ownedStates.map(t => t.territory_id), remaining,
        `${campaign_id}_${actingPlayer.id}_r${round}_autolock`,
      );
      finalPlacements = mergePlacements(finalPlacements, additions);
    }

    await base44.entities.PhaseDecision.update(decision.id, {
      is_locked: true, locked_at: new Date().toISOString(),
      data: { placements: finalPlacements, troops_remaining: 0 },
    });

    await log(base44, campaign_id, round, phase, 'player_locked', actingPlayer.id, {
      display_name: actingPlayer.display_name,
    }, true);

    return Response.json({ success: true });
  }

  // ── ACTION: processPhaseEnd ───────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    const isAdminUser = user && campaign.admin_user_id === user.id;
    if (!isInternalCall && !isAdminUser) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const allDecisions  = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });

    for (const p of activePlayers) {
      const dec = allDecisions.find(d => d.player_id === p.id);
      if (!dec || !dec.is_locked) {
        const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
          campaign_id, player_id: p.id, round,
        });
        const allowedTroops = incomeRecords[0]?.total ?? DEFAULT_MIN_TROOPS;

        const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, owner_player_id: p.id,
        });
        const ownedIds = ownedStates.map(t => t.territory_id);

        const existingPlacements = dec?.data?.placements ?? {};
        const alreadyPlaced      = Object.values(existingPlacements).reduce((s, n) => s + n, 0);
        const remaining          = allowedTroops - alreadyPlaced;

        const additions     = autoRandomizePlacements(ownedIds, remaining, `${campaign_id}_${p.id}_r${round}_auto_phase_end`);
        const finalPlacements = mergePlacements(existingPlacements, additions);

        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true, is_auto_submitted: true, data: { placements: finalPlacements, troops_remaining: 0 },
          });
        } else {
          await base44.asServiceRole.entities.PhaseDecision.create({
            campaign_id, player_id: p.id, phase: 'deploy', round,
            is_locked: true, is_auto_submitted: true, data: { placements: finalPlacements, troops_remaining: 0 },
          });
        }

        await log(base44, campaign_id, round, phase, 'auto_submitted', p.id, {
          display_name: p.display_name, troops_auto_placed: remaining,
        }, false);
      }
    }

    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });

    for (const dec of finalDecisions) {
      const decPlacements = dec.data?.placements ?? {};
      for (const [tid, count] of Object.entries(decPlacements)) {
        if (!count) continue;
        const existing = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id, territory_id: tid });
        if (existing[0]) {
          await base44.asServiceRole.entities.TerritoryState.update(existing[0].id, {
            troop_count: (existing[0].troop_count || 0) + count,
          });
        }
      }
    }

    const finalTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({ campaign_id, round });
    const deployIncomes = {};
    for (const inc of incomeRecords) deployIncomes[inc.player_id] = inc;

    const snapshot = buildSnapshot({
      campaignId: campaign_id, round, phase, snapshotType: 'phase_end',
      territoryStates: finalTerritoryStates, activePlayers, deployIncomes,
    });
    await base44.asServiceRole.entities.PhaseSnapshot.create(snapshot);

    await log(base44, campaign_id, round, phase, 'phase_advanced', null, {
      next_phase: 'attack', round,
      players_auto_submitted: activePlayers
        .filter(p => finalDecisions.find(d => d.player_id === p.id)?.is_auto_submitted)
        .map(p => p.display_name),
    }, true);

    await base44.asServiceRole.entities.Campaign.update(campaign_id, { current_phase: 'attack' });

    return Response.json({ success: true, next_phase: 'attack', round });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});