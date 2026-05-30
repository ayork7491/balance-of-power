/**
 * autoStartPhase — called by the campaign phase-change automation.
 * When campaign.current_phase transitions to 'deploy' or 'fortify',
 * this function auto-starts the phase (creates PhaseDecision stubs, income records, etc.)
 * so players see their actions immediately without a manual admin "Start" button.
 *
 * This eliminates the P0 blocker where non-admin players saw a blank panel
 * waiting for the admin to press "Start Deploy".
 *
 * Idempotent — safe to call multiple times for the same phase/round.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { event, data } = body;

  // This function is called by an entity automation on Campaign update.
  // We only care about current_phase changes.
  const campaign = data;
  if (!campaign?.id) {
    return Response.json({ skipped: true, reason: 'No campaign data in payload' });
  }

  const phase = campaign.current_phase;
  const round = campaign.current_round ?? 1;
  const campaign_id = campaign.id;

  // Only act on deploy or fortify phase transitions
  if (phase !== 'deploy' && phase !== 'fortify') {
    return Response.json({ skipped: true, reason: `Phase '${phase}' does not require auto-start` });
  }

  console.log(`[autoStartPhase] Campaign ${campaign_id} entered '${phase}' phase (round ${round}). Auto-starting.`);

  try {
    if (phase === 'deploy') {
      // Check if already started (idempotency)
      const existingDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
        campaign_id, phase: 'deploy', round,
      });
      if (existingDecisions.length > 0) {
        console.log('[autoStartPhase] Deploy phase already started — skipping.');
        return Response.json({ skipped: true, reason: 'Already started' });
      }

      const result = await base44.asServiceRole.functions.invoke('deployPhase', {
        action: 'startDeploy',
        campaign_id,
        _internal: true,
      });
      console.log('[autoStartPhase] Deploy auto-start result:', result?.success);
      return Response.json({ success: true, phase, round });
    }

    if (phase === 'fortify') {
      // Check if already started (idempotency)
      const existingDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
        campaign_id, phase: 'fortify', round,
      });
      if (existingDecisions.length > 0) {
        console.log('[autoStartPhase] Fortify phase already started — skipping.');
        return Response.json({ skipped: true, reason: 'Already started' });
      }

      const result = await base44.asServiceRole.functions.invoke('fortifyPhase', {
        action: 'startFortify',
        campaign_id,
        _internal: true,
      });
      console.log('[autoStartPhase] Fortify auto-start result:', result?.success);
      return Response.json({ success: true, phase, round });
    }
  } catch (err) {
    console.error('[autoStartPhase] Error auto-starting phase:', err?.message ?? err);
    // Non-fatal — log and return error but don't crash
    return Response.json({ success: false, error: err?.message, phase, round }, { status: 500 });
  }

  return Response.json({ skipped: true });
});