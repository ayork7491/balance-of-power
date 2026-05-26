/**
 * getFortifyLockStatus — safe lock status endpoint exposing only player_id, is_locked, locked_at.
 * Does NOT expose PhaseDecision.data (movements/construction) to protect privacy.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { campaign_id, round } = body;
  if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });

  const [campaigns, players] = await Promise.all([
    base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
    base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
  ]);
  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player' }, { status: 403 });

  const phase = 'fortify';
  const targetRound = round ?? campaign.current_round ?? 1;

  // Fetch only lock status fields (not data field)
  const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id,
    phase,
    round: targetRound,
  });

  // Return safe lock status only
  const lockStatus = decisions.map(d => ({
    player_id: d.player_id,
    is_locked: d.is_locked ?? false,
    locked_at: d.locked_at,
    is_auto_submitted: d.is_auto_submitted ?? false,
  }));

  return Response.json({ lock_status: lockStatus });
});