/**
 * PlanningPhaseLockBar — Sprint 5B.2
 *
 * Shown at the top of CommandCenterPanel during deploy (Planning) phase.
 * Displays per-pillar progress and the single phase-wide "Lock In Planning Phase" button.
 *
 * Props:
 *   campaign
 *   myPlayer
 *   actingAsPlayerId
 *   onLocked           — called after successful lock-in
 *   onStatusLoaded     — called with the status object after load
 */
import { useState, useEffect, useCallback } from 'react';
import { Lock, Loader2, Shield, Coins, Feather, CheckCircle2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function PillarProgress({ icon: IconComp, label, staged, total, isLocked, color, note }) {
  const Icon = IconComp;
  const pct = total > 0 ? Math.min(100, Math.round((staged / total) * 100)) : 0;
  const done = isLocked || (total > 0 && staged >= total);

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${isLocked ? 'text-green-400' : color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[10px] font-display tracking-wide uppercase ${isLocked ? 'text-green-400' : 'text-foreground'}`}>
            {label}
          </span>
          {isLocked ? (
            <CheckCircle2 className="w-3 h-3 text-green-400" />
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground">{note}</span>
          )}
        </div>
        <div className="w-full bg-muted/20 rounded-full h-1 overflow-hidden">
          <div
            className={`h-1 rounded-full transition-all duration-300 ${done ? 'bg-green-500' : color === 'text-red-400' ? 'bg-red-500' : color === 'text-amber-400' ? 'bg-amber-500' : 'bg-purple-500'}`}
            style={{ width: `${done ? 100 : pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PlanningPhaseLockBar({ campaign, myPlayer, actingAsPlayerId, onLocked, onStatusLoaded }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const actingId = actingAsPlayerId ?? myPlayer?.id;

  const load = useCallback(async () => {
    if (!campaign?.id || !myPlayer?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('planningPhase', {
        action: 'getPlanningStatus',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
      });
      setStatus(res.data);
      onStatusLoaded?.(res.data);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load planning status.');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, myPlayer?.id, actingAsPlayerId]);

  useEffect(() => { load(); }, [load]);

  const handleLock = async () => {
    if (!campaign?.id) return;
    setLocking(true);
    setError(null);
    try {
      await base44.functions.invoke('planningPhase', {
        action: 'lockPlanningPhase',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
      });
      setSuccess(true);
      await load();
      onLocked?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to lock planning phase.');
    } finally {
      setLocking(false);
    }
  };

  if (!status?.phase_started) return null;

  const { military, economic, diplomatic, planning_locked } = status ?? {};

  // Determine readiness
  const militaryReady = military?.is_locked || military?.ready;
  const economicReady = economic?.is_locked || economic?.ready;
  const diplomaticReady = !diplomatic?.required || diplomatic?.is_locked || diplomatic?.ready;
  const allReady = militaryReady && economicReady && diplomaticReady;

  return (
    <div className="border-b border-border bg-panel-header px-3 py-2 space-y-1">
      {/* Pillar progress */}
      <PillarProgress
        icon={Shield}
        label="Military"
        staged={military?.troops_staged ?? 0}
        total={military?.troops_total ?? 0}
        isLocked={military?.is_locked}
        color="text-red-400"
        note={`${military?.troops_staged ?? 0} / ${military?.troops_total ?? 0} troops`}
      />
      <PillarProgress
        icon={Coins}
        label="Economic"
        staged={economic?.activations_staged ?? 0}
        total={economic?.activations_limit ?? 0}
        isLocked={economic?.is_locked}
        color="text-amber-400"
        note={`${economic?.activations_staged ?? 0} / ${economic?.activations_limit ?? 0} activations`}
      />
      <PillarProgress
        icon={Feather}
        label="Diplomatic"
        staged={diplomatic?.diplomatic_staged ? 1 : 0}
        total={diplomatic?.required ? 1 : 0}
        isLocked={diplomatic?.is_locked}
        color="text-purple-400"
        note={
          !diplomatic?.required ? 'No action required' :
          diplomatic?.diplomatic_staged ? 'Objective staged' :
          diplomatic?.has_pending_draw ? 'Select objective' :
          'Awaiting deal'
        }
      />

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {/* Lock button */}
      {planning_locked ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Planning Phase Locked
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleLock}
            disabled={locking || !allReady}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-display tracking-wider uppercase transition-all ${
              allReady
                ? 'bg-primary text-primary-foreground hover:brightness-110 glow-primary'
                : 'bg-muted/20 text-muted-foreground border border-border cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {locking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Lock In Planning Phase
          </button>
          <button onClick={load} disabled={loading} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {!allReady && !planning_locked && (
        <p className="text-[10px] text-muted-foreground text-center">
          {!militaryReady ? 'Stage all troops · ' : ''}
          {!economicReady ? 'Stage activations · ' : ''}
          {!diplomaticReady ? 'Select objective · ' : ''}
          complete all tasks to lock
        </p>
      )}
    </div>
  );
}