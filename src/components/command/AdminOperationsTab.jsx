/**
 * AdminOperationsTab — Sprint 5B.5
 *
 * Admin-only tab content during Operations Phase (attack phase).
 * Contains:
 *   - Per-player operations lock status (with pillar breakdown)
 *   - Force advance to Conflict (Battle) Phase
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Check, Users, Lock, AlertCircle, Shield, Coins, Feather } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PhaseAuditExport from '@/components/command/PhaseAuditExport';

export default function AdminOperationsTab({ campaign, players, advancing, onProcessEnd }) {
  const [opsStatus, setOpsStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const activePlayers = players?.filter(p => !p.is_eliminated) ?? [];

  const load = useCallback(async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('operationsLockPhase', {
        action: 'getAdminLockStatus',
        campaign_id: campaign.id,
      });
      setOpsStatus(res.data);
    } catch {
      setOpsStatus(null);
    } finally {
      setLoading(false);
    }
  }, [campaign?.id]);

  useEffect(() => { load(); }, [load]);

  const playerStatuses = opsStatus?.players ?? [];
  const lockedCount = opsStatus?.locked_count ?? playerStatuses.filter(p => p.operations_locked).length;
  const totalPlayers = activePlayers.length;
  const allLocked = opsStatus?.all_locked ?? (lockedCount >= totalPlayers && totalPlayers > 0);
  const incompletePlayers = playerStatuses.filter(p => !p.operations_locked);

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Admin Controls — Operations Phase
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Player operations lock status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-display tracking-wider uppercase text-muted-foreground">Operations Lock Status</span>
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <span className={`font-mono font-bold ${allLocked ? 'text-green-400' : 'text-amber-400'}`}>
              {lockedCount}/{totalPlayers}
            </span>
          )}
        </div>

        {activePlayers.map(p => {
          const lockData = playerStatuses.find(l => l.player_id === p.id);
          const isLocked = lockData?.operations_locked ?? false;
          const milLocked = lockData?.military_locked ?? false;
          const ecoLocked = lockData?.economic_locked ?? false;
          const dipLocked = lockData?.diplomatic_locked ?? false;

          return (
            <div key={p.id} className={`rounded border text-xs overflow-hidden ${
              isLocked ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
            }`}>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLocked ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className={`flex-1 truncate font-medium ${isLocked ? 'text-green-400' : 'text-amber-400'}`}>
                  {p.display_name}
                </span>
                {isLocked ? (
                  <Lock className="w-3 h-3 text-green-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                )}
              </div>
              {/* Pillar breakdown — only show if not fully locked */}
              {!isLocked && lockData && (
                <div className="flex items-center gap-3 px-3 pb-1.5 text-[10px]">
                  <span className={`flex items-center gap-1 ${milLocked ? 'text-green-400' : 'text-muted-foreground'}`}>
                    <Shield className="w-2.5 h-2.5" /> Mil
                  </span>
                  <span className={`flex items-center gap-1 ${ecoLocked ? 'text-green-400' : 'text-muted-foreground'}`}>
                    <Coins className="w-2.5 h-2.5" /> Eco
                  </span>
                  <span className={`flex items-center gap-1 ${dipLocked ? 'text-green-400' : 'text-muted-foreground'}`}>
                    <Feather className="w-2.5 h-2.5" /> Dip
                  </span>
                  {lockData.economic_projects > 0 && (
                    <span className="text-amber-400">· {lockData.economic_projects} proj</span>
                  )}
                  {lockData.diplomatic_actions > 0 && (
                    <span className="text-purple-400">· {lockData.diplomatic_actions} actions</span>
                  )}
                </div>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-status-danger text-white text-xs font-display tracking-widest uppercase hover:brightness-110 disabled:opacity-40"
          >
            {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Reveal Attacks &amp; Generate Battles
          </button>
        ) : (
          <>
            <button
              onClick={onProcessEnd}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
            >
              {advancing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Force Advance (skip incomplete players)
            </button>
            {incompletePlayers.length > 0 && (
              <p className="text-[10px] text-muted-foreground text-center">
                Waiting on: {incompletePlayers.map(p => p.display_name).join(', ')}
              </p>
            )}
          </>
        )}
      </div>

      {/* Audit Export */}
      <div className="pt-1 border-t border-border">
        <PhaseAuditExport campaign={campaign} />
      </div>
    </div>
  );
}