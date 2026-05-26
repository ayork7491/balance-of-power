/**
 * getMyCampaigns — Returns only campaigns the authenticated user belongs to.
 * Security: Validates user membership before returning campaign data.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all player records for this user
    const playerRecords = await base44.entities.CampaignPlayer.filter({ user_id: user.id });
    
    // Extract campaign IDs
    const campaignIds = playerRecords.map(p => p.campaign_id);
    
    if (campaignIds.length === 0) {
      return Response.json({ campaigns: [], players: [] });
    }

    // Fetch only campaigns user belongs to (batch fetch)
    const allCampaigns = await base44.entities.Campaign.list();
    const userCampaigns = allCampaigns.filter(c => campaignIds.includes(c.id) && c.status !== 'archived');

    return Response.json({
      campaigns: userCampaigns,
      players: playerRecords,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});