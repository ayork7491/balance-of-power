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

// Inline acting-as validation (services/permissions/actingAsPermissions.js logic)
function resolveActingCampaignPlayer({
  user,
  campaign_id,
  acting_as_player_id,
  campaignPlayers,
  requireActive = true,
}) {
  const ownPlayer = campaignPlayers.find(p => p.user_id === user.id);
  
  if (!acting_as_player_id) {
    if (!ownPlayer) {
      return { success: false, actingPlayer: null, reason: 'You are not a member of this campaign.', code: 'NOT_CAMPAIGN_MEMBER' };
    }
    if (requireActive && ownPlayer.is_eliminated) {
      return { success: false, actingPlayer: ownPlayer, reason: 'Your player has been eliminated.', code: 'PLAYER_ELIMINATED' };
    }
    return { success: true, actingPlayer: ownPlayer, reason: 'Acting as yourself.', code: 'ACTING_AS_SELF' };
  }

  const requestedPlayer = campaignPlayers.find(p => p.id === acting_as_player_id);
  if (!requestedPlayer) {
    return { success: false, actingPlayer: null, reason: 'Invalid player ID.', code: 'INVALID_PLAYER_ID' };
  }
  if (requestedPlayer.campaign_id !== campaign_id) {
    return { success: false, actingPlayer: null, reason: 'Player not in this campaign.', code: 'PLAYER_NOT_IN_CAMPAIGN' };
  }

  if (requestedPlayer.id === ownPlayer?.id) {
    if (requireActive && requestedPlayer.is_eliminated) {
      return { success: false, actingPlayer: requestedPlayer, reason: 'Your player has been eliminated.', code: 'PLAYER_ELIMINATED' };
    }
    return { success: true, actingPlayer: requestedPlayer, reason: 'Acting as yourself.', code: 'ACTING_AS_SELF' };
  }

  const isTestPlayer = requestedPlayer.is_test_player === true || (requestedPlayer.user_id && requestedPlayer.user_id.startsWith('test_player_'));

  if (user.role === 'admin') {
    if (requireActive && requestedPlayer.is_eliminated) {
      return { success: false, actingPlayer: requestedPlayer, reason: 'Cannot act as eliminated players.', code: 'PLAYER_ELIMINATED' };
    }
    return { success: true, actingPlayer: requestedPlayer, reason: 'Platform admin override.', code: 'PLATFORM_ADMIN_OVERRIDE' };
  }

  if (ownPlayer?.is_admin) {
    if (!isTestPlayer) {
      return { success: false, actingPlayer: null, reason: 'Campaign admins can only act as test players.', code: 'CANNOT_ACT_AS_REAL_PLAYER' };
    }
    if (requireActive && requestedPlayer.is_eliminated) {
      return { success: false, actingPlayer: requestedPlayer, reason: 'Cannot act as eliminated test players.', code: 'PLAYER_ELIMINATED' };
    }
    return { success: true, actingPlayer: requestedPlayer, reason: 'Campaign admin acting as test player.', code: 'ADMIN_ACTING_AS_TEST' };
  }

  return { success: false, actingPlayer: null, reason: 'Only admins can act as other players.', code: 'NOT_ADMIN' };
}

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
  // Calculate total territories to draft (approximately 60%)
  // MUST be divisible by player count for equal distribution
  const roughTotal = Math.floor(totalTerritories * draftPct);
  // Round down to nearest multiple of playerCount
  const perPlayer = Math.floor(roughTotal / playerCount);
  const totalClaim = perPlayer * playerCount;
  
  return { 
    totalClaim,     // Total picks across all players (divisible by playerCount)
    perPlayer,      // Picks per individual player
    totalTerritories,
    draftPct,
  };
}

// ─── Snake draft next index ───────────────────────────────────────────────────
//
// Correct snake order for 4 players:
//   Round 1 (forward):  0→1→2→3
//   Round 2 (backward): 3→2→1→0
//   Round 3 (forward):  0→1→2→3
//   ...
//
// The player at the END of each direction picks TWICE (no double-pick for
// the turnaround player) — this is standard snake draft behavior.
// We track picks_remaining externally to know when to flip direction.
//
// Implementation: the NEXT call after reaching an endpoint should continue
// from that same endpoint in the new direction, NOT repeat the endpoint.
// e.g. after index=3 in 'forward', next is index=2 in 'backward'.
// after index=0 in 'backward', next is index=1 in 'forward'.

