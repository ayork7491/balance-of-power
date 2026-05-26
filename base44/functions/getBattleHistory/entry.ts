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

    // Fetch battle cards
    const battleQuery = { campaign_id };
    if (round) battleQuery.round = round;

    const battles = await base44.asServiceRole.entities.BattleCard.filter(battleQuery);
    
    // Sort by round and creation date
    battles.sort((a, b) => {
      if (b.round !== a.round) return b.round - a.round;
      return b.created_date.localeCompare(a.created_date);
    });

    // Apply limit
    const limitedBattles = battles.slice(0, limit);

    return Response.json({ battles: limitedBattles });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});