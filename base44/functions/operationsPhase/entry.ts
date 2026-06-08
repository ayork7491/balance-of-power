/**
 * operationsPhase — Sprint 4K Operations Phase Expansion
 *
 * Generates Battle Cards through non-attack conflict sources.
 * All generated cards enter the EXISTING battle lifecycle unchanged.
 * Resolution, preferences, auto-resolve, and phase advance are NOT altered.
 *
 * Actions:
 *   getOperationsState       — returns available operations, costs, regional pools, active ops
 *   submitOperation          — validate, spend influence/resources, create BattleCard
 *   getGeneratedCards        — list battle cards generated via operations this round
 *
 * ─── DIPLOMATIC OPERATIONS (influence cost) ────────────────────────────────
 *   incite_rebellion         — 4 influence: generate battle card at target territory
 *   manufactured_crisis      — 4 influence: generate battle card in a region
 *   assassination            — 6 influence: battle card targeting a structure territory
 *   mercenary_action         — 6 influence: battle card with mercenary_flag metadata
 *
 * ─── ECONOMIC OPERATIONS (resource cost, configurable) ─────────────────────
 *   supply_raid              — targets enemy supply route, generates battle card
 *   resource_interdiction    — targets resource hub territory, generates battle card
 *
 * ─── METADATA ONLY ─────────────────────────────────────────────────────────
 *   battle_card_source, source_player_id, source_operation_metadata are set
 *   on the generated BattleCard. They do NOT affect resolution.
 *
 * ─── OBJECTIVE HOOKS ───────────────────────────────────────────────────────
 *   objective_hook field in metadata exposes completion events for:
 *     incite_rebellion, manufactured_crisis, mercenary_action
 *     cause_production_decrease (resource_interdiction)
 *     use_influence_alter_battle (assassination / manufactured_crisis)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATION_COSTS = {
  // Diplomatic (influence)
  incite_rebellion:     { type: 'influence', amount: 4 },
  manufactured_crisis:  { type: 'influence', amount: 4 },
  assassination:        { type: 'influence', amount: 6 },
  mercenary_action:     { type: 'influence', amount: 6 },
  // Economic (gold — configurable per campaign settings, defaults below)
  supply_raid:          { type: 'resource', resource: 'gold', amount: 3 },
  resource_interdiction:{ type: 'resource', resource: 'gold', amount: 3 },
};

const DIPLOMATIC_OPS = new Set(['incite_rebellion', 'manufactured_crisis', 'assassination', 'mercenary_action']);
const ECONOMIC_OPS   = new Set(['supply_raid', 'resource_interdiction']);

// Default tabletop scale reference (troops per full point)
const DEFAULT_AVG_BATTLE_SIZE = 1000;

// ─── Territory → Region mapping (inline) ─────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function spendRegionalInfluence(base44, campaignId, playerId, regionId, amount, round) {
  const existing = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
    campaign_id: campaignId,
    region_id: regionId,
    player_id: playerId,
  });
  const record = existing[0];
  const currentAmount = record?.spendable_influence ?? 0;
  if (currentAmount < amount) {
    throw new Error(`Not enough influence in region '${regionId}'. Have ${currentAmount}, need ${amount}.`);
  }
  const newAmount = currentAmount - amount;
  if (record) {
    await base44.asServiceRole.entities.RegionalInfluencePool.update(record.id, {
      spendable_influence: newAmount,
      last_updated_round: round,
    });
  }
  return newAmount;
}

async function spendPlayerResource(base44, campaignId, playerId, resource, amount, round) {
  const ledgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({
    campaign_id: campaignId,
    player_id: playerId,
  });
  const ledger = ledgers[0];
  const current = ledger?.[resource] ?? 0;
  if (current < amount) {
    throw new Error(`Not enough ${resource}. Have ${current}, need ${amount}.`);
  }
  if (ledger) {
    await base44.asServiceRole.entities.PlayerResourceLedger.update(ledger.id, {
      [resource]: current - amount,
      updated_at_round: round,
    });
  }
  return current - amount;
}

function computeCardScale(totalTroops, avgBattleSize) {
  const scaleFactor = parseFloat(Math.max(totalTroops / avgBattleSize, 1).toFixed(2));
  const tabletopSize = Math.round(totalTroops / scaleFactor);
  return { scaleFactor, tabletopSize };
}

async function log(base44, campaignId, round, eventType, playerId, payload) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase: 'battle',
    round,
    event_type: eventType,
    player_id: playerId ?? null,
    payload,
    is_public: true,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id } = body;
  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  let campaigns, players;
  try {
    [campaigns, players] = await Promise.all([
      base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
      base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
    ]);
  } catch {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const isAdmin = campaign.admin_user_id === user.id;
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

  // ── ACTION: getOperationsState ─────────────────────────────────────────────
  if (action === 'getOperationsState') {
    const [regionalPools, resourceLedgers, supplyRoutes, territoryBuildings, generatedCards] = await Promise.all([
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id, player_id: actingPlayer.id }),
      base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id, player_id: actingPlayer.id }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round }),
    ]);

    const regionPools = {};
    for (const p of regionalPools) regionPools[p.region_id] = p.spendable_influence ?? 0;

    const ledger = resourceLedgers[0] ?? {};
    const resources = {
      gold: ledger.gold ?? 0,
      iron: ledger.iron ?? 0,
      timber: ledger.timber ?? 0,
      stone: ledger.stone ?? 0,
      food: ledger.food ?? 0,
    };

    const myOpCards = generatedCards.filter(
      c => c.source_player_id === actingPlayer.id && c.battle_card_source !== 'military_attack'
    );

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      round,
      region_pools: regionPools,
      resources,
      operation_costs: OPERATION_COSTS,
      supply_routes: supplyRoutes.map(r => ({
        id: r.id,
        hub_territory_id: r.hub_territory_id,
        source_territory_id: r.source_territory_id,
        owner_player_id: r.owner_player_id,
        route_status: r.route_status,
        resource_type: r.resource_type,
      })),
      active_buildings: territoryBuildings
        .filter(b => b.status === 'active')
        .map(b => ({ id: b.id, territory_id: b.territory_id, player_id: b.player_id, building_type: b.building_type, pillar_type: b.pillar_type })),
      operations_this_round: myOpCards.length,
      generated_cards: myOpCards.map(c => ({
        id: c.id,
        battle_card_source: c.battle_card_source,
        target_territory_id: c.target_territory_id,
        status: c.status,
        source_operation_metadata: c.source_operation_metadata ?? {},
      })),
    });
  }

  // ── ACTION: getGeneratedCards ──────────────────────────────────────────────
  if (action === 'getGeneratedCards') {
    const queryRound = body.round ?? round;
    const allCards = await base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: queryRound });
    const opCards = allCards.filter(c => c.battle_card_source && c.battle_card_source !== 'military_attack');
    return Response.json({ success: true, cards: opCards, round: queryRound });
  }

  // ── ACTION: submitOperation ────────────────────────────────────────────────
  if (action === 'submitOperation') {
    const {
      operation_type,
      region_id,
      target_territory_id,
      target_supply_route_id,
      target_resource_hub_territory,
      committed_troops,
    } = body;

    if (!operation_type) {
      return Response.json({ error: 'operation_type is required' }, { status: 400 });
    }

    const costConfig = OPERATION_COSTS[operation_type];
    if (!costConfig) {
      return Response.json({ error: `Unknown operation type: ${operation_type}` }, { status: 400 });
    }

    // ── Validate target territory ────────────────────────────────────────────
    if (!target_territory_id) {
      return Response.json({ error: 'target_territory_id is required' }, { status: 400 });
    }

    const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const targetState = territoryStates.find(s => s.territory_id === target_territory_id);

    // ── Influence-based operations ───────────────────────────────────────────
    if (DIPLOMATIC_OPS.has(operation_type)) {
      if (!region_id) {
        return Response.json({ error: 'region_id is required for diplomatic operations' }, { status: 400 });
      }

      // Validate player has influence in target territory (for incite_rebellion)
      if (operation_type === 'incite_rebellion') {
        const influenceRecords = await base44.asServiceRole.entities.TerritoryInfluence.filter({
          campaign_id,
          territory_id: target_territory_id,
          player_id: actingPlayer.id,
        });
        const influence = influenceRecords[0]?.influence_amount ?? 0;
        if (influence < 1) {
          return Response.json({ error: 'You must have influence in the target territory to incite a rebellion.' }, { status: 400 });
        }
      }

      // Validate structure exists for assassination
      if (operation_type === 'assassination') {
        const buildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
          campaign_id,
          territory_id: target_territory_id,
          status: 'active',
        });
        if (buildings.length === 0) {
          return Response.json({ error: 'Target territory must contain an active building for an assassination operation.' }, { status: 400 });
        }
      }

      // Spend influence
      await spendRegionalInfluence(base44, campaign_id, actingPlayer.id, region_id, costConfig.amount, round);

      // Build operation metadata
      const defenderTroops = targetState?.troop_count ?? 0;
      const operationTroops = committed_troops ?? Math.max(1, Math.round(defenderTroops * 0.5));
      const totalTroops = operationTroops + defenderTroops;
      const avgSize = campaign.settings?.average_battle_size ?? DEFAULT_AVG_BATTLE_SIZE;
      const { scaleFactor, tabletopSize } = computeCardScale(totalTroops, avgSize);

      let metadata = {
        diplomatic_operation_type: operation_type,
        influence_spent: costConfig.amount,
        region_id,
        objective_hook: null,
      };

      if (operation_type === 'incite_rebellion') {
        metadata.objective_hook = 'incite_rebellion';
        metadata.rebellion_narrative = 'Local rebels rise against current control.';
      }
      if (operation_type === 'manufactured_crisis') {
        metadata.target_region = SC_TERRITORY_REGION[target_territory_id] ?? region_id;
        metadata.objective_hook = 'manufactured_crisis';
        metadata.use_influence_alter_battle = true;
      }
      if (operation_type === 'assassination') {
        metadata.objective_hook = 'use_influence_alter_battle';
        metadata.use_influence_alter_battle = true;
        // Store first active building in territory as assassination target
        const buildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
          campaign_id,
          territory_id: target_territory_id,
          status: 'active',
        });
        metadata.target_structure = buildings[0]?.building_type ?? null;
        metadata.target_building_id = buildings[0]?.id ?? null;
      }
      if (operation_type === 'mercenary_action') {
        metadata.mercenary_flag = true;
        metadata.objective_hook = 'mercenary_action';
      }

      // Create the BattleCard
      const card = await base44.asServiceRole.entities.BattleCard.create({
        campaign_id,
        round,
        battle_type: 'siege',
        target_territory_id,
        defender_player_id: targetState?.owner_player_id ?? null,
        defender_troops: defenderTroops,
        attackers: [{
          player_id: actingPlayer.id,
          origin_territory_id: target_territory_id,
          committed_troops: operationTroops,
        }],
        total_attacking_troops: operationTroops,
        total_troops_in_battle: totalTroops,
        scale_factor: scaleFactor,
        tabletop_size: tabletopSize,
        status: 'pending',
        is_mutual: false,
        battle_preferences: {},
        battle_card_source: operation_type,
        source_player_id: actingPlayer.id,
        source_operation_metadata: metadata,
      });

      await log(base44, campaign_id, round, `operation_${operation_type}_generated`, actingPlayer.id, {
        battle_card_id: card.id,
        target_territory_id,
        influence_spent: costConfig.amount,
        region_id,
      });

      return Response.json({
        success: true,
        battle_card_id: card.id,
        operation_type,
        target_territory_id,
        tabletop_size: tabletopSize,
        influence_spent: costConfig.amount,
        message: `${operation_type.replace(/_/g, ' ')} operation generated a battle card at ${target_territory_id}.`,
      });
    }

    // ── Resource-based operations ────────────────────────────────────────────
    if (ECONOMIC_OPS.has(operation_type)) {
      const cost = costConfig.amount;
      const resource = costConfig.resource;

      // Spend resources
      await spendPlayerResource(base44, campaign_id, actingPlayer.id, resource, cost, round);

      const defenderTroops = targetState?.troop_count ?? 0;
      const operationTroops = committed_troops ?? Math.max(1, Math.round(defenderTroops * 0.5));
      const totalTroops = operationTroops + defenderTroops;
      const avgSize = campaign.settings?.average_battle_size ?? DEFAULT_AVG_BATTLE_SIZE;
      const { scaleFactor, tabletopSize } = computeCardScale(totalTroops, avgSize);

      let metadata = {
        resource_spent: cost,
        resource_type: resource,
        objective_hook: null,
      };

      if (operation_type === 'supply_raid') {
        if (!target_supply_route_id) {
          return Response.json({ error: 'target_supply_route_id is required for supply_raid' }, { status: 400 });
        }
        // Validate supply route exists
        const routes = await base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id });
        const route = routes.find(r => r.id === target_supply_route_id);
        if (!route) {
          return Response.json({ error: 'Supply route not found.' }, { status: 404 });
        }
        metadata.target_supply_route_id = target_supply_route_id;
        metadata.supply_route_owner = route.owner_player_id;
        metadata.supply_route_resource = route.resource_type;
      }

      if (operation_type === 'resource_interdiction') {
        const hubTerritory = target_resource_hub_territory ?? target_territory_id;
        const hubBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
          campaign_id,
          territory_id: hubTerritory,
          building_type: 'resource_hub',
          status: 'active',
        });
        if (hubBuildings.length === 0) {
          return Response.json({ error: 'Target territory does not have an active Resource Hub.' }, { status: 400 });
        }
        metadata.target_resource_hub_territory = hubTerritory;
        metadata.resource_hub_id = hubBuildings[0]?.id ?? null;
        metadata.objective_hook = 'cause_production_decrease';
      }

      const card = await base44.asServiceRole.entities.BattleCard.create({
        campaign_id,
        round,
        battle_type: 'siege',
        target_territory_id,
        defender_player_id: targetState?.owner_player_id ?? null,
        defender_troops: defenderTroops,
        attackers: [{
          player_id: actingPlayer.id,
          origin_territory_id: target_territory_id,
          committed_troops: operationTroops,
        }],
        total_attacking_troops: operationTroops,
        total_troops_in_battle: totalTroops,
        scale_factor: scaleFactor,
        tabletop_size: tabletopSize,
        status: 'pending',
        is_mutual: false,
        battle_preferences: {},
        battle_card_source: operation_type,
        source_player_id: actingPlayer.id,
        source_operation_metadata: metadata,
      });

      await log(base44, campaign_id, round, `operation_${operation_type}_generated`, actingPlayer.id, {
        battle_card_id: card.id,
        target_territory_id,
        resource_spent: cost,
      });

      return Response.json({
        success: true,
        battle_card_id: card.id,
        operation_type,
        target_territory_id,
        tabletop_size: tabletopSize,
        resource_spent: cost,
        message: `${operation_type.replace(/_/g, ' ')} operation generated a battle card at ${target_territory_id}.`,
      });
    }

    return Response.json({ error: `Unknown operation type: ${operation_type}` }, { status: 400 });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});