function nextSnakeIndex(current, playerCount, direction) {
  if (direction === 'forward') {
    if (current >= playerCount - 1) {
      // Reached the end — reverse: next pick is playerCount-2 in 'backward'
      return { index: playerCount - 2, direction: 'backward' };
    }
    return { index: current + 1, direction: 'forward' };
  } else {
    // backward
    if (current <= 0) {
      // Reached the start — reverse: next pick is index 1 in 'forward'
      return { index: 1, direction: 'forward' };
    }
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
  const { action, campaign_id, faction_name, territory_id, acting_as_player_id } = body;

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

  // ── Acting-as delegation (admin test mode) ───────────────────────────────────
  const actingResult = resolveActingCampaignPlayer({
    user,
    campaign_id,
    acting_as_player_id,
    campaignPlayers: players,
    requireActive: false, // Setup actions can be done by eliminated players (e.g., rejoining)
  });

  if (!actingResult.success) {
    return Response.json({ error: actingResult.reason }, { status: 403 });
  }

  const actingPlayer = actingResult.actingPlayer;

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

    if (setupOrder[currentIdx] !== actingPlayer.id) {
      return Response.json({ error: 'It is not your turn to select a faction' }, { status: 403 });
    }

    if (!faction_name) {
      return Response.json({ error: 'faction_name is required' }, { status: 400 });
    }

    // Validate uniqueness if duplicates are disabled
    if (!campaign.settings?.allow_faction_duplicates) {
      const taken = players.find(p => p.faction_name === faction_name && p.id !== actingPlayer.id);
      if (taken) return Response.json({ error: `${faction_name} is already chosen by another player` }, { status: 400 });
    }

    await base44.asServiceRole.entities.CampaignPlayer.update(actingPlayer.id, { faction_name });

    await log(base44, campaign_id, 'faction_selection', 'faction_selected', actingPlayer.id, {
      faction_name,
      display_name: actingPlayer.display_name,
    });

    // Advance to next player or to territory_draft
    const nextIdx = currentIdx + 1;
    if (nextIdx >= setupOrder.length) {
      // All factions selected — calculate draft targets and enter territory_draft
      const activePlayers = players.filter(p => !p.is_eliminated);
      // Draft percentage: from campaign settings if present, else engine default (0.6)
      const draftPct = campaign.settings?.draft_percentage ?? 0.6;
      // Territory count: from map TerritoryState records (already exist as definitions)
      // We use the total number of territory definitions for the campaign's map.
      const allTerritories = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      // If no TerritoryState rows yet, fall back to the body-provided hint or 36
      const totalTerritories = body.total_territories ?? (allTerritories.length > 0 ? allTerritories.length : 36);
      const { perPlayer } = calcDraftTargets(totalTerritories, activePlayers.length, draftPct);
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

    if (setupOrder[currentIdx] !== actingPlayer.id) {
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

    // Assign territory to acting player
    await base44.asServiceRole.entities.TerritoryState.create({
      campaign_id,
      map_id: campaign.map_id,
      territory_id,
      owner_player_id: actingPlayer.id,
      troop_count: 0,
      structures: [],
    });

    await log(base44, campaign_id, 'territory_draft', 'territory_picked', actingPlayer.id, {
      territory_id,
      display_name: actingPlayer.display_name,
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
    if (setupOrder[currentIdx] !== actingPlayer.id) {
      return Response.json({ error: 'It is not your turn' }, { status: 403 });
    }

    await log(base44, campaign_id, 'faction_selection', 'auto_submitted', actingPlayer.id, {
      display_name: actingPlayer.display_name,
      note: 'Player skipped faction selection',
    });

    const nextIdx = currentIdx + 1;
    if (nextIdx >= setupOrder.length) {
      const activePlayers = players.filter(p => !p.is_eliminated);
      const draftPct = campaign.settings?.draft_percentage ?? 0.6;
      const allTerritories = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
      const totalTerritories = body.total_territories ?? (allTerritories.length > 0 ? allTerritories.length : 36);
      const { perPlayer } = calcDraftTargets(totalTerritories, activePlayers.length, draftPct);
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