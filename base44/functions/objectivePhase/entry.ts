/**
 * objectivePhase — Sprint 4I Secret Objective Engine
 *
 * Actions:
 *   getObjectiveState     — returns deck state + player's held/completed/discarded objectives
 *   initializeDeck        — admin: creates the campaign deck from all SecretObjectiveCard records
 *   drawOpportunity       — player draws 3 cards (or fewer if deck+discard small); stores pending
 *   resolveOpportunity    — player keeps 1 card, discards rest; enforces cap of 3 active
 *   completeObjective     — marks objective complete, reveals, awards influence via Sprint 4G
 *   adminCompleteObjective — admin completes objective for any player
 *   adminDiscardObjective  — admin discards an active objective (correction tool)
 *
 * ─── DECK MODEL ──────────────────────────────────────────────────────────────
 *   CampaignObjectiveDeck.draw_pile    = ordered array of card_ids (top = index 0)
 *   CampaignObjectiveDeck.discard_pile = all used card_ids (completed + discarded)
 *   PlayerInfluenceLedger.objective_cards_json = {
 *     held: [card_id, ...],                                  // max 3
 *     pending_draw: [card_id, ...] | null,                   // 3 drawn, awaiting keep choice
 *     completed: [{ card_id, completed_round, reward_amount, placement_territory_id }],
 *     discarded: [{ card_id, discarded_round }],
 *   }
 *
 * ─── INFLUENCE REWARD ────────────────────────────────────────────────────────
 *   Calls influencePhase addDirectInfluence logic inline (no local imports).
 *   Tier 1=3, Tier 2=5, Tier 3=8, Tier 4=12.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Constants ────────────────────────────────────────────────────────────────

const OBJECTIVE_TIER_REWARDS = { 1: 3, 2: 5, 3: 8, 4: 12 };
const MAX_HAND_SIZE = 3;
const DRAW_COUNT = 3;

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

// ─── Shuffle helper ───────────────────────────────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Ledger helpers ───────────────────────────────────────────────────────────

function emptyCards() {
  return { held: [], pending_draw: null, completed: [], discarded: [] };
}

async function getLedger(base44, campaignId, playerId) {
  const records = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
    campaign_id: campaignId, player_id: playerId,
  });
  return records[0] ?? null;
}

async function upsertLedger(base44, campaignId, playerId, patch) {
  const records = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({
    campaign_id: campaignId, player_id: playerId,
  });
  if (records[0]) {
    await base44.asServiceRole.entities.PlayerInfluenceLedger.update(records[0].id, patch);
    return { ...records[0], ...patch };
  } else {
    const created = await base44.asServiceRole.entities.PlayerInfluenceLedger.create({
      campaign_id: campaignId, player_id: playerId,
      global_influence: 0, regional_influence_json: {},
      objective_cards_json: emptyCards(),
      updated_at_round: 0,
      ...patch,
    });
    return created;
  }
}

// ─── Deck helpers ─────────────────────────────────────────────────────────────

async function getDeck(base44, campaignId) {
  const records = await base44.asServiceRole.entities.CampaignObjectiveDeck.filter({ campaign_id: campaignId });
  return records[0] ?? null;
}

/**
 * drawFromDeck — draws `count` cards from the deck.
 * Auto-reshuffles discard into draw pile when empty.
 * Skips cards already held by any player in the campaign.
 * Returns { drawn: card_id[], updatedDeck }.
 */
async function drawFromDeck(base44, campaignId, count, excludeCardIds) {
  let deck = await getDeck(base44, campaignId);
  if (!deck) throw new Error('Deck not initialized for this campaign.');

  const exclude = new Set(excludeCardIds ?? []);
  const drawn = [];

  let drawPile = [...(deck.draw_pile ?? [])];
  let discardPile = [...(deck.discard_pile ?? [])];

  const maxAttempts = drawPile.length + discardPile.length;
  let attempts = 0;

  while (drawn.length < count && attempts < maxAttempts) {
    // Reshuffle if draw pile is empty
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break; // truly empty
      drawPile = shuffleArray(discardPile);
      discardPile = [];
    }

    const cardId = drawPile.shift();
    attempts++;
    if (!exclude.has(cardId)) {
      drawn.push(cardId);
    } else {
      // Put excluded cards back at the bottom so they can be drawn later
      drawPile.push(cardId);
    }
  }

  // Persist updated deck
  await base44.asServiceRole.entities.CampaignObjectiveDeck.update(deck.id, {
    draw_pile: drawPile,
    discard_pile: discardPile,
  });

  return { drawn, deckId: deck.id };
}

async function addToDiscard(base44, campaignId, cardIds) {
  const deck = await getDeck(base44, campaignId);
  if (!deck) return;
  const updated = [...(deck.discard_pile ?? []), ...cardIds];
  await base44.asServiceRole.entities.CampaignObjectiveDeck.update(deck.id, {
    discard_pile: updated,
  });
}

async function appendOpportunityLog(base44, campaignId, logEntry) {
  const deck = await getDeck(base44, campaignId);
  if (!deck) return;
  const log = [...(deck.opportunity_log ?? []), logEntry];
  await base44.asServiceRole.entities.CampaignObjectiveDeck.update(deck.id, {
    opportunity_log: log,
  });
}

// ─── Influence reward (inline — mirrors influencePhase addDirectInfluence) ────

async function addDirectInfluence(base44, campaignId, playerId, territoryId, amount, round) {
  const regionId = SC_TERRITORY_REGION[territoryId];

  // Permanent influence on territory
  const existing = await base44.asServiceRole.entities.TerritoryInfluence.filter({
    campaign_id: campaignId, territory_id: territoryId, player_id: playerId,
  });
  const record = existing[0];
  if (record) {
    await base44.asServiceRole.entities.TerritoryInfluence.update(record.id, {
      influence_amount: Math.max(0, (record.influence_amount ?? 0) + amount),
      last_updated_round: round, source: 'objective',
    });
  } else {
    await base44.asServiceRole.entities.TerritoryInfluence.create({
      campaign_id: campaignId, territory_id: territoryId, player_id: playerId,
      influence_amount: Math.max(0, amount), last_updated_round: round, source: 'objective',
    });
  }

  // Spendable influence in region
  let newSpendable = 0;
  if (regionId) {
    const pools = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
      campaign_id: campaignId, region_id: regionId, player_id: playerId,
    });
    const pool = pools[0];
    if (pool) {
      newSpendable = Math.max(0, (pool.spendable_influence ?? 0) + amount);
      await base44.asServiceRole.entities.RegionalInfluencePool.update(pool.id, {
        spendable_influence: newSpendable, last_updated_round: round,
      });
    } else {
      newSpendable = Math.max(0, amount);
      await base44.asServiceRole.entities.RegionalInfluencePool.create({
        campaign_id: campaignId, region_id: regionId, player_id: playerId,
        spendable_influence: newSpendable, last_updated_round: round,
      });
    }
  }

  return { region_id: regionId, spendable: newSpendable };
}

/**
 * resolvePlacement — determines which territory to award influence to.
 * Falls back to player_choice (caller must supply placement_territory_id).
 */
function resolvePlacement(cardDef, placementTerritoryId, stateById) {
  const rule = cardDef.placement_rule ?? 'player_choice';

  if (rule === 'player_choice' || rule === 'captured_territory' || rule === 'primary_territory' || rule === 'structure_territory') {
    return placementTerritoryId ?? null;
  }
  if (rule === 'region_capital') {
    // Find highest-troop territory in the target region owned by the player
    // (stateById is available at call site for this lookup)
    return placementTerritoryId ?? null; // caller must pass best territory
  }
  return placementTerritoryId ?? null;
}

