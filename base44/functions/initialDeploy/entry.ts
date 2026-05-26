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

  // ── stageTroops ──────────────────────────────────────────────────────────────
  if (action === 'stageTroops') {
    if (campaign.current_phase !== 'initial_deploy') {
      return Response.json({ error: 'Not in initial_deploy phase' }, { status: 400 });
    }

    // Load my PhaseDecision
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id,
      player_id: myPlayer.id,
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
      owner_player_id: myPlayer.id,
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

    await log(base44, campaign_id, 'troop_staged', myPlayer.id, {
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
      player_id: myPlayer.id,
      phase: 'initial_deploy',
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision record found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const startingTroops = campaign.settings?.starting_troops ?? 30;
    const currentPlacements = decision.data?.placements ?? {};
    let totalPlaced = Object.values(currentPlacements).reduce((s, n) => s + n, 0);

    // If troops remain unplaced, auto-distribute to owned territories
    let finalPlacements = { ...currentPlacements };
    let remaining = startingTroops - totalPlaced;

    if (remaining > 0) {
      const ownedTerritories = await base44.asServiceRole.entities.TerritoryState.filter({
        campaign_id,
        owner_player_id: myPlayer.id,
      });
      const rng = seededRandom(`${campaign_id}_${myPlayer.id}_auto`);
      let i = 0;
      while (remaining > 0) {
        const t = ownedTerritories[Math.floor(rng() * ownedTerritories.length)];
        if (t) {
          finalPlacements[t.territory_id] = (finalPlacements[t.territory_id] || 0) + 1;
          remaining--;
        }
        if (++i > 10000) break; // safety
      }
    }

    await base44.entities.PhaseDecision.update(decision.id, {
      is_locked: true,
      locked_at: new Date().toISOString(),
      data: { placements: finalPlacements, troops_remaining: 0 },
    });

    await log(base44, campaign_id, 'player_locked', myPlayer.id, {
      display_name: myPlayer.display_name,
    }, true);

    return Response.json({ success: true });
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

    // Auto-submit any unlocked players
    for (const p of activePlayers) {
      const dec = allDecisions.find(d => d.player_id === p.id);
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
      for (const [tid, count] of Object.entries(placements)) {
        const existing = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id,
          territory_id: tid,
        });
        if (existing[0]) {
          await base44.asServiceRole.entities.TerritoryState.update(existing[0].id, {
            troop_count: (existing[0].troop_count || 0) + count,
          });
        }
      }

      // Mark decision as public/revealed
      await base44.asServiceRole.entities.PhaseDecision.update(dec.id, { is_auto_submitted: dec.is_auto_submitted });
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