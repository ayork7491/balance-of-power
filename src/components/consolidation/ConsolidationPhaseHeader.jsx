/**
 * ConsolidationPhaseHeader — Sprint 5B.7
 *
 * Phase header for the Consolidation Phase (fortify phase).
 * Shows per-pillar staging progress and a single "Lock In Consolidation Phase" button.
 * Lock state is phase+round specific — does not inherit from prior phases.
 */
import { useState, useEffect, useCallback } from 'react';
import { Lock, Loader2, Shield, Coins, Feather, CheckCircle2, RefreshCw, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useConsolidationStagingStore } from '@/features/campaigns/consolidation/useConsolidationStagingStore';

function PillarProgress({ icon: Icon, label, note, isLocked, color }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${isLocked ? 'text-green-400' : color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-display tracking-wide uppercase ${isLocked ? 'text-green-400' : 'text-foreground'}`}>
            {label}
          </span>
          {isLocked
            ? <CheckCircle2 className="w-3 h-3 text-green-400" />
            : <span className="text-[10px] font-mono text-muted-foreground">{note}</span>
          }
        </div>
      </div>
    </div>
  );
}

export default function ConsolidationPhaseHeader({ campaign, myPlayer, actingAsPlayerId, players, onLocked, onStatusLoaded }) {
  const actingId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 1;

  const stagingStore = useConsolidationStagingStore({ campaignId: campaign?.id, playerId: actingId, round });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState(null);
  const [adminLocks, setAdminLocks] = useState([]);
  const [localTick, setLocalTick] = useState(0);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingId) return;
    setError(null);
    if (!status) setLoading(true);
    try {
      const lockRes = await base44.functions.invoke('getFortifyLockStatus', {
        campaign_id: campaign.id,
        round,
      });
      const lockStatus = lockRes.data?.lock_status ?? [];
      setAdminLocks(lockStatus);

      // Derive own lock state from the all-player lock status (no extra user-scoped call)
      const myLock = lockStatus.find(d => d.player_id === actingId);
      const s = {
        is_locked: myLock?.is_locked ?? false,
        movements_staged: 0, // local-first store provides the live count
      };
      setStatus(s);
      onStatusLoaded?.(s);
    } catch (e) {
      // Silently ignore load errors (phase transitions, transient failures)
      console.warn('[ConsolidationPhaseHeader] load error:', e?.response?.data?.error ?? e?.message);
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingId, round]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Listen for localStorage changes from movement/caravan panels
  useEffect(() => {
    const onStorage = () => setLocalTick(t => t + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleLock = async () => {
    if (!campaign?.id) return;
    setLocking(true);
    setError(null);
    try {
      await base44.functions.invoke('fortifyPhase', {
        action: 'lockFortify',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
      });
      stagingStore.clearAll();
      await load();
      onLocked?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to lock consolidation phase.');
    } finally {
      setLocking(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="border-b border-border bg-panel-header px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading consolidation status…
      </div>
    );
  }

  const isLocked = status?.is_locked ?? false;

  // Local-first counts for immediate reactivity
  const localMovements = stagingStore.getMilitaryStaging();
  const localCaravans  = stagingStore.getEconomicStaging();
  const movementsStaged = localMovements != null ? localMovements.length : (status?.movements_staged ?? 0);
  const caravansStaged  = localCaravans  != null ? localCaravans.length  : 0;

  const lockedPlayers = adminLocks.filter(d => d.is_locked);
  const activePlayers = players?.filter(p => !p.is_eliminated) ?? [];
  const lockedCount = lockedPlayers.length;
  const totalCount = activePlayers.length;

  return (
    <div className="border-b border-border bg-panel-header px-3 py-2 space-y-1">
      <PillarProgress
        icon={Shield} label="Military"
        note={`${movementsStaged} fortification${movementsStaged !== 1 ? 's' : ''} staged`}
        isLocked={isLocked} color="text-red-400"
      />
      <PillarProgress
        icon={Coins} label="Economic"
        note={`${caravansStaged} caravan${caravansStaged !== 1 ? 's' : ''} staged`}
        isLocked={isLocked} color="text-amber-400"
      />
      <PillarProgress
        icon={Feather} label="Diplomatic"
        note="trade proposals"
        isLocked={isLocked} color="text-purple-400"
      />

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        {isLocked ? (
          <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Consolidation Phase Locked
          </div>
        ) : (
          <>
            <button
              onClick={handleLock}
              disabled={locking}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-display tracking-wider uppercase transition-all bg-primary text-primary-foreground hover:brightness-110 glow-primary disabled:opacity-50"
            >
              {locking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Lock In Consolidation
            </button>
            <button onClick={load} disabled={loading} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}

        {totalCount > 0 && (
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <Users className="w-3 h-3 text-muted-foreground" />
            <span className={`text-xs font-mono font-bold ${lockedCount === totalCount ? 'text-green-400' : 'text-muted-foreground'}`}>
              {lockedCount}/{totalCount}
            </span>
            <div className="flex gap-0.5">
              {activePlayers.map(p => {
                const dec = adminLocks.find(d => d.player_id === p.id);
                const locked = dec?.is_locked ?? false;
                return (
                  <div
                    key={p.id}
                    title={`${p.display_name}: ${locked ? 'Locked' : 'Pending'}`}
                    className={`w-2 h-2 rounded-full border ${locked ? 'bg-green-500 border-green-400' : 'bg-muted border-border'}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!isLocked && (
        <p className="text-[10px] text-muted-foreground">
          Review fortifications, caravans, and trade, then lock in Consolidation Phase.
        </p>
      )}
    </div>
  );
}