/**
 * AdminConsolidationTab — Sprint 5B.7
 *
 * Admin-only tab content during Consolidation Phase.
 * Contains:
 *   - Per-player lock status (phase+round scoped)
 *   - Phase advancement control
 *   - Force advance option
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Check, Users, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminConsolidationTab({ campaign, players, onPhaseChanged }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState(null);

  const round = campaign?.current_round ?? 1;
  const activePlayers = players?.filter(p => !p.is_eliminated) ?? [];

  const load = useCallback(async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const data = await base44.entities.PhaseDecision.filter({
        campaign_id: campaign.id,
        phase: 'fortify',
        round,
      });
      setDecisions(data ?? []);
    } catch { setDecisions([]); }
    finally { setLoading(false); }
  }, [campaign?.id, round]);

  useEffect(() => { load(); }, [load]);

  const handleAdvance = async () => {
    setAdvancing(true);
    setAdvanceError(null);
    try {
      await base44.functions.invoke('fortifyPhase', {
        action: 'processPhaseEnd',
        campaign_id: campaign.id,
      });
      onPhaseChanged?.();
    } catch (e) {
      setAdvanceError(e?.response?.data?.error ?? 'Failed to advance phase.');
    } finally {
      setAdvancing(false);
    }
  };

  const lockedCount = decisions.filter(d => d.is_locked).length;
  const totalCount = activePlayers.length;
  const allLocked = lockedCount >= totalCount && totalCount > 0;
  const incompletePlayers = activePlayers.filter(p => {
    const dec = decisions.find(d => d.player_id === p.id);
    return !dec?.is_locked;
  });

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Admin — Consolidation Phase
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Per-player lock status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-display tracking-wider uppercase text-muted-foreground">Consolidation Lock Status</span>
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            : <span className={`font-mono font-bold ${allLocked ? 'text-green-400' : 'text-amber-400'}`}>{lockedCount}/{totalCount}</span>
          }
        </div>

        {activePlayers.map(p => {
          const dec = decisions.find(d => d.player_id === p.id);
          const isLocked = dec?.is_locked ?? false;
          const movCount = (dec?.data?.movements ?? []).length;

          return (
            <div key={p.id} className={`rounded border text-xs overflow-hidden ${
              isLocked ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
            }`}>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLocked ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className={`flex-1 truncate font-medium ${isLocked ? 'text-green-400' : 'text-amber-400'}`}>
                  {p.display_name}
                </span>
                {isLocked
                  ? <Lock className="w-3 h-3 text-green-400 shrink-0" />
                  : <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                }
              </div>
              {!isLocked && dec && (
                <div className="px-3 pb-1.5 text-[10px] text-muted-foreground">
                  {movCount} movement{movCount !== 1 ? 's' : ''} staged
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
        {advanceError && <p className="text-[10px] text-destructive">{advanceError}</p>}

        {allLocked ? (
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 disabled:opacity-40"
          >
            {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Advance to Next Round
          </button>
        ) : (
          <>
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
            >
              {advancing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Force Advance (skip incomplete)
            </button>
            {incompletePlayers.length > 0 && (
              <p className="text-[10px] text-muted-foreground text-center">
                Waiting on: {incompletePlayers.map(p => p.display_name).join(', ')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}