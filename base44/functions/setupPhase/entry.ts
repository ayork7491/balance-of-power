/**
 * setupPhase — handles all campaign setup phase transitions.
 *
 * Actions:
 *   initSetup      — called when campaign starts: randomize player order, enter faction_selection
 *   selectFaction  — player selects their faction
 *   pickTerritory  — player picks a territory during draft
 *   advanceSetup   — admin force-advance (if all players have acted or phase is complete)
 *
 * Determinism: player order is seeded from campaign.id + timestamp at start.
 * All events are logged to SetupLog.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Seeded shuffle (Fisher-Yates with xmur3 seed) ───────────────────────────

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed) {
  const rng = xmur3(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Calculate draft targets ──────────────────────────────────────────────────

function calcDraftTargets(totalTerritories, playerCount, draftPct = 0.6) {
  // Total territories to be claimed = floor(total * pct)
  // Equal per player = floor(total / playerCount)
  const totalClaim = Math.floor(totalTerritories * draftPct);
  const perPlayer  = Math.floor(totalClaim / playerCount);
  return { totalClaim: perPlayer * playerCount, perPlayer };
}

// ─── Snake draft next index ───────────────────────────────────────────────────

function nextSnakeIndex(current, playerCount, direction) {
  if (direction === 'forward') {
    if (current + 1 >= playerCount) return { index: current - 1 >= 0 ? current - 1 : 0, direction: 'backward' };
    return { index: current + 1, direction: 'forward' };
  } else {
    if (current - 1 < 0) return { index: current + 1 <= playerCount - 1 ? current + 1 : 0, direction: 'forward' };
    return { index: current - 1, direction: 'backward' };
  }
}

// ─── Log helper ──────────────────────────────────────────────────────────────

async function log(base44, campaignId, phase, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase,
    round: 0,
    event_type: eventType,
    player_id: playerId || null,
    payload,
    is_public: isPublic,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id, faction_name, territory_id } = body;

  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  // Load campaign
  const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  // Load all players in join order
  const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
  if (!players.length) return Response.json({ error: 'No players found' }, { status: 400 });

  // Find my CampaignPlayer record
  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'You are not a player in this campaign' }, { status: 403 });

  // ── ACTION: initSetup ────────────────────────────────────────────────────────
  if (action === 'initSetup') {
    // Admin only
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Only the campaign admin can initialize setup' }, { status: 403 });
    }
    if (campaign.current_phase !== 'faction_selection') {
      return Response.json({ error: 'Campaign is not in faction_selection phase' }, { status: 400 });
    }

    // Randomize player order using campaign.id as seed
    const seed = campaign_id + '_order';
    const shuffled = seededShuffle(players.map(p => p.id), seed);

    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      setup_order: shuffled,
      setup_current_index: 0,
      draft_snake_direction: 'forward',
    });

    await log(base44, campaign_id, 'faction_selection', 'draft_order_set', null, {
      order: shuffled,
      player_names: shuffled.map(pid => players.find(p => p.id === pid)?.display_name),
    });

    return Response.json({ success: true, order: shuffled });
  }

  // ── ACTION: selectFaction ────────────────────────────────────────────────────
  if (action === 'selectFaction') {
    if (campaign.current_phase !== 'faction_selection') {
      return Response.json({ error: 'Not in faction_selection phase' }, { status: 400 });
    }

    const setupOrder = campaign.setup_order || [];
    const currentIdx = campaign.setup_current_index ?? 0;

    if (setupOrder[currentIdx] !== myPlayer.id) {
      return Response.json({ error: 'It is not your turn to select a faction' }, { status: 403 });
    }

    if (!faction_name) {
      return Response.json({ error: 'faction_name is required' }, { status: 400 });
    }

    // Validate uniqueness if duplicates are disabled
    if (!campaign.settings?.allow_faction_duplicates) {
      const taken = players.find(p => p.faction_name === faction_name && p.id !== myPlayer.id);
      if (taken) return Response.json({ error: `${faction_name} is already chosen by another player` }, { status: 400 });
    }

    await base44.asServiceRole.entities.CampaignPlayer.update(myPlayer.id, { faction_name });

    await log(base44, campaign_id, 'faction_selection', 'faction_selected', myPlayer.id, {
      faction_name,
      display_name: myPlayer.display_name,
    });

    // Advance to next player or to territory_draft
    const nextIdx = currentIdx + 1;
    if (nextIdx >= setupOrder.length) {
      // All factions selected — calculate draft targets and enter territory_draft
      const activePlayers = players.filter(p => !p.is_eliminated);
      const DRAFT_PCT = 0.6;
      const TOTAL_TERRITORIES = 36; // Standard V1 map — configurable in future
      const { perPlayer } = calcDraftTargets(TOTAL_TERRITORIES, activePlayers.length, DRAFT_PCT);
      const totalPicks = perPlayer * activePlayers.length;

      await base44.asServiceRole.entities.Campaign.update(campaign_id, {
        current_phase: 'territory_draft',
        setup_current_index: 0,
        draft_snake_direction: 'forward',
        draft_picks_remaining: totalPicks,
      });

      await log(base44, campaign_id, 'faction_selection', 'phase_advanced', null, {
        next_phase: 'territory_draft',
        draft_picks_remaining: totalPicks,
        per_player: perPlayer,
      });
    } else {
      await base44.asServiceRole.entities.Campaign.update(campaign_id, {
        setup_current_index: nextIdx,
      });
    }

    return Response.json({ success: true });
  }

  // ── ACTION: pickTerritory ────────────────────────────────────────────────────
  if (action === 'pickTerritory') {
    if (campaign.current_phase !== 'territory_draft') {
      return Response.json({ error: 'Not in territory_draft phase' }, { status: 400 });
    }

    const setupOrder = campaign.setup_order || [];
    const currentIdx = campaign.setup_current_index ?? 0;

    if (setupOrder[currentIdx] !== myPlayer.id) {
      return Response.json({ error: 'It is not your turn to pick' }, { status: 403 });
    }

    if (!territory_id) {
      return Response.json({ error: 'territory_id is required' }, { status: 400 });
    }

    // Validate territory is unclaimed
    const existing = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id,
      territory_id,
    });
    if (existing.length > 0) {
      return Response.json({ error: 'Territory already claimed' }, { status: 400 });
    }

    // Assign territory to player
    await base44.asServiceRole.entities.TerritoryState.create({
      campaign_id,
      map_id: campaign.map_id,
      territory_id,
      owner_player_id: myPlayer.id,
      troop_count: 0,
      structures: [],
    });

    await log(base44, campaign_id, 'territory_draft', 'territory_picked', myPlayer.id, {
      territory_id,
      display_name: myPlayer.display_name,
      pick_index: campaign.draft_picks_remaining - 1,
    });

    const remaining = (campaign.draft_picks_remaining || 1) - 1;

    if (remaining <= 0) {
      // Draft complete — advance to initial_deploy
      // Create PhaseDecision stubs for all players
      const activePlayers = players.filter(p => !p.is_eliminated);
      for (const p of activePlayers) {
        await base44.asServiceRole.entities.PhaseDecision.create({
          campaign_id,
          player_id: p.id,
          phase: 'initial_deploy',
          round: 0,
          is_locked: false,
          data: { placements: {}, troops_remaining: campaign.settings?.starting_troops ?? 30 },
        });
      }

      await base44.asServiceRole.entities.Campaign.update(campaign_id, {
        current_phase: 'initial_deploy',
        setup_current_index: 0,
        draft_picks_remaining: 0,
      });

      await log(base44, campaign_id, 'territory_draft', 'phase_advanced', null, {
        next_phase: 'initial_deploy',
        starting_troops: campaign.settings?.starting_troops ?? 30,
      });
    } else {
      // Advance snake draft
      const playerCount = setupOrder.length;
      const { index: nextIdx, direction: nextDir } = nextSnakeIndex(
        currentIdx,
        playerCount,
        campaign.draft_snake_direction || 'forward',
      );

      await base44.asServiceRole.entities.Campaign.update(campaign_id, {
        setup_current_index: nextIdx,
        draft_snake_direction: nextDir,
        draft_picks_remaining: remaining,
      });
    }

    return Response.json({ success: true, picks_remaining: remaining });
  }

  // ── ACTION: skipFaction (pass with no selection — use first available) ────────
  if (action === 'skipFaction') {
    if (campaign.current_phase !== 'faction_selection') {
      return Response.json({ error: 'Not in faction_selection phase' }, { status: 400 });
    }
    const setupOrder = campaign.setup_order || [];
    const currentIdx = campaign.setup_current_index ?? 0;
    if (setupOrder[currentIdx] !== myPlayer.id) {
      return Response.json({ error: 'It is not your turn' }, { status: 403 });
    }

    await log(base44, campaign_id, 'faction_selection', 'auto_submitted', myPlayer.id, {
      display_name: myPlayer.display_name,
      note: 'Player skipped faction selection',
    });

    const nextIdx = currentIdx + 1;
    if (nextIdx >= setupOrder.length) {
      const activePlayers = players.filter(p => !p.is_eliminated);
      const TOTAL_TERRITORIES = 36;
      const { perPlayer } = calcDraftTargets(TOTAL_TERRITORIES, activePlayers.length, 0.6);
      const totalPicks = perPlayer * activePlayers.length;
      await base44.asServiceRole.entities.Campaign.update(campaign_id, {
        current_phase: 'territory_draft',
        setup_current_index: 0,
        draft_snake_direction: 'forward',
        draft_picks_remaining: totalPicks,
      });
      await log(base44, campaign_id, 'faction_selection', 'phase_advanced', null, {
        next_phase: 'territory_draft',
        draft_picks_remaining: totalPicks,
        per_player: perPlayer,
      });
    } else {
      await base44.asServiceRole.entities.Campaign.update(campaign_id, { setup_current_index: nextIdx });
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});