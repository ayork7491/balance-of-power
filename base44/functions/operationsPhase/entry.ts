/**
 * operationsPhase — Sprint 4L v1 Battle Card Operations
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
 *   uprising                 — 4 influence: rebel unrest at target territory (replaces incite_rebellion)
 *   labor_strike             — 4 influence: disrupt resource hub production
 *   tax_protest              — 4 influence: challenge another player's gold in a territory
 *   manufactured_crisis      — 4 influence: engineer conflict in a region
 *
 * ─── ECONOMIC OPERATIONS (resource cost) ───────────────────────────────────
 *   supply_route_establishment — establish a new supply route via battle
 *   supply_route_race          — contest ownership of an existing supply route
 *   supply_raid                — raid enemy territory for stored resources
 *   supply_caravan_escort      — protect or intercept a resource shipment
 *
 * ─── LEGACY COMPATIBILITY ──────────────────────────────────────────────────
 *   incite_rebellion → remapped to uprising
 *   assassination, mercenary_action, resource_interdiction → rejected (deprecated)
 *
 * ─── LIFECYCLE ─────────────────────────────────────────────────────────────
 *   All 8 operation types use the standard BattleCard lifecycle:
 *   generated → preference/setup → tabletop result → approval → resolution/consequences
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATION_COSTS = {
  // Diplomatic (influence)
  uprising:                   { type: 'influence', amount: 4 },
  labor_strike:               { type: 'influence', amount: 4 },
  tax_protest:                { type: 'influence', amount: 4 },
  manufactured_crisis:        { type: 'influence', amount: 4 },
  // Economic (gold)
  supply_route_establishment: { type: 'resource', resource: 'gold', amount: 3 },
  supply_route_race:          { type: 'resource', resource: 'gold', amount: 3 },
  supply_raid:                { type: 'resource', resource: 'gold', amount: 3 },
  supply_caravan_escort:      { type: 'resource', resource: 'gold', amount: 2 },
};

const DIPLOMATIC_OPS = new Set(['uprising', 'labor_strike', 'tax_protest', 'manufactured_crisis']);
const ECONOMIC_OPS   = new Set(['supply_route_establishment', 'supply_route_race', 'supply_raid', 'supply_caravan_escort']);

// Legacy alias: incite_rebellion → uprising
const LEGACY_ALIASES = { incite_rebellion: 'uprising' };

// Deprecated types that should no longer generate cards
const DEPRECATED_OPS = new Set(['assassination', 'mercenary_action', 'resource_interdiction']);

// Default tabletop scale reference
const DEFAULT_AVG_BATTLE_SIZE = 1000;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function spendRegionalInfluence(base44, campaignId, playerId, regionId, amount, round) {
  const existing = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
    campaign_id: campaignId, region_id: regionId, player_id: playerId,
  });
  const record = existing[0];
  const current = record?.spendable_influence ?? 0;
  if (current < amount) {
    throw new Error(`Not enough influence in region '${regionId}'. Have ${current}, need ${amount}.`);
  }
  if (record) {
    await base44.asServiceRole.entities.RegionalInfluencePool.update(record.id, {
      spendable_influence: current - amount, last_updated_round: round,
    });
  }
  return current - amount;
}

async function spendPlayerResource(base44, campaignId, playerId, resource, amount, round) {
  const ledgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({
    campaign_id: campaignId, player_id: playerId,
  });
  const ledger = ledgers[0];
  const current = ledger?.[resource] ?? 0;
  if (current < amount) {
    throw new Error(`Not enough ${resource}. Have ${current}, need ${amount}.`);
  }
  if (ledger) {
    await base44.asServiceRole.entities.PlayerResourceLedger.update(ledger.id, {
      [resource]: current - amount, updated_at_round: round,
    });
  }
  return current - amount;
}

function computeCardScale(totalTroops, avgBattleSize) {
  const scaleFactor = parseFloat(Math.max(totalTroops / avgBattleSize, 1).toFixed(2));
  const tabletopSize = Math.round(totalTroops / scaleFactor);
  return { scaleFactor, tabletopSize };
}

async function logOp(base44, campaignId, round, eventType, playerId, payload) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId, phase: 'battle', round,
    event_type: eventType, player_id: playerId ?? null, payload, is_public: true,
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

  const [campaigns, players] = await Promise.all([
    base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
    base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
  ]);
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
        battle_type: c.battle_type,
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
    let {
      operation_type,
      region_id,
      target_territory_id,
      target_supply_route_id,
      committed_troops,
      declared_resource_type,
      // caravan escort fields
      shipment_contents,
      shipment_destination,
      // tax protest
      gold_transfer_amount,
      // manufactured crisis
      territory_b_id,
    } = body;

    if (!operation_type) {
      return Response.json({ error: 'operation_type is required' }, { status: 400 });
    }

    // ── Legacy alias: incite_rebellion → uprising ────────────────────────────
    if (LEGACY_ALIASES[operation_type]) {
      operation_type = LEGACY_ALIASES[operation_type];
    }

    // ── Reject deprecated operation types ────────────────────────────────────
    if (DEPRECATED_OPS.has(operation_type)) {
      return Response.json({
        error: `Operation type '${operation_type}' has been deprecated and no longer generates battle cards. Use the v1 operation types instead.`,
      }, { status: 400 });
    }

    const costConfig = OPERATION_COSTS[operation_type];
    if (!costConfig) {
      return Response.json({ error: `Unknown operation type: ${operation_type}` }, { status: 400 });
    }

    if (!target_territory_id) {
      return Response.json({ error: 'target_territory_id is required' }, { status: 400 });
    }

    const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const targetState = territoryStates.find(s => s.territory_id === target_territory_id);
    const avgSize = campaign.settings?.average_battle_size ?? DEFAULT_AVG_BATTLE_SIZE;

    // ── DIPLOMATIC OPERATIONS ─────────────────────────────────────────────────
    if (DIPLOMATIC_OPS.has(operation_type)) {
      if (!region_id) {
        return Response.json({ error: 'region_id is required for diplomatic operations' }, { status: 400 });
      }

      // Spend influence
      await spendRegionalInfluence(base44, campaign_id, actingPlayer.id, region_id, costConfig.amount, round);

      const defenderPlayerId = targetState?.owner_player_id ?? null;
      const garrisonTroops = targetState?.troop_count ?? 0;

      // Uprising troop math: 30% of garrison enters battle
      //   rebels (diplomat/attacker) = 10%, loyalists (defender) = 20%
      //   Both deducted from territory garrison at card generation time
      let diplomatTroops, actualDefenderTroops;
      if (operation_type === 'uprising') {
        diplomatTroops = committed_troops ?? Math.max(1, Math.floor(garrisonTroops * 0.10));
        actualDefenderTroops = Math.max(1, Math.floor(garrisonTroops * 0.20));
        const battleForce = diplomatTroops + actualDefenderTroops;
        const remainingGarrison = Math.max(0, garrisonTroops - battleForce);
        if (targetState) {
          await base44.asServiceRole.entities.TerritoryState.update(targetState.id, { troop_count: remainingGarrison });
        }
      } else {
        diplomatTroops = committed_troops ?? Math.max(1, Math.round(garrisonTroops * 0.3));
        actualDefenderTroops = garrisonTroops;
      }
      const defenderTroops = actualDefenderTroops;
      const totalTroops = diplomatTroops + defenderTroops;
      const { scaleFactor, tabletopSize } = computeCardScale(Math.max(totalTroops, 2), avgSize);

      let battleType = operation_type; // uprising, labor_strike, tax_protest, manufactured_crisis
      let metadata = {
        influence_spent: costConfig.amount,
        region_id,
        diplomat_committed_troops: diplomatTroops,
        troop_loss_basis: defenderTroops,
        garrison_before_battle: garrisonTroops,
        influence_reward_target: region_id,
        objective_hook: operation_type,
      };

      // Operation-specific metadata
      if (operation_type === 'uprising') {
        // Diplomat attacks territory to incite revolt
        metadata.rebellion_narrative = 'Local rebels rise against current control.';
      }
      if (operation_type === 'labor_strike') {
        // Targets a resource hub territory
        metadata.target_resource_hub = target_territory_id;
      }
      if (operation_type === 'tax_protest') {
        // Targets a player's gold; diplomat is the defender role
        metadata.gold_transfer_amount = gold_transfer_amount ?? Math.max(1, Math.round((defenderTroops ?? 1) * 1));
        metadata.taxed_player_id = defenderPlayerId;
      }
      if (operation_type === 'manufactured_crisis') {
        metadata.target_region = SC_TERRITORY_REGION[target_territory_id] ?? region_id;
        metadata.use_influence_alter_battle = true;
        if (territory_b_id) {
          metadata.territory_b_id = territory_b_id;
          const stateB = territoryStates.find(s => s.territory_id === territory_b_id);
          metadata.territory_b_player_id = stateB?.owner_player_id ?? null;
        }
      }

      // Tax protest: diplomat is the "defender" — the taxed player's forces attack
      // All others: diplomat is the attacker
      let attackers, cardDefenderPlayerId, cardDefenderTroops;
      if (operation_type === 'tax_protest') {
        // Taxed player attacks the protest; diplomat defends
        attackers = [{
          player_id: defenderPlayerId ?? actingPlayer.id,
          origin_territory_id: target_territory_id,
          committed_troops: defenderTroops,
        }];
        cardDefenderPlayerId = actingPlayer.id;
        cardDefenderTroops = diplomatTroops;
      } else {
        attackers = [{
          player_id: actingPlayer.id,
          origin_territory_id: target_territory_id,
          committed_troops: diplomatTroops,
        }];
        cardDefenderPlayerId = defenderPlayerId;
        cardDefenderTroops = defenderTroops;
      }

      const card = await base44.asServiceRole.entities.BattleCard.create({
        campaign_id,
        round,
        battle_type: battleType,
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
        battle_card_source: operation_type,
        source_player_id: actingPlayer.id,
        source_operation_metadata: metadata,
      });

      await logOp(base44, campaign_id, round, `operation_${operation_type}_generated`, actingPlayer.id, {
        battle_card_id: card.id, target_territory_id, influence_spent: costConfig.amount, region_id,
      });

      return Response.json({
        success: true,
        battle_card_id: card.id,
        operation_type,
        battle_type: battleType,
        target_territory_id,
        tabletop_size: tabletopSize,
        influence_spent: costConfig.amount,
        message: `${operation_type.replace(/_/g, ' ')} generated a battle card at ${target_territory_id}.`,
      });
    }

    // ── ECONOMIC OPERATIONS ────────────────────────────────────────────────────
    if (ECONOMIC_OPS.has(operation_type)) {
      const cost = costConfig.amount;
      const resource = costConfig.resource;

      await spendPlayerResource(base44, campaign_id, actingPlayer.id, resource, cost, round);

      const defenderTroops = targetState?.troop_count ?? 0;
      const operationTroops = committed_troops ?? Math.max(1, Math.round(Math.max(defenderTroops, 1) * 0.5));
      const totalTroops = operationTroops + defenderTroops;
      const { scaleFactor, tabletopSize } = computeCardScale(Math.max(totalTroops, 2), avgSize);

      let metadata = {
        invested_gold: cost,
        resource_type: resource,
        objective_hook: operation_type,
      };

      if (operation_type === 'supply_route_establishment') {
        metadata.route_target_territory = target_territory_id;
        metadata.route_cooldown_until_round = round + 2;
        if (target_supply_route_id) metadata.supply_route_id = target_supply_route_id;
      }

      if (operation_type === 'supply_route_race') {
        if (!target_supply_route_id) {
          return Response.json({ error: 'target_supply_route_id is required for supply_route_race' }, { status: 400 });
        }
        const routes = await base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id });
        const route = routes.find(r => r.id === target_supply_route_id);
        if (!route) {
          return Response.json({ error: 'Supply route not found.' }, { status: 404 });
        }
        metadata.supply_route_id = target_supply_route_id;
        metadata.supply_route_owner = route.owner_player_id;
        metadata.supply_route_resource = route.resource_type;
        metadata.route_cooldown_until_round = round + 2;
      }

      if (operation_type === 'supply_raid') {
        if (!declared_resource_type) {
          return Response.json({ error: 'declared_resource_type is required for supply_raid' }, { status: 400 });
        }
        metadata.declared_resource_type = declared_resource_type;
        metadata.target_resource_hub = target_territory_id;
      }

      if (operation_type === 'supply_caravan_escort') {
        if (!shipment_destination) {
          return Response.json({ error: 'shipment_destination is required for supply_caravan_escort' }, { status: 400 });
        }
        metadata.shipment_origin = target_territory_id;
        metadata.shipment_destination = shipment_destination;
        metadata.shipment_contents = shipment_contents ?? {};
      }

      const card = await base44.asServiceRole.entities.BattleCard.create({
        campaign_id,
        round,
        battle_type: operation_type,
        battle_pillar: 'economic',
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

      await logOp(base44, campaign_id, round, `operation_${operation_type}_generated`, actingPlayer.id, {
        battle_card_id: card.id, target_territory_id, resource_spent: cost,
      });

      return Response.json({
        success: true,
        battle_card_id: card.id,
        operation_type,
        battle_type: operation_type,
        target_territory_id,
        tabletop_size: tabletopSize,
        resource_spent: cost,
        message: `${operation_type.replace(/_/g, ' ')} generated a battle card at ${target_territory_id}.`,
      });
    }

    return Response.json({ error: `Unknown operation type: ${operation_type}` }, { status: 400 });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});