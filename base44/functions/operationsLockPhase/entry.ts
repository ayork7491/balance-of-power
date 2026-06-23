/**
 * operationsLockPhase — Sprint 5B.5
 *
 * Staging + lock-in model for the Operations Phase (attack phase).
 *
 * Actions:
 *   getOperationsStatus    — returns per-pillar staging status for the acting player
 *   stageMilitary          — save staged attack lock state (idempotent — attacks staged via attackPhase)
 *   stageEconomic          — stage construction project(s) for this round
 *   stageDiplomatic        — stage an influence action (intelligence / diplomatic / battle-card-gen)
 *   removeStaged           — remove a staged diplomatic or economic action by index
 *   lockOperationsPhase    — commit ALL staged choices simultaneously (idempotent)
 *   getAdminLockStatus     — returns per-player lock completion for admin guard
 *
 * ─── STAGING MODEL ─────────────────────────────────────────────────────────────
 *   Staged choices stored in PhaseDecision (phase='operations_stage', round=N).
 *   data = {
 *     military_locked:       bool,
 *     economic_staged:       [{ building_type, territory_id, cost }],
 *     economic_locked:       bool,
 *     diplomatic_staged:     [{ action_type, region_id, target_territory_id, ... }],
 *     diplomatic_locked:     bool,
 *     locked_at:             string | null,
 *   }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Territory → Region mapping ───────────────────────────────────────────────
const SC_TERRITORY_REGION = {
  I8:'outer_passes', I4:'outer_passes', I6:'outer_passes', I7:'outer_passes',
  I1:'high_crown',   I2:'high_crown',   I3:'high_crown',   I5:'high_crown',
  W1:'northern_wilds',W2:'northern_wilds',W3:'northern_wilds',W4:'northern_wilds',W5:'northern_wilds',
  W6:'deepwoods',    W7:'deepwoods',    W8:'deepwoods',    W9:'deepwoods',
  B1:'northern_ruins',B3:'northern_ruins',B2:'northern_ruins',B4:'northern_ruins',
  B5:'central_crossroads',B6:'central_crossroads',B7:'central_crossroads',
  B8:'southern_ruins',B9:'southern_ruins',B10:'southern_ruins',
  S1:'western_plains',S4:'western_plains',S7:'western_plains',S2:'western_plains',
  S5:'eastern_granaries',S8:'eastern_granaries',S3:'eastern_granaries',
  S6:'eastern_granaries',S9:'eastern_granaries',
  C1:'northern_isles',C2:'northern_isles',C3:'northern_isles',C4:'northern_isles',
  C5:'southern_fractures',C6:'southern_fractures',C7:'southern_fractures',C8:'southern_fractures',
};

// Influence costs per action type
const DIPLOMATIC_OPS_COSTS = {
  // Intelligence
  recon_territory:       2,
  audit_stockpile:       3,
  investigate_influence: 3,
  // Diplomatic / Military Support / Economic Protection
  war_rations:           2,
  influence_network:     2,
  merchant_convoy:       2,
  non_aggression_pact:   4,
  broker_peace:          4,
  coalition_warfare:     6,
  power_broker:          6,
  // Battle-card-generating
  uprising:              4,
  labor_strike:          4,
  tax_protest:           4,
  manufactured_crisis:   4,
};

// Battle-card-generating ops that go through operationsPhase/submitOperation
const BATTLE_GEN_OPS = new Set(['uprising', 'labor_strike', 'tax_protest', 'manufactured_crisis']);

function emptyStaging() {
  return {
    military_locked: false,
    economic_staged: [],
    economic_locked: false,
    diplomatic_staged: [],
    diplomatic_locked: false,
    locked_at: null,
  };
}

async function getStagingDecision(base44, campaignId, playerId, round) {
  const records = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id: campaignId, player_id: playerId, phase: 'operations_stage', round,
  });
  return records[0] ?? null;
}

async function upsertStagingDecision(base44, campaignId, playerId, round, patch) {
  const existing = await getStagingDecision(base44, campaignId, playerId, round);
  const data = { ...(existing?.data ?? emptyStaging()), ...patch };
  if (existing) {
    await base44.asServiceRole.entities.PhaseDecision.update(existing.id, { data });
    return { ...existing, data };
  } else {
    const created = await base44.asServiceRole.entities.PhaseDecision.create({
      campaign_id: campaignId, player_id: playerId,
      phase: 'operations_stage', round, is_locked: false, data,
    });
    return created;
  }
}

async function getAttackDecision(base44, campaignId, playerId, round) {
  const records = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id: campaignId, player_id: playerId, phase: 'attack', round,
  });
  return records[0] ?? null;
}

async function spendRegionalInfluence(base44, campaignId, playerId, regionId, amount, round) {
  const existing = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
    campaign_id: campaignId, region_id: regionId, player_id: playerId,
  });
  const record = existing[0];
  const current = record?.spendable_influence ?? 0;
  if (current < amount) throw new Error(`Not enough influence in region '${regionId}'. Have ${current}, need ${amount}.`);
  if (record) {
    await base44.asServiceRole.entities.RegionalInfluencePool.update(record.id, {
      spendable_influence: current - amount, last_updated_round: round,
    });
  }
}

// ─── Inline: Shattered Crown adjacency pairs (for supply route range validation) ──
const SC_ADJ_PAIRS = [
  ['I8','I4'],['I4','I3'],['I4','I7'],['I6','I3'],['I6','I5'],['I6','I7'],['I1','I2'],['I1','I5'],
  ['I2','I3'],['I2','I5'],['I6','B1'],['I7','B1'],['I7','B3'],['I8','C1'],['W1','W2'],['W2','W3'],
  ['W2','W4'],['W2','W5'],['W3','W5'],['W3','W6'],['W4','W5'],['W4','W7'],['W5','W6'],['W5','W7'],
  ['W5','W8'],['W6','W9'],['W7','W8'],['W8','W9'],['W7','S1'],['W9','S2'],['B1','B3'],['B1','B2'],
  ['B3','B2'],['B3','B4'],['B2','B4'],['B2','B5'],['B2','B6'],['B4','B7'],['B5','B6'],['B5','B8'],
  ['B6','B7'],['B6','B8'],['B6','B9'],['B7','B10'],['B8','B9'],['B9','B10'],['B10','C6'],['B10','C4'],
  ['B10','S3'],['S1','S2'],['S1','S4'],['S4','S5'],['S4','S7'],['S7','S5'],['S7','S8'],['S2','S3'],
  ['S2','S5'],['S5','S8'],['S5','S6'],['S3','S6'],['S6','S9'],['S6','C8'],['S9','C8'],['C1','C2'],
  ['C2','C3'],['C3','C4'],['C3','C5'],['C4','C5'],['C4','C6'],['C5','C6'],['C5','C7'],['C6','C7'],
  ['C6','C8'],['C7','C8'],
];
function buildAdjacency(mapId) {
  // SC_ADJ_PAIRS covers shattered_crown_v1; for other maps use SC_ADJ_PAIRS as fallback
  // (V1 standard map is not used in production campaigns)
  const pairs = SC_ADJ_PAIRS;
  const adj = {};
  for (const [a, b] of pairs) {
    if (!adj[a]) adj[a] = new Set();
    if (!adj[b]) adj[b] = new Set();
    adj[a].add(b); adj[b].add(a);
  }
  return adj;
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

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const isAdmin = campaign.admin_user_id === user.id || user.role === 'admin';
  const round = campaign.current_round ?? 1;

  const { acting_as_player_id } = body;
  let actingPlayer = myPlayer;
  if (acting_as_player_id) {
    const target = players.find(p => p.id === acting_as_player_id);
    if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
    if (!isAdmin && target.id !== myPlayer.id) {
      return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
    }
    actingPlayer = target;
  }

  // ── ACTION: getOperationsStatus ────────────────────────────────────────────
  if (action === 'getOperationsStatus') {
    // No hard phase guard — allow reads during transitions to avoid UI errors.
    const [stagingDecision, attackDecision, attackLockRecords, territoryStates, regionalPools] = await Promise.all([
      getStagingDecision(base44, campaign_id, actingPlayer.id, round),
      getAttackDecision(base44, campaign_id, actingPlayer.id, round),
      base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'attack', round }),
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id, owner_player_id: actingPlayer.id }),
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id, player_id: actingPlayer.id }),
    ]);

    const staging = stagingDecision?.data ?? emptyStaging();
    const maxAttacks = campaign.settings?.max_attacks_per_phase ?? 3;

    // Military: count staged attacks from PhaseDecision
    const attackData = attackDecision?.data ?? {};
    const stagedAttacks = Array.isArray(attackData.attacks) ? attackData.attacks : [];
    const militaryLocked = attackDecision?.is_locked ?? staging.military_locked ?? false;

    // Economic: construction capacity (1 project per round, expandable with buildings)
    const constructionLimit = 1; // base limit; future: buildings can increase
    const economicStaged = staging.economic_staged ?? [];
    const economicLocked = staging.economic_locked ?? false;

    // Diplomatic: influence pools
    const regionPools = {};
    for (const p of regionalPools) regionPools[p.region_id] = p.spendable_influence ?? 0;
    const diplomaticStaged = staging.diplomatic_staged ?? [];
    const diplomaticLocked = staging.diplomatic_locked ?? false;

    // Resources: sum territory storages — exclude food (special resource, not spendable for construction)
    const SPENDABLE_RESOURCES = ['gold', 'iron', 'timber', 'stone'];
    const resources = { gold: 0, iron: 0, timber: 0, stone: 0 };
    for (const ts of territoryStates) {
      const storage = ts.resource_storage ?? {};
      for (const r of SPENDABLE_RESOURCES) {
        resources[r] = (resources[r] ?? 0) + (storage[r] ?? 0);
      }
    }

    const operationsLocked = !!staging.locked_at;

    // Optionally bundle admin lock status inline (saves a separate getAdminLockStatus call)
    let adminLockStatus = null;
    if (body.include_admin_status) {
      const activePl = players.filter(p => !p.is_eliminated);
      const [stagingRecs, attackDecs] = await Promise.all([
        base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'operations_stage', round }),
        base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'attack', round }),
      ]);
      adminLockStatus = {
        players: activePl.map(p => {
          const s = stagingRecs.find(r => r.player_id === p.id);
          const a = attackDecs.find(r => r.player_id === p.id);
          const sd = s?.data ?? emptyStaging();
          return {
            player_id: p.id,
            display_name: p.display_name,
            operations_locked: !!sd.locked_at,
            locked_at: sd.locked_at ?? null,
            military_locked: a?.is_locked ?? sd.military_locked ?? false,
          };
        }),
      };
    }

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      round,
      operations_locked: operationsLocked,
      locked_at: staging.locked_at ?? null,
      admin_lock_status: adminLockStatus,
      military: {
        attacks_staged: stagedAttacks.length,
        attacks_limit: maxAttacks,
        is_locked: militaryLocked,
        ready: militaryLocked,
      },
      economic: {
        projects_staged: economicStaged.length,
        projects_limit: constructionLimit,
        staged: economicStaged,
        is_locked: economicLocked,
        ready: economicLocked || economicStaged.length === 0,
        resources,
      },
      diplomatic: {
        actions_staged: diplomaticStaged.length,
        staged: diplomaticStaged,
        is_locked: diplomaticLocked,
        ready: diplomaticLocked || diplomaticStaged.length === 0,
        region_pools: regionPools,
      },
    });
  }

  // ── ACTION: stageMilitary ──────────────────────────────────────────────────
  // Called when attacks are already staged via attackPhase — just marks military as "ready".
  if (action === 'stageMilitary') {
    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    if (staging?.data?.locked_at) {
      return Response.json({ error: 'Operations phase already locked.' }, { status: 400 });
    }
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      military_locked: false, // Will be committed at lockOperationsPhase
    });
    return Response.json({ success: true, message: 'Military staging acknowledged.' });
  }

  // ── ACTION: stageEconomic ──────────────────────────────────────────────────
  if (action === 'stageEconomic') {
    const { building_type, territory_id, source_territory_id } = body;
    if (!building_type || !territory_id) {
      return Response.json({ error: 'building_type and territory_id are required' }, { status: 400 });
    }

    // supply_route requires source_territory_id (the territory the route extracts from)
    if (building_type === 'supply_route' && !source_territory_id) {
      return Response.json({ error: 'source_territory_id is required for supply_route' }, { status: 400 });
    }

    // ── Duplicate supply route guard — check before ANY resource deduction ──────
    if (building_type === 'supply_route' && source_territory_id) {
      const [existingRoutes, existingCards] = await Promise.all([
        base44.asServiceRole.entities.SupplyRoute.filter({
          campaign_id, owner_player_id: actingPlayer.id, source_territory_id,
        }),
        base44.asServiceRole.entities.BattleCard.filter({
          campaign_id, round, source_player_id: actingPlayer.id, battle_card_source: 'supply_route_establishment',
        }),
      ]);
      // Check active/disrupted routes to this source
      const activeRoute = existingRoutes.find(r => r.route_status !== 'inactive');
      if (activeRoute) {
        return Response.json({
          error: `A supply route to ${source_territory_id} already exists. Each source territory can only have one route.`,
        }, { status: 400 });
      }
      // Check pending battle card for same source this round
      const pendingCard = existingCards.find(c =>
        c.source_operation_metadata?.route_target_territory === source_territory_id &&
        c.status !== 'resolved' && c.status !== 'forfeited'
      );
      if (pendingCard) {
        return Response.json({
          error: `A supply route battle for ${source_territory_id} is already pending this round.`,
        }, { status: 400 });
      }

      // Check locally staged items — source already staged by this player this round
      const existingDecisionStage = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
      const alreadyStagedForSource = (existingDecisionStage?.data?.economic_staged ?? []).some(
        p => p.building_type === 'supply_route' && p.source_territory_id === source_territory_id
      );
      if (alreadyStagedForSource) {
        return Response.json({
          error: `You already have a staged supply route to ${source_territory_id} this round.`,
        }, { status: 400 });
      }
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();
    if (stagingData.locked_at) {
      return Response.json({ error: 'Operations phase already locked.' }, { status: 400 });
    }
    if (stagingData.economic_locked) {
      return Response.json({ error: 'Economic operations already locked.' }, { status: 400 });
    }

    // Validate territory ownership and get all states
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const ownedStates = allTerritoryStates.filter(s => s.owner_player_id === actingPlayer.id);
    const ownedIds = new Set(ownedStates.map(s => s.territory_id));
    if (!ownedIds.has(territory_id)) {
      return Response.json({ error: 'You do not own that territory.' }, { status: 400 });
    }

    // Validate supply route: hub must have resource_hub building, source must be within range 2
    if (building_type === 'supply_route') {
      const hubBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
        campaign_id, territory_id, building_type: 'resource_hub',
      });
      const hasHub = hubBuildings.some(b => b.status === 'active');
      if (!hasHub) {
        return Response.json({ error: 'Selected territory does not have an active Resource Hub.' }, { status: 400 });
      }
      // BFS to check source is within range 2 of hub
      const adj = buildAdjacency(campaign.map_id ?? 'shattered_crown_v1');
      const inRange2 = new Set();
      const queue = [[territory_id, 0]];
      const visited = new Set([territory_id]);
      while (queue.length > 0) {
        const [cur, dist] = queue.shift();
        if (dist > 0) inRange2.add(cur);
        if (dist < 2) {
          for (const nb of (adj[cur] ?? new Set())) {
            if (!visited.has(nb)) { visited.add(nb); queue.push([nb, dist + 1]); }
          }
        }
      }
      if (!inRange2.has(source_territory_id)) {
        return Response.json({ error: 'Source territory must be within range 2 of the Resource Hub.' }, { status: 400 });
      }
    }

    // Construction limit: 1 per round (base)
    const existing = stagingData.economic_staged ?? [];
    if (existing.length >= 1) {
      return Response.json({ error: 'Only 1 construction project can be staged per round.' }, { status: 400 });
    }

    // ── Deduct resources immediately from territory storage (like troops for attacks) ──
    const BUILDING_COSTS = {
      barracks:        { gold: 2, iron: 1 },
      war_council:     { gold: 3, iron: 2 },
      logistics_corps: { gold: 2, iron: 1, timber: 1 },
      embassy:         { gold: 2, stone: 2 },
      council_chamber: { gold: 3, stone: 2 },
      foreign_office:  { gold: 2, stone: 1, timber: 1 },
      monument:        { gold: 3, stone: 3 },
      marketplace:     { gold: 2, timber: 1 },
      builders_guild:  { gold: 3, timber: 2 },
      trade_network:   { gold: 2, timber: 2 },
      resource_hub:    { gold: 3, timber: 1, stone: 1 },
      supply_route:    { gold: 1, timber: 1 },
      warehouse:       { gold: 2, stone: 1 },
    };
    const cost = BUILDING_COSTS[building_type];
    if (!cost) {
      return Response.json({ error: `Unknown building type: ${building_type}` }, { status: 400 });
    }

    // Find the territory to deduct from: for supply_route use hub territory, else the target territory
    const costTerritoryId = territory_id;
    const costTs = allTerritoryStates.find(s => s.territory_id === costTerritoryId);
    const storage = { ...(costTs?.resource_storage ?? {}) };

    // Validate affordability
    for (const [res, needed] of Object.entries(cost)) {
      if (needed > 0 && (storage[res] ?? 0) < needed) {
        return Response.json({
          error: `Not enough ${res} in ${costTerritoryId}. Have ${storage[res] ?? 0}, need ${needed}.`,
        }, { status: 400 });
      }
    }

    // Deduct resources
    for (const [res, needed] of Object.entries(cost)) {
      if (needed > 0) storage[res] = (storage[res] ?? 0) - needed;
    }
    if (costTs) {
      await base44.asServiceRole.entities.TerritoryState.update(costTs.id, { resource_storage: storage });
    }

    const newProject = {
      building_type,
      territory_id,
      source_territory_id: source_territory_id ?? null,
      cost_paid: cost,
      staged_at: new Date().toISOString(),
    };
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      economic_staged: [...existing, newProject],
    });

    return Response.json({ success: true, project: newProject, message: 'Construction project staged. Resources deducted.' });
  }

  // ── ACTION: stageDiplomatic ────────────────────────────────────────────────
  if (action === 'stageDiplomatic') {
    const { action_type, region_id, target_territory_id, target_player_id, target_player_b_id, target_supply_route_id } = body;
    if (!action_type) return Response.json({ error: 'action_type is required' }, { status: 400 });
    if (!region_id) return Response.json({ error: 'region_id is required' }, { status: 400 });

    const cost = DIPLOMATIC_OPS_COSTS[action_type];
    if (cost === undefined) {
      return Response.json({ error: `Unknown action type: ${action_type}` }, { status: 400 });
    }

    // Check influence availability (reserve it — don't spend until lock)
    const poolRecords = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
      campaign_id, player_id: actingPlayer.id, region_id,
    });
    const pool = poolRecords[0];
    const available = pool?.spendable_influence ?? 0;

    // Calculate already-reserved influence from previously staged actions in same region
    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();
    if (stagingData.locked_at) {
      return Response.json({ error: 'Operations phase already locked.' }, { status: 400 });
    }
    if (stagingData.diplomatic_locked) {
      return Response.json({ error: 'Diplomatic operations already locked.' }, { status: 400 });
    }

    const alreadyReserved = (stagingData.diplomatic_staged ?? [])
      .filter(a => a.region_id === region_id)
      .reduce((s, a) => s + (DIPLOMATIC_OPS_COSTS[a.action_type] ?? 0), 0);

    if (available - alreadyReserved < cost) {
      return Response.json({
        error: `Not enough spendable influence in region '${region_id}'. Available: ${available - alreadyReserved}, need: ${cost}.`,
      }, { status: 400 });
    }

    const newAction = {
      action_type,
      region_id,
      cost,
      target_territory_id: target_territory_id ?? null,
      target_player_id: target_player_id ?? null,
      target_player_b_id: target_player_b_id ?? null,
      target_supply_route_id: target_supply_route_id ?? null,
      staged_at: new Date().toISOString(),
    };

    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      diplomatic_staged: [...(stagingData.diplomatic_staged ?? []), newAction],
    });

    return Response.json({ success: true, action: newAction, message: `Staged ${action_type}.` });
  }

  // ── ACTION: removeStaged ───────────────────────────────────────────────────
  if (action === 'removeStaged') {
    const { pillar, index } = body; // pillar: 'economic' | 'diplomatic', index: number
    if (pillar === undefined || index === undefined) {
      return Response.json({ error: 'pillar and index are required' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();
    if (stagingData.locked_at) {
      return Response.json({ error: 'Operations phase already locked.' }, { status: 400 });
    }

    if (pillar === 'economic') {
      const arr = [...(stagingData.economic_staged ?? [])];
      const removed = arr.splice(index, 1)[0];
      // Refund resources that were deducted at staging time
      if (removed?.cost_paid && removed?.territory_id) {
        const allStatesForRefund = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const refundTs = allStatesForRefund.find(s => s.territory_id === removed.territory_id);
        if (refundTs) {
          const newStorage = { ...(refundTs.resource_storage ?? {}) };
          for (const [res, amount] of Object.entries(removed.cost_paid)) {
            if (amount > 0) newStorage[res] = (newStorage[res] ?? 0) + amount;
          }
          await base44.asServiceRole.entities.TerritoryState.update(refundTs.id, { resource_storage: newStorage });
        }
      }
      await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, { economic_staged: arr });
    } else if (pillar === 'diplomatic') {
      const arr = [...(stagingData.diplomatic_staged ?? [])];
      arr.splice(index, 1);
      await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, { diplomatic_staged: arr });
    } else {
      return Response.json({ error: 'Invalid pillar' }, { status: 400 });
    }

    return Response.json({ success: true, message: 'Staged action removed.' });
  }

  // ── ACTION: lockOperationsPhase ────────────────────────────────────────────
  // Accepts local-first staged arrays from the client — no prior server writes needed.
  // _local_economic_staged and _local_diplomatic_staged override server-staged data.
  if (action === 'lockOperationsPhase') {
    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();

    // Idempotency
    if (stagingData.locked_at) {
      return Response.json({
        success: true, idempotent: true,
        message: 'Operations phase already locked.',
        locked_at: stagingData.locked_at,
      });
    }

    // Accept client-submitted local staging (atomic local-first model)
    // For economic: client already shows deducted resources in UI but server must deduct now.
    // For diplomatic: influence is spent below during processing.
    const isLocalFirstEconomic = Array.isArray(body._local_economic_staged);
    if (isLocalFirstEconomic) {
      stagingData.economic_staged = body._local_economic_staged;
    }
    if (Array.isArray(body._local_diplomatic_staged)) {
      stagingData.diplomatic_staged = body._local_diplomatic_staged;
    }

    const results = {};

    // ── 1. Military: upsert + lock attack phase decision ────────────────────
    // Accept local-first attacks from the client (no separate Save Attacks step needed).
    const localMilitaryAttacks = Array.isArray(body._local_military_attacks) ? body._local_military_attacks : null;
    const attackDecision = await getAttackDecision(base44, campaign_id, actingPlayer.id, round);
    const lockedNow = new Date().toISOString();

    if (attackDecision) {
      if (!attackDecision.is_locked) {
        // Merge: prefer local attacks if provided (most up-to-date), else keep server data
        const attacksToCommit = localMilitaryAttacks !== null
          ? localMilitaryAttacks.map(a => ({
              ...a,
              // Remap local_ prefixed ids to stable ids
              id: a.id?.startsWith('local_') ? `atk_${Date.now()}_${Math.random().toString(36).slice(2)}` : a.id,
            }))
          : (attackDecision.data?.attacks ?? []);
        await base44.asServiceRole.entities.PhaseDecision.update(attackDecision.id, {
          is_locked: true,
          locked_at: lockedNow,
          data: { attacks: attacksToCommit },
        });
        results.military = { locked: true, attacks_committed: attacksToCommit.length };
      } else {
        results.military = { locked: true, already_locked: true, attacks_committed: (attackDecision.data?.attacks ?? []).length };
      }
    } else {
      // No existing decision — create one from local attacks
      const attacksToCommit = (localMilitaryAttacks ?? []).map(a => ({
        ...a,
        id: a.id?.startsWith('local_') ? `atk_${Date.now()}_${Math.random().toString(36).slice(2)}` : (a.id ?? `atk_${Date.now()}_${Math.random().toString(36).slice(2)}`),
      }));
      await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id,
        player_id: actingPlayer.id,
        phase: 'attack',
        round,
        is_locked: true,
        locked_at: lockedNow,
        data: { attacks: attacksToCommit },
      });
      results.military = { locked: true, created: true, attacks_committed: attacksToCommit.length };
    }

    // ── 2. Economic: commit construction projects ────────────────────────────
    const economicStaged = stagingData.economic_staged ?? [];
    if (economicStaged.length > 0) {
      const constructionResults = [];
      const allTerritoryStatesForLock = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });

      // Local-first model: resources were NOT deducted server-side during staging.
      // Deduct them now at lock time.
      if (isLocalFirstEconomic) {
        for (const project of economicStaged) {
          const cost = project.cost_paid;
          if (!cost || !project.territory_id) continue;
          const costTs = allTerritoryStatesForLock.find(s => s.territory_id === project.territory_id);
          if (!costTs) continue;
          const storage = { ...(costTs.resource_storage ?? {}) };
          let canAfford = true;
          for (const [res, needed] of Object.entries(cost)) {
            if (needed > 0 && (storage[res] ?? 0) < needed) { canAfford = false; break; }
          }
          if (!canAfford) continue; // skip — insufficient resources
          for (const [res, needed] of Object.entries(cost)) {
            if (needed > 0) storage[res] = Math.max(0, (storage[res] ?? 0) - needed);
          }
          await base44.asServiceRole.entities.TerritoryState.update(costTs.id, { resource_storage: storage });
          // Update our in-memory list so subsequent projects see the updated storage
          costTs.resource_storage = storage;
        }
      }

      for (const project of economicStaged) {
        const pillarMap = {
          barracks: 'military', war_council: 'military', logistics_corps: 'military',
          embassy: 'diplomatic', council_chamber: 'diplomatic', foreign_office: 'diplomatic',
          monument: 'diplomatic', marketplace: 'economic', builders_guild: 'economic',
          trade_network: 'economic', resource_hub: 'economic', supply_route: 'economic', warehouse: 'economic',
        };
        const pillar = pillarMap[project.building_type] ?? 'economic';

        // Supply route: resolve into battle card (enemy target) or SupplyRoute record (friendly/unoccupied)
        if (project.building_type === 'supply_route' && project.source_territory_id) {
          const sourceState = allTerritoryStatesForLock.find(s => s.territory_id === project.source_territory_id);
          const sourceOwner = sourceState?.owner_player_id ?? null;
          const isEnemy = sourceOwner && sourceOwner !== actingPlayer.id;

          if (isEnemy) {
            // Generate a supply_route_establishment battle card
            const DEFAULT_AVG_BATTLE_SIZE = 1000;
            const garrisonTroops = sourceState?.troop_count ?? 0;
            const attackerTroops = Math.max(1, Math.floor(garrisonTroops * 0.3));
            const totalTroops = attackerTroops + garrisonTroops;
            const scaleFactor = parseFloat(Math.max(totalTroops / DEFAULT_AVG_BATTLE_SIZE, 1).toFixed(2));
            const tabletopSize = Math.round(totalTroops / scaleFactor);

            const existingCards = await base44.asServiceRole.entities.BattleCard.filter({
              campaign_id, round, source_player_id: actingPlayer.id, battle_card_source: 'supply_route_establishment',
            });
            const alreadyExists = existingCards.some(c => c.target_territory_id === project.source_territory_id);
            if (!alreadyExists) {
              await base44.asServiceRole.entities.BattleCard.create({
                campaign_id, round,
                battle_type: 'supply_route_establishment',
                battle_pillar: 'economic',
                target_territory_id: project.source_territory_id,
                defender_player_id: sourceOwner,
                defender_troops: garrisonTroops,
                attackers: [{ player_id: actingPlayer.id, origin_territory_id: project.territory_id, committed_troops: attackerTroops }],
                total_attacking_troops: attackerTroops,
                total_troops_in_battle: totalTroops,
                scale_factor: scaleFactor,
                tabletop_size: tabletopSize,
                status: 'pending',
                is_mutual: false,
                battle_preferences: {},
                battle_card_source: 'supply_route_establishment',
                source_player_id: actingPlayer.id,
                source_operation_metadata: {
                  hub_territory_id: project.territory_id,
                  route_target_territory: project.source_territory_id,
                  declared_resource_type: sourceState?.resource_type ?? null,
                },
              });
            }
            constructionResults.push({ building_type: 'supply_route', hub_territory_id: project.territory_id, source_territory_id: project.source_territory_id, result: 'battle_card_generated' });
          } else {
            // Friendly or unoccupied — create SupplyRoute directly and the TerritoryBuilding
            const existingRoute = await base44.asServiceRole.entities.SupplyRoute.filter({
              campaign_id, owner_player_id: actingPlayer.id,
              hub_territory_id: project.territory_id,
              source_territory_id: project.source_territory_id,
            });
            if (existingRoute.length === 0) {
              await base44.asServiceRole.entities.SupplyRoute.create({
                campaign_id,
                owner_player_id: actingPlayer.id,
                hub_territory_id: project.territory_id,
                source_territory_id: project.source_territory_id,
                route_status: 'active',
                range_distance: 2,
                resource_type: sourceState?.resource_type ?? null,
                created_round: round,
                metadata_json: {},
              });
            }
            // Also create TerritoryBuilding for the route itself
            const existingBld = await base44.asServiceRole.entities.TerritoryBuilding.filter({
              campaign_id, territory_id: project.territory_id,
              building_type: 'supply_route', player_id: actingPlayer.id,
            });
            if (existingBld.length === 0) {
              await base44.asServiceRole.entities.TerritoryBuilding.create({
                campaign_id, territory_id: project.territory_id, player_id: actingPlayer.id,
                building_type: 'supply_route', pillar_type: 'economic',
                status: 'active', started_round: round, completed_round: round,
                construction_progress: 1, metadata_json: { source_territory_id: project.source_territory_id },
              });
            }
            constructionResults.push({ building_type: 'supply_route', hub_territory_id: project.territory_id, source_territory_id: project.source_territory_id, result: 'route_established' });
          }
          continue; // handled supply_route — skip generic TerritoryBuilding creation below
        }

        // Generic building: create TerritoryBuilding in 'planned' status (idempotent)
        const existing = await base44.asServiceRole.entities.TerritoryBuilding.filter({
          campaign_id, territory_id: project.territory_id, building_type: project.building_type, player_id: actingPlayer.id,
        });
        if (existing.length === 0) {
          const created = await base44.asServiceRole.entities.TerritoryBuilding.create({
            campaign_id, territory_id: project.territory_id, player_id: actingPlayer.id,
            building_type: project.building_type, pillar_type: pillar,
            status: 'planned', started_round: round, construction_progress: 0, metadata_json: {},
          });
          constructionResults.push({ building_id: created.id, building_type: project.building_type, territory_id: project.territory_id });
        }
      }
      results.economic = { locked: true, projects_committed: constructionResults.length, details: constructionResults };
    } else {
      results.economic = { locked: true, skipped: true };
    }

    // ── 3. Diplomatic: commit influence actions ──────────────────────────────
    const diplomaticStaged = stagingData.diplomatic_staged ?? [];
    const dipResults = [];

    for (const staged of diplomaticStaged) {
      const { action_type, region_id, cost, target_territory_id, target_player_id, target_player_b_id, target_supply_route_id } = staged;

      // Spend influence
      await spendRegionalInfluence(base44, campaign_id, actingPlayer.id, region_id, cost, round);

      if (BATTLE_GEN_OPS.has(action_type)) {
        // These generate battle cards — call operationsPhase/submitOperation logic inline
        // (No local imports; must inline)
        const DEFAULT_AVG_BATTLE_SIZE = 1000;
        const avgSize = campaign.settings?.average_battle_size ?? DEFAULT_AVG_BATTLE_SIZE;

        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const targetState = territoryStates.find(s => s.territory_id === target_territory_id);
        const defenderPlayerId = targetState?.owner_player_id ?? null;
        const garrisonTroops = targetState?.troop_count ?? 0;

        // Uprising troop math: 30% of garrison enters battle
        //   loyalists (defender) = 20% of garrison, rebels (diplomat) = 10% of garrison
        //   Both are drawn from the territory garrison (subtracted at battle generation)
        let diplomatTroops, cardDefenderTroopsUprise;
        if (action_type === 'uprising') {
          diplomatTroops = Math.max(1, Math.floor(garrisonTroops * 0.10));
          cardDefenderTroopsUprise = Math.max(1, Math.floor(garrisonTroops * 0.20));
          // Pre-deduct both from territory garrison so no troops are created from nothing
          const battleForce = diplomatTroops + cardDefenderTroopsUprise;
          const remainingGarrison = Math.max(0, garrisonTroops - battleForce);
          if (targetState) {
            await base44.asServiceRole.entities.TerritoryState.update(targetState.id, { troop_count: remainingGarrison });
          }
        } else {
          diplomatTroops = Math.max(1, Math.round(garrisonTroops * 0.3));
          cardDefenderTroopsUprise = garrisonTroops;
        }

        const defenderTroops = cardDefenderTroopsUprise;
        const totalTroops = diplomatTroops + defenderTroops;
        const scaleFactor = parseFloat(Math.max(totalTroops / DEFAULT_AVG_BATTLE_SIZE, 1).toFixed(2));
        const tabletopSize = Math.round(totalTroops / scaleFactor);

        let metadata = {
          influence_spent: cost, region_id,
          diplomat_committed_troops: diplomatTroops,
          troop_loss_basis: defenderTroops,
          garrison_before_battle: garrisonTroops,
          influence_reward_target: region_id,
          objective_hook: action_type,
        };

        let attackers, cardDefenderPlayerId, cardDefenderTroops;
        if (action_type === 'tax_protest') {
          attackers = [{ player_id: defenderPlayerId ?? actingPlayer.id, origin_territory_id: target_territory_id, committed_troops: defenderTroops }];
          cardDefenderPlayerId = actingPlayer.id;
          cardDefenderTroops = diplomatTroops;
        } else {
          attackers = [{ player_id: actingPlayer.id, origin_territory_id: target_territory_id, committed_troops: diplomatTroops }];
          cardDefenderPlayerId = defenderPlayerId;
          cardDefenderTroops = defenderTroops;
        }

        // Idempotency: skip if card already exists this round from same source
        const existingCards = await base44.asServiceRole.entities.BattleCard.filter({
          campaign_id, round, source_player_id: actingPlayer.id, battle_card_source: action_type,
        });
        const alreadyExists = existingCards.some(c => c.target_territory_id === target_territory_id);
        if (!alreadyExists) {
          await base44.asServiceRole.entities.BattleCard.create({
            campaign_id, round,
            battle_type: action_type,
            battle_pillar: 'diplomatic',
            target_territory_id,
            defender_player_id: cardDefenderPlayerId,
            defender_troops: cardDefenderTroops,
            attackers,
            total_attacking_troops: attackers.reduce((s, a) => s + (a.committed_troops ?? 0), 0),
            total_troops_in_battle: totalTroops,
            scale_factor: scaleFactor,
            tabletop_size: tabletopSize,
            status: 'pending',
            is_mutual: false,
            battle_preferences: {},
            battle_card_source: action_type,
            source_player_id: actingPlayer.id,
            source_operation_metadata: metadata,
          });
        }
        dipResults.push({ action_type, region_id, result: 'battle_card_generated' });
      } else {
        // Pure influence actions — record as DiplomaticAction + apply immediate effects
        const SC_ADJACENCY_MAP = (() => {
          const edges = [
            ['I8','I4'],['I4','I3'],['I4','I7'],['I6','I3'],['I6','I5'],['I6','I7'],['I1','I2'],['I1','I5'],
            ['I2','I3'],['I2','I5'],['I6','B1'],['I7','B1'],['I7','B3'],['I8','C1'],['W1','W2'],['W2','W3'],
            ['W2','W4'],['W2','W5'],['W3','W5'],['W3','W6'],['W4','W5'],['W4','W7'],['W5','W6'],['W5','W7'],
            ['W5','W8'],['W6','W9'],['W7','W8'],['W8','W9'],['W7','S1'],['W9','S2'],['B1','B3'],['B1','B2'],
            ['B3','B2'],['B3','B4'],['B2','B4'],['B2','B5'],['B2','B6'],['B4','B7'],['B5','B6'],['B5','B8'],
            ['B6','B7'],['B6','B8'],['B6','B9'],['B7','B10'],['B8','B9'],['B9','B10'],['B10','C6'],['B10','C4'],
            ['B10','S3'],['S1','S2'],['S1','S4'],['S4','S5'],['S4','S7'],['S7','S5'],['S7','S8'],['S2','S3'],
            ['S2','S5'],['S5','S8'],['S5','S6'],['S3','S6'],['S6','S9'],['S6','C8'],['S9','C8'],['C1','C2'],
            ['C2','C3'],['C3','C4'],['C3','C5'],['C4','C5'],['C4','C6'],['C5','C6'],['C5','C7'],['C6','C7'],
            ['C6','C8'],['C7','C8'],
          ];
          const adj = {};
          for (const [a, b] of edges) {
            if (!adj[a]) adj[a] = []; if (!adj[b]) adj[b] = [];
            adj[a].push(b); adj[b].push(a);
          }
          return adj;
        })();

        let effectMetadata = {};
        let dipResult = 'action_recorded';

        // Apply Influence Network effect: +1 permanent influence to all adjacent territories
        if (action_type === 'influence_network' && target_territory_id) {
          const neighbors = SC_ADJACENCY_MAP[target_territory_id] ?? [];
          const spreadResults = [];
          for (const neighborId of neighbors) {
            const existing = await base44.asServiceRole.entities.TerritoryInfluence.filter({
              campaign_id, territory_id: neighborId, player_id: actingPlayer.id,
            });
            const rec = existing[0];
            if (rec) {
              const newAmt = Math.max(0, (rec.influence_amount ?? 0) + 1);
              await base44.asServiceRole.entities.TerritoryInfluence.update(rec.id, {
                influence_amount: newAmt, last_updated_round: round, source: 'influence_network',
              });
              spreadResults.push({ territory_id: neighborId, new_total: newAmt });
            } else {
              await base44.asServiceRole.entities.TerritoryInfluence.create({
                campaign_id, territory_id: neighborId, player_id: actingPlayer.id,
                influence_amount: 1, last_updated_round: round, source: 'influence_network',
              });
              spreadResults.push({ territory_id: neighborId, new_total: 1 });
            }
          }
          effectMetadata = {
            source_territory: target_territory_id,
            territories_affected: spreadResults.map(r => r.territory_id),
            spread_count: spreadResults.length,
            results: spreadResults,
          };
          dipResult = `influence_network_applied_to_${spreadResults.length}_territories`;
        }

        const existingActions = await base44.asServiceRole.entities.DiplomaticAction.filter({
          campaign_id, round, player_id: actingPlayer.id, action_type,
        });
        if (existingActions.length === 0) {
          await base44.asServiceRole.entities.DiplomaticAction.create({
            campaign_id, round,
            player_id: actingPlayer.id,
            action_type,
            region_id,
            influence_spent: cost,
            status: 'active',
            expires_round: round,
            target_player_id: target_player_id ?? undefined,
            target_player_b_id: target_player_b_id ?? undefined,
            target_territory_id: target_territory_id ?? undefined,
            target_supply_route_id: target_supply_route_id ?? undefined,
            effect_metadata: effectMetadata,
          });
        }
        // For intelligence actions, also create an IntelligenceReport via intelligencePhase
        const INTEL_ACTION_IDS = new Set(['recon_territory', 'audit_stockpile', 'investigate_influence']);
        if (INTEL_ACTION_IDS.has(action_type)) {
          try {
            await base44.asServiceRole.functions.invoke('intelligencePhase', {
              action: 'submitIntelAction',
              campaign_id,
              acting_as_player_id: actingPlayer.id,
              intel_action_id: action_type,
              region_id,
              target_territory_id: target_territory_id ?? undefined,
              target_region_id: undefined,
              _skip_influence_spend: true, // influence already spent above
            });
            dipResult = `${action_type}_report_generated`;
          } catch (intelErr) {
            console.warn(`[lockOperationsPhase] Intel report creation failed for ${action_type}:`, intelErr?.message);
          }
        }

        dipResults.push({ action_type, region_id, result: dipResult, effect_metadata: effectMetadata });
      }
    }
    results.diplomatic = { locked: true, actions_committed: dipResults.length, details: dipResults };

    // ── Finalize staging record ──────────────────────────────────────────────
    const lockedAt = new Date().toISOString();
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      military_locked: true,
      economic_locked: true,
      diplomatic_locked: true,
      locked_at: lockedAt,
    });

    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id, phase: 'attack', round,
      event_type: 'operations_phase_locked',
      player_id: actingPlayer.id,
      payload: { display_name: actingPlayer.display_name, results },
      is_public: true,
    });

    return Response.json({ success: true, locked_at: lockedAt, player_id: actingPlayer.id, results });
  }

  // ── ACTION: unlockOperationsPhase ─────────────────────────────────────────
  // Allows a player to undo their operations lock while still in Operations Phase,
  // as long as admin has not yet advanced the phase.
  // Admin can unlock any player via acting_as_player_id.
  if (action === 'unlockOperationsPhase') {
    if (campaign.current_phase !== 'attack') {
      return Response.json({ error: 'Not in Operations (attack) Phase' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    if (!staging?.data?.locked_at) {
      return Response.json({ success: true, idempotent: true, message: 'Operations phase is not locked.' });
    }

    // Reset staging lock — keep staged items so the player can review/edit
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      military_locked: false,
      economic_locked: false,
      diplomatic_locked: false,
      locked_at: null,
    });

    // Also unlock the attack PhaseDecision so the player can re-stage attacks
    const attackDecision = await getAttackDecision(base44, campaign_id, actingPlayer.id, round);
    if (attackDecision?.is_locked) {
      await base44.asServiceRole.entities.PhaseDecision.update(attackDecision.id, {
        is_locked: false,
        locked_at: null,
      });
    }

    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id, phase: 'attack', round,
      event_type: 'operations_phase_unlocked',
      player_id: actingPlayer.id,
      payload: { display_name: actingPlayer.display_name, unlocked_by: myPlayer.id },
      is_public: true,
    });

    return Response.json({
      success: true,
      message: `Operations phase unlocked for ${actingPlayer.display_name}.`,
      player_id: actingPlayer.id,
    });
  }

  // ── ACTION: getAdminLockStatus ─────────────────────────────────────────────
  if (action === 'getAdminLockStatus') {
    const activePlayers = players.filter(p => !p.is_eliminated);

    const [stagingRecords, attackDecisions] = await Promise.all([
      base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'operations_stage', round }),
      base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'attack', round }),
    ]);

    const status = activePlayers.map(p => {
      const staging = stagingRecords.find(r => r.player_id === p.id);
      const attack = attackDecisions.find(r => r.player_id === p.id);
      const stagingData = staging?.data ?? emptyStaging();
      const operationsLocked = !!stagingData.locked_at;
      return {
        player_id: p.id,
        display_name: p.display_name,
        operations_locked: operationsLocked,
        locked_at: stagingData.locked_at ?? null,
        military_locked: attack?.is_locked ?? stagingData.military_locked ?? false,
        economic_locked: stagingData.economic_locked ?? false,
        diplomatic_locked: stagingData.diplomatic_locked ?? false,
        economic_projects: (stagingData.economic_staged ?? []).length,
        diplomatic_actions: (stagingData.diplomatic_staged ?? []).length,
      };
    });

    const allLocked = status.every(s => s.operations_locked);
    const lockedCount = status.filter(s => s.operations_locked).length;

    return Response.json({
      success: true,
      all_locked: allLocked,
      locked_count: lockedCount,
      total_players: activePlayers.length,
      players: status,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[operationsLockPhase] Unhandled error:', err?.message ?? err);
    return Response.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
});