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

  // Resolve acting player (admin can act as others)
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

  // ── ACTION: evaluateObjectives ────────────────────────────────────────────
  // Called at the start of Planning Phase to auto-complete eligible objectives.
  // Checks each held objective's trigger_condition against current game state.
  // Awards influence, moves completed cards to discard. Idempotent per round.
  // Only objectives with auto_completable=true (or automation_level='automatic') are evaluated.
  if (action === 'evaluateObjectives') {
    const ledger = await getLedger(base44, campaign_id, actingPlayer.id);
    const cards = ledger?.objective_cards_json ?? emptyCards();
    const held = cards.held ?? [];
    if (held.length === 0) {
      return Response.json({ success: true, evaluated: 0, completed: [], message: 'No held objectives to evaluate.' });
    }

    const allCardDefs = await base44.asServiceRole.entities.SecretObjectiveCard.list();
    const [allTerritoryStates] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
    ]);

    const ownedStates = allTerritoryStates.filter(s => s.owner_player_id === actingPlayer.id);
    const ownedTerritoryIds = new Set(ownedStates.map(s => s.territory_id));

    // Load regional influence pools
    const allPools = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
      campaign_id, player_id: actingPlayer.id,
    });
    const poolByRegion = {};
    for (const p of allPools) poolByRegion[p.region_id] = p.spendable_influence ?? 0;

    const completedThisEval = [];
    let updatedCards = { ...cards };

    for (const cardId of held) {
      const cardDef = allCardDefs.find(c => c.card_id === cardId);
      if (!cardDef) continue;
      // Only auto-evaluate cards marked as auto_completable
      if (!cardDef.auto_completable) continue;
      // Skip if already completed this round (idempotency)
      const alreadyDone = (updatedCards.completed ?? []).some(
        e => e.card_id === cardId && e.completed_round === round
      );
      if (alreadyDone) continue;

      // ── Evaluate trigger_condition ──────────────────────────────────────
      // Supported conditions (extend as objective catalog grows):
      //   hold_territories:<count>          — own at least N territories
      //   hold_region:<region_id>           — own ALL territories in a region
      //   influence_pool:<region>:<min>     — have >= min spendable influence in region
      //   territories_count:<min>           — alias for hold_territories
      let conditionMet = false;
      const condition = cardDef.trigger_condition ?? '';
      const params    = cardDef.metadata_json ?? {};

      if (condition.startsWith('hold_territories:') || condition.startsWith('territories_count:')) {
        const required = parseInt(condition.split(':')[1]) || (params.count ?? 0);
        conditionMet = ownedStates.length >= required;
      } else if (condition.startsWith('hold_region:')) {
        const regionId = condition.split(':')[1] ?? params.region_id;
        const regionTerritories = allTerritoryStates.filter(s => SC_TERRITORY_REGION[s.territory_id] === regionId);
        conditionMet = regionTerritories.length > 0 && regionTerritories.every(s => s.owner_player_id === actingPlayer.id);
      } else if (condition.startsWith('influence_pool:')) {
        const parts  = condition.split(':');
        const region = parts[1];
        const minAmt = parseInt(parts[2]) || (params.min_influence ?? 0);
        conditionMet = (poolByRegion[region] ?? 0) >= minAmt;
      }
      // Unknown or no condition: skip (requires manual/admin completion)
      if (!conditionMet) continue;

      // ── Complete the objective ──────────────────────────────────────────
      const rewardAmount = OBJECTIVE_TIER_REWARDS[cardDef.tier] ?? 3;

      // Find a suitable placement territory (highest troop owned territory)
      let placementTerritory = null;
      if (ownedStates.length > 0) {
        const best = ownedStates.reduce((a, b) => (b.troop_count ?? 0) > (a.troop_count ?? 0) ? b : a);
        placementTerritory = best.territory_id;
      }

      if (placementTerritory) {
        await addDirectInfluence(base44, campaign_id, actingPlayer.id, placementTerritory, rewardAmount, round);
      }
      await addToDiscard(base44, campaign_id, [cardId]);

      const completedEntry = {
        card_id: cardId, completed_round: round,
        reward_amount: rewardAmount,
        placement_territory_id: placementTerritory ?? null,
        auto_completed: true,
      };
      updatedCards = {
        ...updatedCards,
        held: (updatedCards.held ?? []).filter(cid => cid !== cardId),
        completed: [...(updatedCards.completed ?? []), completedEntry],
      };
      completedThisEval.push({ card_id: cardId, card_title: cardDef.title, reward_amount: rewardAmount });
    }

    if (completedThisEval.length > 0) {
      await upsertLedger(base44, campaign_id, actingPlayer.id, {
        objective_cards_json: updatedCards, updated_at_round: round,
      });
    }

    return Response.json({
      success: true,
      evaluated: held.length,
      completed: completedThisEval,
      message: completedThisEval.length > 0
        ? `Auto-completed ${completedThisEval.length} objective(s).`
        : 'No objectives met auto-completion criteria.',
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