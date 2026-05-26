/**
 * forcePhaseAdvance — Admin-only endpoint to force phase advancement.
 * CRITICAL: Only accessible by campaign admins. Bypasses timer and lock checks.
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

    const { campaign_id, target_phase } = await req.json();

    if (!campaign_id) {
      return Response.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    // Validate campaign exists
    const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Update campaign phase
    const updateData: Record<string, any> = {
      current_phase: target_phase || campaign.current_phase,
      phase_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    };

    // If advancing to next round, increment round
    if (target_phase === 'deploy' && campaign.current_phase === 'fortify') {
      updateData.current_round = (campaign.current_round || 1) + 1;
    }

    await base44.asServiceRole.entities.Campaign.update(campaign_id, updateData);

    // Log the admin action
    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id,
      phase: campaign.current_phase,
      round: campaign.current_round,
      event_type: 'phase_advanced',
      payload: { 
        admin_user_id: user.id, 
        from_phase: campaign.current_phase,
        to_phase: updateData.current_phase,
        forced: true 
      },
      is_public: true,
    });

    return Response.json({ 
      success: true, 
      campaign: { 
        id: campaign_id, 
        current_phase: updateData.current_phase, 
        current_round: updateData.current_round || campaign.current_round 
      } 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});