import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, round, limit = 50 } = await req.json();
    
    if (!campaign_id) {
      return Response.json({ error: 'campaign_id required' }, { status: 400 });
    }

    // Membership validation: verify user is a campaign player or admin
    const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
    const isMember = players.some(p => p.user_id === user.id);
    const isAdmin = campaign.admin_user_id === user.id;

    if (!isMember && !isAdmin) {
      return Response.json({ error: 'Access denied: Campaign membership required' }, { status: 403 });
    }

    // Fetch phase snapshots (safe: only contains public revealed state)
    // PhaseSnapshot contains: territory_states, player_standings, deploy_incomes
    // It does NOT contain: private PhaseDecision data, unrevealed staged decisions
    const snapshotQuery = { campaign_id };
    if (round) snapshotQuery.round = round;

    const snapshots = await base44.asServiceRole.entities.PhaseSnapshot.filter(snapshotQuery);
    
    // Sort by round and snapshot type
    snapshots.sort((a, b) => {
      if (b.round !== a.round) return b.round - a.round;
      return b.created_date.localeCompare(a.created_date);
    });

    // Apply limit
    const limitedSnapshots = snapshots.slice(0, limit);

    return Response.json({ snapshots: limitedSnapshots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});