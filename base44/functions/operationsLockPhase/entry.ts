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

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      round,
      operations_locked: operationsLocked,
      locked_at: staging.locked_at ?? null,
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
    const { building_type, territory_id } = body;
    if (!building_type || !territory_id) {
      return Response.json({ error: 'building_type and territory_id are required' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();
    if (stagingData.locked_at) {
      return Response.json({ error: 'Operations phase already locked.' }, { status: 400 });
    }
    if (stagingData.economic_locked) {
      return Response.json({ error: 'Economic operations already locked.' }, { status: 400 });
    }

    // Validate territory ownership
    const [ownedStates] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id, owner_player_id: actingPlayer.id }),
    ]);
    const ownedIds = new Set(ownedStates.map(s => s.territory_id));
    if (!ownedIds.has(territory_id)) {
      return Response.json({ error: 'You do not own that territory.' }, { status: 400 });
    }

    // Construction limit: 1 per round
    const existing = stagingData.economic_staged ?? [];
    if (existing.length >= 1) {
      return Response.json({ error: 'Only 1 construction project can be staged per round.' }, { status: 400 });
    }

    const newProject = { building_type, territory_id, staged_at: new Date().toISOString() };
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      economic_staged: [...existing, newProject],
    });

    return Response.json({ success: true, project: newProject, message: 'Construction project staged.' });
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
      arr.splice(index, 1);
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

    const results = {};

    // ── 1. Military: lock attack phase decision ──────────────────────────────
    const attackDecision = await getAttackDecision(base44, campaign_id, actingPlayer.id, round);
    if (attackDecision && !attackDecision.is_locked) {
      await base44.asServiceRole.entities.PhaseDecision.update(attackDecision.id, {
        is_locked: true,
        locked_at: new Date().toISOString(),
      });
      results.military = { locked: true };
    } else {
      results.military = { locked: true, already_locked: !attackDecision ? false : attackDecision.is_locked };
    }

    // ── 2. Economic: commit construction projects ────────────────────────────
    const economicStaged = stagingData.economic_staged ?? [];
    if (economicStaged.length > 0) {
      const constructionResults = [];
      for (const project of economicStaged) {
        // Create a TerritoryBuilding record in 'planned' status
        const existing = await base44.asServiceRole.entities.TerritoryBuilding.filter({
          campaign_id,
          territory_id: project.territory_id,
          building_type: project.building_type,
          player_id: actingPlayer.id,
        });
        // Idempotency: skip if already exists
        if (existing.length === 0) {
          const pillarMap = {
            barracks: 'military', war_council: 'military', logistics_corps: 'military',
            embassy: 'diplomatic', council_chamber: 'diplomatic', foreign_office: 'diplomatic',
            monument: 'diplomatic', marketplace: 'economic', builders_guild: 'economic',
            trade_network: 'economic', resource_hub: 'economic', supply_route: 'economic', warehouse: 'economic',
          };
          const pillar = pillarMap[project.building_type] ?? 'economic';
          const created = await base44.asServiceRole.entities.TerritoryBuilding.create({
            campaign_id,
            territory_id: project.territory_id,
            player_id: actingPlayer.id,
            building_type: project.building_type,
            pillar_type: pillar,
            status: 'planned',
            started_round: round,
            construction_progress: 0,
            metadata_json: {},
          });
          constructionResults.push({ building_id: created.id, building_type: project.building_type, territory_id: project.territory_id });
        }
      }
      results.economic = { locked: true, projects_committed: constructionResults.length };
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
        // Pure influence actions — record as DiplomaticAction
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
            target_player_id: target_player_id ?? undefined,
            target_player_b_id: target_player_b_id ?? undefined,
            target_territory_id: target_territory_id ?? undefined,
            target_supply_route_id: target_supply_route_id ?? undefined,
            effect_metadata: {},
          });
        }
        dipResults.push({ action_type, region_id, result: 'action_recorded' });
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
});