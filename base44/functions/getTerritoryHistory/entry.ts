import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, territory_id, limit = 50 } = await req.json();
    
    if (!campaign_id) {
      return Response.json({ error: 'campaign_id required' }, { status: 400 });
    }

    if (!territory_id) {
      return Response.json({ error: 'territory_id required' }, { status: 400 });
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

    // Fetch territory states across all rounds (snapshots contain historical data)
    const snapshots = await base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id });
    
    // Extract territory history from snapshots
    const territoryHistory = [];
    
    snapshots.forEach(snapshot => {
      const territoryState = snapshot.territory_states?.find(t => t.territory_id === territory_id);
      if (territoryState) {
        territoryHistory.push({
          round: snapshot.round,
          phase: snapshot.phase,
          snapshot_type: snapshot.snapshot_type,
          owner_player_id: territoryState.owner_player_id,
          troop_count: territoryState.troop_count,
          timestamp: snapshot.created_date,
        });
      }
    });

    // Also fetch battle cards for this territory
    const battles = await base44.asServiceRole.entities.BattleCard.filter({ 
      campaign_id,
      target_territory_id: territory_id,
    });
    
    battles.forEach(battle => {
      territoryHistory.push({
        round: battle.round,
        phase: 'battle',
        event_type: 'battle',
        battle_type: battle.battle_type,
        result: battle.result,
        timestamp: battle.created_date,
      });
    });

    // Sort by timestamp (most recent first)
    territoryHistory.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Apply limit
    const history = territoryHistory.slice(0, limit);

    return Response.json({ history });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});