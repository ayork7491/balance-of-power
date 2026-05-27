/**
 * repairInitialDeploy — TEMPORARY admin-only recovery tool.
 *
 * Purpose:
 *   Repairs campaigns stuck in initial_deploy due to 0-troop territories.
 *   This can happen when a player's PhaseDecision.data.placements contains
 *   entries with 0 (or missing) troops for owned territories, causing
 *   processPhaseEnd to apply 0 troops and leave territories empty, which
 *   then breaks subsequent phase logic.
 *
 * Safety:
 *   - Admin-only (campaign.admin_user_id OR user.role === 'admin').
 *   - Only operates on campaigns in 'initial_deploy' phase.
 *   - Only modifies TerritoryState.troop_count — does NOT change ownership.
 *   - Idempotent: safe to run multiple times.
 *
 * Repair algorithm (per player):
 *   1. Find all owned territories with troop_count < 1.
 *   2. Set each to 1 (minimum).
 *   3. Recalculate total. If > startingTroops, subtract excess from the
 *      largest stack (clamped so no territory goes below 1).
 *   4. If total < startingTroops, add missing troops to the largest stack.
 *   5. Result: every owned territory has >= 1 troop, total == startingTroops.
 *
 * Removal note:
 *   Once all test/live campaigns have passed initial_deploy successfully,
 *   this function can be removed or gated behind an additional debug flag.
 *   It should NEVER be surfaced to regular (non-admin) users.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { campaign_id } = body;

  if (!campaign_id) {
    return Response.json({ error: 'campaign_id required' }, { status: 400 });
  }

  // Load campaign
  const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  // Admin check: campaign admin or platform admin
  const isCampaignAdmin = campaign.admin_user_id === user.id;
  const isPlatformAdmin = user.role === 'admin';
  if (!isCampaignAdmin && !isPlatformAdmin) {
    return Response.json({ error: 'Admin only — campaign admin or platform admin required' }, { status: 403 });
  }

  // Only valid during initial_deploy (or after processPhaseEnd left 0-troop territories in deploy)
  const allowedPhases = ['initial_deploy', 'deploy'];
  if (!allowedPhases.includes(campaign.current_phase)) {
    return Response.json({
      error: `Repair only valid during initial_deploy or deploy phase. Current: ${campaign.current_phase}`,
    }, { status: 400 });
  }

  const startingTroops = campaign.settings?.starting_troops ?? 30;

  // Load all players
  const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
  const activePlayers = players.filter(p => !p.is_eliminated);

  // Load all territory states
  const allTerritories = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
  const ownedTerritories = allTerritories.filter(t => t.owner_player_id);

  const repairLog = [];
  let totalChanges = 0;

  for (const player of activePlayers) {
    const playerTerritories = ownedTerritories.filter(t => t.owner_player_id === player.id);
    if (playerTerritories.length === 0) continue;

    // Step 1: identify territories with < 1 troop
    const zeroTerritories = playerTerritories.filter(t => !t.troop_count || t.troop_count < 1);

    // Current allocation (treat null/undefined/0 as 0)
    const allocation = {};
    for (const t of playerTerritories) {
      allocation[t.id] = Math.max(0, Math.floor(Number(t.troop_count) || 0));
    }

    // Step 2: set each zero territory to minimum 1
    for (const t of zeroTerritories) {
      allocation[t.id] = 1;
    }

    let currentTotal = Object.values(allocation).reduce((s, n) => s + n, 0);

    // Step 3: if over budget, subtract excess from largest stack (min 1 each)
    if (currentTotal > startingTroops) {
      let excess = currentTotal - startingTroops;
      // Sort by descending count to subtract from largest first
      const sortedIds = Object.keys(allocation).sort((a, b) => allocation[b] - allocation[a]);
      for (const id of sortedIds) {
        if (excess <= 0) break;
        const canRemove = Math.min(excess, allocation[id] - 1); // keep >= 1
        allocation[id] -= canRemove;
        excess -= canRemove;
      }
    }

    // Step 4: if under budget, add missing to largest stack
    currentTotal = Object.values(allocation).reduce((s, n) => s + n, 0);
    if (currentTotal < startingTroops) {
      const missing = startingTroops - currentTotal;
      const sortedIds = Object.keys(allocation).sort((a, b) => allocation[b] - allocation[a]);
      if (sortedIds.length > 0) {
        allocation[sortedIds[0]] += missing;
      }
    }

    // Apply changes to TerritoryState records
    const playerChanges = [];
    for (const t of playerTerritories) {
      const newCount = allocation[t.id];
      const oldCount = Math.floor(Number(t.troop_count) || 0);
      if (newCount !== oldCount) {
        await base44.asServiceRole.entities.TerritoryState.update(t.id, { troop_count: newCount });
        playerChanges.push({ territory_id: t.territory_id, old: oldCount, new: newCount });
        totalChanges++;
      }
    }

    const finalTotal = Object.values(allocation).reduce((s, n) => s + n, 0);
    repairLog.push({
      player_id: player.id,
      display_name: player.display_name,
      territory_count: playerTerritories.length,
      zero_territories_found: zeroTerritories.length,
      changes: playerChanges,
      final_total: finalTotal,
      target_total: startingTroops,
      balanced: finalTotal === startingTroops,
    });
  }

  // Also unlock any locked PhaseDecisions so admin can re-advance cleanly
  // (only if we're still in initial_deploy — don't touch deploy phase decisions)
  if (campaign.current_phase === 'initial_deploy') {
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id,
      phase: 'initial_deploy',
    });
    for (const dec of decisions) {
      if (dec.is_locked) {
        // Rebuild placements from repaired TerritoryState
        const player = activePlayers.find(p => p.id === dec.player_id);
        if (!player) continue;
        const playerTerrs = ownedTerritories.filter(t => t.owner_player_id === player.id);
        // Reload territory states to get repaired counts
        const repairedTerrs = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id,
          owner_player_id: player.id,
        });
        const repairedPlacements = {};
        for (const t of repairedTerrs) {
          repairedPlacements[t.territory_id] = Math.max(1, Math.floor(Number(t.troop_count) || 1));
        }
        await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
          data: { placements: repairedPlacements, troops_remaining: 0 },
          // Keep is_locked: true so processPhaseEnd can proceed
        });
      }
    }
  }

  return Response.json({
    success: true,
    total_territory_changes: totalChanges,
    players_repaired: repairLog.filter(r => r.changes.length > 0).length,
    repair_log: repairLog,
    next_step: campaign.current_phase === 'initial_deploy'
      ? 'Admin can now click "Force Advance" to run processPhaseEnd.'
      : 'Territory troop counts have been corrected.',
  });
});