/**
 * AdminPlanningTab — Admin-only tab in CommandCenterPanel during deploy (Planning) phase.
 *
 * Contains:
 *   - Global player lock status (who has/hasn't locked Planning Phase)
 *   - Force Advance / Reveal & Begin Attack Phase button
 *   - Start Deploy Phase manually (if not yet started)
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, Check, Play, Users, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminPlanningTab({ campaign, players, advancing, onProcessEnd, onStartDeploy }) {
  const [planningStatus, setPlanningStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState(null);

  const activePlayers = players?.filter(p => !p.is_eliminated) ?? [];

  const load = useCallback(async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('planningPhase', {
        action: 'getAdminLockStatus',
        campaign_id: campaign.id,
      });
      setPlanningStatus(res.data);
    } catch {
      setPlanningStatus(null);
    } finally {
      setLoading(false);
    }
  }, [campaign?.id]);

  useEffect(() => { load(); }, [load]);

  const handleStartDeploy = async () => {
    setStarting(true);
    setStartErr(null);
    try {
      await base44.functions.invoke('deployPhase', {
        action: 'startDeploy',
        campaign_id: campaign.id,
      });
      onStartDeploy?.();
      await load();
    } catch (e) {
      setStartErr(e?.response?.data?.error ?? 'Failed to start deploy phase.');
    } finally {
      setStarting(false);
    }
  };

  const playerLocks = planningStatus?.players ?? planningStatus?.status ?? [];
  const lockedCount = planningStatus?.locked_count ?? playerLocks.filter(p => p.planning_locked).length;
  const totalPlayers = activePlayers.length;
  const allLocked = planningStatus?.all_locked ?? (lockedCount >= totalPlayers && totalPlayers > 0);
  const incompletePlayers = playerLocks.filter(p => !p.planning_locked);
  const deployStarted = !!planningStatus?.phase_started;

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Admin Controls
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Start deploy manually — if phase hasn't started */}
      {!deployStarted && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-muted/20 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Deploy phase not yet started. Income not yet calculated.</span>
          </div>
          {startErr && <p className="text-xs text-destructive">{startErr}</p>}
          <button
            onClick={handleStartDeploy}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
          >
            {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Start Deploy Phase Manually
          </button>
        </div>
      )}

      {/* Player lock status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-display tracking-wider uppercase text-muted-foreground">Planning Lock Status</span>
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <span className={`font-mono font-bold ${allLocked ? 'text-green-400' : 'text-amber-400'}`}>
              {lockedCount}/{totalPlayers}
            </span>
          )}
        </div>

        {/* Per-player lock rows */}
        {activePlayers.map(p => {
          const lockData = playerLocks.find(l => l.player_id === p.id);
          const isLocked = lockData?.planning_locked ?? false;
          return (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${
              isLocked
                ? 'border-green-500/30 bg-green-500/5 text-green-400'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLocked ? 'bg-green-500' : 'bg-amber-400'}`} />
              <span className="flex-1 truncate">{p.display_name}</span>
              {isLocked ? (
                <Lock className="w-3 h-3 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 shrink-0" />
              )}
            </div>
          );
        })}

        {activePlayers.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground italic">No active players.</p>
        )}
      </div>

      {/* Phase advance */}
      <div className="space-y-2 pt-1 border-t border-border">
        {allLocked ? (
          <button
            onClick={onProcessEnd}
            disabled={advancing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary disabled:opacity-40"
          >
            {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Reveal &amp; Begin Attack Phase
          </button>
        ) : (
          <>
            <button
              onClick={onProcessEnd}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
            >
              {advancing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Force Advance (auto-fill missing)
            </button>
            <p className="text-[10px] text-muted-foreground text-center">
              {incompletePlayers.length > 0
                ? `Waiting on: ${incompletePlayers.map(p => p.display_name).join(', ')}`
                : 'Waiting for all players to lock Planning Phase.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}