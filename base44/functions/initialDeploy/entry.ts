/**
 * initialDeploy — manages initial troop placement staging and locking.
 *
 * Actions:
 *   stageTroops   — place/adjust troop counts on owned territories (private, editable)
 *   lockDeploy    — lock in staged placements (irreversible for this phase)
 *   processPhaseEnd — admin or auto: apply all placements, advance to Round 1 / deploy phase
 *
 * Privacy: staged placements are stored on PhaseDecision.data and are NOT visible
 * to other players until processPhaseEnd is called.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Inline acting-as validation (services/permissions/actingAsPermissions.js logic)
function resolveActingCampaignPlayer({ user, campaign_id, acting_as_player_id, campaignPlayers, requireActive = true }) {
  const ownPlayer = campaignPlayers.find(p => p.user_id === user.id);
  if (!acting_as_player_id) {
    if (!ownPlayer) return { success: false, actingPlayer: null, reason: 'You are not a member of this campaign.', code: 'NOT_CAMPAIGN_MEMBER' };
    if (requireActive && ownPlayer.is_eliminated) return { success: false, actingPlayer: ownPlayer, reason: 'Your player has been eliminated.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: ownPlayer, reason: 'Acting as yourself.', code: 'ACTING_AS_SELF' };
  }
  const requestedPlayer = campaignPlayers.find(p => p.id === acting_as_player_id);
  if (!requestedPlayer) return { success: false, actingPlayer: null, reason: 'Invalid player ID.', code: 'INVALID_PLAYER_ID' };
  if (requestedPlayer.campaign_id !== campaign_id) return { success: false, actingPlayer: null, reason: 'Player not in this campaign.', code: 'PLAYER_NOT_IN_CAMPAIGN' };
  if (requestedPlayer.id === ownPlayer?.id) {
    if (requireActive && requestedPlayer.is_eliminated) return { success: false, actingPlayer: requestedPlayer, reason: 'Your player has been eliminated.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: requestedPlayer, reason: 'Acting as yourself.', code: 'ACTING_AS_SELF' };
  }
  const isTestPlayer = requestedPlayer.is_test_player === true || (requestedPlayer.user_id && requestedPlayer.user_id.startsWith('test_player_'));
  if (user.role === 'admin') {
    if (requireActive && requestedPlayer.is_eliminated) return { success: false, actingPlayer: requestedPlayer, reason: 'Cannot act as eliminated players.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: requestedPlayer, reason: 'Platform admin override.', code: 'PLATFORM_ADMIN_OVERRIDE' };
  }
  if (ownPlayer?.is_admin) {
    if (!isTestPlayer) return { success: false, actingPlayer: null, reason: 'Campaign admins can only act as test players.', code: 'CANNOT_ACT_AS_REAL_PLAYER' };
    if (requireActive && requestedPlayer.is_eliminated) return { success: false, actingPlayer: requestedPlayer, reason: 'Cannot act as eliminated test players.', code: 'PLAYER_ELIMINATED' };
    return { success: true, actingPlayer: requestedPlayer, reason: 'Campaign admin acting as test player.', code: 'ADMIN_ACTING_AS_TEST' };
  }
  return { success: false, actingPlayer: null, reason: 'Only admins can act as other players.', code: 'NOT_ADMIN' };
}

function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

async function log(base44, campaignId, eventType, playerId, payload, isPublic = false) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase: 'initial_deploy',
    round: 0,
    event_type: eventType,
    player_id: playerId || null,
    payload,
    is_public: isPublic,
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id, placements } = body;

  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action required' }, { status: 400 });
  }

  const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  // ── Acting-as delegation ─────────────────────────────────────────────────────
  const { acting_as_player_id } = body;
  const actingResult = resolveActingCampaignPlayer({
    user,
    campaign_id,
    acting_as_player_id,
    campaignPlayers: players,
    requireActive: false,
  });
  if (!actingResult.success) {
    return Response.json({ error: actingResult.reason }, { status: 403 });
  }
  const actingPlayer = actingResult.actingPlayer;

  // ── stageTroops ──────────────────────────────────────────────────────────────
  if (action === 'stageTroops') {
    if (campaign.current_phase !== 'initial_deploy') {
      return Response.json({ error: 'Not in initial_deploy phase' }, { status: 400 });
    }

    // Load acting player's PhaseDecision
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id,
      player_id: actingPlayer.id,
      phase: 'initial_deploy',
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision record found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your deployment' }, { status: 400 });

    // Validate: placements must be an object of { territory_id: number }
    if (!placements || typeof placements !== 'object') {
      return Response.json({ error: 'placements must be an object { territory_id: number }' }, { status: 400 });
    }

    const startingTroops = campaign.settings?.starting_troops ?? 30;

    // Validate: only owned territories
    const ownedTerritories = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id,
      owner_player_id: actingPlayer.id,
    });
    const ownedIds = new Set(ownedTerritories.map(t => t.territory_id));

    let totalPlaced = 0;
    for (const [tid, count] of Object.entries(placements)) {
      if (!ownedIds.has(tid)) {
        return Response.json({ error: `Territory ${tid} is not owned by you` }, { status: 400 });
      }
      if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
        return Response.json({ error: `Invalid troop count for ${tid}` }, { status: 400 });
      }
      totalPlaced += count;
    }

    if (totalPlaced > startingTroops) {
      return Response.json({
        error: `Total placements (${totalPlaced}) exceed starting troops (${startingTroops})`,
      }, { status: 400 });
    }

    // Note: stageTroops allows 0-troop territories (player may not be done yet).
    // The >= 1 troop per territory rule is enforced at lockDeploy time.

    const troopsRemaining = startingTroops - totalPlaced;

    await base44.entities.PhaseDecision.update(decision.id, {
      data: { placements, troops_remaining: troopsRemaining },
    });

    await log(base44, campaign_id, 'troop_staged', actingPlayer.id, {
      placements,
      troops_remaining: troopsRemaining,
    }, false); // private until reveal

    return Response.json({ success: true, troops_remaining: troopsRemaining });
  }

  // ── lockDeploy ───────────────────────────────────────────────────────────────
  if (action === 'lockDeploy') {
    if (campaign.current_phase !== 'initial_deploy') {
      return Response.json({ error: 'Not in initial_deploy phase' }, { status: 400 });
    }

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id,
      player_id: actingPlayer.id,
      phase: 'initial_deploy',
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision record found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const startingTroops = campaign.settings?.starting_troops ?? 30;

    // Prefer placements from the request body (atomic save+lock from frontend).
    // Fall back to what was previously staged (Save button path) only if not provided.
    const incomingPlacements = body.placements;
    const hasFreshPayload = incomingPlacements && typeof incomingPlacements === 'object' && !Array.isArray(incomingPlacements);
    const resolvedPlacements = hasFreshPayload ? incomingPlacements : (decision.data?.placements ?? {});

    console.log('[lockDeploy] debug:', {
      actingPlayerId: actingPlayer.id,
      startingTroops,
      hasFreshPayload,
      resolvedPlacements,
      rawBodyPlacements: incomingPlacements,
      storedPlacements: decision.data?.placements,
    });

    // Normalise all values to integers — reject NaN/negative/non-number
    const cleanPlacements = {};
    for (const [tid, raw] of Object.entries(resolvedPlacements)) {
      const n = Math.floor(Number(raw));
      if (isNaN(n) || n < 0) {
        return Response.json({ error: `Invalid troop count for territory ${tid}: ${raw}` }, { status: 400 });
      }
      cleanPlacements[tid] = n;
    }

    const totalPlaced = Object.values(cleanPlacements).reduce((s, n) => s + n, 0);

    // Validate: only owned territories
    const ownedTerritories = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id,
      owner_player_id: actingPlayer.id,
    });
    const ownedIds = new Set(ownedTerritories.map(t => t.territory_id));

    const invalidTerritories = Object.keys(cleanPlacements).filter(tid => !ownedIds.has(tid));
    if (invalidTerritories.length > 0) {
      return Response.json({
        error: `Territories not owned by acting player: ${invalidTerritories.join(', ')}`,
        invalidTerritories,
        actingPlayerId: actingPlayer.id,
      }, { status: 400 });
    }

    // Check every owned territory has >= 1 troop
    const zeroTerritories = Object.entries(cleanPlacements).filter(([, n]) => n < 1);
    if (zeroTerritories.length > 0) {
      return Response.json({
        error: `Each drafted territory must receive at least 1 troop. ${zeroTerritories.length} territory(ies) have 0.`,
        zeroTerritories: zeroTerritories.map(([tid]) => tid),
      }, { status: 400 });
    }

    // Check total equals starting troops exactly
    if (totalPlaced !== startingTroops) {
      return Response.json({ 
        error: `Must place exactly ${startingTroops} troops. You placed ${totalPlaced}.`,
        totalPlaced,
        startingTroops,
        cleanPlacements,
        actingPlayerId: actingPlayer.id,
        ownedTerritoryCount: ownedTerritories.length,
      }, { status: 400 });
    }

    await base44.entities.PhaseDecision.update(decision.id, {
      is_locked: true,
      locked_at: new Date().toISOString(),
      is_auto_submitted: false,
      data: { placements: cleanPlacements, troops_remaining: 0 },
    });

    await log(base44, campaign_id, 'player_locked', actingPlayer.id, {
      display_name: actingPlayer.display_name,
      total_placed: totalPlaced,
      is_manual: true,
    }, true);

    return Response.json({ success: true, is_manual: true, totalPlaced });
  }

  // ── processPhaseEnd ──────────────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    // Admin only
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'initial_deploy') {
      return Response.json({ error: 'Not in initial_deploy phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);

    // Load all decisions
    const allDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id,
      phase: 'initial_deploy',
    });

    const startingTroops = campaign.settings?.starting_troops ?? 30;

    // Auto-submit any unlocked/missing players (ONLY for non-submitters)
    for (const p of activePlayers) {
      const dec = allDecisions.find(d => d.player_id === p.id);
      // Only auto-submit if player has NO locked decision
      if (!dec || !dec.is_locked) {
        const ownedTerritories = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id,
          owner_player_id: p.id,
        });
        const rng = seededRandom(`${campaign_id}_${p.id}_auto_phase_end`);
        const placements = {};
        let remaining = startingTroops;
        let i = 0;
        while (remaining > 0 && ownedTerritories.length > 0) {
          const t = ownedTerritories[Math.floor(rng() * ownedTerritories.length)];
          if (t) {
            placements[t.territory_id] = (placements[t.territory_id] || 0) + 1;
            remaining--;
          }
          if (++i > 10000) break;
        }

        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true,
            is_auto_submitted: true,
            data: { placements, troops_remaining: 0 },
          });
        }

        await log(base44, campaign_id, 'auto_submitted', p.id, {
          display_name: p.display_name,
          placements,
          reason: 'Player did not lock before phase end',
        }, false);
      }
    }

    // Reload final decisions
    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id,
      phase: 'initial_deploy',
    });

    // Apply all troop placements to TerritoryState
    for (const dec of finalDecisions) {
      const placements = dec.data?.placements ?? {};
      const isAuto = dec.is_auto_submitted ?? false;
      
      for (const [tid, count] of Object.entries(placements)) {
        const countNum = parseInt(count) || 0;
        const existing = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id,
          territory_id: tid,
        });
        if (existing[0]) {
          await base44.asServiceRole.entities.TerritoryState.update(existing[0].id, {
            troop_count: (existing[0].troop_count || 0) + countNum,
          });
        }
      }

      // Log applied placements
      await log(base44, campaign_id, 'initial_deploy', 'placements_applied', dec.player_id, {
        placements,
        is_auto_submitted: isAuto,
        total_troops: Object.values(placements).reduce((s, n) => s + (parseInt(n) || 0), 0),
      }, false);
    }

    // Advance campaign to Round 1 deploy phase
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_phase: 'deploy',
      current_round: 1,
      setup_current_index: 0,
    });

    await log(base44, campaign_id, 'phase_advanced', null, {
      next_phase: 'deploy',
      round: 1,
    }, true);

    return Response.json({ success: true, next_phase: 'deploy', round: 1 });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});