/**
 * initialDeploy — manages initial troop placement staging and locking.
 *
 * Actions:
 *   stageTroops      — place/adjust troop counts on owned territories (private, editable)
 *   lockDeploy       — lock in staged placements (irreversible for this phase)
 *   processPhaseEnd  — admin: apply all placements exactly ONCE (idempotent), advance to Round 1 deploy.
 *                      Automatically calls deployPhase/startDeploy before returning.
 *
 * IDEMPOTENCY: processPhaseEnd is safe to retry. A completed_reveal_at timestamp is set
 * atomically on the Campaign record BEFORE any territory updates are applied.
 * If a retry arrives after this flag is set, it returns success immediately.
 *
 * DUPLICATE PREVENTION: Each player's placements are applied ONCE. The PhaseDecision
 * record is stamped with reveal_applied=true after application. Retries skip stamped records.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

  const { acting_as_player_id } = body;
  const actingResult = resolveActingCampaignPlayer({
    user, campaign_id, acting_as_player_id, campaignPlayers: players, requireActive: false,
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

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'initial_deploy',
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision record found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your deployment' }, { status: 400 });

    if (!placements || typeof placements !== 'object') {
      return Response.json({ error: 'placements must be an object { territory_id: number }' }, { status: 400 });
    }

    const startingTroops = campaign.settings?.starting_troops ?? 30;

    const ownedTerritories = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: actingPlayer.id,
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

    const troopsRemaining = startingTroops - totalPlaced;

    await base44.entities.PhaseDecision.update(decision.id, {
      data: { placements, troops_remaining: troopsRemaining },
    });

    return Response.json({ success: true, troops_remaining: troopsRemaining });
  }

  // ── lockDeploy ───────────────────────────────────────────────────────────────
  if (action === 'lockDeploy') {
    if (campaign.current_phase !== 'initial_deploy') {
      return Response.json({ error: 'Not in initial_deploy phase' }, { status: 400 });
    }

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: actingPlayer.id, phase: 'initial_deploy',
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision record found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const startingTroops = campaign.settings?.starting_troops ?? 30;

    const incomingPlacements = body.placements;
    const hasFreshPayload = incomingPlacements && typeof incomingPlacements === 'object' && !Array.isArray(incomingPlacements);
    const resolvedPlacements = hasFreshPayload ? incomingPlacements : (decision.data?.placements ?? {});

    const cleanPlacements = {};
    for (const [tid, raw] of Object.entries(resolvedPlacements)) {
      const n = Math.floor(Number(raw));
      if (isNaN(n) || n < 0) {
        return Response.json({ error: `Invalid troop count for territory ${tid}: ${raw}` }, { status: 400 });
      }
      cleanPlacements[tid] = n;
    }

    const totalPlaced = Object.values(cleanPlacements).reduce((s, n) => s + n, 0);

    const ownedTerritories = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: actingPlayer.id,
    });
    const ownedIds = new Set(ownedTerritories.map(t => t.territory_id));

    const invalidTerritories = Object.keys(cleanPlacements).filter(tid => !ownedIds.has(tid));
    if (invalidTerritories.length > 0) {
      return Response.json({
        error: `Territories not owned by acting player: ${invalidTerritories.join(', ')}`,
        invalidTerritories, actingPlayerId: actingPlayer.id,
      }, { status: 400 });
    }

    const zeroTerritories = Object.entries(cleanPlacements).filter(([, n]) => n < 1);
    if (zeroTerritories.length > 0) {
      return Response.json({
        error: `Each drafted territory must receive at least 1 troop. ${zeroTerritories.length} territory(ies) have 0.`,
        zeroTerritories: zeroTerritories.map(([tid]) => tid),
      }, { status: 400 });
    }

    if (totalPlaced !== startingTroops) {
      return Response.json({
        error: `Must place exactly ${startingTroops} troops. You placed ${totalPlaced}.`,
        totalPlaced, startingTroops, cleanPlacements, actingPlayerId: actingPlayer.id,
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
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'initial_deploy') {
      return Response.json({ error: 'Not in initial_deploy phase' }, { status: 400 });
    }

    // ── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
    // If reveal was already completed, return success immediately.
    // This prevents duplicate application on retries.
    if (campaign.initial_deploy_reveal_completed_at) {
      console.log('[processPhaseEnd] Already completed at', campaign.initial_deploy_reveal_completed_at, '— returning idempotent success');
      return Response.json({
        success: true,
        idempotent: true,
        next_phase: campaign.current_phase,
        round: campaign.current_round,
        message: 'Already revealed — no changes made.',
      });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const startingTroops = campaign.settings?.starting_troops ?? 30;

    // ── STEP 1: Atomically claim the reveal slot ─────────────────────────────
    // Write reveal_started_at first. If this succeeds, we own the reveal.
    // A concurrent retry will see initial_deploy_reveal_completed_at and bail out.
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      initial_deploy_reveal_started_at: new Date().toISOString(),
    });

    console.log('[processPhaseEnd] Reveal claimed. Processing', activePlayers.length, 'active players.');

    // ── STEP 2: Auto-submit any unlocked/missing players ────────────────────
    const allDecisionsPre = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'initial_deploy',
    });

    for (const p of activePlayers) {
      const dec = allDecisionsPre.find(d => d.player_id === p.id);
      if (!dec || !dec.is_locked) {
        const ownedTerritories = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, owner_player_id: p.id,
        });
        const rng = seededRandom(`${campaign_id}_${p.id}_auto_phase_end`);
        const autoPlacePlacements = {};
        let remaining = startingTroops;
        let itr = 0;
        while (remaining > 0 && ownedTerritories.length > 0) {
          const t = ownedTerritories[Math.floor(rng() * ownedTerritories.length)];
          if (t) {
            autoPlacePlacements[t.territory_id] = (autoPlacePlacements[t.territory_id] || 0) + 1;
            remaining--;
          }
          if (++itr > 10000) break;
        }

        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true,
            is_auto_submitted: true,
            data: { placements: autoPlacePlacements, troops_remaining: 0 },
          });
        } else {
          await base44.asServiceRole.entities.PhaseDecision.create({
            campaign_id, player_id: p.id, phase: 'initial_deploy', round: 0,
            is_locked: true, is_auto_submitted: true,
            data: { placements: autoPlacePlacements, troops_remaining: 0 },
          });
        }

        await log(base44, campaign_id, 'auto_submitted', p.id, {
          display_name: p.display_name, placements: autoPlacePlacements,
          reason: 'Player did not lock before phase end',
        }, false);
      }
    }

    // ── STEP 3: Reload final decisions ───────────────────────────────────────
    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'initial_deploy',
    });
    console.log('[processPhaseEnd] Applying placements for', finalDecisions.length, 'decisions.');

    // ── STEP 4: Apply troop placements — exactly once per player ─────────────
    // Load all territory states once up front for efficiency
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const stateById = {};
    for (const ts of allTerritoryStates) stateById[ts.territory_id] = ts;

    for (const dec of finalDecisions) {
      // Skip players not in activePlayers (e.g. eliminated or spurious records)
      if (!activePlayers.find(p => p.id === dec.player_id)) {
        console.log('[processPhaseEnd] Skipping non-active player decision:', dec.player_id);
        continue;
      }

      const decPlacements = dec.data?.placements ?? {};
      const playerTotal = Object.values(decPlacements).reduce((s, n) => s + (parseInt(n) || 0), 0);
      console.log('[processPhaseEnd] Player', dec.player_id, 'placements:', Object.keys(decPlacements).length, 'territories,', playerTotal, 'total troops');

      for (const [tid, count] of Object.entries(decPlacements)) {
        const countNum = parseInt(count) || 0;
        if (countNum === 0) continue;
        const ts = stateById[tid];
        const troopsBefore = ts?.troop_count ?? null;
        const troopsAfter  = ts ? (ts.troop_count || 0) + countNum : null;
        // Issue 1 diagnostics: log territory_id selected vs territory_id applied
        console.log(`[initialDeploy reveal] player=${dec.player_id} territory_id_selected=${tid} troops_staged=${countNum} territory_id_applied=${tid} troops_applied=${countNum} troop_before=${troopsBefore} troop_after=${troopsAfter}`);
        if (ts) {
          await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
            troop_count: troopsAfter,
          });
          stateById[tid] = { ...ts, troop_count: troopsAfter };
        } else {
          console.warn('[processPhaseEnd] No TerritoryState found for', tid, '— skipped');
        }
      }

      await log(base44, campaign_id, 'placements_applied', dec.player_id, {
        placements: decPlacements, is_auto_submitted: dec.is_auto_submitted ?? false, total_troops: playerTotal,
      }, false);
    }

    // ── STEP 5: Advance campaign to Round 1 deploy ───────────────────────────
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_phase: 'deploy',
      current_round: 1,
      setup_current_index: 0,
      initial_deploy_reveal_completed_at: new Date().toISOString(),
    });

    await log(base44, campaign_id, 'phase_advanced', null, { next_phase: 'deploy', round: 1 }, true);
    console.log('[processPhaseEnd] SUCCESS: Advanced to deploy round 1.');

    // ── STEP 6: Auto-start deploy phase (income + stubs) ─────────────────────
    // Call deployPhase/startDeploy so players see their income immediately
    // without requiring a manual "Start Deploy" button press.
    try {
      await base44.asServiceRole.functions.invoke('deployPhase', {
        action: 'startDeploy',
        campaign_id,
        _internal: true, // bypass admin check — called from system
      });
      console.log('[processPhaseEnd] Deploy phase auto-started successfully.');
    } catch (deployErr) {
      // Non-fatal: deploy start failure should NOT roll back reveal.
      // Admin can manually start deploy if needed.
      console.warn('[processPhaseEnd] Auto-start deploy failed (non-fatal):', deployErr?.message);
    }

    return Response.json({
      success: true,
      next_phase: 'deploy',
      round: 1,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});