/**
 * forcePhaseAdvance — Force phase advancement with proper phase-end processing.
 * ACCESS CONTROL:
 *   - Platform admins (user.role === 'admin'): Always allowed
 *   - Campaign admins (campaign.admin_user_id === user.id): Only if campaign.is_test_campaign === true
 * 
 * CRITICAL: This is a DEBUG-ONLY unsafe phase switch. It does NOT run full phase-end processing.
 * Only use in test campaigns. For production, use the normal phase transition pipeline.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Access control: platform admin OR campaign admin (test campaigns only)
    const isPlatformAdmin = user.role === 'admin';
    const isCampaignAdmin = campaign.admin_user_id === user.id;
    const isTestCampaign = campaign.is_test_campaign === true;

    if (!isPlatformAdmin && !isCampaignAdmin) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Campaign admins can only force advance in test campaigns
    if (isCampaignAdmin && !isPlatformAdmin && !isTestCampaign) {
      return Response.json({ 
        error: 'Force advance restricted to test campaigns. This is a competitive campaign.', 
        requires: 'platform_admin_override' 
      }, { status: 403 });
    }

    // WARNING: This is an unsafe debug-only phase switch
    // It does NOT run the full phase-end processing pipeline:
    // - Does NOT auto-submit missing decisions
    // - Does NOT apply deploy placements/resources
    // - Does NOT reveal attacks
    // - Does NOT generate/apply battle state
    // - Does NOT apply fortify/build results
    // - Does NOT generate proper logs/snapshots
    // Only use in test campaigns for debugging!

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

    // Log the admin action (debug-only)
    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id,
      phase: campaign.current_phase,
      round: campaign.current_round,
      event_type: 'phase_advanced',
      payload: { 
        admin_user_id: user.id, 
        from_phase: campaign.current_phase,
        to_phase: updateData.current_phase,
        forced: true,
        debug_only_unsafe: true,
        warning: 'Skipped phase-end processing pipeline'
      },
      is_public: false, // Hidden from players - admin debug action
    });

    return Response.json({ 
      success: true, 
      campaign: { 
        id: campaign_id, 
        current_phase: updateData.current_phase, 
        current_round: updateData.current_round || campaign.current_round 
      },
      warning: 'Debug-only unsafe phase switch. Phase-end processing not executed.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});