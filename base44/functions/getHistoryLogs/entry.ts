import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaign_id, round, phase, event_type, limit = 100 } = await req.json();
    
    if (!campaign_id) {
      return Response.json({ error: 'campaign_id required' }, { status: 400 });
    }

    // Build query for setup logs (public only)
    const logQuery = { campaign_id };
    if (round) logQuery.round = round;
    if (phase) logQuery.phase = phase;
    if (event_type) logQuery.event_type = event_type;

    // Fetch setup logs (only public ones or revealed ones)
    const allLogs = await base44.asServiceRole.entities.SetupLog.filter(logQuery);
    
    // Filter for visibility: only public or revealed logs
    const now = new Date().toISOString();
    const visibleLogs = allLogs.filter(log => {
      if (log.is_public) return true;
      if (log.visibility_revealed_at && log.visibility_revealed_at <= now) return true;
      return false;
    });

    // Sort by creation date (most recent first)
    visibleLogs.sort((a, b) => {
      const aDate = new Date(a.created_date).getTime();
      const bDate = new Date(b.created_date).getTime();
      return bDate - aDate;
    });

    // Apply limit
    const logs = visibleLogs.slice(0, limit);

    return Response.json({ logs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});