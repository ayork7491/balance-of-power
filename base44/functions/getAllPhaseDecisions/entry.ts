/**
 * getAllPhaseDecisions — Admin-only endpoint to fetch all player decisions for a campaign.
 * CRITICAL: Only accessible by campaign admins. Preserves competitive integrity.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { campaign_id, round, phase } = await req.json();

    if (!campaign_id) {
      return Response.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    // Validate campaign exists
    const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch all phase decisions for this campaign
    const query: Record<string, any> = { campaign_id };
    if (round) query.round = round;
    if (phase) query.phase = phase;

    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter(query);

    // Enrich with player names
    const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
    const playerMap = new Map(players.map(p => [p.id, p.display_name]));

    const enriched = decisions.map(d => ({
      ...d,
      player_name: playerMap.get(d.player_id) || 'Unknown',
    }));

    return Response.json({ decisions: enriched });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});