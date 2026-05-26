/**
 * deployPhase — backend handler for the standard deploy phase (Round 1+).
 *
 * Actions:
 *   startDeploy     — admin: calculates income + resources, creates PhaseDecision stubs,
 *                     writes phase_start snapshot.
 *   stageTroops     — player saves staged placements (private, editable until locked).
 *   lockDeploy      — player locks; auto-fills remaining troops if any.
 *   processPhaseEnd — admin: auto-submits missing players, applies all placements,
 *                     writes phase_end snapshot + public log, advances to attack phase.
 *
 * ─── PRIVACY MODEL ────────────────────────────────────────────────────────────
 *   - stageTroops / lockDeploy: user-scoped SDK — only touches own PhaseDecision.
 *   - processPhaseEnd: asServiceRole + admin-only guard.
 *   - DeployIncome: PUBLIC — income amounts are visible to all players.
 *   - PhaseDecision.data (placements): PRIVATE until processPhaseEnd reveals them
 *     by writing results to TerritoryState.
 *   - getDeployLockStatus returns is_locked only — data field is stripped server-side.
 *
 * ─── MAP DATA SOURCE ─────────────────────────────────────────────────────────
 *   Region/continent membership and resource_distribution come from
 *   services/maps/mapMetadata.js (backend-safe pure JS mirror of mapData.ts).
 *   Local imports are prohibited in Deno deploy, so all helpers are inlined below.
 *   See services/maps/mapMetadata.js for the documented approach and rationale.
 *
 * ─── TABLETOP PROFILE ────────────────────────────────────────────────────────
 *   average_battle_size is loaded from TabletopGameProfile via campaign.game_profile_id.
 *   Falls back to DEFAULT_AVG_BATTLE_SIZE (1000) if profile is not found.
 *   All income formulas use this value for scaling so they work across game systems.
 *
 * ─── INCOME FORMULA ──────────────────────────────────────────────────────────
 *   territory_bonus = max(minTroops, floor((territories / perTroop) * (avgBattleSize / 1000)))
 *   troop_bonus     = floor((totalTroops / 2000) * avgBattleSize)  [disabled by default V1]
 *   region_bonus    = sum(region.control_bonus) for fully-controlled regions
 *   continent_bonus = sum(continent.control_bonus) for fully-controlled continents
 *   total           = territory_bonus + troop_bonus + region_bonus + continent_bonus
 *
 * ─── RESOURCE GENERATION ─────────────────────────────────────────────────────
 *   Each owned territory generates 1 resource per round.
 *   Type is determined by weighted random roll (terrain-biased preset weights).
 *   Seed = `${campaignId}_${playerId}_${territory_id}_r${round}` — deterministic.
 *   V1 resources: brick, lumber, wool, grain, ore.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_AVG_BATTLE_SIZE  = 1000;
const DEFAULT_PER_TROOP        = 3;
const DEFAULT_MIN_TROOPS       = 3;
const DEFAULT_TROOP_DIVISOR    = 2000;
const DEFAULT_TROOP_BONUS_ON   = false;

// ─── Inline: Seedable RNG ─────────────────────────────────────────────────────
// (Local imports prohibited in Deno deploy — inlined from resourceGeneration.js)

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

// ─── Inline: Map Metadata ─────────────────────────────────────────────────────
// (Inlined from services/maps/mapMetadata.js — backend-safe mirror of mapData.ts)
// Region/continent membership and resource_distribution for V1 map.
// If you update mapData.ts, update these to match.

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
    tundra_flats:  { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.tundra   },
    glacier_pass:  { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.tundra   },
    stormwatch:    { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.coastal  },
    crow_harbor:   { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.coastal  },
    pale_cliffs:   { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.coastal  },
    veil_crossing: { region_id: 'north_coast',  continent_id: 'northlands', rd: RES.plains   },
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
    sunken_delta:     { region_id: 'south_plains', continent_id: 'southlands', rd: RES.swamp  },
    dustplains:       { region_id: 'south_plains', continent_id: 'southlands', rd: RES.desert },
    amber_fields:     { region_id: 'south_plains', continent_id: 'southlands', rd: RES.plains },
    sunspire:         { region_id: 'south_plains', continent_id: 'southlands', rd: RES.desert },
    verdant_basin:    { region_id: 'south_plains', continent_id: 'southlands', rd: RES.plains },
    sea_gate:         { region_id: 'far_south', continent_id: 'southlands', rd: RES.coastal },
    crimson_shore:    { region_id: 'far_south', continent_id: 'southlands', rd: RES.coastal },
    southern_reach:   { region_id: 'far_south', continent_id: 'southlands', rd: RES.plains  },
  },
};

// Build array form for calc functions
function getV1MapTerritories() {
  return Object.entries(V1_MAP_META.territories).map(([tid, d]) => ({
    territory_id: tid, region_id: d.region_id, continent_id: d.continent_id,
    resource_distribution: d.rd,
  }));
}

function getMetaForMapId(mapId) {
  if (mapId === 'map_v1_standard' || !mapId) return V1_MAP_META;
  // Future maps: add cases here or fetch from MapDefinition entity
  console.warn(`[deployPhase] Unknown mapId: ${mapId}, falling back to V1 map metadata`);
  return V1_MAP_META;
}

// ─── Inline: Income Calc ──────────────────────────────────────────────────────

function calcTerritoryBonus(territoriesOwned, settings, avgBattleSize) {
  const perTroop  = settings?.territories_per_bonus_troop ?? DEFAULT_PER_TROOP;
  const minTroops = settings?.min_troops_per_turn ?? DEFAULT_MIN_TROOPS;
  const raw       = Math.floor((territoriesOwned / perTroop) * (avgBattleSize / 1000));
  return Math.max(minTroops, raw);
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

// ─── Inline: Resource Generation ─────────────────────────────────────────────

function rollWeightedResource(dist, roll) {
  const roll100  = roll * 100;
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
    if (!def?.resource_distribution) {
      console.warn(`[deployPhase] no resource_distribution for ${ts.territory_id}`);
      continue;
    }
    const seed     = `${campaignId}_${playerId}_${ts.territory_id}_r${round}`;
    const rng      = seededRandom(seed);
    const resource = rollWeightedResource(def.resource_distribution, rng());
    totals[resource] = (totals[resource] || 0) + 1;
  }
  return totals;
}

// ─── Inline: Auto-placement ───────────────────────────────────────────────────

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

// ─── Inline: Phase snapshot builder ──────────────────────────────────────────

function buildSnapshot({ campaignId, round, phase, snapshotType, territoryStates, activePlayers, deployIncomes }) {
  return {
    campaign_id: campaignId,
    round,
    phase,
    snapshot_type: snapshotType,
    territory_states: territoryStates.map(ts => ({
      territory_id:    ts.territory_id,
      owner_player_id: ts.owner_player_id ?? null,
      troop_count:     ts.troop_count ?? 0,
    })),
    player_standings: activePlayers.map(p => {
      const owned      = territoryStates.filter(ts => ts.owner_player_id === p.id);
      const troopTotal = owned.reduce((s, ts) => s + (ts.troop_count || 0), 0);
      const inc        = deployIncomes?.[p.id];
      return {
        player_id:       p.id,
        display_name:    p.display_name,
        territory_count: owned.length,
        troop_total:     troopTotal,
        deploy_income:   inc?.total ?? null,
        is_eliminated:   p.is_eliminated ?? false,
      };
    }),
    deploy_incomes: deployIncomes ?? {},
  };
}

// ─── Inline: Campaign log helper ─────────────────────────────────────────────

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

// ─── Validate deploy placements ───────────────────────────────────────────────

function validateDeployPlacements(placements, ownedIds, allowedTroops) {
  let totalPlaced = 0;
  for (const [tid, count] of Object.entries(placements)) {
    if (!ownedIds.has(tid)) {
      return { valid: false, error: `Territory ${tid} is not owned by you` };
    }
    if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
      return { valid: false, error: `Invalid troop count for ${tid}: must be a non-negative integer` };
    }
    totalPlaced += count;
  }
  if (totalPlaced > allowedTroops) {
    return { valid: false, error: `Total placements (${totalPlaced}) exceed your income (${allowedTroops})` };
  }
  return { valid: true, totalPlaced };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id, placements } = body;

  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  const [campaigns, players] = await Promise.all([
    base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
    base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
  ]);

  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
  if (!players.length) return Response.json({ error: 'No players found' }, { status: 400 });

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const round = campaign.current_round ?? 1;
  const phase = 'deploy';

  // ── ACTION: startDeploy ───────────────────────────────────────────────────────
  if (action === 'startDeploy') {
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Campaign is not in deploy phase' }, { status: 400 });
    }

    // Idempotency guard
    const existingDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });
    if (existingDecisions.length > 0) {
      return Response.json({ error: 'Deploy phase already started for this round' }, { status: 400 });
    }

    // Load territory states
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });

    // Load map metadata (region/continent/resource_distribution)
    const mapMeta        = getMetaForMapId(campaign.map_id);
    const mapTerritories = getV1MapTerritories(); // array form for calc functions
    const mapRegions     = mapMeta.regions;
    const mapContinents  = mapMeta.continents;

    // Load TabletopGameProfile for avgBattleSize scaling
    let avgBattleSize = DEFAULT_AVG_BATTLE_SIZE;
    if (campaign.game_profile_id) {
      const profiles = await base44.asServiceRole.entities.TabletopGameProfile.filter({
        id: campaign.game_profile_id,
      });
      if (profiles[0]?.average_battle_size) {
        avgBattleSize = profiles[0].average_battle_size;
      }
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const deployIncomes = {};

    for (const p of activePlayers) {
      const ownedStates      = allTerritoryStates.filter(s => s.owner_player_id === p.id);
      const territoriesOwned = ownedStates.length;
      const totalTroops      = ownedStates.reduce((sum, s) => sum + (s.troop_count || 0), 0);

      const territory_bonus = calcTerritoryBonus(territoriesOwned, campaign.settings, avgBattleSize);
      const troop_bonus     = calcTroopBonus(totalTroops, campaign.settings, avgBattleSize);
      const region_bonus    = calcRegionBonus(p.id, allTerritoryStates, mapTerritories, mapRegions);
      const continent_bonus = calcContinentBonus(p.id, allTerritoryStates, mapTerritories, mapContinents);
      const total           = territory_bonus + troop_bonus + region_bonus + continent_bonus;

      // Generate V1 resources (1 per owned territory, weighted by terrain)
      const resources_generated = generateResourcesForPlayer(
        p.id, round, allTerritoryStates, mapTerritories, campaign_id,
      );

      deployIncomes[p.id] = { territory_bonus, troop_bonus, region_bonus, continent_bonus, total };

      // Public income record (visible to all players)
      await base44.asServiceRole.entities.DeployIncome.create({
        campaign_id,
        round,
        player_id:        p.id,
        territory_bonus,
        troop_bonus,
        region_bonus,
        continent_bonus,
        total,
        resources_generated,
      });

      // Private staged decision stub (placements hidden until reveal)
      await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id,
        player_id: p.id,
        phase:     'deploy',
        round,
        is_locked: false,
        data:      { placements: {}, troops_remaining: total },
      });
    }

    // Phase-start snapshot
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

    // Load own decision only (user-scoped — privacy enforced)
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'deploy', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision found. Has deploy phase been started?' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your deployment' }, { status: 400 });

    // Load income to know allowed total
    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
      campaign_id, player_id: myPlayer.id, round,
    });
    const income = incomeRecords[0];
    if (!income) return Response.json({ error: 'Income record not found' }, { status: 404 });

    // Validate ownership and totals
    const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: myPlayer.id,
    });
    const ownedIds = new Set(ownedStates.map(t => t.territory_id));

    const validation = validateDeployPlacements(placements, ownedIds, income.total);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const troopsRemaining = income.total - validation.totalPlaced;
    await base44.entities.PhaseDecision.update(decision.id, {
      data: { placements, troops_remaining: troopsRemaining },
    });

    // Private log — placement data NOT public until reveal
    await log(base44, campaign_id, round, phase, 'troop_staged', myPlayer.id, {
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
      campaign_id, player_id: myPlayer.id, phase: 'deploy', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
      campaign_id, player_id: myPlayer.id, round,
    });
    const allowedTroops = incomeRecords[0]?.total ?? 0;

    const currentPlacements = decision.data?.placements ?? {};
    const totalPlaced       = Object.values(currentPlacements).reduce((s, n) => s + n, 0);
    let remaining           = allowedTroops - totalPlaced;

    let finalPlacements = { ...currentPlacements };
    if (remaining > 0) {
      // Auto-distribute remaining troops (seeded — deterministic)
      const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
        campaign_id, owner_player_id: myPlayer.id,
      });
      const additions = autoRandomizePlacements(
        ownedStates.map(t => t.territory_id),
        remaining,
        `${campaign_id}_${myPlayer.id}_r${round}_autolock`,
      );
      finalPlacements = mergePlacements(finalPlacements, additions);
    }

    await base44.entities.PhaseDecision.update(decision.id, {
      is_locked: true,
      locked_at: new Date().toISOString(),
      data:      { placements: finalPlacements, troops_remaining: 0 },
    });

    // Public lock log — no placement data
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
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const allDecisions  = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });

    // Auto-submit any players who did not lock
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

        const additions     = autoRandomizePlacements(
          ownedIds, remaining,
          `${campaign_id}_${p.id}_r${round}_auto_phase_end`,
        );
        const finalPlacements = mergePlacements(existingPlacements, additions);

        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true, is_auto_submitted: true,
            data: { placements: finalPlacements, troops_remaining: 0 },
          });
        } else {
          await base44.asServiceRole.entities.PhaseDecision.create({
            campaign_id, player_id: p.id, phase: 'deploy', round,
            is_locked: true, is_auto_submitted: true,
            data: { placements: finalPlacements, troops_remaining: 0 },
          });
        }

        // Private auto-submit log (hidden until reveal)
        await log(base44, campaign_id, round, phase, 'auto_submitted', p.id, {
          display_name: p.display_name, troops_auto_placed: remaining,
        }, false);
      }
    }

    // Reload all finalized decisions
    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });

    // REVEAL: Apply all troop placements to TerritoryState (becomes public via troop counts)
    for (const dec of finalDecisions) {
      const decPlacements = dec.data?.placements ?? {};
      for (const [tid, count] of Object.entries(decPlacements)) {
        if (!count) continue;
        const existing = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, territory_id: tid,
        });
        if (existing[0]) {
          await base44.asServiceRole.entities.TerritoryState.update(existing[0].id, {
            troop_count: (existing[0].troop_count || 0) + count,
          });
        }
      }
    }

    // Reload final territory states for snapshot
    const finalTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });

    // Build deployIncomes map for snapshot
    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({ campaign_id, round });
    const deployIncomes = {};
    for (const inc of incomeRecords) deployIncomes[inc.player_id] = inc;

    // Phase-end snapshot (territory states now include revealed troop additions)
    const snapshot = buildSnapshot({
      campaignId: campaign_id, round, phase, snapshotType: 'phase_end',
      territoryStates: finalTerritoryStates, activePlayers, deployIncomes,
    });
    await base44.asServiceRole.entities.PhaseSnapshot.create(snapshot);

    // Public reveal log — confirms reveal occurred, no raw placement data
    await log(base44, campaign_id, round, phase, 'phase_advanced', null, {
      next_phase: 'attack',
      round,
      players_auto_submitted: activePlayers
        .filter(p => finalDecisions.find(d => d.player_id === p.id)?.is_auto_submitted)
        .map(p => p.display_name),
    }, true);

    // Advance campaign phase
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_phase: 'attack',
    });

    return Response.json({ success: true, next_phase: 'attack', round });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});