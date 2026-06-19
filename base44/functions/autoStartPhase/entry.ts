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
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { event, data } = body;

  // This function is called by an entity automation on Campaign update.
  // We only care about current_phase changes.
  // If payload_too_large is true, data is null — fetch the campaign directly.
  let campaign = data;
  if (!campaign?.id) {
    if (body.payload_too_large && event?.entity_id) {
      try {
        const fetched = await base44.asServiceRole.entities.Campaign.filter({ id: event.entity_id });
        campaign = fetched[0] ?? null;
      } catch { /* fall through */ }
    }
    if (!campaign?.id) {
      return Response.json({ skipped: true, reason: 'No campaign data in payload' });
    }
  }

  const phase = campaign.current_phase;
  const round = campaign.current_round ?? 1;
  const campaign_id = campaign.id;

  // Only act on deploy or fortify phase transitions
  if (phase !== 'deploy' && phase !== 'fortify') {
    return Response.json({ skipped: true, reason: `Phase '${phase}' does not require auto-start` });
  }

  if (!campaign_id) {
    return Response.json({ skipped: true, reason: 'No campaign_id resolved' });
  }

  console.log(`[autoStartPhase] Campaign ${campaign_id} entered '${phase}' phase (round ${round}). Auto-starting.`);

  try {
    // Validate campaign is still active before acting
    if (!['deploy', 'fortify', 'attack', 'battle'].includes(phase)) {
      return Response.json({ skipped: true, reason: `Phase '${phase}' does not require auto-start` });
    }
    if (phase === 'deploy') {
      // Check if already started (decisions exist AND phase_start snapshot exists).
      // Must check BOTH — decisions may exist but snapshot may be missing (repair needed).
      const [existingDecisions, existingSnapshots] = await Promise.all([
        base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'deploy', round }),
        base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id, phase: 'deploy', round, snapshot_type: 'phase_start' }),
      ]);

      const decisionsExist = existingDecisions.length > 0;
      const snapshotExists = existingSnapshots.length > 0;

      if (decisionsExist && snapshotExists) {
        console.log('[autoStartPhase] Deploy phase already started and phase_start snapshot exists — skipping.');
        return Response.json({ skipped: true, reason: 'Already started' });
      }

      if (decisionsExist && !snapshotExists) {
        console.log('[autoStartPhase] Deploy decisions exist but phase_start snapshot missing — calling startDeploy for snapshot repair.');
      } else {
        console.log('[autoStartPhase] Starting deploy phase for the first time.');
      }

      const result = await base44.asServiceRole.functions.invoke('deployPhase', {
        action: 'startDeploy',
        campaign_id,
        _internal: true,
      });
      console.log('[autoStartPhase] Deploy auto-start result:', result?.success);
      return Response.json({ success: true, phase, round, snapshot_repaired: decisionsExist && !snapshotExists });
    }

    if (phase === 'fortify') {
      // Check both decisions AND snapshot — startFortify now writes the snapshot.
      // If decisions exist but snapshot is missing, call startFortify for repair.
      const [existingDecisions, existingSnapshots] = await Promise.all([
        base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, phase: 'fortify', round }),
        base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id, phase: 'fortify', round, snapshot_type: 'phase_start' }),
      ]);

      const decisionsExist = existingDecisions.length > 0;
      const snapshotExists = existingSnapshots.length > 0;

      if (decisionsExist && snapshotExists) {
        console.log('[autoStartPhase] Fortify phase already started and phase_start snapshot exists — skipping.');
        return Response.json({ skipped: true, reason: 'Already started' });
      }

      if (decisionsExist && !snapshotExists) {
        console.log('[autoStartPhase] Fortify decisions exist but phase_start snapshot missing — calling startFortify for snapshot repair.');
      } else {
        console.log('[autoStartPhase] Starting fortify phase for the first time.');
      }

      const result = await base44.asServiceRole.functions.invoke('fortifyPhase', {
        action: 'startFortify',
        campaign_id,
        _internal: true,
      });
      console.log('[autoStartPhase] Fortify auto-start result:', result?.success, 'snapshot_repaired:', result?.snapshot_repaired);
      return Response.json({ success: true, phase, round, snapshot_repaired: decisionsExist && !snapshotExists });
    }
  } catch (err) {
    console.error('[autoStartPhase] Error auto-starting phase:', err?.message ?? err);
    // Non-fatal — log and return error but don't crash
    return Response.json({ success: false, error: err?.message, phase, round }, { status: 500 });
  }

  return Response.json({ skipped: true });
});