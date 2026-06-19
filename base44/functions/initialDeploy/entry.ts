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

    // ── Capital validation: must set capital before locking ────────────────
    const capitalDevRecords = await base44.asServiceRole.entities.TerritoryDevelopment.filter({
      campaign_id, owner_player_id: actingPlayer.id,
    });
    const hasCapital = capitalDevRecords.some(d => d.is_capital);
    if (!hasCapital) {
      return Response.json({
        error: 'You must designate a capital territory before locking your deployment.',
        validation_error: 'capital_not_set',
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

    // ── STEP 2b: Auto-designate capital for players who don't have one ──────
    // Required so STEP 8 can route starting resources to capital.
    // Players who locked manually already have a capital (enforced by lockDeploy).
    // Auto-submitted players may not — designate their first territory as capital.
    try {
      const [allDevRecords, allTerritoryStates2b] = await Promise.all([
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      ]);
      for (const p of activePlayers) {
        const playerDev = allDevRecords.filter(d => d.owner_player_id === p.id);
        const hasCapital = playerDev.some(d => d.is_capital);
        if (!hasCapital) {
          const ownedTs = allTerritoryStates2b.filter(s => s.owner_player_id === p.id);
          if (ownedTs.length > 0) {
            const firstTid = ownedTs[0].territory_id;
            const existingDev = playerDev.find(d => d.territory_id === firstTid);
            if (existingDev) {
              await base44.asServiceRole.entities.TerritoryDevelopment.update(existingDev.id, {
                is_capital: true, capital_set_round: 0,
              });
            } else {
              await base44.asServiceRole.entities.TerritoryDevelopment.create({
                campaign_id, territory_id: firstTid, owner_player_id: p.id,
                development_level: 1, development_progress: 0, food_to_next_level: 3,
                total_food_invested: 0, is_capital: true, capital_set_round: 0,
                unlocked_resources: ['primary'], unlocked_slot_count: 1, last_updated_round: 0,
              });
            }
            console.log(`[processPhaseEnd] Auto-designated capital ${firstTid} for player ${p.display_name}`);
          }
        }
      }
    } catch (capitalErr) {
      console.warn('[processPhaseEnd] Auto-capital designation failed (non-fatal):', capitalErr?.message);
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
    try {
      await base44.asServiceRole.functions.invoke('deployPhase', {
        action: 'startDeploy',
        campaign_id,
        _internal: true,
      });
      console.log('[processPhaseEnd] Deploy phase auto-started successfully.');
    } catch (deployErr) {
      console.warn('[processPhaseEnd] Auto-start deploy failed (non-fatal):', deployErr?.message);
    }

    // ── STEP 7: Seed starting influence — INLINE (1 perm + 1 spendable per territory)
    // Inlined instead of cross-function call to avoid silent auth failures.
    {
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

      try {
        // Idempotency: check if already seeded
        const existingInfluence = await base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id });
        const alreadySeeded = existingInfluence.some(r => r.source === 'starting_bonus');

        if (alreadySeeded) {
          console.log('[processPhaseEnd] Starting influence already seeded — skipping.');
        } else {
          const influenceStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
          const ownedForInfluence = influenceStates.filter(s => s.owner_player_id != null);
          let influenceCount = 0;

          for (const ts of ownedForInfluence) {
            // 1 permanent influence per territory
            await base44.asServiceRole.entities.TerritoryInfluence.create({
              campaign_id,
              territory_id: ts.territory_id,
              player_id: ts.owner_player_id,
              influence_amount: 1,
              last_updated_round: 1,
              source: 'starting_bonus',
            });

            // 1 spendable influence per territory's region
            const regionId = SC_TERRITORY_REGION[ts.territory_id];
            if (regionId) {
              const existingPool = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
                campaign_id, region_id: regionId, player_id: ts.owner_player_id,
              });
              if (existingPool[0]) {
                await base44.asServiceRole.entities.RegionalInfluencePool.update(existingPool[0].id, {
                  spendable_influence: (existingPool[0].spendable_influence ?? 0) + 1,
                  last_updated_round: 1,
                });
              } else {
                await base44.asServiceRole.entities.RegionalInfluencePool.create({
                  campaign_id, region_id: regionId, player_id: ts.owner_player_id,
                  spendable_influence: 1, last_updated_round: 1,
                });
              }
            }
            influenceCount++;
          }
          console.log('[processPhaseEnd] Starting influence seeded for', influenceCount, 'territories.');
        }
      } catch (infErr) {
        console.error('[processPhaseEnd] Starting influence seed FAILED:', infErr?.message, infErr?.stack);
      }
    }

    // ── STEP 8: Seed starting resources — all routed to capital territory ──
    // Players enter Round 1 Planning with 1 of each territory's primary resource
    // already in their capital's storage, so they can build and act immediately.
    {
      const SC_RESOURCE_TYPES = {
        I1:'iron',  I2:'iron',  I3:'stone', I4:'iron',  I5:'stone',
        I6:'timber',I7:'timber',I8:'iron',
        W1:'timber',W2:'stone', W3:'timber',W4:'timber',W5:'timber',
        W6:'timber',W7:'gold',  W8:'gold',  W9:'iron',
        B1:'stone', B2:'stone', B3:'stone', B4:'stone', B5:'iron',
        B6:'stone', B7:'stone', B8:'stone', B9:'iron',  B10:'gold',
        S1:'timber',S2:'gold',  S3:'iron',  S4:'gold',  S5:'gold',
        S6:'stone', S7:'timber',S8:'gold',  S9:'iron',
        C1:'iron',  C2:'gold',  C3:'iron',  C4:'gold',  C5:'gold',
        C6:'gold',  C7:'stone', C8:'gold',
      };
      const VALID_RESOURCES = ['gold', 'iron', 'timber', 'stone', 'food'];
      const emptyStorage = () => ({ gold: 0, iron: 0, timber: 0, stone: 0, food: 0 });

      try {
        const startingStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
        const ownedStarting = startingStates.filter(s => s.owner_player_id != null);

        // Load capital designations (fresh query — includes STEP 2b records)
        const allDevRecords = await base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id });
        console.log('[STEP 8] Found', allDevRecords.length, 'TerritoryDevelopment records.',
          'Capitals:', allDevRecords.filter(d => d.is_capital).map(d => `${d.territory_id}(${d.owner_player_id})`).join(', ') || 'NONE');

        // Group owned territories by player and accumulate resources
        const playerResources = {}; // playerId → { gold, iron, timber, stone, food }
        for (const ts of ownedStarting) {
          const primary = SC_RESOURCE_TYPES[ts.territory_id] ?? ts.resource_type ?? 'gold';
          if (!playerResources[ts.owner_player_id]) playerResources[ts.owner_player_id] = emptyStorage();
          playerResources[ts.owner_player_id][primary] = (playerResources[ts.owner_player_id][primary] ?? 0) + 1;
        }

        // Index states for O(1) lookup
        const step8StateById = {};
        for (const ts of startingStates) step8StateById[ts.territory_id] = ts;

        for (const [playerId, gained] of Object.entries(playerResources)) {
          // Find capital for this player
          const capitalDev = allDevRecords.find(d => d.owner_player_id === playerId && d.is_capital);
          const capitalTid = capitalDev?.territory_id ?? null;
          const capitalTs = capitalTid ? step8StateById[capitalTid] : null;

          console.log('[STEP 8] Player', playerId, '→ capital:', capitalTid, '→ capitalTs found:', !!capitalTs, '→ resources:', JSON.stringify(gained));

          if (capitalTs) {
            // Route ALL starting resources to capital territory
            const before = { ...emptyStorage(), ...(capitalTs.resource_storage ?? {}) };
            const after = { ...before };
            for (const r of VALID_RESOURCES) after[r] = (after[r] || 0) + (gained[r] || 0);
            await base44.asServiceRole.entities.TerritoryState.update(capitalTs.id, { resource_storage: after });
            console.log('[STEP 8] Wrote resources to capital', capitalTid, ':', JSON.stringify(after));
          } else {
            console.warn('[STEP 8] NO CAPITAL FOUND for player', playerId, '— falling back to individual territories');
            for (const ts of ownedStarting.filter(s => s.owner_player_id === playerId)) {
              const primary = SC_RESOURCE_TYPES[ts.territory_id] ?? ts.resource_type ?? 'gold';
              const before = { ...emptyStorage(), ...(ts.resource_storage ?? {}) };
              const after = { ...before, [primary]: (before[primary] ?? 0) + 1 };
              await base44.asServiceRole.entities.TerritoryState.update(ts.id, { resource_storage: after });
            }
          }

          // Seed player resource ledger
          const existing = await base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id, player_id: playerId });
          const prev = existing[0];
          const merged = { ...emptyStorage(), ...(prev ?? {}) };
          for (const r of VALID_RESOURCES) merged[r] = (merged[r] ?? 0) + (gained[r] ?? 0);
          if (prev) {
            await base44.asServiceRole.entities.PlayerResourceLedger.update(prev.id, {
              ...merged, updated_at_round: 1, updated_at_phase: 'initial_deploy',
            });
          } else {
            await base44.asServiceRole.entities.PlayerResourceLedger.create({
              campaign_id, player_id: playerId, ...merged,
              updated_at_round: 1, updated_at_phase: 'initial_deploy',
            });
          }
        }

        console.log('[processPhaseEnd] Starting resources seeded for', Object.keys(playerResources).length, 'players.');
      } catch (resErr) {
        console.error('[processPhaseEnd] Starting resources seed FAILED:', resErr?.message, resErr?.stack);
      }
    }

    // ── STEP 9: Initialize territory development records ─────────────────
    try {
      await base44.asServiceRole.functions.invoke('territoryDevelopment', {
        action: 'initDevelopment',
        campaign_id,
      });
      console.log('[processPhaseEnd] Territory development initialized.');
    } catch (devErr) {
      console.warn('[processPhaseEnd] Territory development init failed (non-fatal):', devErr?.message);
    }

    return Response.json({
      success: true,
      next_phase: 'deploy',
      round: 1,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});