// ─── All-player held cards set ────────────────────────────────────────────────

async function getAllHeldCardIds(base44, campaignId) {
  const ledgers = await base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id: campaignId });
  const held = new Set();
  for (const l of ledgers) {
    const cards = l.objective_cards_json ?? emptyCards();
    for (const cid of (cards.held ?? [])) held.add(cid);
    for (const cid of (cards.pending_draw ?? [])) held.add(cid);
  }
  return held;
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

  // Internal/service-role calls skip user auth (e.g. from planningPhase evaluateObjectives)
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

  const isAdmin = isInternalCall || (user && campaign.admin_user_id === user.id);
  const round = campaign.current_round ?? 1;

  // Resolve acting player (admin can act as others; internal calls require acting_as_player_id)
  const { acting_as_player_id } = body;
  let actingPlayer = myPlayer;
  if (acting_as_player_id) {
    const target = players.find(p => p.id === acting_as_player_id);
    if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
    if (!isAdmin && !isInternalCall && target.id !== myPlayer?.id) {
      return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
    }
    actingPlayer = target;
  }
  if (isInternalCall && !actingPlayer) {
    return Response.json({ error: 'Internal calls must provide acting_as_player_id' }, { status: 400 });
  }

  // ── ACTION: getObjectiveState ──────────────────────────────────────────────
  if (action === 'getObjectiveState') {
    const [deck, ledger, allCards] = await Promise.all([
      getDeck(base44, campaign_id),
      getLedger(base44, campaign_id, actingPlayer.id),
      base44.asServiceRole.entities.SecretObjectiveCard.list(),
    ]);

    const cardMap = {};
    for (const c of allCards) cardMap[c.card_id] = c;

    const cards = ledger?.objective_cards_json ?? emptyCards();

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      held: cards.held ?? [],
      pending_draw: cards.pending_draw ?? null,
      completed: cards.completed ?? [],
      discarded: cards.discarded ?? [],
      deck_draw_count: deck?.draw_pile?.length ?? 0,
      deck_discard_count: deck?.discard_pile?.length ?? 0,
      deck_initialized: !!deck,
      card_definitions: cardMap,
    });
  }

  // ── ACTION: initializeDeck (admin only) ───────────────────────────────────
  if (action === 'initializeDeck') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const existing = await getDeck(base44, campaign_id);
    if (existing) {
      return Response.json({ success: true, message: 'Deck already initialized', deck_size: existing.draw_pile?.length ?? 0 });
    }

    const allCards = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const shuffled = shuffleArray(allCards.map(c => c.card_id));

    await base44.asServiceRole.entities.CampaignObjectiveDeck.create({
      campaign_id,
      draw_pile: shuffled,
      discard_pile: [],
      opportunity_log: [],
      initialized_at_round: round,
    });

    return Response.json({ success: true, deck_size: shuffled.length, message: `Deck initialized with ${shuffled.length} cards.` });
  }

  // ── ACTION: drawOpportunity ────────────────────────────────────────────────
  // Draws 3 cards and stores them as pending_draw on the player's ledger.
  // Does NOT auto-initialize deck — admin must call initializeDeck first.
  if (action === 'drawOpportunity') {
    // Auto-initialize deck if needed (convenience)
    let deck = await getDeck(base44, campaign_id);
    if (!deck) {
      if (!isAdmin && !myPlayer.is_admin) {
        return Response.json({ error: 'Deck not initialized. Ask admin to initialize the objective deck.' }, { status: 400 });
      }
      const allCards = await base44.asServiceRole.entities.SecretObjectiveCard.list();
      const shuffled = shuffleArray(allCards.map(c => c.card_id));
      deck = await base44.asServiceRole.entities.CampaignObjectiveDeck.create({
        campaign_id, draw_pile: shuffled, discard_pile: [],
        opportunity_log: [], initialized_at_round: round,
      });
    }

    const ledger = await getLedger(base44, campaign_id, actingPlayer.id);
    const cards = ledger?.objective_cards_json ?? emptyCards();

    // Cannot draw if already has pending draw
    if (cards.pending_draw && cards.pending_draw.length > 0) {
      return Response.json({ error: 'Already have a pending draw. Resolve it before drawing again.', pending_draw: cards.pending_draw }, { status: 400 });
    }

    // Get all currently held card ids across all players to avoid duplicates
    const allHeld = await getAllHeldCardIds(base44, campaign_id);
    // Also exclude player's own completed/discarded in this session (they're already in discard pile)

    const { drawn } = await drawFromDeck(base44, campaign_id, DRAW_COUNT, allHeld);
    if (drawn.length === 0) {
      return Response.json({ error: 'No cards available to draw.' }, { status: 400 });
    }

    // Store pending draw
    const updatedCards = { ...cards, pending_draw: drawn };
    await upsertLedger(base44, campaign_id, actingPlayer.id, {
      objective_cards_json: updatedCards,
      updated_at_round: round,
    });

    // Fetch definitions for response
    const allCardDefs = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const cardMap = {};
    for (const c of allCardDefs) cardMap[c.card_id] = c;

    return Response.json({
      success: true,
      drawn,
      card_definitions: cardMap,
      held_count: (cards.held ?? []).length,
      message: `Drew ${drawn.length} objective cards. Choose 1 to keep.`,
    });
  }

  // ── ACTION: resolveOpportunity ─────────────────────────────────────────────
  // Player picks 1 card to keep from pending_draw; rest go to discard.
  // Enforces MAX_HAND_SIZE. If at cap, kept card replaces nothing by default —
  // but if player is at 3 and keeps a 4th, we return an error requiring replace_card_id.
  if (action === 'resolveOpportunity') {
    const { kept_card_id, replace_card_id, submission_id: oppSubmissionId } = body;
    if (!kept_card_id) return Response.json({ error: 'kept_card_id is required' }, { status: 400 });

    const ledger = await getLedger(base44, campaign_id, actingPlayer.id);
    const cards = ledger?.objective_cards_json ?? emptyCards();

    // ── Idempotency: if card already in held and pending_draw is gone, it was already resolved ──
    if (!cards.pending_draw || cards.pending_draw.length === 0) {
      // Check if the kept card is already held — means this was already processed
      if ((cards.held ?? []).includes(kept_card_id)) {
        return Response.json({ success: true, held: cards.held, kept: kept_card_id, idempotent: true, message: 'Opportunity already resolved.' });
      }
      return Response.json({ error: 'No pending draw to resolve.' }, { status: 400 });
    }

    // submission_id dedup via opportunity_log
    if (oppSubmissionId) {
      const deck = await getDeck(base44, campaign_id);
      const log = deck?.opportunity_log ?? [];
      const dup = log.find(e => e.submission_id === oppSubmissionId);
      if (dup) {
        return Response.json({ success: true, held: cards.held, kept: dup.kept, idempotent: true, message: 'Opportunity already resolved.' });
      }
    }

    if (!cards.pending_draw.includes(kept_card_id)) {
      return Response.json({ error: 'kept_card_id is not in pending draw.' }, { status: 400 });
    }

    const currentHeld = cards.held ?? [];
    const toDiscard = cards.pending_draw.filter(cid => cid !== kept_card_id);

    let newHeld;
    const discardedObjectiveEntry = [];
    const discardCardIds = [...toDiscard]; // These always go to deck discard pile

    if (currentHeld.length >= MAX_HAND_SIZE) {
      // At cap — must replace an existing objective with the new one
      if (!replace_card_id) {
        return Response.json({
          error: `You already have ${MAX_HAND_SIZE} active objectives. Provide replace_card_id to swap one out.`,
          held: currentHeld,
          kept_card_id,
        }, { status: 400 });
      }
      if (!currentHeld.includes(replace_card_id)) {
        return Response.json({ error: 'replace_card_id is not in your active objectives.' }, { status: 400 });
      }
      // Remove replaced card, add new one
      newHeld = currentHeld.filter(cid => cid !== replace_card_id).concat(kept_card_id);
      discardCardIds.push(replace_card_id);
      discardedObjectiveEntry.push({ card_id: replace_card_id, discarded_round: round });
    } else {
      newHeld = [...currentHeld, kept_card_id];
    }

    // Move discarded cards into deck's discard pile
    await addToDiscard(base44, campaign_id, discardCardIds);

    // Append opportunity log — include submission_id for idempotency checking
    await appendOpportunityLog(base44, campaign_id, {
      round,
      player_id: actingPlayer.id,
      drawn: [...cards.pending_draw],
      kept: kept_card_id,
      discarded: discardCardIds,
      submission_id: oppSubmissionId ?? null,
      timestamp: new Date().toISOString(),
    });

    // Update ledger
    const updatedCards = {
      ...cards,
      held: newHeld,
      pending_draw: null,
      discarded: [...(cards.discarded ?? []), ...toDiscard.map(cid => ({ card_id: cid, discarded_round: round })), ...discardedObjectiveEntry],
    };
    await upsertLedger(base44, campaign_id, actingPlayer.id, {
      objective_cards_json: updatedCards,
      updated_at_round: round,
    });

    return Response.json({
      success: true,
      held: newHeld,
      kept: kept_card_id,
      discarded: discardCardIds,
      replace_used: !!replace_card_id,
      message: `Kept "${kept_card_id}". Discarded ${discardCardIds.length} card(s).`,
    });
  }

  // ── ACTION: completeObjective — ADMIN/SYSTEM ONLY ────────────────────────
  // Normal players cannot self-complete objectives. Completion is automatic (system evaluation)
  // or via adminCompleteObjective. This endpoint is kept for backward compat but requires admin.
  if (action === 'completeObjective') {
    if (!isAdmin) {
      return Response.json({
        error: 'Objectives are completed automatically by the system. Manual completion is not available.',
      }, { status: 403 });
    }
    // Admin path — same as adminCompleteObjective but for the acting player
    const { card_id, placement_territory_id } = body;
    if (!card_id) return Response.json({ error: 'card_id is required' }, { status: 400 });

    const ledger = await getLedger(base44, campaign_id, actingPlayer.id);
    const cards = ledger?.objective_cards_json ?? emptyCards();

    if (!(cards.held ?? []).includes(card_id)) {
      return Response.json({ error: 'card_id is not in the player\'s active objectives.' }, { status: 400 });
    }

    const allCards = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const cardDef = allCards.find(c => c.card_id === card_id);
    if (!cardDef) return Response.json({ error: 'Card definition not found.' }, { status: 404 });

    const rewardAmount = OBJECTIVE_TIER_REWARDS[cardDef.tier] ?? 3;
    const placementTerritory = resolvePlacement(cardDef, placement_territory_id, {});

    let influenceResult = null;
    if (placementTerritory) {
      influenceResult = await addDirectInfluence(base44, campaign_id, actingPlayer.id, placementTerritory, rewardAmount, round);
    }

    await addToDiscard(base44, campaign_id, [card_id]);

    const newHeld = (cards.held ?? []).filter(cid => cid !== card_id);
    const completedEntry = { card_id, completed_round: round, reward_amount: rewardAmount, placement_territory_id: placementTerritory ?? null };
    const updatedCards = { ...cards, held: newHeld, completed: [...(cards.completed ?? []), completedEntry] };
    await upsertLedger(base44, campaign_id, actingPlayer.id, {
      objective_cards_json: updatedCards, updated_at_round: round,
    });

    return Response.json({
      success: true, card_id, card_title: cardDef.title, tier: cardDef.tier,
      reward_amount: rewardAmount, placement_territory_id: placementTerritory,
      influence_region: influenceResult?.region_id ?? null,
      message: `[Admin] Completed "${cardDef.title}" for ${actingPlayer.display_name}.`,
    });
  }

  // ── ACTION: adminCompleteObjective (admin only) ────────────────────────────
  if (action === 'adminCompleteObjective') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const { target_player_id, card_id, placement_territory_id } = body;
    if (!target_player_id || !card_id) {
      return Response.json({ error: 'target_player_id and card_id are required' }, { status: 400 });
    }

    const targetPlayer = players.find(p => p.id === target_player_id);
    if (!targetPlayer) return Response.json({ error: 'Target player not found' }, { status: 404 });

    const ledger = await getLedger(base44, campaign_id, target_player_id);
    const cards = ledger?.objective_cards_json ?? emptyCards();

    if (!(cards.held ?? []).includes(card_id)) {
      return Response.json({ error: 'card_id is not in target player\'s active objectives.' }, { status: 400 });
    }

    const allCards = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const cardDef = allCards.find(c => c.card_id === card_id);
    if (!cardDef) return Response.json({ error: 'Card definition not found.' }, { status: 404 });

    const rewardAmount = OBJECTIVE_TIER_REWARDS[cardDef.tier] ?? 3;
    const placementTerritory = resolvePlacement(cardDef, placement_territory_id, {});

    let influenceResult = null;
    if (placementTerritory) {
      influenceResult = await addDirectInfluence(base44, campaign_id, target_player_id, placementTerritory, rewardAmount, round);
    }

    await addToDiscard(base44, campaign_id, [card_id]);

    const newHeld = (cards.held ?? []).filter(cid => cid !== card_id);
    const completedEntry = { card_id, completed_round: round, reward_amount: rewardAmount, placement_territory_id: placementTerritory ?? null };
    const updatedCards = { ...cards, held: newHeld, completed: [...(cards.completed ?? []), completedEntry] };
    await upsertLedger(base44, campaign_id, target_player_id, {
      objective_cards_json: updatedCards, updated_at_round: round,
    });

    return Response.json({
      success: true, card_id, card_title: cardDef.title, tier: cardDef.tier,
      target_player: targetPlayer.display_name, reward_amount: rewardAmount,
      placement_territory_id: placementTerritory, influence_region: influenceResult?.region_id ?? null,
    });
  }

  // ── ACTION: adminDiscardObjective (admin only) ─────────────────────────────
  if (action === 'adminDiscardObjective') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const { target_player_id, card_id } = body;
    if (!target_player_id || !card_id) {
      return Response.json({ error: 'target_player_id and card_id are required' }, { status: 400 });
    }

    const targetPlayer = players.find(p => p.id === target_player_id);
    if (!targetPlayer) return Response.json({ error: 'Target player not found' }, { status: 404 });

    const ledger = await getLedger(base44, campaign_id, target_player_id);
    const cards = ledger?.objective_cards_json ?? emptyCards();

    if (!(cards.held ?? []).includes(card_id)) {
      return Response.json({ error: 'card_id not found in player\'s held objectives.' }, { status: 400 });
    }

    await addToDiscard(base44, campaign_id, [card_id]);

    const newHeld = (cards.held ?? []).filter(cid => cid !== card_id);
    const updatedCards = {
      ...cards, held: newHeld,
      discarded: [...(cards.discarded ?? []), { card_id, discarded_round: round }],
    };
    await upsertLedger(base44, campaign_id, target_player_id, {
      objective_cards_json: updatedCards, updated_at_round: round,
    });

    return Response.json({ success: true, card_id, target_player: targetPlayer.display_name });
  }

  // ── Shared: Objective condition evaluator ────────────────────────────────
  // Evaluates a single card's completion_condition against game state.
  // Returns { conditionMet, placementTerritory, progressCurrent, progressRequired }.
  //
  // gameState = { ownedStates, allTerritoryStates, allPools, allBuildings,
  //               allSupplyRoutes, allBattleCards, allConstructionProjects,
  //               permInfluenceByTerritory, allDiplomaticActions }
  function evaluateCondition(cardDef, playerId, gameState) {
    const condition = cardDef.completion_condition ?? cardDef.trigger_condition ?? '';
    const params = cardDef.condition_params ?? cardDef.metadata_json ?? {};
    const {
      ownedStates, allTerritoryStates, allPools = [], allBuildings = [],
      allSupplyRoutes = [], allBattleCards = [], allConstructionProjects = [],
      permInfluenceByTerritory = [], allDiplomaticActions = [],
    } = gameState;

    const ownedIds = new Set(ownedStates.map(s => s.territory_id));

    // ── Legacy string-format conditions ─────────────────────────────────────
    if (condition.startsWith('hold_territories:') || condition.startsWith('territories_count:')) {
      const required = parseInt(condition.split(':')[1]) || (params.count ?? 0);
      return { conditionMet: ownedStates.length >= required, progressCurrent: ownedStates.length, progressRequired: required };
    }
    if (condition.startsWith('hold_region:')) {
      const regionId = condition.split(':')[1] ?? params.region_id;
      const regionTs = allTerritoryStates.filter(s => SC_TERRITORY_REGION[s.territory_id] === regionId);
      const ownedInRegion = regionTs.filter(s => ownedIds.has(s.territory_id)).length;
      return { conditionMet: regionTs.length > 0 && ownedInRegion >= regionTs.length, progressCurrent: ownedInRegion, progressRequired: regionTs.length };
    }
    if (condition.startsWith('influence_pool:')) {
      const parts = condition.split(':'); const region = parts[1]; const minAmt = parseInt(parts[2]) || (params.min_influence ?? 0);
      const pool = allPools.find(p => p.player_id === playerId && p.region_id === region);
      const amt = pool?.spendable_influence ?? 0;
      return { conditionMet: amt >= minAmt, progressCurrent: amt, progressRequired: minAmt };
    }

    // ── Canonical modern conditions ──────────────────────────────────────────

    // occupy_territories: own >= count territories
    if (condition === 'occupy_territories') {
      const required = params.count ?? 8;
      return { conditionMet: ownedStates.length >= required, progressCurrent: ownedStates.length, progressRequired: required };
    }

    // occupy_regions: own territories in >= count different regions
    if (condition === 'occupy_regions') {
      const required = params.count ?? 4;
      const regionsPresent = new Set(ownedStates.map(s => SC_TERRITORY_REGION[s.territory_id]).filter(Boolean));
      return { conditionMet: regionsPresent.size >= required, progressCurrent: regionsPresent.size, progressRequired: required };
    }

    // occupy_full_region: own every territory in at least one region
    if (condition === 'occupy_full_region') {
      const regionCounts = {};
      const regionOwned = {};
      for (const ts of allTerritoryStates) {
        const r = SC_TERRITORY_REGION[ts.territory_id];
        if (!r) continue;
        regionCounts[r] = (regionCounts[r] ?? 0) + 1;
        if (ts.owner_player_id === playerId) regionOwned[r] = (regionOwned[r] ?? 0) + 1;
      }
      const fullRegion = Object.keys(regionCounts).find(r => regionCounts[r] > 0 && (regionOwned[r] ?? 0) >= regionCounts[r]);
      // For progress: best region completion %
      let bestOwned = 0, bestTotal = 1;
      for (const [r, total] of Object.entries(regionCounts)) {
        const owned = regionOwned[r] ?? 0;
        if (owned / total > bestOwned / bestTotal) { bestOwned = owned; bestTotal = total; }
      }
      return { conditionMet: !!fullRegion, progressCurrent: bestOwned, progressRequired: bestTotal };
    }

    // occupy_full_continent: own every territory on at least one continent
    if (condition === 'occupy_full_continent') {
      // Derive continent membership from territory_id prefix
      const CONTINENT_PREFIX = { I: 'ironspine', W: 'wild_frontier', B: 'fracture_basin', S: 'sunfields', C: 'shattered_coast' };
      const contCounts = {};
      const contOwned = {};
      for (const ts of allTerritoryStates) {
        const prefix = ts.territory_id?.[0];
        const cont = CONTINENT_PREFIX[prefix];
        if (!cont) continue;
        contCounts[cont] = (contCounts[cont] ?? 0) + 1;
        if (ts.owner_player_id === playerId) contOwned[cont] = (contOwned[cont] ?? 0) + 1;
      }
      const fullCont = Object.keys(contCounts).find(c => contCounts[c] > 0 && (contOwned[c] ?? 0) >= contCounts[c]);
      let bestOwned = 0, bestTotal = 1;
      for (const [c, total] of Object.entries(contCounts)) {
        const owned = contOwned[c] ?? 0;
        if (owned / total > bestOwned / bestTotal) { bestOwned = owned; bestTotal = total; }
      }
      return { conditionMet: !!fullCont, progressCurrent: bestOwned, progressRequired: bestTotal };
    }

    // territory_on_every_continent: own ≥1 territory on each continent
    if (condition === 'territory_on_every_continent') {
      const CONTINENT_PREFIX = { I: 'ironspine', W: 'wild_frontier', B: 'fracture_basin', S: 'sunfields', C: 'shattered_coast' };
      const allConts = new Set(Object.values(CONTINENT_PREFIX));
      const ownedConts = new Set(ownedStates.map(s => CONTINENT_PREFIX[s.territory_id?.[0]]).filter(Boolean));
      return { conditionMet: [...allConts].every(c => ownedConts.has(c)), progressCurrent: ownedConts.size, progressRequired: allConts.size };
    }

    // control_resource_territories: own >= count territories producing a given resource
    if (condition === 'control_resource_territories') {
      const resource = params.resource;
      const required = params.count ?? 3;
      const SC_RESOURCE_TYPES = { I1:'iron',I2:'iron',I3:'stone',I4:'iron',I5:'stone',I6:'timber',I7:'timber',I8:'iron',W1:'timber',W2:'stone',W3:'timber',W4:'timber',W5:'timber',W6:'timber',W7:'gold',W8:'gold',W9:'iron',B1:'stone',B2:'stone',B3:'stone',B4:'stone',B5:'iron',B6:'stone',B7:'stone',B8:'stone',B9:'iron',B10:'gold',S1:'timber',S2:'gold',S3:'iron',S4:'gold',S5:'gold',S6:'stone',S7:'timber',S8:'gold',S9:'iron',C1:'iron',C2:'gold',C3:'iron',C4:'gold',C5:'gold',C6:'gold',C7:'stone',C8:'gold' };
      const count = ownedStates.filter(s => (s.resource_type ?? SC_RESOURCE_TYPES[s.territory_id]) === resource).length;
      return { conditionMet: count >= required, progressCurrent: count, progressRequired: required };
    }

    // control_resource_hubs: own >= count territories with active Resource Hub buildings
    if (condition === 'control_resource_hubs') {
      const required = params.count ?? 3;
      const hubTerrIds = new Set(allBuildings.filter(b => b.player_id === playerId && b.building_type === 'resource_hub' && b.status === 'active').map(b => b.territory_id));
      const count = ownedStates.filter(s => s.has_resource_hub || hubTerrIds.has(s.territory_id)).length;
      return { conditionMet: count >= required, progressCurrent: count, progressRequired: required };
    }

    // build_structure: player has an active building of the given type
    if (condition === 'build_structure') {
      const buildingType = params.building_type;
      const found = allBuildings.find(b => b.player_id === playerId && b.building_type === buildingType && b.status === 'active');
      return { conditionMet: !!found, progressCurrent: found ? 1 : 0, progressRequired: 1, placementTerritory: found?.territory_id };
    }

    // complete_pillar_build: player has completed any building of the given pillar
    if (condition === 'complete_pillar_build') {
      const pillar = params.pillar;
      const found = allBuildings.find(b => b.player_id === playerId && b.pillar_type === pillar && b.status === 'active');
      return { conditionMet: !!found, progressCurrent: found ? 1 : 0, progressRequired: 1, placementTerritory: found?.territory_id };
    }

    // control_active_buildings: player has >= count active buildings total
    if (condition === 'control_active_buildings') {
      const required = params.count ?? 5;
      const count = allBuildings.filter(b => b.player_id === playerId && b.status === 'active').length;
      return { conditionMet: count >= required, progressCurrent: count, progressRequired: required };
    }

    // control_pillar_structures: player has >= count active buildings of the given pillar
    if (condition === 'control_pillar_structures') {
      const required = params.count ?? 3;
      const pillar = params.pillar;
      const count = allBuildings.filter(b => b.player_id === playerId && b.pillar_type === pillar && b.status === 'active').length;
      return { conditionMet: count >= required, progressCurrent: count, progressRequired: required };
    }

    // multi_structure_territory: player has a territory with >= count active buildings
    if (condition === 'multi_structure_territory') {
      const required = params.count ?? 2;
      const byTerritory = {};
      for (const b of allBuildings.filter(b => b.player_id === playerId && b.status === 'active' && ownedIds.has(b.territory_id))) {
        byTerritory[b.territory_id] = (byTerritory[b.territory_id] ?? 0) + 1;
      }
      const best = Math.max(0, ...Object.values(byTerritory));
      const bestTerr = Object.entries(byTerritory).find(([, v]) => v >= required)?.[0] ?? null;
      return { conditionMet: best >= required, progressCurrent: best, progressRequired: required, placementTerritory: bestTerr };
    }

    // complete_construction_projects: player completed >= count construction projects this round
    if (condition === 'complete_construction_projects') {
      const required = params.count ?? 2;
      const count = allConstructionProjects.filter(p => p.player_id === playerId && p.status === 'completed' && p.completed_at && p.completed_at.startsWith(new Date().getFullYear().toString())).length;
      // Simpler: count active buildings completed this round
      const completedThisRound = allBuildings.filter(b => b.player_id === playerId && b.status === 'active' && b.completed_round === round).length;
      return { conditionMet: completedThisRound >= required, progressCurrent: completedThisRound, progressRequired: required };
    }

    // build_in_regions: player has active buildings in >= count different regions
    if (condition === 'build_in_regions') {
      const required = params.count ?? 3;
      const regions = new Set(allBuildings.filter(b => b.player_id === playerId && b.status === 'active' && SC_TERRITORY_REGION[b.territory_id]).map(b => SC_TERRITORY_REGION[b.territory_id]));
      return { conditionMet: regions.size >= required, progressCurrent: regions.size, progressRequired: required };
    }

    // build_in_occupied_territory: player has a territory with ≥2 buildings (at least one was pre-existing)
    if (condition === 'build_in_occupied_territory') {
      const byTerritory = {};
      for (const b of allBuildings.filter(b => b.player_id === playerId && b.status === 'active' && ownedIds.has(b.territory_id))) {
        byTerritory[b.territory_id] = (byTerritory[b.territory_id] ?? 0) + 1;
      }
      const found = Object.entries(byTerritory).find(([, v]) => v >= 2);
      return { conditionMet: !!found, progressCurrent: found ? 2 : Math.max(0, ...Object.values(byTerritory), 0), progressRequired: 2, placementTerritory: found?.[0] };
    }

    // maintain_all_buildings: all player buildings are still active (none damaged/destroyed)
    if (condition === 'maintain_all_buildings') {
      const playerBuildings = allBuildings.filter(b => b.player_id === playerId);
      const anyDamaged = playerBuildings.some(b => b.status === 'damaged' || b.status === 'destroyed');
      const active = playerBuildings.filter(b => b.status === 'active').length;
      return { conditionMet: !anyDamaged && active > 0, progressCurrent: active, progressRequired: active };
    }

    // establish_supply_route_length: player has an active supply route (range >= length)
    if (condition === 'establish_supply_route_length') {
      const required = params.length ?? 3;
      const found = allSupplyRoutes.find(r => r.owner_player_id === playerId && r.route_status === 'active' && (r.range_distance ?? 1) >= required);
      return { conditionMet: !!found, progressCurrent: found ? (found.range_distance ?? 1) : 0, progressRequired: required };
    }

    // win_battles: player won >= count battle cards this round
    if (condition === 'win_battles') {
      const required = params.count ?? 2;
      const wins = allBattleCards.filter(bc => bc.round === round && (bc.status === 'resolved' || bc.status === 'auto_resolved') && bc.result?.winner_player_id === playerId).length;
      return { conditionMet: wins >= required, progressCurrent: wins, progressRequired: required };
    }

    // win_battle_type: player won a battle of the given type this round
    if (condition === 'win_battle_type') {
      const battleType = params.battle_type;
      const found = allBattleCards.find(bc => bc.round === round && bc.battle_type === battleType && (bc.status === 'resolved' || bc.status === 'auto_resolved') && bc.result?.winner_player_id === playerId);
      return { conditionMet: !!found, progressCurrent: found ? 1 : 0, progressRequired: 1 };
    }

    // capture_territories: player captured >= count territories this round (owns but attacker was player)
    if (condition === 'capture_territories') {
      const required = params.count ?? 1;
      const wins = allBattleCards.filter(bc => bc.round === round && (bc.status === 'resolved' || bc.status === 'auto_resolved') && bc.result?.winner_player_id === playerId && bc.attackers?.some(a => a.player_id === playerId)).length;
      return { conditionMet: wins >= required, progressCurrent: wins, progressRequired: required };
    }

    // capture_in_new_region: player captured a territory in a region they didn't have at round start
    // (approximate: won a battle in a region where they only have 1 territory)
    if (condition === 'capture_in_new_region') {
      const ownedRegions = new Set(ownedStates.map(s => SC_TERRITORY_REGION[s.territory_id]).filter(Boolean));
      const capturedRegions = new Set(
        allBattleCards.filter(bc => bc.round === round && (bc.status === 'resolved' || bc.status === 'auto_resolved') && bc.result?.winner_player_id === playerId && bc.attackers?.some(a => a.player_id === playerId))
          .map(bc => SC_TERRITORY_REGION[bc.target_territory_id]).filter(Boolean)
      );
      const newRegion = [...capturedRegions].find(r => {
        const ownedInRegion = ownedStates.filter(s => SC_TERRITORY_REGION[s.territory_id] === r).length;
        return ownedInRegion <= 1; // only 1 = just captured it, was 0 before
      });
      return { conditionMet: !!newRegion, progressCurrent: capturedRegions.size, progressRequired: 1 };
    }

    // increase_territory_count: player owns >= count more territories than at round start (approx via battle wins)
    if (condition === 'increase_territory_count') {
      const required = params.count ?? 2;
      const winsAsAttacker = allBattleCards.filter(bc => bc.round === round && (bc.status === 'resolved' || bc.status === 'auto_resolved') && bc.result?.winner_player_id === playerId && bc.attackers?.some(a => a.player_id === playerId)).length;
      return { conditionMet: winsAsAttacker >= required, progressCurrent: winsAsAttacker, progressRequired: required };
    }

    // capture_unoccupied: player won a battle where the target was unoccupied/neutral
    if (condition === 'capture_unoccupied') {
      const found = allBattleCards.find(bc => bc.round === round && (bc.status === 'resolved' || bc.status === 'auto_resolved') && bc.result?.winner_player_id === playerId && !bc.defender_player_id && bc.attackers?.some(a => a.player_id === playerId));
      return { conditionMet: !!found, progressCurrent: found ? 1 : 0, progressRequired: 1 };
    }

    // maintain_all_territories: player hasn't lost any territory this round
    if (condition === 'maintain_all_territories') {
      const lostBattle = allBattleCards.find(bc => bc.round === round && (bc.status === 'resolved' || bc.status === 'auto_resolved') && bc.result?.winner_player_id && bc.result.winner_player_id !== playerId && bc.defender_player_id === playerId);
      return { conditionMet: !lostBattle, progressCurrent: lostBattle ? 0 : 1, progressRequired: 1 };
    }

    // hold_influence_in_regions: player has permanent influence in >= count different regions
    if (condition === 'hold_influence_in_regions') {
      const required = params.count ?? 2;
      const regionsWithInfluence = new Set(
        permInfluenceByTerritory.filter(i => i.player_id === playerId && (i.influence_amount ?? 0) > 0)
          .map(i => SC_TERRITORY_REGION[i.territory_id]).filter(Boolean)
      );
      return { conditionMet: regionsWithInfluence.size >= required, progressCurrent: regionsWithInfluence.size, progressRequired: required };
    }

    // influence_without_territory: player has influence in a region where they own no territories
    if (condition === 'influence_without_territory') {
      const ownedRegions = new Set(ownedStates.map(s => SC_TERRITORY_REGION[s.territory_id]).filter(Boolean));
      const influenceRegions = new Set(
        permInfluenceByTerritory.filter(i => i.player_id === playerId && (i.influence_amount ?? 0) > 0)
          .map(i => SC_TERRITORY_REGION[i.territory_id]).filter(Boolean)
      );
      const shadowRegion = [...influenceRegions].find(r => !ownedRegions.has(r));
      return { conditionMet: !!shadowRegion, progressCurrent: shadowRegion ? 1 : 0, progressRequired: 1 };
    }

    // influence_in_most_regions: player has influence in more regions than any other player
    if (condition === 'influence_in_most_regions') {
      const byPlayer = {};
      for (const i of permInfluenceByTerritory.filter(i => (i.influence_amount ?? 0) > 0)) {
        const r = SC_TERRITORY_REGION[i.territory_id];
        if (!r) continue;
        if (!byPlayer[i.player_id]) byPlayer[i.player_id] = new Set();
        byPlayer[i.player_id].add(r);
      }
      const myCount = byPlayer[playerId]?.size ?? 0;
      const maxOther = Math.max(0, ...Object.entries(byPlayer).filter(([pid]) => pid !== playerId).map(([, s]) => s.size));
      return { conditionMet: myCount > 0 && myCount > maxOther, progressCurrent: myCount, progressRequired: maxOther + 1 };
    }

    // influence_in_controlled_region: player has influence in a region controlled by another player
    if (condition === 'influence_in_controlled_region') {
      // "controlled" = another player owns more territories in that region
      const regionOwners = {};
      for (const ts of allTerritoryStates) {
        const r = SC_TERRITORY_REGION[ts.territory_id];
        if (!r || !ts.owner_player_id) continue;
        if (!regionOwners[r]) regionOwners[r] = {};
        regionOwners[r][ts.owner_player_id] = (regionOwners[r][ts.owner_player_id] ?? 0) + 1;
      }
      const myInfluenceRegions = new Set(
        permInfluenceByTerritory.filter(i => i.player_id === playerId && (i.influence_amount ?? 0) > 0)
          .map(i => SC_TERRITORY_REGION[i.territory_id]).filter(Boolean)
      );
      const found = [...myInfluenceRegions].find(r => {
        const owners = regionOwners[r] ?? {};
        const dominantOwner = Object.entries(owners).sort((a, b) => b[1] - a[1])[0]?.[0];
        return dominantOwner && dominantOwner !== playerId;
      });
      return { conditionMet: !!found, progressCurrent: found ? 1 : 0, progressRequired: 1 };
    }

    // submit_diplomatic_action: player submitted one of the listed action types this round
    if (condition === 'submit_diplomatic_action') {
      const actionTypes = params.action_types ?? [];
      const found = allDiplomaticActions.find(a => a.player_id === playerId && a.round === round && actionTypes.includes(a.action_type));
      return { conditionMet: !!found, progressCurrent: found ? 1 : 0, progressRequired: 1 };
    }

    // Unknown condition: skip
    return { conditionMet: false, progressCurrent: 0, progressRequired: 0 };
  }

  // ── Shared: find best placement territory for influence reward ────────────
  function resolveBestPlacement(cardDef, conditionResult, ownedStates) {
    // Use placement from condition evaluation if available (e.g. specific building territory)
    if (conditionResult.placementTerritory) return conditionResult.placementTerritory;
    // placement_rule = structure_territory → use building territory from condition result
    // Fall back to highest-troop owned territory
    if (ownedStates.length === 0) return null;
    return ownedStates.reduce((a, b) => (b.troop_count ?? 0) > (a.troop_count ?? 0) ? b : a).territory_id;
  }

  // ── ACTION: evaluateObjectives ────────────────────────────────────────────
  // Called at the start of Planning Phase to auto-complete eligible objectives.
  // Idempotent per card (skips already-completed cards).
  // Falls back to inline catalog definitions when DB records are stale/missing auto_completable.
  // Inline catalog: card_id → { auto_completable, completion_condition, condition_params, placement_rule }
  const INLINE_CATALOG_AUTO = {
    // military
    mil_build_barracks:   { auto_completable: true,  completion_condition: 'build_structure',         condition_params: { building_type: 'barracks' },   placement_rule: 'structure_territory' },
    mil_capture_1:        { auto_completable: true,  completion_condition: 'capture_territories',     condition_params: { count: 1 },                    placement_rule: 'captured_territory' },
    mil_capture_2:        { auto_completable: true,  completion_condition: 'capture_territories',     condition_params: { count: 2 },                    placement_rule: 'captured_territory' },
    mil_win_2_battles:    { auto_completable: true,  completion_condition: 'win_battles',             condition_params: { count: 2 },                    placement_rule: 'primary_contributing_territory' },
    mil_win_siege:        { auto_completable: true,  completion_condition: 'win_battle_type',         condition_params: { battle_type: 'siege' },         placement_rule: 'captured_territory' },
    mil_win_bloodbath:    { auto_completable: true,  completion_condition: 'win_battle_type',         condition_params: { battle_type: 'bloodbath' },     placement_rule: 'primary_contributing_territory' },
    // economic
    eco_build_marketplace:{ auto_completable: true,  completion_condition: 'build_structure',         condition_params: { building_type: 'marketplace' }, placement_rule: 'structure_territory' },
    eco_complete_2_builds:{ auto_completable: true,  completion_condition: 'complete_construction_projects', condition_params: { count: 2 },             placement_rule: 'structure_territory' },
    eco_control_3_hubs:   { auto_completable: true,  completion_condition: 'control_resource_hubs',  condition_params: { count: 3 },                    placement_rule: 'chosen_territory' },
    eco_control_3_iron:   { auto_completable: true,  completion_condition: 'control_resource_territories', condition_params: { resource: 'iron', count: 3 }, placement_rule: 'chosen_territory' },
    eco_control_3_timber: { auto_completable: true,  completion_condition: 'control_resource_territories', condition_params: { resource: 'timber', count: 3 }, placement_rule: 'chosen_territory' },
    eco_control_3_stone:  { auto_completable: true,  completion_condition: 'control_resource_territories', condition_params: { resource: 'stone', count: 3 }, placement_rule: 'chosen_territory' },
    // diplomatic
    dip_build_embassy:    { auto_completable: true,  completion_condition: 'build_structure',         condition_params: { building_type: 'embassy' },     placement_rule: 'structure_territory' },
    dip_broker_trade:     { auto_completable: true,  completion_condition: 'submit_diplomatic_action', condition_params: { action_types: ['merchant_convoy','non_aggression_pact'] }, placement_rule: 'affected_region' },
    dip_two_regions:      { auto_completable: true,  completion_condition: 'hold_influence_in_regions', condition_params: { count: 2 },                 placement_rule: 'chosen_territory' },
    dip_no_territory_region: { auto_completable: true, completion_condition: 'influence_without_territory', condition_params: {},                        placement_rule: 'affected_region' },
    dip_rival_region:     { auto_completable: true,  completion_condition: 'influence_in_controlled_region', condition_params: {},                       placement_rule: 'affected_region' },
    dip_3_diplomatic_structures: { auto_completable: true, completion_condition: 'control_pillar_structures', condition_params: { pillar: 'diplomatic', count: 3 }, placement_rule: 'chosen_territory' },
    dip_most_regions:     { auto_completable: true,  completion_condition: 'influence_in_most_regions', condition_params: {},                            placement_rule: 'chosen_territory' },
    // territorial
    ter_occupy_x:         { auto_completable: true,  completion_condition: 'occupy_territories',      condition_params: { count: 8 },                    placement_rule: 'chosen_territory' },
    ter_occupy_region:    { auto_completable: true,  completion_condition: 'occupy_full_region',      condition_params: {},                              placement_rule: 'affected_region' },
    ter_occupy_continent: { auto_completable: true,  completion_condition: 'occupy_full_continent',   condition_params: {},                              placement_rule: 'chosen_territory' },
    ter_new_region:       { auto_completable: true,  completion_condition: 'capture_in_new_region',   condition_params: {},                              placement_rule: 'captured_territory' },
    ter_4_regions:        { auto_completable: true,  completion_condition: 'occupy_regions',          condition_params: { count: 4 },                    placement_rule: 'chosen_territory' },
    ter_every_continent:  { auto_completable: true,  completion_condition: 'territory_on_every_continent', condition_params: {},                         placement_rule: 'chosen_territory' },
    ter_grow_by_2:        { auto_completable: true,  completion_condition: 'increase_territory_count', condition_params: { count: 2 },                   placement_rule: 'captured_territory' },
    ter_hold_all:         { auto_completable: true,  completion_condition: 'maintain_all_territories', condition_params: {},                             placement_rule: 'chosen_territory' },
    ter_unoccupied:       { auto_completable: true,  completion_condition: 'capture_unoccupied',      condition_params: {},                              placement_rule: 'captured_territory' },
    // infrastructure
    inf_build_military:   { auto_completable: true,  completion_condition: 'complete_pillar_build',   condition_params: { pillar: 'military' },           placement_rule: 'structure_territory' },
    inf_build_economic:   { auto_completable: true,  completion_condition: 'complete_pillar_build',   condition_params: { pillar: 'economic' },           placement_rule: 'structure_territory' },
    inf_build_diplomatic: { auto_completable: true,  completion_condition: 'complete_pillar_build',   condition_params: { pillar: 'diplomatic' },         placement_rule: 'structure_territory' },
    inf_control_5_structures: { auto_completable: true, completion_condition: 'control_active_buildings', condition_params: { count: 5 },                placement_rule: 'chosen_territory' },
    inf_3_regions:        { auto_completable: true,  completion_condition: 'build_in_regions',        condition_params: { count: 3 },                    placement_rule: 'chosen_territory' },
    inf_multi_structure:  { auto_completable: true,  completion_condition: 'multi_structure_territory', condition_params: { count: 2 },                  placement_rule: 'structure_territory' },
    inf_maintain_all:     { auto_completable: true,  completion_condition: 'maintain_all_buildings',  condition_params: {},                              placement_rule: 'chosen_territory' },
    inf_build_railway:    { auto_completable: true,  completion_condition: 'establish_supply_route_length', condition_params: { length: 3 },              placement_rule: 'chosen_territory' },
    inf_upgrade_structure:{ auto_completable: true,  completion_condition: 'build_in_occupied_territory', condition_params: {},                          placement_rule: 'structure_territory' },
  };

  if (action === 'evaluateObjectives') {
    const ledger = await getLedger(base44, campaign_id, actingPlayer.id);
    const cards = ledger?.objective_cards_json ?? emptyCards();
    const held = cards.held ?? [];
    if (held.length === 0) {
      return Response.json({ success: true, evaluated: 0, completed: [], message: 'No held objectives to evaluate.' });
    }

    const allCardDefs = await base44.asServiceRole.entities.SecretObjectiveCard.list();

    // Load all game state needed for evaluation in parallel
    const [allTerritoryStates, allPools, allBuildings, allSupplyRoutes, allBattleCards, allConstructionProjects, permInfluenceByTerritory, allDiplomaticActions] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id, player_id: actingPlayer.id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
      base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round }),
      base44.asServiceRole.entities.ConstructionProject.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
      base44.asServiceRole.entities.DiplomaticAction.filter({ campaign_id }),
    ]);

    const ownedStates = allTerritoryStates.filter(s => s.owner_player_id === actingPlayer.id);
    const gameState = { ownedStates, allTerritoryStates, allPools, allBuildings, allSupplyRoutes, allBattleCards, allConstructionProjects, permInfluenceByTerritory, allDiplomaticActions };

    const completedThisEval = [];
    const skippedThisEval = [];
    let updatedCards = { ...cards };

    for (const cardId of held) {
      const dbDef = allCardDefs.find(c => c.card_id === cardId);
      // Merge DB definition with inline catalog fallback so stale DB records still evaluate.
      const inlineFallback = INLINE_CATALOG_AUTO[cardId] ?? null;
      const cardDef = dbDef ? {
        ...dbDef,
        // If DB record lacks auto_completable or completion_condition, use inline catalog.
        auto_completable: dbDef.auto_completable ?? inlineFallback?.auto_completable ?? false,
        completion_condition: dbDef.completion_condition ?? inlineFallback?.completion_condition ?? null,
        condition_params: (dbDef.condition_params && Object.keys(dbDef.condition_params).length > 0)
          ? dbDef.condition_params
          : (inlineFallback?.condition_params ?? {}),
        placement_rule: dbDef.placement_rule ?? inlineFallback?.placement_rule ?? 'chosen_territory',
      } : (inlineFallback ? { card_id: cardId, tier: 1, ...inlineFallback } : null);

      if (!cardDef) { skippedThisEval.push({ card_id: cardId, reason: 'no_definition' }); continue; }
      if (!cardDef.auto_completable) { skippedThisEval.push({ card_id: cardId, reason: 'not_auto_completable', condition: cardDef.completion_condition }); continue; }
      const alreadyDone = (updatedCards.completed ?? []).some(e => e.card_id === cardId);
      if (alreadyDone) { skippedThisEval.push({ card_id: cardId, reason: 'already_completed' }); continue; }

      const result = evaluateCondition(cardDef, actingPlayer.id, gameState);
      console.log(`[evaluateObjectives] ${cardId} (${cardDef.completion_condition}): met=${result.conditionMet} progress=${result.progressCurrent}/${result.progressRequired}`);

      if (!result.conditionMet) { skippedThisEval.push({ card_id: cardId, reason: 'condition_not_met', condition: cardDef.completion_condition, progress: `${result.progressCurrent}/${result.progressRequired}` }); continue; }

      const rewardAmount = OBJECTIVE_TIER_REWARDS[cardDef.tier] ?? 3;
      const placementTerritory = resolveBestPlacement(cardDef, result, ownedStates);

      if (placementTerritory) {
        await addDirectInfluence(base44, campaign_id, actingPlayer.id, placementTerritory, rewardAmount, round);
      }
      await addToDiscard(base44, campaign_id, [cardId]);

      const completedEntry = { card_id: cardId, completed_round: round, reward_amount: rewardAmount, placement_territory_id: placementTerritory ?? null, auto_completed: true };
      updatedCards = { ...updatedCards, held: (updatedCards.held ?? []).filter(cid => cid !== cardId), completed: [...(updatedCards.completed ?? []), completedEntry] };
      completedThisEval.push({ card_id: cardId, card_title: cardDef.title, reward_amount: rewardAmount, placement_territory_id: placementTerritory });
    }

    if (completedThisEval.length > 0 || skippedThisEval.length > 0) {
      await upsertLedger(base44, campaign_id, actingPlayer.id, { objective_cards_json: updatedCards, updated_at_round: round });
    }

    return Response.json({
      success: true, evaluated: held.length, completed: completedThisEval, skipped: skippedThisEval,
      message: completedThisEval.length > 0 ? `Auto-completed ${completedThisEval.length} objective(s).` : 'No objectives met auto-completion criteria.',
    });
  }

  // ── ACTION: evaluateAllObjectives ────────────────────────────────────────
  // Evaluates all held objectives for all active players. Idempotent per card.
  if (action === 'evaluateAllObjectives') {
    const allCardDefs = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const autoCards = new Set(allCardDefs.filter(c => c.auto_completable).map(c => c.card_id));

    const activePlayers = players.filter(p => !p.is_eliminated);
    const [allLedgers, allTerritoryStates, allPools, allBuildings, allSupplyRoutes, allBattleCards, allConstructionProjects, permInfluenceByTerritory, allDiplomaticActions] = await Promise.all([
      base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
      base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round }),
      base44.asServiceRole.entities.ConstructionProject.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
      base44.asServiceRole.entities.DiplomaticAction.filter({ campaign_id }),
    ]);

    const totalCompleted = [];

    for (const player of activePlayers) {
      const ledger = allLedgers.find(l => l.player_id === player.id);
      const cards = ledger?.objective_cards_json ?? emptyCards();
      const held = cards.held ?? [];
      if (held.length === 0) continue;

      const ownedStates = allTerritoryStates.filter(s => s.owner_player_id === player.id);
      const playerPools = allPools.filter(p => p.player_id === player.id);
      const gameState = { ownedStates, allTerritoryStates, allPools: playerPools, allBuildings, allSupplyRoutes, allBattleCards, allConstructionProjects, permInfluenceByTerritory, allDiplomaticActions };

      let updatedCards = { ...cards };
      const completedForPlayer = [];

      for (const cardId of held) {
        const dbDef = allCardDefs.find(c => c.card_id === cardId);
        const inlineFallback = INLINE_CATALOG_AUTO[cardId] ?? null;
        const cardDef = dbDef ? {
          ...dbDef,
          auto_completable: dbDef.auto_completable ?? inlineFallback?.auto_completable ?? false,
          completion_condition: dbDef.completion_condition ?? inlineFallback?.completion_condition ?? null,
          condition_params: (dbDef.condition_params && Object.keys(dbDef.condition_params).length > 0) ? dbDef.condition_params : (inlineFallback?.condition_params ?? {}),
          placement_rule: dbDef.placement_rule ?? inlineFallback?.placement_rule ?? 'chosen_territory',
        } : (inlineFallback ? { card_id: cardId, tier: 1, ...inlineFallback } : null);
        if (!cardDef || (!cardDef.auto_completable && !autoCards.has(cardId))) continue;
        if (!cardDef.auto_completable) continue;
        const alreadyDone = (updatedCards.completed ?? []).some(e => e.card_id === cardId);
        if (alreadyDone) continue;

        const result = evaluateCondition(cardDef, player.id, gameState);
        if (!result.conditionMet) continue;

        const rewardAmount = OBJECTIVE_TIER_REWARDS[cardDef.tier] ?? 3;
        const placementTerritory = resolveBestPlacement(cardDef, result, ownedStates);
        if (placementTerritory) await addDirectInfluence(base44, campaign_id, player.id, placementTerritory, rewardAmount, round);
        await addToDiscard(base44, campaign_id, [cardId]);

        const completedEntry = { card_id: cardId, completed_round: round, reward_amount: rewardAmount, placement_territory_id: placementTerritory ?? null, auto_completed: true };
        updatedCards = { ...updatedCards, held: (updatedCards.held ?? []).filter(cid => cid !== cardId), completed: [...(updatedCards.completed ?? []), completedEntry] };
        completedForPlayer.push({ card_id: cardId, card_title: cardDef.title, reward_amount: rewardAmount, placement_territory_id: placementTerritory });
      }

      if (completedForPlayer.length > 0) {
        if (ledger) await base44.asServiceRole.entities.PlayerInfluenceLedger.update(ledger.id, { objective_cards_json: updatedCards, updated_at_round: round });
        totalCompleted.push({ player_id: player.id, display_name: player.display_name, completed: completedForPlayer });
      }
    }

    return Response.json({
      success: true, players_evaluated: activePlayers.length,
      total_completions: totalCompleted.reduce((s, p) => s + p.completed.length, 0),
      details: totalCompleted,
      message: totalCompleted.length > 0 ? `Auto-completed objectives for ${totalCompleted.length} player(s).` : 'No objectives met auto-completion criteria.',
    });
  }

  // ── ACTION: seedCatalog (admin only) ──────────────────────────────────────
  // Bulk-upserts the objective catalog into SecretObjectiveCard records.
  // Idempotent: updates existing records by card_id, creates missing ones.
  if (action === 'seedCatalog') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const { catalog } = body;
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return Response.json({ error: 'catalog array is required' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const existingByCardId = {};
    for (const c of existing) existingByCardId[c.card_id] = c;

    let created = 0;
    let updated = 0;

    for (const obj of catalog) {
      const record = existingByCardId[obj.card_id];
      const payload = {
        card_id: obj.card_id,
        category: obj.category,
        tier: obj.tier,
        title: obj.title,
        description: obj.description,
        completion_condition: obj.completion_condition ?? null,
        condition_params: obj.condition_params ?? {},
        placement_rule: obj.placement_rule ?? 'chosen_territory',
        auto_completable: obj.automation_level === 'automatic',
      };
      if (record) {
        await base44.asServiceRole.entities.SecretObjectiveCard.update(record.id, payload);
        updated++;
      } else {
        await base44.asServiceRole.entities.SecretObjectiveCard.create(payload);
        created++;
      }
    }

    return Response.json({
      success: true,
      created,
      updated,
      total: catalog.length,
      message: `Catalog seeded: ${created} created, ${updated} updated.`,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[objectivePhase] Unhandled error:', err?.message ?? err);
    return Response.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
});