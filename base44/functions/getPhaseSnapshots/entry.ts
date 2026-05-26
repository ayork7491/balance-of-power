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

    // Fetch phase snapshots
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