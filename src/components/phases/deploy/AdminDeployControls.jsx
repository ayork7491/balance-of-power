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

  return (
    <div className="pt-2 border-t border-border space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">
          Planning Lock Status
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking…
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {planningLockedCount}/{totalPlayers} players locked Planning Phase
        </div>
      )}

      {incompletePlayers.length > 0 && (
        <div className="space-y-1">
          {incompletePlayers.map(p => (
            <div key={p.player_id} className="flex items-center gap-1.5 text-[10px] text-amber-400">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {p.display_name} has not completed Planning Phase
            </div>
          ))}
        </div>
      )}

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
        <div className="space-y-2">
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