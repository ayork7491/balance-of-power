/**
 * getDeployLockStatus — returns ONLY lock status (is_locked) for all active
 * players in any hidden-decision phase (initial_deploy, deploy, attack, fortify).
 *
 * Privacy contract (enforced server-side):
 *   - The response contains ONLY { player_id, is_locked } per player.
 *   - Placement / decision data (the `data` field on PhaseDecision) is NEVER
 *     included in the response, regardless of who calls this function.
 *
 * Params: { campaign_id, phase? (default: 'initial_deploy'), round? }
 * Called by: useDeployLockStatus, useDeployPhaseLockStatus hooks.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { campaign_id, phase = 'initial_deploy', round } = body;

  if (!campaign_id) {
    return Response.json({ error: 'campaign_id required' }, { status: 400 });
  }

  // Verify caller is a player in this campaign
  const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  // Build filter — round is optional (omit for initial_deploy which uses round 0)
  const filter = { campaign_id, phase };
  if (round !== undefined && round !== null) filter.round = round;

  // Fetch via service role — placement data stays server-side
  const decisions = await base44.asServiceRole.entities.PhaseDecision.filter(filter);

  // Strip ALL placement data — return ONLY lock status
  const lockStatus = decisions.map(d => ({
    player_id: d.player_id,
    is_locked: d.is_locked ?? false,
  }));

  return Response.json({ lock_status: lockStatus });
});