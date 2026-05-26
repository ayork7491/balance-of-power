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

    // Use players array from membership validation
    
    // Fetch territory states for this campaign
    const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    
    // Fetch deploy income for current round (public info)
    const currentRound = campaign?.current_round ?? 1;
    const deployIncomes = await base44.asServiceRole.entities.DeployIncome.filter({ 
      campaign_id,
      round: currentRound,
    });

    // Calculate leaderboard metrics for each player
    const leaderboard = players.map(player => {
      // Count territories owned
      const ownedTerritories = territoryStates.filter(t => t.owner_player_id === player.id);
      const territoryCount = ownedTerritories.length;
      
      // Calculate total troops
      const troopTotal = ownedTerritories.reduce((sum, t) => sum + (t.troop_count ?? 0), 0);
      
      // Get deploy income
      const income = deployIncomes.find(d => d.player_id === player.id);
      
      // Note: region_count and continent_count require map definition data
      // V1 uses territory_count as primary metric (accurate and reliable)
      // Future enhancement: load map definition to calculate controlled regions/continents
      
      return {
        player_id: player.id,
        display_name: player.display_name,
        color: player.color,
        faction_name: player.faction_name,
        territory_count: territoryCount,
        troop_total: troopTotal,
        deploy_income: income?.total ?? 0,
        resources_generated: income?.resources_generated ?? {},
        is_eliminated: player.is_eliminated ?? false,
        eliminated_at: player.eliminated_at,
      };
    });

    // Sort by territory count (primary), then troop total (secondary)
    leaderboard.sort((a, b) => {
      if (b.territory_count !== a.territory_count) {
        return b.territory_count - a.territory_count;
      }
      return b.troop_total - a.troop_total;
    });

    // Add rank
    leaderboard.forEach((player, idx) => {
      player.rank = idx + 1;
    });

    return Response.json({ leaderboard });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});