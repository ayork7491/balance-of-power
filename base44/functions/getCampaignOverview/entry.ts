/**
 * getCampaignOverview — Returns campaign data only if user is a member.
 * Security: Validates user membership before returning campaign, players, and invites.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return Response.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    // Use service role for all reads — avoids "not found" caused by user-scoped
    // permission race conditions during phase transitions or token refresh.
    const [campaigns, allPlayers, invites] = await Promise.all([
      base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
      base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
      base44.asServiceRole.entities.CampaignInvite.filter({ campaign_id }),
    ]);

    const campaign = campaigns[0] ?? null;
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify user is a member (security check still enforced)
    const playerRecord = allPlayers.find(p => p.user_id === user.id) ?? null;
    if (!playerRecord) {
      return Response.json({ error: 'Access denied: Not a campaign member' }, { status: 403 });
    }

    return Response.json({
      campaign,
      players: allPlayers,
      invites,
      myPlayer: playerRecord,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});