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
  try {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { action, campaign_id } = body;
  const isInternalCall = body._internal === true;

  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  // Internal system calls (e.g. from initialDeploy/deployPhase) skip user auth
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

  const myPlayer = user ? players.find(p => p.user_id === user.id) : null;
  if (!isInternalCall && !myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const isAdmin = isInternalCall || campaign.admin_user_id === user?.id || user?.role === 'admin';
  const round = campaign.current_round ?? 1;

  // Resolve acting player
  const { acting_as_player_id } = body;
  let actingPlayer = myPlayer;
  if (acting_as_player_id) {
    const target = players.find(p => p.id === acting_as_player_id);
    if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
    const isTestPlayer = target.is_test_player === true;
    if (!isAdmin && !isInternalCall && !isTestPlayer && target.id !== myPlayer?.id) {
      return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
    }
    actingPlayer = target;
  }
  // For internal calls with acting_as_player_id, actingPlayer must be set
  if (isInternalCall && !actingPlayer && acting_as_player_id) {
    const target = players.find(p => p.id === acting_as_player_id);
    actingPlayer = target ?? null;
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
    // B4 fix: Resource Hubs do NOT increase activation count.
    // Activation limit = max(1, floor(territories / 3)), capped at territories owned.
    const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: actingPlayer.id,
    });
    const ownedCount = ownedStates.length;
    const activationLimit = ownedCount === 0 ? 0 :
      Math.min(Math.max(1, Math.floor(ownedCount / 3)), ownedCount);
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

    // Optionally include admin lock status in the same response (saves a round-trip)
    let adminLockStatus = null;
    if (body.include_admin_status) {
      const activePl = players.filter(p => !p.is_eliminated);
      const [stagingRecs, deployDecs] = await Promise.all([
        base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'planning_stage', round }),
        base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'deploy', round }),
      ]);
      adminLockStatus = {
        players: activePl.map(p => {
          const s = stagingRecs.find(r => r.player_id === p.id);
          const d = deployDecs.find(r => r.player_id === p.id);
          return {
            player_id: p.id,
            display_name: p.display_name,
            planning_locked: !!(s?.data?.locked_at),
            locked_at: s?.data?.locked_at ?? null,
            military_locked: d?.is_locked ?? false,
          };
        }),
      };
    }

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      round,
      phase_started: !!deployIncome,
      planning_locked: planningLocked,
      locked_at: staging.locked_at ?? null,
      admin_lock_status: adminLockStatus,

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
    if (!actingPlayer) {
      return Response.json({ error: 'actingPlayer could not be resolved. Pass acting_as_player_id.' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();

    // Idempotency: already dealt this round
    if (stagingData.objective_dealt && stagingData.objective_dealt_round === round) {
      // Still return existing pending draw so UI can show cards
      const ledgerRecordsIdem = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
        campaign_id, player_id: actingPlayer.id,
      });
      const ledgerIdem = ledgerRecordsIdem[0];
      const cardsIdem = ledgerIdem?.objective_cards_json ?? {};
      const allCardDefsIdem = await base44.asServiceRole.entities.SecretObjectiveCard.list();
      const cardMapIdem = {};
      for (const c of allCardDefsIdem) cardMapIdem[c.card_id] = c;
      return Response.json({ success: true, idempotent: true, message: 'Objectives already dealt this round.',
        drawn: cardsIdem.pending_draw ?? [], card_definitions: cardMapIdem });
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
    // Best-effort, non-blocking. Full per-player evaluation runs at lockPlanningPhase.
    try {
      await base44.asServiceRole.functions.invoke('objectivePhase', {
        action: 'evaluateObjectives',
        campaign_id,
        acting_as_player_id: actingPlayer.id,
        _internal: true,
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

    // Activation limit — B4 fix: Resource Hubs do NOT add extra activations.
    const ownedCount = ownedStates.length;
    const activationLimit = ownedCount === 0 ? 0 :
      Math.min(Math.max(1, Math.floor(ownedCount / 3)), ownedCount);

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

    // Accept local-first payloads from the UI staging store.
    const localEconomicStaged      = body._local_economic_staged       ?? null;
    const localDiplomaticStaged    = body._local_diplomatic_staged     ?? null;
    const localMilitaryPlacements  = body._local_military_placements   ?? null;
    const localCapitalTerritoryId  = body._local_capital_territory_id  ?? null;

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    const stagingData = staging?.data ?? emptyStaging();

    // Merge local-first economic staging into stagingData if provided and not already server-staged
    if (localEconomicStaged && !stagingData.economic_locked && (!stagingData.economic_staged || stagingData.economic_staged.length === 0)) {
      stagingData.economic_staged = localEconomicStaged;
    }
    // Merge local-first diplomatic staging into stagingData if provided and not already staged
    if (localDiplomaticStaged?.kept_card_id && !stagingData.diplomatic_locked && !stagingData.diplomatic_staged) {
      stagingData.diplomatic_staged = localDiplomaticStaged;
    }

    // Idempotency: already locked
    if (stagingData.locked_at) {
      return Response.json({
        success: true,
        idempotent: true,
        message: 'Planning phase already locked.',
        locked_at: stagingData.locked_at,
      });
    }

    // ── B3 Validation: enforce objective selection before lock ──────────────
    // If the player has a pending draw, they must have staged a selection.
    const preLockLedgers = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
      campaign_id, player_id: actingPlayer.id,
    });
    const preLockCards = preLockLedgers[0]?.objective_cards_json ?? {};
    const hasPendingDraw = preLockCards.pending_draw && preLockCards.pending_draw.length > 0;

    if (hasPendingDraw && !stagingData.diplomatic_staged && !localDiplomaticStaged) {
      return Response.json({
        error: 'You must select an objective card from your pending draw before locking the Planning Phase.',
        validation_error: 'objective_not_selected',
      }, { status: 400 });
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
      // Use local-first placements if provided by the UI (latest state); fall back to server decision
      const placements = localMilitaryPlacements ?? deployDecision.data?.placements ?? {};
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

        // Resolve capital territory + dev records for food production calculations
        const devRecords = await base44.asServiceRole.entities.TerritoryDevelopment.filter({
          campaign_id, owner_player_id: actingPlayer.id,
        });
        const capitalDev = devRecords.find(d => d.is_capital) ?? null;
        const capitalTerritoryId = capitalDev?.territory_id ?? null;
        // Capital territory state (may be same as activated territory if no capital set)
        const capitalTs = capitalTerritoryId ? stateMap[capitalTerritoryId] : null;

        const activationResults = [];
        // Track accumulated non-food resources to write to capital once after all activations
        const capitalAccum = { gold: 0, iron: 0, timber: 0, stone: 0 };
        let foodAccum = 0;

        for (const territory_id of economicStaged) {
          const ts = stateMap[territory_id];
          if (!ts) continue;
          const primary = ts.resource_type ?? SC_RESOURCE_TYPES[territory_id] ?? 'food';
          const generated = { gold: 0, iron: 0, timber: 0, stone: 0, food: 0 };
          generated[primary] = 1;

          // Food is a special resource — accumulate separately for ledger/auto-invest
          if (primary === 'food') {
            foodAccum += 1;
          } else {
            capitalAccum[primary] = (capitalAccum[primary] ?? 0) + 1;
          }
          // Food production based on territory development level (always produces food)
          // Level 1: produce 2, consume 1 → net +1
          // Level 2: produce 2.5, consume 2 → net +0.5
          // Level 3: produce 3, consume 3 → net 0
          // Level 4: produce 4, consume 4.5 → net -0.5
          // Level 5: produce 5, consume 6 → net -1
          // We apply per-territory food surplus from development here
          {
            const devRec = devRecords.find(d => d.territory_id === territory_id);
            const devLevel = devRec?.development_level ?? 1;
            const FOOD_NET = [0, 1, 0.5, 0, -0.5, -1]; // index = level
            const netFood = FOOD_NET[Math.min(devLevel, 5)] ?? 0;
            if (netFood > 0) foodAccum += netFood;
          }

          activationResults.push({
            territory_id,
            player_id: actingPlayer.id,
            resource_type: primary,
            amount_generated: 1,
            generated,
            destination: primary === 'food' ? 'ledger_food' : (capitalTerritoryId ?? territory_id),
          });
        }

        // ── Supply route bonus: determine activated hub territories via TerritoryBuilding records
        // (do NOT rely solely on TerritoryState.has_resource_hub which may lag behind).
        const [activeSupplyRoutes, hubBuildings] = await Promise.all([
          base44.asServiceRole.entities.SupplyRoute.filter({
            campaign_id, owner_player_id: actingPlayer.id,
          }),
          base44.asServiceRole.entities.TerritoryBuilding.filter({
            campaign_id, player_id: actingPlayer.id, building_type: 'resource_hub', status: 'active',
          }),
        ]);
        const hubBuildingTerritoryIds = new Set(hubBuildings.map(b => b.territory_id));
        const activatedHubIds = new Set(economicStaged.filter(tid =>
          hubBuildingTerritoryIds.has(tid) || stateMap[tid]?.has_resource_hub
        ));
        // Fetch all territory states once for supply route source lookups
        const allStatesForRoutes = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const allDevRecsForRoutes = await base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id });

        for (const route of activeSupplyRoutes) {
          if (route.route_status !== 'active') continue;
          if (!activatedHubIds.has(route.hub_territory_id)) continue;

          // Resolve source territory's primary resource from live TerritoryState
          // (route.resource_type may be stale). Fall back to SC_RESOURCE_TYPES map.
          const sourceTs = allStatesForRoutes.find(s => s.territory_id === route.source_territory_id);
          const sourcePrimary = sourceTs?.resource_type ?? SC_RESOURCE_TYPES[route.source_territory_id] ?? route.resource_type ?? null;
          if (!sourcePrimary) continue;

          // Primary resource — guaranteed
          if (sourcePrimary !== 'food') {
            capitalAccum[sourcePrimary] = (capitalAccum[sourcePrimary] ?? 0) + 1;
          } else {
            foodAccum += 1;
          }

          // Secondary resource — 40% chance if unlocked (dev level >= 2)
          const sourceDevRec = allDevRecsForRoutes.find(d => d.territory_id === route.source_territory_id);
          const sourceDevLevel = sourceDevRec?.development_level ?? 1;
          let secondaryGenerated = null;
          if (sourceDevLevel >= 2) {
            // We don't store a canonical secondary resource per territory yet,
            // so skip the secondary roll here — just log it as future work.
            // This can be wired once secondary resources are defined in map config.
          }

          activationResults.push({
            territory_id: route.source_territory_id,
            player_id: actingPlayer.id,
            resource_type: sourcePrimary,
            amount_generated: 1,
            generated: { [sourcePrimary]: 1 },
            destination: sourcePrimary === 'food' ? 'ledger_food' : (capitalTerritoryId ?? route.hub_territory_id),
            via_supply_route: route.id,
            hub_territory_id: route.hub_territory_id,
            source_dev_level: sourceDevLevel,
            secondary_generated: secondaryGenerated,
          });
        }

        // Write non-food resources to capital territory storage (or split to individual territories if no capital)
        if (capitalTs && (capitalAccum.gold + capitalAccum.iron + capitalAccum.timber + capitalAccum.stone) > 0) {
          const capBefore = { gold: 0, iron: 0, timber: 0, stone: 0, food: 0, ...(capitalTs.resource_storage ?? {}) };
          const capAfter = { ...capBefore };
          for (const r of ['gold', 'iron', 'timber', 'stone']) {
            capAfter[r] = (capAfter[r] || 0) + (capitalAccum[r] || 0);
          }
          await base44.asServiceRole.entities.TerritoryState.update(capitalTs.id, {
            resource_storage: capAfter,
          });
        } else if (!capitalTs) {
          // No capital set — fall back to storing each resource in the activated territory
          for (const territory_id of economicStaged) {
            const ts = stateMap[territory_id];
            if (!ts) continue;
            const primary = ts.resource_type ?? SC_RESOURCE_TYPES[territory_id] ?? 'food';
            if (primary === 'food') continue;
            const before = { gold: 0, iron: 0, timber: 0, stone: 0, food: 0, ...(ts.resource_storage ?? {}) };
            const after = { ...before };
            after[primary] = (after[primary] || 0) + 1;
            await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
              resource_storage: after, resource_type: primary,
            });
          }
        }

        // Food is invested directly into the capital's development track.
        // We inline the investment logic here rather than calling autoInvestFoodToCapital
        // so that development progress updates atomically with the planning lock.
        if (foodAccum > 0) {
          const [ledgerRecords, allDevRecords] = await Promise.all([
            base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id, player_id: actingPlayer.id }),
            base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id, owner_player_id: actingPlayer.id }),
          ]);
          const existingLedger = ledgerRecords[0];

          // Find capital dev record — auto-designate if none set yet
          let capitalDevRecord = allDevRecords.find(d => d.is_capital) ?? null;

          if (!capitalDevRecord && allDevRecords.length > 0) {
            // Auto-designate the first dev record as capital so food doesn't silently vanish
            // (player can change it later via setCapital)
            capitalDevRecord = allDevRecords[0];
            await base44.asServiceRole.entities.TerritoryDevelopment.update(capitalDevRecord.id, {
              is_capital: true, capital_set_round: round,
            });
            capitalDevRecord = { ...capitalDevRecord, is_capital: true, capital_set_round: round };
          }

          if (capitalDevRecord) {
            // Invest food into capital development
            // foodToNextLevel thresholds: level 1→3, 2→5, 3→8, 4→12, 5→17, higher→level+12
            function foodThreshold(lvl) {
              const thresholds = [0, 3, 5, 8, 12, 17];
              return thresholds[lvl] ?? (lvl + 12);
            }

            let level = capitalDevRecord.development_level ?? 1;
            let progress = (capitalDevRecord.development_progress ?? 0) + foodAccum;
            let totalInvested = (capitalDevRecord.total_food_invested ?? 0) + foodAccum;

            // Level-up loop
            while (progress >= foodThreshold(level)) {
              progress -= foodThreshold(level);
              level += 1;
            }

            // Compute unlocked resources based on level
            const allUnlocked = ['primary'];
            if (level >= 2) allUnlocked.push('secondary');
            if (level >= 4) allUnlocked.push('tertiary');
            const slotCount = level >= 5 ? 3 : level >= 3 ? 2 : 1;

            await base44.asServiceRole.entities.TerritoryDevelopment.update(capitalDevRecord.id, {
              development_level: level,
              development_progress: Math.max(0, progress),
              food_to_next_level: foodThreshold(level),
              total_food_invested: totalInvested,
              unlocked_resources: allUnlocked,
              unlocked_slot_count: slotCount,
              last_updated_round: round,
            });

            // Food is fully consumed by capital investment — no ledger storage needed
            // (food stays at 0 in the ledger; we just create/update it for consistency)
            if (existingLedger) {
              await base44.asServiceRole.entities.PlayerResourceLedger.update(existingLedger.id, {
                updated_at_round: round, updated_at_phase: 'deploy',
              });
            } else {
              await base44.asServiceRole.entities.PlayerResourceLedger.create({
                campaign_id, player_id: actingPlayer.id,
                gold: 0, iron: 0, timber: 0, stone: 0, food: 0,
                updated_at_round: round, updated_at_phase: 'deploy',
              });
            }

            // Log the investment for audit visibility
            activationResults.push({
              territory_id: capitalDevRecord.territory_id,
              player_id: actingPlayer.id,
              resource_type: 'food',
              amount_generated: foodAccum,
              generated: { food: foodAccum },
              destination: 'capital_development',
              capital_territory_id: capitalDevRecord.territory_id,
              development_level_before: capitalDevRecord.development_level ?? 1,
              development_level_after: level,
            });
          } else {
            // No capital set — store food in ledger so player can manually invest later
            if (existingLedger) {
              await base44.asServiceRole.entities.PlayerResourceLedger.update(existingLedger.id, {
                food: (existingLedger.food ?? 0) + foodAccum,
                updated_at_round: round, updated_at_phase: 'deploy',
              });
            } else {
              await base44.asServiceRole.entities.PlayerResourceLedger.create({
                campaign_id, player_id: actingPlayer.id,
                gold: 0, iron: 0, timber: 0, stone: 0, food: foodAccum,
                updated_at_round: round, updated_at_phase: 'deploy',
              });
            }
          }
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

    // ── 2b. Round-limited objective expiration ──────────────────────────────
    // At lock time, expire any held objectives that contain "this round" in their description
    // and were not completed this round.
    try {
      const expireLedgers = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
        campaign_id, player_id: actingPlayer.id,
      });
      const expireLedger = expireLedgers[0];
      if (expireLedger?.objective_cards_json) {
        const expireCards = { ...expireLedger.objective_cards_json };
        const heldNow = expireCards.held ?? [];
        if (heldNow.length > 0) {
          const expireAllDefs = await base44.asServiceRole.entities.SecretObjectiveCard.list();
          const expireDefMap = {};
          for (const c of expireAllDefs) expireDefMap[c.card_id] = c;
          const completedIds = new Set((expireCards.completed ?? []).map(e => e.card_id));
          const toExpire = heldNow.filter(cid => {
            if (completedIds.has(cid)) return false;
            const def = expireDefMap[cid];
            if (!def) return false;
            return (def.description ?? '').toLowerCase().includes('this round');
          });
          if (toExpire.length > 0) {
            const deckRecsExp = await base44.asServiceRole.entities.CampaignObjectiveDeck.filter({ campaign_id });
            const deckExp = deckRecsExp[0];
            if (deckExp) {
              await base44.asServiceRole.entities.CampaignObjectiveDeck.update(deckExp.id, {
                discard_pile: [...(deckExp.discard_pile ?? []), ...toExpire],
              });
            }
            expireCards.held = heldNow.filter(cid => !toExpire.includes(cid));
            expireCards.discarded = [
              ...(expireCards.discarded ?? []),
              ...toExpire.map(cid => ({ card_id: cid, discarded_round: round, reason: 'round_expired' })),
            ];
            await base44.asServiceRole.entities.PlayerInfluenceLedger.update(expireLedger.id, {
              objective_cards_json: expireCards, updated_at_round: round,
            });
          }
        }
      }
    } catch (expErr) {
      console.warn('[lockPlanningPhase] Round-limited objective expiration failed (non-fatal):', expErr?.message);
    }

    // ── 2b. Capital: apply staged capital selection ─────────────────────────
    if (localCapitalTerritoryId) {
      const devRecordsForCapital = await base44.asServiceRole.entities.TerritoryDevelopment.filter({
        campaign_id, owner_player_id: actingPlayer.id,
      });
      // Unset any existing capital
      for (const rec of devRecordsForCapital) {
        if (rec.is_capital && rec.territory_id !== localCapitalTerritoryId) {
          await base44.asServiceRole.entities.TerritoryDevelopment.update(rec.id, {
            is_capital: false,
          });
        }
      }
      // Set new capital (create record if missing)
      const existingCapDev = devRecordsForCapital.find(d => d.territory_id === localCapitalTerritoryId);
      if (existingCapDev) {
        await base44.asServiceRole.entities.TerritoryDevelopment.update(existingCapDev.id, {
          is_capital: true, capital_set_round: round,
        });
      } else {
        await base44.asServiceRole.entities.TerritoryDevelopment.create({
          campaign_id, territory_id: localCapitalTerritoryId,
          owner_player_id: actingPlayer.id,
          development_level: 1, development_progress: 0,
          food_to_next_level: 3, total_food_invested: 0,
          is_capital: true, capital_set_round: round,
          unlocked_resources: ['primary'], unlocked_slot_count: 1,
          last_updated_round: round,
        });
      }
      results.capital = { set: true, territory_id: localCapitalTerritoryId };
    } else {
      results.capital = { set: false, skipped: true };
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
          // replace_card_id can be an existing held card (swap it out) OR the kept_card_id itself
          // (meaning: discard the new card, keep all existing held cards unchanged).
          const isValidReplace = replace_card_id && (
            currentHeld.includes(replace_card_id) || replace_card_id === kept_card_id
          );
          if (!isValidReplace) {
            return Response.json({
              error: 'You have 3 active objectives. You must select which existing objective to replace (provide replace_card_id).',
              validation_error: 'replace_card_required',
              held: currentHeld,
            }, { status: 400 });
          }
          if (replace_card_id === kept_card_id) {
            // Player chose to discard the newly drawn card — held remains unchanged
            newHeld = [...currentHeld];
            discardCardIds.push(kept_card_id);
            discardedEntries.push({ card_id: kept_card_id, discarded_round: round });
          } else {
            // Player chose to replace an existing held card with the new one
            newHeld = currentHeld.filter(cid => cid !== replace_card_id).concat(kept_card_id);
            discardCardIds.push(replace_card_id);
            discardedEntries.push({ card_id: replace_card_id, discarded_round: round });
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

    // ── Evaluate objectives for all active players at Planning lock ──────────
    // Uses asServiceRole + _internal:true to bypass user-auth check in objectivePhase.
    try {
      const evalPlayers = players.filter(p => !p.is_eliminated);
      await Promise.all(evalPlayers.map(ep =>
        base44.asServiceRole.functions.invoke('objectivePhase', {
          action: 'evaluateObjectives',
          campaign_id,
          acting_as_player_id: ep.id,
          _internal: true,
        }).catch(e => console.warn(`[lockPlanningPhase] Objective eval failed for ${ep.id}:`, e?.message))
      ));
    } catch (evalErr) {
      console.warn('[lockPlanningPhase] Objective evaluation failed (non-fatal):', evalErr?.message);
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
  // Fully reverses a planning lock, restoring all three pillars to staged state:
  //   Military:   subtracts placed troops from territory states; keeps placements staged
  //   Economic:   subtracts generated resources from capital/territory storage;
  //               reverses food from capital development progress; keeps territory_ids staged
  //   Diplomatic: moves kept card + discarded cards back to pending_draw on the ledger;
  //               removes those card_ids from the deck's discard pile
  if (action === 'unlockPlanningPhase') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy (Planning) phase' }, { status: 400 });
    }

    const staging = await getStagingDecision(base44, campaign_id, actingPlayer.id, round);
    if (!staging?.data?.locked_at) {
      return Response.json({ success: true, idempotent: true, message: 'Planning phase is not locked.' });
    }

    const stagingData = staging.data;
    const reversalLog = {};

    // ── 1. Military reversal ────────────────────────────────────────────────
    // Subtract placed troops from TerritoryState and mark deploy decision unlocked.
    const deployDecision = await getDeployDecision(base44, campaign_id, actingPlayer.id, round);
    if (deployDecision?.is_locked) {
      const placements = deployDecision.data?.placements ?? {};
      if (Object.keys(placements).length > 0) {
        const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        await Promise.all(
          Object.entries(placements).map(([tid, placed]) => {
            if (!placed || placed <= 0) return Promise.resolve();
            const ts = allStates.find(s => s.territory_id === tid);
            if (!ts) return Promise.resolve();
            return base44.asServiceRole.entities.TerritoryState.update(ts.id, {
              troop_count: Math.max(0, (ts.troop_count ?? 0) - placed),
            });
          })
        );
        reversalLog.military = { troops_reversed: Object.values(placements).reduce((s, n) => s + (n || 0), 0), placements };
      }
      // Unlock deploy decision — keep placements intact so UI can restore staged state
      await base44.asServiceRole.entities.PhaseDecision.update(deployDecision.id, {
        is_locked: false,
        locked_at: null,
      });
    }

    // ── 2. Economic reversal ────────────────────────────────────────────────
    // Reverse resources that were written to capital/territory storage at lock time.
    if (stagingData.economic_locked && (stagingData.economic_staged ?? []).length > 0) {
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
      const VALID_RESOURCES = ['gold', 'iron', 'timber', 'stone'];
      const economicStaged = stagingData.economic_staged;

      const [allTsForEco, devRecsEco] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id, owner_player_id: actingPlayer.id }),
      ]);
      const myTsMap = {};
      for (const ts of allTsForEco) {
        if (ts.owner_player_id === actingPlayer.id) myTsMap[ts.territory_id] = ts;
      }

      const capitalDevRec = devRecsEco.find(d => d.is_capital) ?? null;
      const capitalTs = capitalDevRec ? allTsForEco.find(s => s.territory_id === capitalDevRec.territory_id) : null;

      // Compute what was generated and accumulated into capital
      const capitalDeduct = { gold: 0, iron: 0, timber: 0, stone: 0 };
      let foodDeduct = 0;

      for (const tid of economicStaged) {
        const ts = myTsMap[tid];
        if (!ts) continue;
        const primary = ts.resource_type ?? SC_RESOURCE_TYPES[tid] ?? 'food';
        if (primary === 'food') {
          foodDeduct += 1;
        } else if (VALID_RESOURCES.includes(primary)) {
          capitalDeduct[primary] = (capitalDeduct[primary] ?? 0) + 1;
        }
        // Reverse food net from development
        const devRec = devRecsEco.find(d => d.territory_id === tid);
        const devLevel = devRec?.development_level ?? 1;
        const FOOD_NET = [0, 1, 0.5, 0, -0.5, -1];
        const netFood = FOOD_NET[Math.min(devLevel, 5)] ?? 0;
        if (netFood > 0) foodDeduct += netFood;
      }

      // Also account for supply route resources that were written to capital
      const [activeSupplyRoutes, hubBuildings] = await Promise.all([
        base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id, owner_player_id: actingPlayer.id }),
        base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id, player_id: actingPlayer.id, building_type: 'resource_hub', status: 'active' }),
      ]);
      const hubBuildingTerritoryIds = new Set(hubBuildings.map(b => b.territory_id));
      const activatedHubIds = new Set(economicStaged.filter(tid =>
        hubBuildingTerritoryIds.has(tid) || myTsMap[tid]?.has_resource_hub
      ));
      for (const route of activeSupplyRoutes) {
        if (route.route_status !== 'active') continue;
        if (!activatedHubIds.has(route.hub_territory_id)) continue;
        const sourceTs = allTsForEco.find(s => s.territory_id === route.source_territory_id);
        const sourcePrimary = sourceTs?.resource_type ?? SC_RESOURCE_TYPES[route.source_territory_id] ?? route.resource_type ?? null;
        if (!sourcePrimary) continue;
        if (sourcePrimary === 'food') {
          foodDeduct += 1;
        } else if (VALID_RESOURCES.includes(sourcePrimary)) {
          capitalDeduct[sourcePrimary] = (capitalDeduct[sourcePrimary] ?? 0) + 1;
        }
      }

      // Deduct non-food from capital storage
      if (capitalTs && VALID_RESOURCES.some(r => capitalDeduct[r] > 0)) {
        const newStorage = { gold: 0, iron: 0, timber: 0, stone: 0, food: 0, ...(capitalTs.resource_storage ?? {}) };
        for (const r of VALID_RESOURCES) {
          newStorage[r] = Math.max(0, (newStorage[r] ?? 0) - (capitalDeduct[r] ?? 0));
        }
        await base44.asServiceRole.entities.TerritoryState.update(capitalTs.id, { resource_storage: newStorage });
      } else if (!capitalTs) {
        // No capital — resources were stored in individual activated territories; reverse each
        await Promise.all(economicStaged.map(tid => {
          const ts = myTsMap[tid];
          if (!ts) return Promise.resolve();
          const primary = ts.resource_type ?? SC_RESOURCE_TYPES[tid] ?? 'food';
          if (primary === 'food') return Promise.resolve();
          const newStorage = { gold: 0, iron: 0, timber: 0, stone: 0, food: 0, ...(ts.resource_storage ?? {}) };
          newStorage[primary] = Math.max(0, (newStorage[primary] ?? 0) - 1);
          return base44.asServiceRole.entities.TerritoryState.update(ts.id, { resource_storage: newStorage });
        }));
      }

      // Reverse food from capital development progress
      if (foodDeduct > 0 && capitalDevRec) {
        function foodThreshold(lvl) {
          const thresholds = [0, 3, 5, 8, 12, 17];
          return thresholds[lvl] ?? (lvl + 12);
        }
        // Walk backwards: reconstruct what level/progress was before the food was invested
        let level = capitalDevRec.development_level ?? 1;
        let progress = capitalDevRec.development_progress ?? 0;
        let totalInvested = Math.max(0, (capitalDevRec.total_food_invested ?? 0) - foodDeduct);
        // Subtract food from progress, potentially de-leveling
        let remaining = foodDeduct;
        while (remaining > 0 && level >= 1) {
          if (progress >= remaining) {
            progress -= remaining;
            remaining = 0;
          } else {
            remaining -= progress;
            if (level > 1) {
              level -= 1;
              progress = foodThreshold(level) - remaining;
              remaining = 0;
            } else {
              progress = 0;
              remaining = 0;
            }
          }
        }
        await base44.asServiceRole.entities.TerritoryDevelopment.update(capitalDevRec.id, {
          development_level: Math.max(1, level),
          development_progress: Math.max(0, progress),
          food_to_next_level: foodThreshold(Math.max(1, level)),
          total_food_invested: totalInvested,
          last_updated_round: round,
        });
      }

      reversalLog.economic = { deducted: capitalDeduct, food_reversed: foodDeduct };
    }

    // ── 3. Diplomatic reversal ──────────────────────────────────────────────
    // Move the kept card (and any replaced card) back to pending_draw.
    // Remove them from the deck's discard pile.
    if (stagingData.diplomatic_locked && stagingData.diplomatic_staged?.kept_card_id) {
      const { kept_card_id, replace_card_id } = stagingData.diplomatic_staged;

      const [ledgerRecs, deckRecs] = await Promise.all([
        base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id, player_id: actingPlayer.id }),
        base44.asServiceRole.entities.CampaignObjectiveDeck.filter({ campaign_id }),
      ]);
      const ledger = ledgerRecs[0];
      const deck = deckRecs[0];

      if (ledger) {
        const cards = { held: [], pending_draw: null, completed: [], discarded: [], ...(ledger.objective_cards_json ?? {}) };

        // Determine which cards were discarded at lock time from this operation
        // Cards discarded during this lock: the non-kept drawn cards + (replace_card_id if it was a held card swap)
        const lockedPendingCards = [kept_card_id]; // kept was in pending_draw — restore it

        // Cards to restore to pending_draw: was the entire pending_draw that was drawn at autoDeal
        // We need to figure out what the full drawn set was. The deck opportunity_log has it.
        let originalDrawn = null;
        if (deck) {
          // Find the opportunity_log entry for this round+player
          const logEntry = (deck.opportunity_log ?? []).slice().reverse().find(
            e => e.round === round && e.player_id === actingPlayer.id
          );
          if (logEntry) {
            originalDrawn = logEntry.drawn ?? null;
          }
        }

        // Cards to remove from deck discard pile (were moved there at lock time)
        const cardsToRestoreFromDeck = [];
        let newHeld = [...(cards.held ?? [])];
        let newDiscarded = [...(cards.discarded ?? [])];

        if (originalDrawn && originalDrawn.length > 0) {
          // Restore ALL originally drawn cards back to pending_draw
          // Remove them from deck.discard_pile since they're active again
          for (const cid of originalDrawn) {
            if (cid !== kept_card_id) cardsToRestoreFromDeck.push(cid); // non-kept were discarded to deck
            // Remove any discarded entry added at lock time
            newDiscarded = newDiscarded.filter(e => !(e.card_id === cid && e.discarded_round === round));
          }
          // If replace_card_id was a held card that was swapped out, restore it to held
          if (replace_card_id && replace_card_id !== kept_card_id && !newHeld.includes(replace_card_id)) {
            // The kept card was added to held — remove it; restore replace_card_id back
            newHeld = newHeld.filter(cid => cid !== kept_card_id);
            newHeld.push(replace_card_id);
            // replace_card_id was added to deck discard — remove it
            cardsToRestoreFromDeck.push(replace_card_id);
            newDiscarded = newDiscarded.filter(e => !(e.card_id === replace_card_id && e.discarded_round === round));
          } else if (!replace_card_id) {
            // Simple add: kept_card_id was added to held without replacement — remove it from held
            newHeld = newHeld.filter(cid => cid !== kept_card_id);
          } else if (replace_card_id === kept_card_id) {
            // Player discarded the new card and kept existing hand — no held changes needed
            cardsToRestoreFromDeck.push(kept_card_id);
            newDiscarded = newDiscarded.filter(e => !(e.card_id === kept_card_id && e.discarded_round === round));
          }

          const updatedCards = {
            ...cards,
            held: newHeld,
            pending_draw: originalDrawn, // restore full drawn set
            discarded: newDiscarded,
          };
          await base44.asServiceRole.entities.PlayerInfluenceLedger.update(ledger.id, {
            objective_cards_json: updatedCards, updated_at_round: round,
          });
        }

        // Remove restored cards from deck discard pile
        if (deck && cardsToRestoreFromDeck.length > 0) {
          const restoreSet = new Set(cardsToRestoreFromDeck);
          // Remove one instance of each card from the discard pile
          const currentDiscard = [...(deck.discard_pile ?? [])];
          const newDeckDiscard = [];
          const toRemove = { ...Object.fromEntries([...restoreSet].map(c => [c, 1])) };
          for (const cid of currentDiscard) {
            if (toRemove[cid] > 0) {
              toRemove[cid]--;
            } else {
              newDeckDiscard.push(cid);
            }
          }
          // Also remove the opportunity_log entry for this round+player so re-lock works cleanly
          const newOpLog = (deck.opportunity_log ?? []).filter(
            e => !(e.round === round && e.player_id === actingPlayer.id)
          );
          await base44.asServiceRole.entities.CampaignObjectiveDeck.update(deck.id, {
            discard_pile: newDeckDiscard,
            opportunity_log: newOpLog,
          });
        }

        reversalLog.diplomatic = { kept_card_id, replace_card_id: replace_card_id ?? null, restored_to_pending: originalDrawn };
      }
    }

    // ── Unlock the staging decision — wipe locked_at and per-pillar locks ───
    // Keep economic_staged and diplomatic_staged intact so the UI can restore them.
    await upsertStagingDecision(base44, campaign_id, actingPlayer.id, round, {
      military_locked: false,
      economic_locked: false,
      diplomatic_locked: false,
      locked_at: null,
    });

    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id, phase: 'deploy', round,
      event_type: 'planning_phase_unlocked',
      player_id: actingPlayer.id,
      payload: { display_name: actingPlayer.display_name, unlocked_by: myPlayer?.id ?? actingPlayer.id, reversal: reversalLog },
      is_public: true,
    });

    return Response.json({
      success: true,
      message: `Planning phase unlocked for ${actingPlayer.display_name}.`,
      player_id: actingPlayer.id,
      reversal: reversalLog,
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
  } catch (err) {
    console.error('[planningPhase] Unhandled error:', err?.message ?? err);
    return Response.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
});