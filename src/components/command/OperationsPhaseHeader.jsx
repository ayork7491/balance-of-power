/**
 * OperationsPhaseHeader — Atomic Refactor (Phase 1).
 *
 * Single source of truth for Operations Phase local staging.
 * Owns localStorage state for economic + diplomatic pillars.
 * Passes localStaging down to child panels via onStatusLoaded callback.
 *
 * Data flow:
 *   1. Load once on mount: server operationsStatus → hydrate state
 *   2. Child panels (Economic, Diplomatic) call onEconomicChange / onDiplomaticChange
 *      to update local staging — no server writes.
 *   3. Lock: send one atomic payload { economic_projects, diplomatic_actions } + attacks
 *      to operationsLockPhase/lockOperationsPhase.
 *   4. Clear local storage after successful lock.
 *
 * Mid-phase polling: only lightweight admin lock-status dot indicators,
 * NOT full territory/influence/resource state.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Loader2, Shield, Coins, Feather, CheckCircle2, RefreshCw, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useOperationsStagingStore } from '@/features/campaigns/operations/useOperationsStagingStore';

function PillarProgress({ icon: Icon, label, staged, total, isLocked, color, note }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${isLocked ? 'text-green-400' : color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[10px] font-display tracking-wide uppercase ${isLocked ? 'text-green-400' : 'text-foreground'}`}>
            {label}
          </span>
          {isLocked
            ? <CheckCircle2 className="w-3 h-3 text-green-400" />
            : <span className="text-[10px] font-mono text-muted-foreground">{note}</span>
          }
        </div>
        <div className="w-full bg-muted/20 rounded-full h-1 overflow-hidden">
          <div
            className={`h-1 rounded-full transition-all duration-300 ${
              isLocked ? 'bg-green-500' :
              color === 'text-red-400' ? 'bg-red-500' :
              color === 'text-amber-400' ? 'bg-amber-500' : 'bg-purple-500'
            }`}
            style={{ width: isLocked ? '100%' : (total > 0 ? `${Math.min(100, Math.round((staged / total) * 100))}%` : '0%') }}
          />
        </div>
      </div>
    </div>
  );
}

export default function OperationsPhaseHeader({
  campaign, myPlayer, actingAsPlayerId, players,
  onLocked, onStatusLoaded,
  onEconomicLocalChange,
  onDiplomaticLocalChange,
  localEconomicStaging,
  localDiplomaticStaging,
}) {
  const actingId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 1;
  const stagingStore = useOperationsStagingStore({ campaignId: campaign?.id, playerId: actingId, round });

  const [status, setStatus] = useState(null);
  const [adminStatus, setAdminStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState(null);
  const lockInFlightRef = useRef(false);
  const retryRef = useRef(null);

  const load = useCallback(async (isRetry = false) => {
    if (!campaign?.id || !myPlayer?.id) return;
    if (campaign.current_phase !== 'attack') return;
    if (!isRetry) setError(null);
    if (!status) setLoading(true);

    try {
      const [statusRes, adminRes] = await Promise.allSettled([
        base44.functions.invoke('operationsLockPhase', {
          action: 'getOperationsStatus',
          campaign_id: campaign.id,
          acting_as_player_id: actingAsPlayerId ?? undefined,
        }),
        base44.functions.invoke('operationsLockPhase', {
          action: 'getAdminLockStatus',
          campaign_id: campaign.id,
        }),
      ]);

      if (statusRes.status === 'fulfilled') {
        const serverStatus = statusRes.value.data;
        setStatus(serverStatus);
        onStatusLoaded?.(serverStatus);
        setError(null);
        retryRef.current = null;

        if (serverStatus?.operations_locked) {
          stagingStore.clearAll();
        } else {
          // Restore from localStorage or seed from server (only on initial load)
          const localEcon = stagingStore.getEconomicStaging();
          const localDiplo = stagingStore.getDiplomaticStaging();
          onEconomicLocalChange?.(localEcon ?? (serverStatus?.economic?.staged ?? []));
          onDiplomaticLocalChange?.(localDiplo ?? (serverStatus?.diplomatic?.staged ?? []));
        }
      } else {
        const msg = statusRes.reason?.response?.data?.error ?? statusRes.reason?.message ?? '';
        console.warn('[OperationsPhaseHeader] load error (suppressed):', msg);
        if (!retryRef.current) {
          retryRef.current = setTimeout(() => { retryRef.current = null; load(true); }, 3000);
        }
      }

      if (adminRes.status === 'fulfilled') setAdminStatus(adminRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, campaign?.current_phase, myPlayer?.id, actingAsPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [load]);

  // Persist local staging to localStorage whenever it changes
  useEffect(() => {
    if (localEconomicStaging !== null && localEconomicStaging !== undefined) {
      stagingStore.setEconomicStaging(localEconomicStaging);
    }
  }, [localEconomicStaging]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (localDiplomaticStaging !== null && localDiplomaticStaging !== undefined) {
      stagingStore.setDiplomaticStaging(localDiplomaticStaging);
    }
  }, [localDiplomaticStaging]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLock = async () => {
    if (!campaign?.id || lockInFlightRef.current) return;
    lockInFlightRef.current = true;
    setLocking(true);
    setError(null);
    try {
      await base44.functions.invoke('operationsLockPhase', {
        action: 'lockOperationsPhase',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
        _local_economic_staged: localEconomicStaging ?? [],
        _local_diplomatic_staged: localDiplomaticStaging ?? [],
      });
      stagingStore.clearAll();
      onEconomicLocalChange?.([]);
      onDiplomaticLocalChange?.([]);
      await load();
      onLocked?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to lock operations phase.');
    } finally {
      setLocking(false);
      lockInFlightRef.current = false;
    }
  };

  const handleUnlock = async () => {
    if (!campaign?.id || lockInFlightRef.current) return;
    lockInFlightRef.current = true;
    setLocking(true);
    setError(null);
    try {
      await base44.functions.invoke('operationsLockPhase', {
        action: 'unlockOperationsPhase',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
      });
      await load();
      onLocked?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to unlock operations phase.');
    } finally {
      setLocking(false);
      lockInFlightRef.current = false;
    }
  };

  if (loading && !status) {
    return (
      <div className="border-b border-border bg-panel-header px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading operations status…
      </div>
    );
  }

  const { military, economic, diplomatic, operations_locked } = status ?? {};
  const playerLocks = adminStatus?.players ?? [];
  const lockedCount = playerLocks.filter(p => p.operations_locked).length;
  const totalPlayers = playerLocks.length;

  const econCount  = (localEconomicStaging ?? []).length;
  const diploCount = (localDiplomaticStaging ?? []).length;

  return (
    <div className="border-b border-border bg-panel-header px-3 py-2 space-y-1">
      <PillarProgress
        icon={Shield} label="Military"
        staged={military?.attacks_staged ?? 0} total={Math.max(military?.attacks_staged ?? 0, 1)}
        isLocked={military?.is_locked} color="text-red-400"
        note={`${military?.attacks_staged ?? 0} attack${(military?.attacks_staged ?? 0) !== 1 ? 's' : ''} staged`}
      />
      <PillarProgress
        icon={Coins} label="Economic"
        staged={econCount} total={economic?.projects_limit ?? 1}
        isLocked={economic?.is_locked} color="text-amber-400"
        note={`${econCount} project${econCount !== 1 ? 's' : ''} staged`}
      />
      <PillarProgress
        icon={Feather} label="Diplomatic"
        staged={diploCount} total={Math.max(diploCount, 1)}
        isLocked={diplomatic?.is_locked} color="text-purple-400"
        note={`${diploCount} action${diploCount !== 1 ? 's' : ''} staged`}
      />

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        {operations_locked ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400 flex-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Operations Phase Locked
            </div>
            <button
              onClick={handleUnlock} disabled={locking}
              className="px-2 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-destructive/40 transition-colors disabled:opacity-40 shrink-0"
              title="Unlock to edit staged choices"
            >
              {locking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Unlock'}
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleLock} disabled={locking}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-display tracking-wider uppercase transition-all bg-primary text-primary-foreground hover:brightness-110 glow-primary disabled:opacity-50"
            >
              {locking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Lock Operations
            </button>
            <button onClick={load} disabled={loading} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}

        {totalPlayers > 0 && (
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <Users className="w-3 h-3 text-muted-foreground" />
            <span className={`text-xs font-mono font-bold ${lockedCount === totalPlayers ? 'text-green-400' : 'text-muted-foreground'}`}>
              {lockedCount}/{totalPlayers}
            </span>
            <div className="flex gap-0.5">
              {playerLocks.map(p => {
                const playerDef = players?.find(pl => pl.id === p.player_id);
                return (
                  <div
                    key={p.player_id}
                    title={`${playerDef?.display_name ?? p.player_id}: ${p.operations_locked ? 'Locked' : 'Pending'}`}
                    className={`w-2 h-2 rounded-full border ${p.operations_locked ? 'bg-green-500 border-green-400' : 'bg-muted border-border'}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!operations_locked && (
        <p className="text-[10px] text-muted-foreground">
          Stage actions in each pillar tab, then lock in Operations Phase.
        </p>
      )}
    </div>
  );
}