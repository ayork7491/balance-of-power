/**
 * getAttackLockStatus — public lock status for attack phase.
 *
 * Returns only { player_id, is_locked } for each player.
 * The data.attacks field is NEVER returned — it is stripped server-side.
 * This is the only safe way for clients to check attack lock status.
 *
 * Used by: DeployLockStatusRow (reused), AttackPanel lock status section.
 *
 * Query params (via JSON body):
 *   campaign_id (required)
 *   round (default: campaign.current_round)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { campaign_id } = body;
  if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });

  // Verify player is in this campaign
  const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
  const campaign  = campaigns[0];
  const round     = body.round ?? campaign?.current_round ?? 1;

  const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id,
    phase: 'attack',
    round,
  });

  // Strip data field — only return lock status
  const lockStatus = decisions.map(d => ({
    player_id:        d.player_id,
    is_locked:        d.is_locked ?? false,
    is_auto_submitted: d.is_auto_submitted ?? false,
  }));

  return Response.json({ lock_status: lockStatus });
});