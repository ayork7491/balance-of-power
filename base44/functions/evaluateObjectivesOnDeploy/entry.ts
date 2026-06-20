/**
 * evaluateObjectivesOnDeploy — automation handler.
 * Called by Campaign entity automation when current_phase changes to 'deploy'.
 * Evaluates all auto-completable objectives for all active players.
 * Idempotent — safe to call multiple times per round.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { event, data } = body;

    // Only act on deploy phase transitions
    let campaign = data;
    if (!campaign?.id && body.payload_too_large && event?.entity_id) {
      const fetched = await base44.asServiceRole.entities.Campaign.filter({ id: event.entity_id });
      campaign = fetched[0] ?? null;
    }
    if (!campaign?.id) {
      return Response.json({ skipped: true, reason: 'No campaign data' });
    }
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ skipped: true, reason: `Phase '${campaign.current_phase}' is not deploy` });
    }

    console.log(`[evaluateObjectivesOnDeploy] Evaluating all objectives for campaign ${campaign.id} round ${campaign.current_round}`);

    const result = await base44.asServiceRole.functions.invoke('objectivePhase', {
      action: 'evaluateAllObjectives',
      campaign_id: campaign.id,
    });

    console.log(`[evaluateObjectivesOnDeploy] Result:`, result?.total_completions, 'completions');
    return Response.json({ success: true, result });
  } catch (err) {
    console.error('[evaluateObjectivesOnDeploy] Error:', err?.message ?? err);
    return Response.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
});