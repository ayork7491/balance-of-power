/**
 * planningPhase — Sprint 5B.2 unified Planning Phase (deploy phase) lock-in.
 *
 * This function manages the three-pillar staged lock-in workflow for the deploy phase.
 * It does NOT replace deployPhase, resourcePhase, or objectivePhase logic —
 * it orchestrates them and tracks staged state.
 *
 * Actions:
 *   getPlanningStatus     — returns per-pillar staging status for a player this round
 *   stageActivations      — stage (but not commit) resource activation choices
 *   stageObjectiveKeep    — stage objective keep/discard selection (does not commit)
 *   autoDealObjectives    — auto-deal 3 objective cards if not dealt this round (idempotent)
 *   lockPlanningPhase     — commits ALL staged choices simultaneously:
 *                           1. Locks troop deployment (calls deployPhase/lockDeploy)
 *                           2. Commits resource activations (calls resourcePhase/lockActivations)
 *                           3. Resolves objective opportunity (calls objectivePhase/resolveOpportunity)
 *   getAdminLockStatus    — returns per-player lock completion for admin guard check
 *   seedStartingInfluence — admin: grants 1 perm + 1 spendable per starting territory (idempotent)
 *
 * ─── STAGING MODEL ────────────────────────────────────────────────────────────
 *   Staged choices are stored in a PhaseDecision record (phase='planning_stage', round=N).
 *   data = {
 *     military_locked:    bool,         // deploy lockDeploy already called
 *     economic_staged:    string[],     // territory_ids selected for activation
 *     economic_locked:    bool,         // resourcePhase/lockActivations already called
 *     diplomatic_staged:  { kept_card_id, replace_card_id } | null,
 *     diplomatic_locked:  bool,         // objectivePhase/resolveOpportunity already called
 *     objective_dealt:    bool,         // drawOpportunity already called this round
 *     objective_dealt_round: number,    // round when objectives were auto-dealt
 *     locked_at:          string | null,
 *   }
 *
 * ─── IDEMPOTENCY ──────────────────────────────────────────────────────────────
 *   lockPlanningPhase is safe to retry — each sub-call is idempotent.
 *   autoDealObjectives checks objective_dealt + pending_draw before drawing.
 *   stageActivations / stageObjectiveKeep are always overwritable until lockPlanningPhase.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Territory → Region mapping (inline — no local imports in Deno) ───────────
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

function emptyStaging() {
  return {
    military_locked: false,
    economic_staged: [],
    economic_locked: false,
    diplomatic_staged: null,
    diplomatic_locked: false,
    objective_dealt: false,
    objective_dealt_round: null,
    locked_at: null,
  };
}

async function getStagingDecision(base44, campaignId, playerId, round) {
  const records = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id: campaignId,
    player_id: playerId,
    phase: 'planning_stage',
    round,
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
      campaign_id: campaignId,
      player_id: playerId,
      phase: 'planning_stage',
      round,
      is_locked: false,
      data,
    });
    return created;
  }
}

async function getDeployDecision(base44, campaignId, playerId, round) {
  const records = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id: campaignId,
    player_id: playerId,
    phase: 'deploy',
    round,
  });
  return records[0] ?? null;
}

async function getDeployIncome(base44, campaignId, playerId, round) {
  const records = await base44.asServiceRole.entities.DeployIncome.filter({
    campaign_id: campaignId,
    player_id: playerId,
    round,
  });
  return records[0] ?? null;
}

// ─── Influence helpers (inline — mirrors influencePhase) ──────────────────────

async function upsertPermanentInfluence(base44, campaignId, playerId, territoryId, amount, round) {
  const existing = await base44.asServiceRole.entities.TerritoryInfluence.filter({
    campaign_id: campaignId, territory_id: territoryId, player_id: playerId,
  });
  const record = existing[0];
  if (record) {
    const newAmt = Math.max(0, (record.influence_amount ?? 0) + amount);
    await base44.asServiceRole.entities.TerritoryInfluence.update(record.id, {
      influence_amount: newAmt, last_updated_round: round, source: 'starting_bonus',
    });
    return newAmt;
  } else {
    const newAmt = Math.max(0, amount);
    await base44.asServiceRole.entities.TerritoryInfluence.create({
      campaign_id: campaignId, territory_id: territoryId, player_id: playerId,
      influence_amount: newAmt, last_updated_round: round, source: 'starting_bonus',
    });
    return newAmt;
  }
}

async function upsertSpendableInfluence(base44, campaignId, playerId, regionId, amount, round) {
  const existing = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
    campaign_id: campaignId, region_id: regionId, player_id: playerId,
  });
  const record = existing[0];
  if (record) {
    const newAmt = Math.max(0, (record.spendable_influence ?? 0) + amount);
    await base44.asServiceRole.entities.RegionalInfluencePool.update(record.id, {
      spendable_influence: newAmt, last_updated_round: round,
    });
    return newAmt;
  } else {
    const newAmt = Math.max(0, amount);
    await base44.asServiceRole.entities.RegionalInfluencePool.create({
      campaign_id: campaignId, region_id: regionId, player_id: playerId,
      spendable_influence: newAmt, last_updated_round: round,
    });
    return newAmt;
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

  // Resolve acting player
  const { acting_as_player_id } = body;
  let actingPlayer = myPlayer;
  if (acting_as_player_id) {
    const target = players.find(p => p.id === acting_as_player_id);
    if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
    const isTestPlayer = target.is_test_player === true;
    if (!isAdmin && !isTestPlayer && target.id !== myPlayer.id) {
      return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
    }
    actingPlayer = target;
  }

  // ── ACTION: seedStartingInfluence ─────────────────────────────────────────
  // Admin: grant 1 perm + 1 spendable per starting territory for ALL players.
  // Idempotent: checks for existing TerritoryInfluence records first.
  if (action === 'seedStartingInfluence') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    // Idempotency: check if already seeded (any TerritoryInfluence with source='starting_bonus')
    const existing = await base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id });
    const alreadySeeded = existing.some(r => r.source === 'starting_bonus');
    if (alreadySeeded) {
      return Response.json({ success: true, idempotent: true, message: 'Starting influence already seeded.' });
    }

    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const ownedStates = allStates.filter(s => s.owner_player_id != null);
    const results = [];

    for (const ts of ownedStates) {
      const regionId = SC_TERRITORY_REGION[ts.territory_id];
      const newPerm = await upsertPermanentInfluence(
        base44, campaign_id, ts.owner_player_id, ts.territory_id, 1, round
      );
      let newSpend = null;
      if (regionId) {
        newSpend = await upsertSpendableInfluence(
          base44, campaign_id, ts.owner_player_id, regionId, 1, round
        );
      }
      results.push({
        territory_id: ts.territory_id,
        player_id: ts.owner_player_id,
        region_id: regionId,
        permanent: newPerm,
        spendable: newSpend,
      });
    }

    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id, phase: 'deploy', round,
      event_type: 'starting_influence_seeded',
      player_id: null,
      payload: { territories_processed: results.length },
      is_public: true,
    });

    return Response.json({ success: true, territories_processed: results.length, results });
  }

  // ── ACTION: getPlanningStatus ──────────────────────────────────────────────
  // Returns staging state for the acting player + deploy income + resource state summary.
  if (action === 'getPlanningStatus') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy (Planning) phase', phase: campaign.current_phase }, { status: 400 });
    }

    const [stagingDecision, deployDecision, deployIncome] = await Promise.all([
      getStagingDecision(base44, campaign_id, actingPlayer.id, round),
      getDeployDecision(base44, campaign_id, actingPlayer.id, round),
      getDeployIncome(base44, campaign_id, actingPlayer.id, round),
    ]);

    const staging = stagingDecision?.data ?? emptyStaging();

    // Military status
    const militaryLocked = deployDecision?.is_locked ?? staging.military_locked ?? false;
    const totalTroops = deployIncome?.total ?? 0;
    const stagedPlacements = deployDecision?.data?.placements ?? {};
    const troopsStaged = Object.values(stagedPlacements).reduce((s, n) => s + (n || 0), 0);

    // Economic status — activation limit from server
    const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: actingPlayer.id,
    });
    const hubCount = ownedStates.filter(s => s.has_resource_hub).length;
    const ownedCount = ownedStates.length;
    const activationLimit = ownedCount === 0 ? 0 :
      Math.min(Math.max(1, Math.floor(ownedCount / 3)) + hubCount, ownedCount);
    const economicStaged = staging.economic_staged ?? [];
    const economicLocked = staging.economic_locked ?? false;

    // Diplomatic status — objective deck
    const ledgerRecords = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
      campaign_id, player_id: actingPlayer.id,
    });
    const ledger = ledgerRecords[0];
    const cards = ledger?.objective_cards_json ?? { held: [], pending_draw: null, completed: [], discarded: [] };
    const objectiveDealt = staging.objective_dealt ?? false;
    const objectiveDealtRound = staging.objective_dealt_round ?? null;
    const hasPendingDraw = !!(cards.pending_draw && cards.pending_draw.length > 0);
    const diplomaticStaged = staging.diplomatic_staged ?? null;
    const diplomaticLocked = staging.diplomatic_locked ?? false;

    // Resolve discard requirements: if held >= 3 AND gaining a new card, must discard 1
    const heldCount = (cards.held ?? []).length;
    const needsReplace = heldCount >= 3 && hasPendingDraw;
    const diplomaticRequired = hasPendingDraw || objectiveDealt; // true = player must resolve objective

    // Overall planning locked
    const planningLocked = staging.locked_at != null;

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      round,
      phase_started: !!deployIncome,
      planning_locked: planningLocked,
      locked_at: staging.locked_at ?? null,

      military: {
        troops_total: totalTroops,
        troops_staged: troopsStaged,
        troops_remaining: totalTroops - troopsStaged,
        is_locked: militaryLocked,
        ready: troopsStaged >= totalTroops || militaryLocked,
      },
      economic: {
        activations_staged: economicStaged.length,
        activations_limit: activationLimit,
        staged_territory_ids: economicStaged,
        is_locked: economicLocked,
        ready: economicLocked || economicStaged.length >= activationLimit,
      },
      diplomatic: {
        objective_dealt: objectiveDealt,
        objective_dealt_round: objectiveDealtRound,
        has_pending_draw: hasPendingDraw,
        pending_draw: cards.pending_draw ?? null,
        diplomatic_staged: diplomaticStaged,
        is_locked: diplomaticLocked,
        held_count: heldCount,
        needs_replace: needsReplace,
        required: diplomaticRequired,
        ready: !diplomaticRequired || diplomaticLocked || (diplomaticStaged != null),
      },
    });
  }

  // ── ACTION: autoDealObjectives ─────────────────────────────────────────────
  // Called at start of deploy phase. Idempotent — only deals once per round per player.
  if (action === 'autoDealObjectives') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();

    // Idempotency: already dealt this round
    if (stagingData.objective_dealt && stagingData.objective_dealt_round === round) {
      return Response.json({ success: true, idempotent: true, message: 'Objectives already dealt this round.' });
    }

    // Check if player already has a pending draw (from a previous attempt)
    const ledgerRecords = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
      campaign_id, player_id: actingPlayer.id,
    });
    const ledger = ledgerRecords[0];
    const cards = ledger?.objective_cards_json ?? {};
    if (cards.pending_draw && cards.pending_draw.length > 0) {
      // Already has a pending draw — mark as dealt and return
      await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
        objective_dealt: true,
        objective_dealt_round: round,
      });
      return Response.json({ success: true, idempotent: true, message: 'Pending draw already exists.' });
    }

    // Auto-initialize deck if needed
    let deck = await (async () => {
      const records = await base44.asServiceRole.entities.CampaignObjectiveDeck.filter({ campaign_id });
      return records[0] ?? null;
    })();

    if (!deck) {
      const allCards = await base44.asServiceRole.entities.SecretObjectiveCard.list();
      if (allCards.length === 0) {
        // No cards defined yet — mark as dealt (no-op) to unblock phase
        await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
          objective_dealt: true,
          objective_dealt_round: round,
        });
        return Response.json({ success: true, no_cards: true, message: 'No objective cards defined. Skipping.' });
      }
      const shuffled = [...allCards.map(c => c.card_id)].sort(() => Math.random() - 0.5);
      deck = await base44.asServiceRole.entities.CampaignObjectiveDeck.create({
        campaign_id, draw_pile: shuffled, discard_pile: [],
        opportunity_log: [], initialized_at_round: round,
      });
    }

    // Get all held cards to avoid duplicates
    const allLedgers = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id });
    const allHeld = new Set();
    for (const l of allLedgers) {
      for (const cid of (l.objective_cards_json?.held ?? [])) allHeld.add(cid);
      for (const cid of (l.objective_cards_json?.pending_draw ?? [])) allHeld.add(cid);
    }

    // Draw up to 3 cards
    const DRAW_COUNT = 3;
    let drawPile = [...(deck.draw_pile ?? [])];
    let discardPile = [...(deck.discard_pile ?? [])];
    const drawn = [];
    let attempts = 0;
    const maxAttempts = drawPile.length + discardPile.length + 10;

    while (drawn.length < DRAW_COUNT && attempts < maxAttempts) {
      if (drawPile.length === 0) {
        if (discardPile.length === 0) break;
        drawPile = discardPile.sort(() => Math.random() - 0.5);
        discardPile = [];
      }
      const cardId = drawPile.shift();
      attempts++;
      if (!allHeld.has(cardId)) {
        drawn.push(cardId);
      } else {
        drawPile.push(cardId);
      }
    }

    if (drawn.length === 0) {
      // No cards available — mark as dealt (no-op)
      await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
        objective_dealt: true,
        objective_dealt_round: round,
      });
      return Response.json({ success: true, no_cards: true, message: 'No cards available to draw.' });
    }

    // Persist updated deck
    await base44.asServiceRole.entities.CampaignObjectiveDeck.update(deck.id, {
      draw_pile: drawPile,
      discard_pile: discardPile,
    });

    // Store pending draw on ledger
    const existingCards = ledger?.objective_cards_json ?? { held: [], pending_draw: null, completed: [], discarded: [] };
    const updatedCards = { ...existingCards, pending_draw: drawn };
    if (ledger) {
      await base44.asServiceRole.entities.PlayerInfluenceLedger.update(ledger.id, {
        objective_cards_json: updatedCards, updated_at_round: round,
      });
    } else {
      await base44.asServiceRole.entities.PlayerInfluenceLedger.create({
        campaign_id, player_id: actingPlayer.id,
        global_influence: 0, regional_influence_json: {},
        objective_cards_json: updatedCards,
        updated_at_round: round,
      });
    }

    // Mark as dealt in staging
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      objective_dealt: true,
      objective_dealt_round: round,
    });

    // ── Auto-evaluate held objectives before dealing new cards ─────────────
    // This runs inline here (no local imports allowed) by delegating to objectivePhase
    // via base44.functions.invoke (service-role call not available cross-function;
    // evaluation logic is light so we do a minimal inline check here).
    // Full evaluation is available via objectivePhase/evaluateObjectives.
    // We call it as a best-effort fire-and-forget — errors don't block dealing.
    try {
      await base44.functions.invoke('objectivePhase', {
        action: 'evaluateObjectives',
        campaign_id,
        acting_as_player_id: actingPlayer.id,
      });
    } catch { /* non-blocking */ }

    // Fetch card definitions for response
    const allCardDefs = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const cardMap = {};
    for (const c of allCardDefs) cardMap[c.card_id] = c;

    return Response.json({
      success: true,
      drawn,
      card_definitions: cardMap,
      message: `Auto-dealt ${drawn.length} objective cards.`,
    });
  }

  // ── ACTION: stageActivations ───────────────────────────────────────────────
  // Stage (but don't commit) resource territory selections.
  if (action === 'stageActivations') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const { territory_ids } = body;
    if (!Array.isArray(territory_ids)) {
      return Response.json({ error: 'territory_ids array required' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    if (staging?.data?.economic_locked) {
      return Response.json({ error: 'Economic activations already locked.' }, { status: 400 });
    }
    if (staging?.data?.locked_at) {
      return Response.json({ error: 'Planning phase already locked.' }, { status: 400 });
    }

    // Validate ownership
    const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: actingPlayer.id,
    });
    const ownedIds = new Set(ownedStates.map(s => s.territory_id));
    for (const tid of territory_ids) {
      if (!ownedIds.has(tid)) {
        return Response.json({ error: `Territory ${tid} not owned by you` }, { status: 400 });
      }
    }

    // Activation limit
    const hubCount = ownedStates.filter(s => s.has_resource_hub).length;
    const ownedCount = ownedStates.length;
    const activationLimit = ownedCount === 0 ? 0 :
      Math.min(Math.max(1, Math.floor(ownedCount / 3)) + hubCount, ownedCount);

    if (territory_ids.length > activationLimit) {
      return Response.json({
        error: `Exceeds activation limit of ${activationLimit}. You selected ${territory_ids.length}.`,
      }, { status: 400 });
    }

    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      economic_staged: territory_ids,
    });

    return Response.json({
      success: true,
      staged_count: territory_ids.length,
      activation_limit: activationLimit,
      message: `Staged ${territory_ids.length} territory activations.`,
    });
  }

  // ── ACTION: stageObjectiveKeep ─────────────────────────────────────────────
  // Stage objective keep/discard selection (does not commit to objectivePhase yet).
  if (action === 'stageObjectiveKeep') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const { kept_card_id, replace_card_id } = body;
    if (!kept_card_id) return Response.json({ error: 'kept_card_id required' }, { status: 400 });

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    if (staging?.data?.diplomatic_locked) {
      return Response.json({ error: 'Objective selection already locked.' }, { status: 400 });
    }
    if (staging?.data?.locked_at) {
      return Response.json({ error: 'Planning phase already locked.' }, { status: 400 });
    }

    // Validate the card is in pending_draw
    const ledgerRecords = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
      campaign_id, player_id: actingPlayer.id,
    });
    const ledger = ledgerRecords[0];
    const cards = ledger?.objective_cards_json ?? {};
    if (!cards.pending_draw || !cards.pending_draw.includes(kept_card_id)) {
      return Response.json({ error: 'kept_card_id is not in your pending draw.' }, { status: 400 });
    }

    const heldCount = (cards.held ?? []).length;
    if (heldCount >= 3 && !replace_card_id) {
      return Response.json({
        error: 'You have 3 active objectives. Provide replace_card_id to swap one out.',
        held: cards.held,
      }, { status: 400 });
    }
    if (replace_card_id && !(cards.held ?? []).includes(replace_card_id)) {
      return Response.json({ error: 'replace_card_id is not in your held objectives.' }, { status: 400 });
    }

    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      diplomatic_staged: { kept_card_id, replace_card_id: replace_card_id ?? null },
    });

    return Response.json({
      success: true,
      kept_card_id,
      replace_card_id: replace_card_id ?? null,
      message: `Staged objective selection: keep ${kept_card_id}.`,
    });
  }

  // ── ACTION: lockPlanningPhase ──────────────────────────────────────────────
  // Commits ALL staged choices simultaneously. Idempotent.
  if (action === 'lockPlanningPhase') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();

    // Idempotency: already locked
    if (stagingData.locked_at) {
      return Response.json({
        success: true,
        idempotent: true,
        message: 'Planning phase already locked.',
        locked_at: stagingData.locked_at,
      });
    }

    const errors = [];
    const results = {};

    // ── 1. Military: lock deploy if not already locked ──────────────────────
    const deployDecision = await getDeployDecision(base44, campaign_id, actingPlayer.id, round);
    if (!deployDecision) {
      errors.push('Deploy phase not started. No income record found.');
    } else if (!deployDecision.is_locked) {
      // Lock deploy via direct entity update (same logic as deployPhase/lockDeploy)
      const deployIncome = await getDeployIncome(base44, campaign_id, actingPlayer.id, round);
      const allowedTroops = deployIncome?.total ?? 0;
      const placements = deployDecision.data?.placements ?? {};
      const totalPlaced = Object.values(placements).reduce((s, n) => s + (n || 0), 0);

      // Auto-fill remaining if not all placed
      let finalPlacements = { ...placements };
      const remaining = allowedTroops - totalPlaced;
      if (remaining > 0) {
        const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, owner_player_id: actingPlayer.id,
        });
        const ownedIds = ownedStates.map(t => t.territory_id);
        if (ownedIds.length > 0) {
          // Distribute remaining troops randomly
          let rem = remaining;
          let i = 0;
          while (rem > 0 && i < 100000) {
            const tid = ownedIds[Math.floor(Math.random() * ownedIds.length)];
            finalPlacements[tid] = (finalPlacements[tid] || 0) + 1;
            rem--;
            i++;
          }
        }
      }

      await base44.asServiceRole.entities.PhaseDecision.update(deployDecision.id, {
        is_locked: true,
        locked_at: new Date().toISOString(),
        data: { placements: finalPlacements, troops_remaining: 0 },
      });

      await base44.asServiceRole.entities.SetupLog.create({
        campaign_id, phase: 'deploy', round,
        event_type: 'player_locked',
        player_id: actingPlayer.id,
        payload: { display_name: actingPlayer.display_name, via: 'planning_lock' },
        is_public: true,
      });

      results.military = { locked: true, placements: finalPlacements };
    } else {
      results.military = { locked: true, already_locked: true };
    }

    // ── 2. Economic: commit resource activations ────────────────────────────
    if (!stagingData.economic_locked) {
      const economicStaged = stagingData.economic_staged ?? [];
      if (economicStaged.length > 0) {
        // Inline lockActivations logic (no local imports)
        const SC_RESOURCE_TYPES = {
          I1:'iron', I2:'iron', I3:'stone', I4:'iron', I5:'stone',
          I6:'timber', I7:'timber', I8:'iron',
          W1:'timber', W2:'stone', W3:'timber', W4:'timber', W5:'timber',
          W6:'timber', W7:'gold', W8:'gold', W9:'iron',
          B1:'stone', B2:'stone', B3:'stone', B4:'stone', B5:'iron',
          B6:'stone', B7:'stone', B8:'stone', B9:'iron', B10:'gold',
          S1:'timber', S2:'gold', S3:'iron', S4:'gold', S5:'gold',
          S6:'stone', S7:'timber', S8:'gold', S9:'iron',
          C1:'iron', C2:'gold', C3:'iron', C4:'gold', C5:'gold',
          C6:'gold', C7:'stone', C8:'gold',
        };
        const VALID_RESOURCES = ['gold', 'iron', 'timber', 'stone', 'food'];

        const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const myStates = allStates.filter(s => s.owner_player_id === actingPlayer.id);
        const stateMap = {};
        for (const s of myStates) stateMap[s.territory_id] = s;

        const activationResults = [];
        for (const territory_id of economicStaged) {
          const ts = stateMap[territory_id];
          if (!ts) continue;
          const primary = ts.resource_type ?? SC_RESOURCE_TYPES[territory_id] ?? 'food';
          const generated = { gold: 0, iron: 0, timber: 0, stone: 0, food: 0 };
          generated[primary] = 1;
          const before = { gold: 0, iron: 0, timber: 0, stone: 0, food: 0, ...(ts.resource_storage ?? {}) };
          const after = { ...before };
          for (const r of VALID_RESOURCES) {
            after[r] = (after[r] || 0) + (generated[r] || 0);
          }
          await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
            resource_storage: after,
            resource_type: primary,
          });
          // Store per-territory audit detail with before/after for delta reporting
          activationResults.push({
            territory_id,
            player_id: actingPlayer.id,
            resource_type: primary,
            amount_generated: 1,
            before_amount: before[primary] ?? 0,
            after_amount: after[primary] ?? 0,
            generated,
            storage_before: { ...before },
            storage_after: after,
          });
        }

        await base44.asServiceRole.entities.SetupLog.create({
          campaign_id, phase: 'deploy', round,
          event_type: 'resource_activations_locked',
          player_id: actingPlayer.id,
          payload: {
            territory_ids: economicStaged,
            activated_count: activationResults.length,
            activation_details: activationResults,
            via: 'planning_lock',
          },
          is_public: false,
        });

        results.economic = { locked: true, activated_count: activationResults.length, activation_details: activationResults };
      } else {
        results.economic = { locked: true, activated_count: 0, skipped: true };
      }
    } else {
      results.economic = { locked: true, already_locked: true };
    }

    // ── 3. Diplomatic: commit objective selection ───────────────────────────
    const diplomaticStaged = stagingData.diplomatic_staged;
    if (!stagingData.diplomatic_locked && diplomaticStaged?.kept_card_id) {
      // Inline resolveOpportunity
      const ledgerRecords = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
        campaign_id, player_id: actingPlayer.id,
      });
      const ledger = ledgerRecords[0];
      const cards = ledger?.objective_cards_json ?? { held: [], pending_draw: null, completed: [], discarded: [] };

      if (cards.pending_draw && cards.pending_draw.includes(diplomaticStaged.kept_card_id)) {
        const { kept_card_id, replace_card_id } = diplomaticStaged;
        const currentHeld = cards.held ?? [];
        const toDiscard = (cards.pending_draw ?? []).filter(cid => cid !== kept_card_id);
        const discardCardIds = [...toDiscard];
        let newHeld;
        const discardedEntries = [];

        if (currentHeld.length >= 3) {
          if (replace_card_id && currentHeld.includes(replace_card_id)) {
            newHeld = currentHeld.filter(cid => cid !== replace_card_id).concat(kept_card_id);
            discardCardIds.push(replace_card_id);
            discardedEntries.push({ card_id: replace_card_id, discarded_round: round });
          } else {
            // At cap but no replace — just add (cap enforcement by UI; backend is lenient at lock time)
            newHeld = [...currentHeld, kept_card_id];
          }
        } else {
          newHeld = [...currentHeld, kept_card_id];
        }

        // Add to deck discard pile
        const deckRecords = await base44.asServiceRole.entities.CampaignObjectiveDeck.filter({ campaign_id });
        const deck = deckRecords[0];
        if (deck) {
          await base44.asServiceRole.entities.CampaignObjectiveDeck.update(deck.id, {
            discard_pile: [...(deck.discard_pile ?? []), ...discardCardIds],
            opportunity_log: [
              ...(deck.opportunity_log ?? []),
              { round, player_id: actingPlayer.id, drawn: cards.pending_draw, kept: kept_card_id, discarded: discardCardIds, timestamp: new Date().toISOString() },
            ],
          });
        }

        const updatedCards = {
          ...cards,
          held: newHeld,
          pending_draw: null,
          discarded: [
            ...(cards.discarded ?? []),
            ...toDiscard.map(cid => ({ card_id: cid, discarded_round: round })),
            ...discardedEntries,
          ],
        };

        if (ledger) {
          await base44.asServiceRole.entities.PlayerInfluenceLedger.update(ledger.id, {
            objective_cards_json: updatedCards, updated_at_round: round,
          });
        } else {
          await base44.asServiceRole.entities.PlayerInfluenceLedger.create({
            campaign_id, player_id: actingPlayer.id,
            global_influence: 0, regional_influence_json: {},
            objective_cards_json: updatedCards,
            updated_at_round: round,
          });
        }

        results.diplomatic = { locked: true, kept: kept_card_id, discarded: discardCardIds };
      } else {
        results.diplomatic = { locked: true, skipped: true, reason: 'Card no longer in pending draw' };
      }
    } else if (stagingData.diplomatic_locked) {
      results.diplomatic = { locked: true, already_locked: true };
    } else {
      // No staged objective — mark as skipped (player had no pending draw)
      results.diplomatic = { locked: true, skipped: true, reason: 'No staged objective selection' };
    }

    // ── Finalize staging record ──────────────────────────────────────────────
    const lockedAt = new Date().toISOString();
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      military_locked: true,
      economic_locked: true,
      diplomatic_locked: true,
      locked_at: lockedAt,
    });

    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id, phase: 'deploy', round,
      event_type: 'planning_phase_locked',
      player_id: actingPlayer.id,
      payload: { display_name: actingPlayer.display_name, results },
      is_public: true,
    });

    // ── Write phase_end snapshot after all activations are applied ────────────
    // This snapshot captures the full post-activation game state so exports can
    // compute accurate resource deltas without relying on SetupLog fallback.
    // Written per-player after their lock commits; exportPhaseAudit uses the
    // last-written phase_end record (or the latest timestamp if multiple exist).
    try {
      const [snapStates, snapInfluence, snapRegionalPools, snapBuildings, snapSupplyRoutes, snapObjectives, snapVictory] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
        base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
        base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
        base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id }),
        base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id }),
      ]);
      const snapActivePlayers = players.filter(p => !p.is_eliminated);
      await base44.asServiceRole.entities.PhaseSnapshot.create({
        campaign_id, round, phase: 'deploy', snapshot_type: 'phase_end',
        _schema_version: 2,
        territory_states: snapStates.map(ts => ({
          territory_id: ts.territory_id, owner_player_id: ts.owner_player_id ?? null,
          troop_count: ts.troop_count ?? 0, resource_storage: ts.resource_storage ?? {},
          has_resource_hub: ts.has_resource_hub ?? false, structures: ts.structures ?? [],
          resource_type: ts.resource_type ?? null,
        })),
        player_standings: snapActivePlayers.map(p => {
          const owned = snapStates.filter(ts => ts.owner_player_id === p.id);
          return { player_id: p.id, display_name: p.display_name, territory_count: owned.length, troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0), is_eliminated: p.is_eliminated ?? false };
        }),
        permanent_influence: snapInfluence.map(i => ({ territory_id: i.territory_id, player_id: i.player_id, influence_amount: i.influence_amount ?? 0 })),
        spendable_influence: snapRegionalPools.map(p => ({ region_id: p.region_id, player_id: p.player_id, spendable_influence: p.spendable_influence ?? 0 })),
        buildings: snapBuildings.map(b => ({ territory_id: b.territory_id, player_id: b.player_id, building_type: b.building_type, pillar_type: b.pillar_type, status: b.status, started_round: b.started_round, completed_round: b.completed_round })),
        supply_routes: snapSupplyRoutes.map(r => ({ id: r.id, owner_player_id: r.owner_player_id, hub_territory_id: r.hub_territory_id, source_territory_id: r.source_territory_id, route_status: r.route_status, resource_type: r.resource_type, created_round: r.created_round })),
        objectives: snapObjectives.map(o => ({ player_id: o.player_id, global_influence: o.global_influence ?? 0, objective_cards: o.objective_cards_json ?? {} })),
        victory_scores: snapVictory.map(v => ({ player_id: v.player_id, occupancy_score: v.occupancy_score ?? 0, wealth_score: v.wealth_score ?? 0, influence_score: v.influence_score ?? 0, has_won: v.has_won ?? false, winning_condition: v.winning_condition ?? null })),
        locked_by_player_id: actingPlayer.id,
        locked_at: lockedAt,
      });
    } catch (snapErr) {
      // Non-fatal — don't fail the lock if snapshot write fails
      console.warn('[lockPlanningPhase] Phase end snapshot write failed (non-fatal):', snapErr?.message);
    }

    return Response.json({
      success: true,
      locked_at: lockedAt,
      player_id: actingPlayer.id,
      results,
    });
  }

  // ── ACTION: unlockPlanningPhase ────────────────────────────────────────────
  // Allows a player to undo their planning lock before the phase advances.
  // Admin can unlock any player by providing acting_as_player_id.
  if (action === 'unlockPlanningPhase') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy (Planning) phase' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    if (!staging?.data?.locked_at) {
      return Response.json({ success: true, idempotent: true, message: 'Planning phase is not locked.' });
    }

    // Unlock the staging decision — wipe locked_at and per-pillar locks
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      military_locked: false,
      economic_locked: false,
      diplomatic_locked: false,
      locked_at: null,
    });

    // Also unlock the deploy PhaseDecision so the player can re-stage troops
    const deployDecision = await getDeployDecision(base44, campaign_id, actingPlayer.id, round);
    if (deployDecision?.is_locked) {
      await base44.asServiceRole.entities.PhaseDecision.update(deployDecision.id, {
        is_locked: false,
        locked_at: null,
      });
    }

    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id, phase: 'deploy', round,
      event_type: 'planning_phase_unlocked',
      player_id: actingPlayer.id,
      payload: { display_name: actingPlayer.display_name, unlocked_by: myPlayer.id },
      is_public: true,
    });

    return Response.json({
      success: true,
      message: `Planning phase unlocked for ${actingPlayer.display_name}.`,
      player_id: actingPlayer.id,
    });
  }

  // ── ACTION: getAdminLockStatus ─────────────────────────────────────────────
  // Returns per-player planning lock status for admin guard check.
  if (action === 'getAdminLockStatus') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);

    const [stagingRecords, deployDecisions] = await Promise.all([
      base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'planning_stage', round }),
      base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'deploy', round }),
    ]);

    const status = activePlayers.map(p => {
      const staging = stagingRecords.find(r => r.player_id === p.id);
      const deploy = deployDecisions.find(r => r.player_id === p.id);
      const planningLocked = !!(staging?.data?.locked_at);
      const militaryLocked = deploy?.is_locked ?? false;
      return {
        player_id: p.id,
        display_name: p.display_name,
        planning_locked: planningLocked,
        locked_at: staging?.data?.locked_at ?? null,
        military_locked: militaryLocked,
      };
    });

    const allLocked = status.every(s => s.planning_locked);
    const lockedCount = status.filter(s => s.planning_locked).length;

    // Check if deploy phase has actually been started (income records exist)
    const deployIncomes = await base44.asServiceRole.entities.DeployIncome.filter({ campaign_id, round });
    const phaseStarted = deployIncomes.length > 0;

    return Response.json({
      success: true,
      all_locked: allLocked,
      locked_count: lockedCount,
      total_players: activePlayers.length,
      phase_started: phaseStarted,
      status,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});