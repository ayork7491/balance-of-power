/**
 * AdminDeployControls — Sprint 5B.2
 *
 * Shows admin phase-advance controls during deploy phase.
 * Checks planningPhase/getAdminLockStatus to guard against advancing
 * before all players have locked their Planning Phase.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminDeployControls({ campaign, activePlayers, advancing, onProcessEnd }) {
  const [planningStatus, setPlanningStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('planningPhase', {
        action: 'getAdminLockStatus',
        campaign_id: campaign.id,
      });
      setPlanningStatus(res.data);
    } catch (e) {
      // Non-fatal — fall back to deploy decision lock status
      setPlanningStatus(null);
    } finally {
      setLoading(false);
    }
  }, [campaign?.id]);

  useEffect(() => { load(); }, [load]);

  const totalPlayers = activePlayers?.length ?? 0;
  const planningLockedCount = planningStatus?.locked_count ?? 0;
  const allPlanningLocked = planningStatus?.all_locked ?? false;
  const incompletePlayers = planningStatus?.status?.filter(s => !s.planning_locked) ?? [];

  // Only show the advance button — lock status is shown in PlanningPhaseLockBar
  return (
    <div className="pt-2 border-t border-border space-y-2">
      {allPlanningLocked ? (
        <button
          onClick={onProcessEnd}
          disabled={advancing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary disabled:opacity-40"
        >
          {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Reveal &amp; Begin Attack Phase
        </button>
      ) : (
        <div className="space-y-1.5">
          <button
            onClick={onProcessEnd}
            disabled={advancing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
          >
            {advancing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Force Advance (auto-fill missing)
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Waiting for all players to lock Planning Phase.
          </p>
        </div>
      )}
    </div>
  );
}