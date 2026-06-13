/**
 * diplomaticPhase — Sprint 4H Diplomatic Actions Framework
 *
 * Actions:
 *   getDiplomaticState       — returns actions remaining, active effects, regional pools for a player
 *   submitAction             — validate + spend spendable influence + create DiplomaticAction record
 *   getActiveEffects         — returns all active DiplomaticAction records for a campaign
 *   expireRoundEffects       — admin: marks single-round effects as expired at round end
 *
 * Action types and costs:
 *   war_rations          — 2 influence: reduce food upkeep modifier for this round
 *   influence_network    — 2 influence: +1 permanent influence to all territories adjacent to target
 *   merchant_convoy      — 2 influence: protect a supply route from disruption
 *   non_aggression_pact  — 4 influence: target player cannot attack you for 1 round
 *   broker_peace         — 4 influence: negate battle generation at target territory this round
 *   coalition_warfare    — 6 influence: record forced troop contribution from target player
 *   power_broker         — 6 influence: create non-aggression pact between two other players
 *
 * INVARIANT: Only Spendable Influence is spent. Permanent Influence is NEVER reduced.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_COSTS = {
  war_rations:         2,
  influence_network:   2,
  merchant_convoy:     2,
  non_aggression_pact: 4,
  broker_peace:        4,
  coalition_warfare:   6,
  power_broker:        6,
};

const BASE_DIPLOMATIC_ACTIONS = 1;

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

// ─── Adjacency ────────────────────────────────────────────────────────────────
const SC_ADJACENCY_TYPED = [
  {from:'I8',to:'I4'},{from:'I4',to:'I3'},{from:'I4',to:'I7'},{from:'I6',to:'I3'},
  {from:'I6',to:'I5'},{from:'I6',to:'I7'},{from:'I1',to:'I2'},{from:'I1',to:'I5'},
  {from:'I2',to:'I3'},{from:'I2',to:'I5'},{from:'I6',to:'B1'},{from:'I7',to:'B1'},
  {from:'I7',to:'B3'},{from:'I8',to:'C1'},{from:'W1',to:'W2'},{from:'W2',to:'W3'},
  {from:'W2',to:'W4'},{from:'W2',to:'W5'},{from:'W3',to:'W5'},{from:'W3',to:'W6'},
  {from:'W4',to:'W5'},{from:'W4',to:'W7'},{from:'W5',to:'W6'},{from:'W5',to:'W7'},
  {from:'W5',to:'W8'},{from:'W6',to:'W9'},{from:'W7',to:'W8'},{from:'W8',to:'W9'},
  {from:'W7',to:'S1'},{from:'W9',to:'S2'},{from:'B1',to:'B3'},{from:'B1',to:'B2'},
  {from:'B3',to:'B2'},{from:'B3',to:'B4'},{from:'B2',to:'B4'},{from:'B2',to:'B5'},
  {from:'B2',to:'B6'},{from:'B4',to:'B7'},{from:'B5',to:'B6'},{from:'B5',to:'B8'},
  {from:'B6',to:'B7'},{from:'B6',to:'B8'},{from:'B6',to:'B9'},{from:'B7',to:'B10'},
  {from:'B8',to:'B9'},{from:'B9',to:'B10'},{from:'B10',to:'C6'},{from:'B10',to:'C4'},
  {from:'B10',to:'S3'},{from:'S1',to:'S2'},{from:'S1',to:'S4'},{from:'S4',to:'S5'},
  {from:'S4',to:'S7'},{from:'S7',to:'S5'},{from:'S7',to:'S8'},{from:'S2',to:'S3'},
  {from:'S2',to:'S5'},{from:'S5',to:'S8'},{from:'S5',to:'S6'},{from:'S3',to:'S6'},
  {from:'S6',to:'S9'},{from:'S6',to:'C8'},{from:'S9',to:'C8'},{from:'C1',to:'C2'},
  {from:'C2',to:'C3'},{from:'C3',to:'C4'},{from:'C3',to:'C5'},{from:'C4',to:'C5'},
  {from:'C4',to:'C6'},{from:'C5',to:'C6'},{from:'C5',to:'C7'},{from:'C6',to:'C7'},
  {from:'C6',to:'C8'},{from:'C7',to:'C8'},
];

function buildAdjacency() {
  const adj = {};
  for (const { from, to } of SC_ADJACENCY_TYPED) {
    if (!adj[from]) adj[from] = [];
    if (!adj[to])   adj[to]   = [];
    adj[from].push(to);
    adj[to].push(from);
  }
  return adj;
}
const ADJ = buildAdjacency();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Count how many diplomatic actions a player has used this round already.
 */
