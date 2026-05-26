/**
 * getDeployLockStatus — returns ONLY lock status (is_locked) for all active
 * players in a campaign's initial_deploy phase.
 *
 * Privacy contract (enforced server-side):
 *   - The response contains ONLY { player_id, is_locked } per player.
 *   - Placement data (the `data` field on PhaseDecision) is NEVER included
 *     in the response, regardless of who calls this function.
 *   - This is the ONLY safe way for a client to know how many players
 *     have locked their deployment without revealing WHERE they placed troops.
 *
 * Called by: useDeployLockStatus hook (InitialDeployPanel).
 * NOT called by: anything that needs placement data (that path doesn't exist client-side).
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

  // Verify caller is a player in this campaign
  const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  // Fetch all PhaseDecision records for initial_deploy (service role — server only)
  const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id,
    phase: 'initial_deploy',
  });

  // Strip ALL placement data — return ONLY lock status
  const lockStatus = decisions.map(d => ({
    player_id: d.player_id,
    is_locked: d.is_locked ?? false,
  }));

  return Response.json({ lock_status: lockStatus });
});