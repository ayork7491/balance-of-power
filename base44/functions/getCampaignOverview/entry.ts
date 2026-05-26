/**
 * getCampaignOverview — Returns campaign data only if user is a member.
 * Security: Validates user membership before returning campaign, players, and invites.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Verify user is a member of this campaign
    const playerRecord = await base44.entities.CampaignPlayer.filter({
      campaign_id,
      user_id: user.id,
    }).then(records => records[0] ?? null);

    if (!playerRecord) {
      return Response.json({ error: 'Access denied: Not a campaign member' }, { status: 403 });
    }

    // Load campaign data
    const campaigns = await base44.entities.Campaign.filter({ id: campaign_id });
    const campaign = campaigns[0] ?? null;

    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Load all players for this campaign
    const players = await base44.entities.CampaignPlayer.filter({ campaign_id });

    // Load invites for this campaign
    const invites = await base44.entities.CampaignInvite.filter({ campaign_id });

    return Response.json({
      campaign,
      players,
      invites,
      myPlayer: playerRecord,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});