async function getActionsUsed(base44, campaignId, playerId, round) {
  const existing = await base44.asServiceRole.entities.DiplomaticAction.filter({
    campaign_id: campaignId,
    player_id: playerId,
    round,
  });
  return existing.filter(a => a.status !== 'cancelled').length;
}

/**
 * Count Council Chamber buildings for a player (each gives +1 diplomatic action).
 */
async function getCouncilChambers(base44, campaignId, playerId) {
  const buildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
    campaign_id: campaignId,
    player_id: playerId,
    building_type: 'council_chamber',
    status: 'active',
  });
  return buildings.length;
}

/**
 * Spend spendable influence from a region pool for a player.
 * Returns new total, throws if insufficient.
 */
async function spendRegionalInfluence(base44, campaignId, playerId, regionId, amount, round) {
  const existing = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
    campaign_id: campaignId,
    region_id: regionId,
    player_id: playerId,
  });
  const record = existing[0];
  const currentAmount = record?.spendable_influence ?? 0;
  if (currentAmount < amount) {
    throw new Error(`Not enough influence in this region. Have ${currentAmount}, need ${amount}.`);
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

/**
 * Add permanent influence to a territory (Influence Network spread).
 * Never creates spendable influence.
 */
async function addPermanentInfluenceOnly(base44, campaignId, playerId, territoryId, amount, round) {
  const existing = await base44.asServiceRole.entities.TerritoryInfluence.filter({
    campaign_id: campaignId,
    territory_id: territoryId,
    player_id: playerId,
  });
  const record = existing[0];
  if (record) {
    const newAmount = Math.max(0, (record.influence_amount ?? 0) + amount);
    await base44.asServiceRole.entities.TerritoryInfluence.update(record.id, {
      influence_amount: newAmount,
      last_updated_round: round,
      source: 'influence_network',
    });
    return newAmount;
  } else {
    const newAmount = Math.max(0, amount);
    await base44.asServiceRole.entities.TerritoryInfluence.create({
      campaign_id: campaignId,
      territory_id: territoryId,
      player_id: playerId,
      influence_amount: newAmount,
      last_updated_round: round,
      source: 'influence_network',
    });
    return newAmount;
  }
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

  // ── ACTION: getDiplomaticState ─────────────────────────────────────────────
  if (action === 'getDiplomaticState') {
    const [councilChambers, actionsThisRound, regionalPools, activeEffects] = await Promise.all([
      getCouncilChambers(base44, campaign_id, actingPlayer.id),
      getActionsUsed(base44, campaign_id, actingPlayer.id, round),
      base44.asServiceRole.entities.RegionalInfluencePool.filter({
        campaign_id,
        player_id: actingPlayer.id,
      }),
      base44.asServiceRole.entities.DiplomaticAction.filter({
        campaign_id,
        round,
      }),
    ]);

    const maxActions = BASE_DIPLOMATIC_ACTIONS + councilChambers;
    const actionsRemaining = Math.max(0, maxActions - actionsThisRound);

    const regionPools = {};
    for (const pool of regionalPools) {
      regionPools[pool.region_id] = pool.spendable_influence ?? 0;
    }

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      round,
      max_actions: maxActions,
      actions_used: actionsThisRound,
      actions_remaining: actionsRemaining,
      council_chambers: councilChambers,
      region_pools: regionPools,
      active_effects: activeEffects,
      action_costs: ACTION_COSTS,
    });
  }

  // ── ACTION: getActiveEffects ───────────────────────────────────────────────
  if (action === 'getActiveEffects') {
    const effects = await base44.asServiceRole.entities.DiplomaticAction.filter({
      campaign_id,
    });
    const active = effects.filter(e => e.status === 'active' || e.status === 'pending');
    return Response.json({ success: true, effects: active });
  }

  // ── ACTION: submitAction ───────────────────────────────────────────────────
  if (action === 'submitAction') {
    const {
      action_type,
      region_id,
      target_territory_id,
      target_player_id,
      target_player_b_id,
      target_supply_route_id,
      submission_id: actionSubmissionId,
    } = body;

    if (!action_type) return Response.json({ error: 'action_type is required' }, { status: 400 });
    if (!region_id)   return Response.json({ error: 'region_id is required' }, { status: 400 });

    const cost = ACTION_COSTS[action_type];
    if (cost === undefined) {
      return Response.json({ error: `Unknown action type: ${action_type}` }, { status: 400 });
    }

    // Check action capacity
    const [councilChambers, actionsUsed] = await Promise.all([
      getCouncilChambers(base44, campaign_id, actingPlayer.id),
      getActionsUsed(base44, campaign_id, actingPlayer.id, round),
    ]);
    const maxActions = BASE_DIPLOMATIC_ACTIONS + councilChambers;
    if (actionsUsed >= maxActions) {
      return Response.json({
        error: 'No diplomatic actions remaining this round.',
        actions_used: actionsUsed,
        max_actions: maxActions,
      }, { status: 400 });
    }

    // Validate regional influence
    const pools = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
      campaign_id,
      region_id,
      player_id: actingPlayer.id,
    });
    const currentSpendable = pools[0]?.spendable_influence ?? 0;
    if (currentSpendable < cost) {
      return Response.json({
        error: `Not enough influence in this region. Have ${currentSpendable}, need ${cost}.`,
        have: currentSpendable,
        need: cost,
        region_id,
      }, { status: 400 });
    }

    // Action-specific validation
    if (action_type === 'influence_network' && !target_territory_id) {
      return Response.json({ error: 'target_territory_id is required for Influence Network' }, { status: 400 });
    }
    if (action_type === 'merchant_convoy' && !target_supply_route_id) {
      return Response.json({ error: 'target_supply_route_id is required for Merchant Convoy' }, { status: 400 });
    }
    if (['non_aggression_pact', 'coalition_warfare'].includes(action_type) && !target_player_id) {
      return Response.json({ error: 'target_player_id is required for this action' }, { status: 400 });
    }
    if (action_type === 'power_broker' && (!target_player_id || !target_player_b_id)) {
      return Response.json({ error: 'target_player_id and target_player_b_id are required for Power Broker' }, { status: 400 });
    }
    if (action_type === 'broker_peace' && !target_territory_id) {
      return Response.json({ error: 'target_territory_id is required for Broker Peace' }, { status: 400 });
    }
    if (['non_aggression_pact', 'coalition_warfare', 'power_broker'].includes(action_type) && target_player_id) {
      const targetP = players.find(p => p.id === target_player_id);
      if (!targetP) return Response.json({ error: 'Invalid target_player_id' }, { status: 400 });
      if (target_player_id === actingPlayer.id) {
        return Response.json({ error: 'Cannot target yourself' }, { status: 400 });
      }
    }
    if (action_type === 'power_broker' && target_player_b_id) {
      const targetB = players.find(p => p.id === target_player_b_id);
      if (!targetB) return Response.json({ error: 'Invalid target_player_b_id' }, { status: 400 });
      if (target_player_b_id === actingPlayer.id) {
        return Response.json({ error: 'Cannot target yourself' }, { status: 400 });
      }
      if (target_player_b_id === target_player_id) {
        return Response.json({ error: 'target_player_b_id must be different from target_player_id' }, { status: 400 });
      }
    }

    // ── Idempotency: submission_id dedup — check before spending influence ────
    if (actionSubmissionId) {
      const existingActions = await base44.asServiceRole.entities.DiplomaticAction.filter({
        campaign_id, round, player_id: actingPlayer.id, action_type,
      });
      const dup = existingActions.find(a => a.effect_metadata?.submission_id === actionSubmissionId);
      if (dup) {
        return Response.json({ success: true, action_id: dup.id, idempotent: true, message: `${action_type} already submitted.` });
      }
    }

    // Spend the influence (ONLY spendable — permanent is never touched)
    await spendRegionalInfluence(base44, campaign_id, actingPlayer.id, region_id, cost, round);

    // Build effect metadata and expires_round based on action type
    let effectMetadata = {};
    let expiresRound = round; // default: expires end of current round

    if (action_type === 'war_rations') {
      effectMetadata = { food_upkeep_reduction: true, applied_round: round };
    }

    if (action_type === 'influence_network') {
      // Spread +1 permanent influence to all territories adjacent to target (no spendable created)
      const neighbors = ADJ[target_territory_id] ?? [];
      const spreadResults = [];
      for (const neighborId of neighbors) {
        const regionForNeighbor = SC_TERRITORY_REGION[neighborId];
        // Only spread to territories in the same or any region — no restriction
        const newTotal = await addPermanentInfluenceOnly(
          base44, campaign_id, actingPlayer.id, neighborId, 1, round
        );
        spreadResults.push({ territory_id: neighborId, new_total: newTotal, region: regionForNeighbor });
      }
      effectMetadata = {
        source_territory: target_territory_id,
        territories_affected: spreadResults.map(r => r.territory_id),
        spread_count: spreadResults.length,
        results: spreadResults,
      };
    }

    if (action_type === 'merchant_convoy') {
      effectMetadata = { protected_route_id: target_supply_route_id, disruption_blocked: true };
    }

    if (action_type === 'non_aggression_pact') {
      expiresRound = round + 1; // lasts until end of next round
      effectMetadata = {
        issuer_player_id: actingPlayer.id,
        protected_player_id: actingPlayer.id,
        restricted_player_id: target_player_id,
        duration: 1,
      };
    }

    if (action_type === 'broker_peace') {
      effectMetadata = {
        protected_territory_id: target_territory_id,
        battle_negated: false, // applied if battle generation occurs
      };
    }

    if (action_type === 'coalition_warfare') {
      effectMetadata = {
        issuer_player_id: actingPlayer.id,
        coerced_player_id: target_player_id,
        battle_territory_id: target_territory_id ?? null,
        contribution_pending: true,
      };
    }

    if (action_type === 'power_broker') {
      expiresRound = round + 1;
      effectMetadata = {
        issuer_player_id: actingPlayer.id,
        player_a_id: target_player_id,
        player_b_id: target_player_b_id,
        duration: 1,
        pact_type: 'non_aggression',
      };
    }

    // Create the DiplomaticAction record — include submission_id for audit traceability
    const record = await base44.asServiceRole.entities.DiplomaticAction.create({
      campaign_id,
      round,
      player_id: actingPlayer.id,
      action_type,
      region_id,
      influence_spent: cost,
      status: 'active',
      expires_round: expiresRound,
      target_player_id: target_player_id ?? null,
      target_player_b_id: target_player_b_id ?? null,
      target_territory_id: target_territory_id ?? null,
      target_supply_route_id: target_supply_route_id ?? null,
      effect_metadata: { ...effectMetadata, submission_id: actionSubmissionId ?? null },
    });

    return Response.json({
      success: true,
      action_id: record.id,
      action_type,
      player_id: actingPlayer.id,
      region_id,
      influence_spent: cost,
      expires_round: expiresRound,
      effect_metadata: effectMetadata,
      message: `${action_type.replace(/_/g, ' ')} action submitted successfully.`,
    });
  }

  // ── ACTION: expireRoundEffects (admin only) ────────────────────────────────
  // Expires all DiplomaticAction records whose expires_round <= current round
  if (action === 'expireRoundEffects') {
    if (!isAdmin) return Response.json({ error: 'Admin only action' }, { status: 403 });

    const allEffects = await base44.asServiceRole.entities.DiplomaticAction.filter({ campaign_id });
    const toExpire = allEffects.filter(
      e => e.status === 'active' && e.expires_round != null && e.expires_round <= round
    );

    for (const effect of toExpire) {
      await base44.asServiceRole.entities.DiplomaticAction.update(effect.id, { status: 'expired' });
    }

    return Response.json({
      success: true,
      round,
      expired_count: toExpire.length,
      expired_ids: toExpire.map(e => e.id),
    });
  }

  // ── ACTION: proposeTradeConsolidation ─────────────────────────────────────
  // Creates a trade_proposal DiplomaticAction record with full asset metadata.
  if (action === 'proposeTradeConsolidation') {
    const { target_player_id, offer, request: requestAssets, submission_id: tradeSubmissionId } = body;
    if (!target_player_id) return Response.json({ error: 'target_player_id is required' }, { status: 400 });
    if (target_player_id === actingPlayer.id) return Response.json({ error: 'Cannot trade with yourself' }, { status: 400 });
    const targetPlayer = players.find(p => p.id === target_player_id);
    if (!targetPlayer) return Response.json({ error: 'Invalid target_player_id' }, { status: 400 });
    if (!offer) return Response.json({ error: 'offer is required' }, { status: 400 });

    // Validate offered resources: each is an array of { territory_id, amount }
    const offerResources = offer.resources ?? {}; // { resource: [{ territory_id, amount }] }
    const allStatesForValidation = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    for (const [resource, lines] of Object.entries(offerResources)) {
      for (const line of (lines ?? [])) {
        if (!line.territory_id || !(line.amount > 0)) continue;
        const ts = allStatesForValidation.find(s => s.territory_id === line.territory_id && s.owner_player_id === actingPlayer.id);
        if (!ts) return Response.json({ error: `You do not own territory ${line.territory_id}.` }, { status: 400 });
        const avail = ts.resource_storage?.[resource] ?? 0;
        if (avail < line.amount) return Response.json({ error: `Not enough ${resource} at ${line.territory_id} (have ${avail}, offering ${line.amount}).` }, { status: 400 });
      }
    }

    // Validate offered influence
    const offerInfluence = offer.influence ?? {};
    for (const [regionId, v] of Object.entries(offerInfluence)) {
      if (v > 0) {
        const pools = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
          campaign_id, region_id: regionId, player_id: actingPlayer.id,
        });
        const have = pools[0]?.spendable_influence ?? 0;
        if (have < v) return Response.json({ error: `Not enough influence in ${regionId}. Have ${have}, offering ${v}.` }, { status: 400 });
      }
    }

    // Validate offered troops
    const offerTroops = offer.troops;
    if (offerTroops?.territory_id && (offerTroops.amount ?? 0) > 0) {
      const states = await base44.asServiceRole.entities.TerritoryState.filter({
        campaign_id, territory_id: offerTroops.territory_id,
      });
      const ts = states[0];
      if (!ts || ts.owner_player_id !== actingPlayer.id) {
        return Response.json({ error: 'You do not own that territory.' }, { status: 400 });
      }
      if ((ts.troop_count ?? 0) < offerTroops.amount) {
        return Response.json({ error: `Not enough troops. Have ${ts.troop_count ?? 0}, offering ${offerTroops.amount}.` }, { status: 400 });
      }
    }

    // ── Idempotency: submission_id dedup ──────────────────────────────────────
    if (tradeSubmissionId) {
      const existingProposals = await base44.asServiceRole.entities.DiplomaticAction.filter({
        campaign_id, round, player_id: actingPlayer.id, action_type: 'trade_proposal',
      });
      const dup = existingProposals.find(p => p.effect_metadata?.submission_id === tradeSubmissionId);
      if (dup) {
        return Response.json({ success: true, proposal_id: dup.id, idempotent: true, message: 'Trade proposal already submitted.' });
      }
    }

    const record = await base44.asServiceRole.entities.DiplomaticAction.create({
      campaign_id,
      round,
      player_id: actingPlayer.id,
      action_type: 'trade_proposal',
      region_id: 'trade',
      influence_spent: 0,
      status: 'pending',
      target_player_id,
      effect_metadata: { offer, request: requestAssets ?? {}, submission_id: tradeSubmissionId ?? null },
    });

    return Response.json({ success: true, proposal_id: record.id, message: 'Trade proposal sent.' });
  }

  // ── ACTION: resolveTradeConsolidation ─────────────────────────────────────
  // Accepts or declines a trade_proposal. On accept: transfers territory-stored resources.
  // receiver_payment is required on accept — receiver chooses source territories/regions privately.
  if (action === 'resolveTradeConsolidation') {
    const { proposal_id, resolution, receiver_payment, submission_id: resolveSubmissionId } = body;
    if (!proposal_id) return Response.json({ error: 'proposal_id is required' }, { status: 400 });
    if (!['accept', 'decline'].includes(resolution)) return Response.json({ error: 'resolution must be accept or decline' }, { status: 400 });

    const proposals = await base44.asServiceRole.entities.DiplomaticAction.filter({ id: proposal_id, campaign_id });
    const proposal = proposals[0];
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });
    if (proposal.action_type !== 'trade_proposal') return Response.json({ error: 'Not a trade proposal' }, { status: 400 });
    // Idempotency: already resolved — return the same result quietly
    if (proposal.status !== 'pending') {
      if (resolveSubmissionId && proposal.effect_metadata?.resolve_submission_id === resolveSubmissionId) {
        return Response.json({ success: true, idempotent: true, message: `Trade already ${proposal.status}.` });
      }
      return Response.json({ error: `Proposal is already ${proposal.status}` }, { status: 400 });
    }

    // Only target player (or admin) can accept/decline
    if (proposal.target_player_id !== actingPlayer.id && !isAdmin) {
      return Response.json({ error: 'Only the recipient can accept or decline this proposal' }, { status: 403 });
    }

    if (resolution === 'decline') {
      await base44.asServiceRole.entities.DiplomaticAction.update(proposal.id, {
        status: 'cancelled',
        effect_metadata: { ...(proposal.effect_metadata ?? {}), resolve_submission_id: resolveSubmissionId ?? null },
      });
      return Response.json({ success: true, message: 'Trade proposal declined.' });
    }

    // ── Accept ─────────────────────────────────────────────────────────────
    const meta = proposal.effect_metadata ?? {};
    const offerAssets   = meta.offer   ?? {};
    const requestAssets = meta.request ?? {};

    const proposerId = proposal.player_id;
    const acceptorId = actingPlayer.id;

    // Re-fetch live territory states for accurate balances (stale snapshot risk)
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    // Build mutable in-memory deltas to validate ALL transfers before writing any
    // delta[territory_id][resource] = signed change amount
    const resourceDelta = {};   // territory → resource → net change
    const troopDelta    = {};   // territory → net troop change
    // Influence delta: player → region → net change
    const influenceDelta = {};  // `${playerId}|${region}` → net change

    function applyResourceDelta(tid, resource, amount) {
      if (!resourceDelta[tid]) resourceDelta[tid] = {};
      resourceDelta[tid][resource] = (resourceDelta[tid][resource] ?? 0) + amount;
    }
    function applyTroopDelta(tid, amount) {
      troopDelta[tid] = (troopDelta[tid] ?? 0) + amount;
    }
    function applyInfluenceDelta(playerId, region, amount) {
      const key = `${playerId}|${region}`;
      influenceDelta[key] = (influenceDelta[key] ?? 0) + amount;
    }

    const receiver_destinations = body.receiver_destinations ?? {};

    // ── Phase 1: DRY-RUN — accumulate all deltas, check validity, write nothing ─

    const validationErrors = [];

    // Helper: get current resource value with in-flight deltas applied
    function effectiveResource(tid, resource) {
      const ts = allTerritoryStates.find(s => s.territory_id === tid);
      const base = (ts?.resource_storage ?? {})[resource] ?? 0;
      return base + (resourceDelta[tid]?.[resource] ?? 0);
    }
    function effectiveTroops(tid) {
      const ts = allTerritoryStates.find(s => s.territory_id === tid);
      return (ts?.troop_count ?? 0) + (troopDelta[tid] ?? 0);
    }
    async function effectiveInfluence(playerId, region) {
      const pools = await base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id, region_id: region, player_id: playerId });
      return (pools[0]?.spendable_influence ?? 0) + (influenceDelta[`${playerId}|${region}`] ?? 0);
    }

    // 1a. Offered resources: proposer → receiver
    const offerResourceLines = offerAssets.resources ?? {};
    for (const [resource, lines] of Object.entries(offerResourceLines)) {
      for (const line of (Array.isArray(lines) ? lines : [lines])) {
        if (!(line?.amount > 0)) continue;
        const srcTid  = line.source_territory ?? line.territory_id;
        const destTid = receiver_destinations?.resources?.[resource];
        if (!srcTid)  { validationErrors.push(`Offer for ${resource} missing source territory.`); continue; }
        if (!destTid) { validationErrors.push(`Receiver must specify destination territory for ${resource}.`); continue; }
        const srcTs  = allTerritoryStates.find(s => s.territory_id === srcTid);
        const destTs = allTerritoryStates.find(s => s.territory_id === destTid);
        if (!srcTs || srcTs.owner_player_id !== proposerId) { validationErrors.push(`${srcTid} is not owned by proposer.`); continue; }
        if (!destTs || destTs.owner_player_id !== acceptorId) { validationErrors.push(`Destination ${destTid} for ${resource} must be receiver's territory.`); continue; }
        const avail = effectiveResource(srcTid, resource);
        if (avail < line.amount) { validationErrors.push(`Not enough ${resource} at ${srcTid} (have ${avail}, need ${line.amount}).`); continue; }
        applyResourceDelta(srcTid, resource, -line.amount);
        applyResourceDelta(destTid, resource, +line.amount);
      }
    }

    // 1b. Receiver payment resources: acceptor → proposer
    if (receiver_payment?.resources) {
      for (const [resource, lines] of Object.entries(receiver_payment.resources)) {
        for (const line of (Array.isArray(lines) ? lines : [lines])) {
          if (!(line?.amount > 0)) continue;
          const srcTid  = line.source_territory ?? line.territory_id;
          const destTid = requestAssets.resources?.[resource]?.dest_territory ?? line.dest_territory;
          if (!srcTid || !destTid) { validationErrors.push(`Payment for ${resource} missing source or destination.`); continue; }
          const srcTs = allTerritoryStates.find(s => s.territory_id === srcTid);
          const destTs = allTerritoryStates.find(s => s.territory_id === destTid);
          if (!srcTs || srcTs.owner_player_id !== acceptorId) { validationErrors.push(`Source ${srcTid} for ${resource} must be receiver's territory.`); continue; }
          if (!destTs || destTs.owner_player_id !== proposerId) { validationErrors.push(`Destination ${destTid} for ${resource} must be proposer's territory.`); continue; }
          const avail = effectiveResource(srcTid, resource);
          if (avail < line.amount) { validationErrors.push(`Not enough ${resource} at ${srcTid} (have ${avail}, need ${line.amount}).`); continue; }
          applyResourceDelta(srcTid, resource, -line.amount);
          applyResourceDelta(destTid, resource, +line.amount);
        }
      }
    }

    // 1c. Offered influence: proposer → receiver
    for (const [srcRegion, v] of Object.entries(offerAssets.influence ?? {})) {
      const amount = typeof v === 'object' ? (v.amount ?? 0) : (v ?? 0);
      const destRegion = receiver_destinations?.influence?.[srcRegion];
      if (amount <= 0) continue;
      if (!destRegion) { validationErrors.push(`Receiver must specify destination region for influence from ${srcRegion}.`); continue; }
      const avail = await effectiveInfluence(proposerId, srcRegion);
      if (avail < amount) { validationErrors.push(`Not enough influence in ${srcRegion} (proposer has ${avail}, need ${amount}).`); continue; }
      applyInfluenceDelta(proposerId, srcRegion, -amount);
      applyInfluenceDelta(acceptorId, destRegion, +amount);
    }

    // 1d. Receiver payment influence: acceptor → proposer
    if (receiver_payment?.influence) {
      const ip = receiver_payment.influence;
      const srcReg  = ip.source_region ?? ip.region;
      const destReg = requestAssets.influence?.dest_region ?? ip.dest_region;
      const amount  = ip.amount ?? 0;
      if (amount > 0) {
        if (!srcReg || !destReg) { validationErrors.push('Influence payment missing source or destination region.'); }
        else {
          const avail = await effectiveInfluence(acceptorId, srcReg);
          if (avail < amount) { validationErrors.push(`Not enough influence in ${srcReg} (receiver has ${avail}, need ${amount}).`); }
          else {
            applyInfluenceDelta(acceptorId, srcReg, -amount);
            applyInfluenceDelta(proposerId, destReg, +amount);
          }
        }
      }
    }

    // 1e. Offered troops: proposer → receiver
    if ((offerAssets.troops?.amount ?? 0) > 0) {
      const srcTid  = offerAssets.troops.source_territory ?? offerAssets.troops.territory_id;
      const destTid = receiver_destinations?.troops;
      if (!srcTid || !destTid) { validationErrors.push('Offered troops missing source or receiver destination territory.'); }
      else {
        const srcTs  = allTerritoryStates.find(s => s.territory_id === srcTid);
        const destTs = allTerritoryStates.find(s => s.territory_id === destTid);
        if (!srcTs || srcTs.owner_player_id !== proposerId) { validationErrors.push(`Troop source ${srcTid} must be proposer's territory.`); }
        else if (!destTs || destTs.owner_player_id !== acceptorId) { validationErrors.push(`Troop destination ${destTid} must be receiver's territory.`); }
        else {
          const avail = effectiveTroops(srcTid);
          if (avail < offerAssets.troops.amount) { validationErrors.push(`Not enough troops at ${srcTid} (have ${avail}, need ${offerAssets.troops.amount}).`); }
          else {
            applyTroopDelta(srcTid, -offerAssets.troops.amount);
            applyTroopDelta(destTid, +offerAssets.troops.amount);
          }
        }
      }
    }

    // 1f. Receiver payment troops: acceptor → proposer
    if ((receiver_payment?.troops?.amount ?? 0) > 0) {
      const tp      = receiver_payment.troops;
      const srcTid  = tp.source_territory ?? tp.territory_id;
      const destTid = requestAssets.troops?.dest_territory ?? tp.dest_territory;
      if (!srcTid || !destTid) { validationErrors.push('Troop payment missing source or destination territory.'); }
      else {
        const srcTs  = allTerritoryStates.find(s => s.territory_id === srcTid);
        const destTs = allTerritoryStates.find(s => s.territory_id === destTid);
        if (!srcTs || srcTs.owner_player_id !== acceptorId) { validationErrors.push(`Troop source ${srcTid} must be receiver's territory.`); }
        else if (!destTs || destTs.owner_player_id !== proposerId) { validationErrors.push(`Troop destination ${destTid} must be proposer's territory.`); }
        else {
          const avail = effectiveTroops(srcTid);
          if (avail < tp.amount) { validationErrors.push(`Not enough troops at ${srcTid} (have ${avail}, need ${tp.amount}).`); }
          else {
            applyTroopDelta(srcTid, -tp.amount);
            applyTroopDelta(destTid, +tp.amount);
          }
        }
      }
    }

    // ── Phase 2: FAIL FAST — if any validation error, apply nothing ──────────
    if (validationErrors.length > 0) {
      return Response.json({ error: validationErrors[0], all_errors: validationErrors }, { status: 400 });
    }

    // ── Phase 3: EXECUTE — all validated; apply all deltas atomically ────────

    // Apply resource deltas
    for (const [tid, resources] of Object.entries(resourceDelta)) {
      const ts = allTerritoryStates.find(s => s.territory_id === tid);
      if (!ts) continue;
      const newStorage = { ...(ts.resource_storage ?? {}) };
      for (const [res, delta] of Object.entries(resources)) {
        newStorage[res] = Math.max(0, (newStorage[res] ?? 0) + delta);
      }
      await base44.asServiceRole.entities.TerritoryState.update(ts.id, { resource_storage: newStorage });
    }

    // Apply troop deltas
    for (const [tid, delta] of Object.entries(troopDelta)) {
      if (delta === 0) continue;
      const ts = allTerritoryStates.find(s => s.territory_id === tid);
      if (!ts) continue;
      await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
        troop_count: Math.max(0, (ts.troop_count ?? 0) + delta),
      });
    }

    // Apply influence deltas
    for (const [key, delta] of Object.entries(influenceDelta)) {
      if (delta === 0) continue;
      const [pid, region] = key.split('|');
      const pools = await base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id, region_id: region, player_id: pid });
      if (pools[0]) {
        await base44.asServiceRole.entities.RegionalInfluencePool.update(pools[0].id, {
          spendable_influence: Math.max(0, (pools[0].spendable_influence ?? 0) + delta),
          last_updated_round: round,
        });
      } else if (delta > 0) {
        await base44.asServiceRole.entities.RegionalInfluencePool.create({
          campaign_id, region_id: region, player_id: pid,
          spendable_influence: delta, last_updated_round: round,
        });
      }
    }

    // ── Peace treaty — create Non-Aggression Pact effect if included ──────
    const peaceDuration = (offerAssets.peace_treaty?.duration ?? 0) + (requestAssets.peace_treaty?.duration ?? 0);
    if (peaceDuration > 0) {
      await base44.asServiceRole.entities.DiplomaticAction.create({
        campaign_id,
        round,
        player_id: proposerId,
        action_type: 'non_aggression_pact',
        region_id: 'trade',
        influence_spent: 0,
        status: 'active',
        expires_round: round + peaceDuration,
        target_player_id: acceptorId,
        effect_metadata: {
          issuer_player_id: proposerId,
          protected_player_id: proposerId,
          restricted_player_id: acceptorId,
          duration: peaceDuration,
          created_by_trade: true,
        },
      });
    }

    // Mark proposal as accepted, storing resolve submission_id for idempotency
    await base44.asServiceRole.entities.DiplomaticAction.update(proposal.id, {
      status: 'active',
      expires_round: round,
      effect_metadata: { ...(proposal.effect_metadata ?? {}), resolve_submission_id: resolveSubmissionId ?? null },
    });

    return Response.json({ success: true, message: 'Trade accepted and assets transferred.' });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});