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
import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Unlock, Loader2, Shield, Coins, Feather, CheckCircle2, RefreshCw, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { usePlanningStagingStore } from '@/features/campaigns/deploy/usePlanningStagingStore';

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

export default function PlanningPhaseLockBar({ campaign, myPlayer, actingAsPlayerId, players, onLocked, onStatusLoaded }) {
  const [status, setStatus] = useState(null);
  const [adminStatus, setAdminStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState(null);
  const [localTick, setLocalTick] = useState(0);
  const lockInFlightRef = useRef(false);

  const actingId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 1;

  const stagingStore = usePlanningStagingStore({
    campaignId: campaign?.id,
    playerId: actingId,
    round,
  });

  // Reset server status when acting-as player changes — forces re-fetch for the new player
  const prevActingIdRef = useRef(actingId);
  useEffect(() => {
    if (prevActingIdRef.current !== actingId) {
      prevActingIdRef.current = actingId;
      setStatus(null);
      setAdminStatus(null);
      setLoading(true);
    }
  }, [actingId]);

  const load = useCallback(async () => {
    if (!campaign?.id || !myPlayer?.id) return;
    // Guard: only load when campaign is actually in deploy phase
    if (campaign.current_phase !== 'deploy') return;
    setError(null);
    if (!status) setLoading(true);
    try {
      // Single merged call — getPlanningStatus now returns admin_lock_status inline
      const res = await base44.functions.invoke('planningPhase', {
        action: 'getPlanningStatus',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
        include_admin_status: true,
      });
      if (res.data) {
        setStatus(res.data);
        onStatusLoaded?.(res.data);
        if (res.data.admin_lock_status) setAdminStatus(res.data.admin_lock_status);
        setError(null);
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error ?? '';
      if (!errMsg.includes('deploy') && !errMsg.includes('phase') && !status) {
        setError(errMsg || 'Failed to load planning status.');
      }
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, campaign?.current_phase, myPlayer?.id, actingAsPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleUnlock = async () => {
    if (!campaign?.id || lockInFlightRef.current) return;
    lockInFlightRef.current = true;
    setUnlocking(true);
    setError(null);
    try {
      await base44.functions.invoke('planningPhase', {
        action: 'unlockPlanningPhase',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
      });
      await load();
      onLocked?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to unlock planning phase.');
    } finally {
      setUnlocking(false);
      lockInFlightRef.current = false;
    }
  };

  const handleLock = async () => {
    if (!campaign?.id || lockInFlightRef.current) return;
    lockInFlightRef.current = true;
    setLocking(true);
    setError(null);
    try {
      const localPlacements = stagingStore.getMilitaryPlacements();
      const localEcon = stagingStore.getEconomicSelections();
      const localDiplo = stagingStore.getDiplomaticStaging();
      const localCapital = stagingStore.getCapitalStaging();

      await base44.functions.invoke('planningPhase', {
        action: 'lockPlanningPhase',
        campaign_id: campaign.id,
        acting_as_player_id: actingAsPlayerId ?? undefined,
        _local_economic_staged: localEcon ?? undefined,
        _local_diplomatic_staged: localDiplo ?? undefined,
        _local_military_placements: localPlacements ?? undefined,
        _local_capital_territory_id: localCapital ?? undefined,
      });
      stagingStore.clearAll();
      await load();
      onLocked?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to lock planning phase.');
    } finally {
      setLocking(false);
      lockInFlightRef.current = false;
    }
  };

  // Listen for localStorage changes (other tabs or within-page writes via storage event)
  // Also re-render when localTick increments (triggered by in-page writes)
  useEffect(() => {
    const onStorage = () => setLocalTick(t => t + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Show a minimal waiting state if deploy hasn't started yet (income not yet calculated)
  if (loading && !status) {
    return (
      <div className="border-b border-border bg-panel-header px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading Planning Phase status…
      </div>
    );
  }

  if (!status?.phase_started) {
    return (
      <div className="border-b border-border bg-panel-header px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Waiting for phase to start…
        <button onClick={load} className="ml-auto text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const { military, economic, diplomatic, planning_locked } = status ?? {};

  // Player lock summary from admin status
  const playerLocks = adminStatus?.players ?? [];
  const lockedCount = playerLocks.filter(p => p.planning_locked).length;
  const totalPlayers = playerLocks.length;

  // ── Local-first overrides ──────────────────────────────────────────────────
  // Read from localStorage so readiness updates immediately when the user stages
  // changes in any pillar tab, without waiting for a server round-trip.
  const localMilitaryPlacements = stagingStore.getMilitaryPlacements();
  const localEconomicSelections = stagingStore.getEconomicSelections();
  const localDiplomaticStaging  = stagingStore.getDiplomaticStaging();

  const militaryTroopsTotal  = military?.troops_total ?? 0;
  const militaryTroopsStaged = localMilitaryPlacements != null
    ? Object.values(localMilitaryPlacements).reduce((s, n) => s + (parseInt(n) || 0), 0)
    : (military?.troops_staged ?? 0);
  const militaryLocalReady = militaryTroopsTotal > 0
    ? militaryTroopsStaged >= militaryTroopsTotal
    : false;

  const economicLimit  = economic?.activations_limit ?? 0;
  const economicStaged = localEconomicSelections != null
    ? localEconomicSelections.length
    : (economic?.activations_staged ?? 0);
  const economicLocalReady = economicLimit === 0 || economicStaged >= economicLimit;

  const diplomaticLocalStaged = localDiplomaticStaging ?? diplomatic?.diplomatic_staged ?? null;
  // Block lock if player is at hand cap and hasn't chosen a card to replace
  const heldCount = diplomatic?.held_count ?? 0;
  const needsReplace = heldCount >= 3 && !!diplomaticLocalStaged?.kept_card_id && !diplomaticLocalStaged?.replace_card_id;
  const diplomaticLocalReady  = !diplomatic?.required || (!!diplomaticLocalStaged && !needsReplace);

  // Determine readiness (server locked state takes priority; local state used when not yet locked)
  const militaryReady   = military?.is_locked || militaryLocalReady;
  const economicReady   = economic?.is_locked || economicLocalReady;
  const diplomaticReady = diplomatic?.is_locked || diplomaticLocalReady;
  const allReady = militaryReady && economicReady && diplomaticReady;

  return (
    <div className="border-b border-border bg-panel-header px-3 py-2 space-y-1">
      {/* Pillar progress */}
      <PillarProgress
        icon={Shield}
        label="Military"
        staged={militaryTroopsStaged}
        total={militaryTroopsTotal}
        isLocked={military?.is_locked}
        color="text-red-400"
        note={`${militaryTroopsStaged} / ${militaryTroopsTotal} troops`}
      />
      <PillarProgress
        icon={Coins}
        label="Economic"
        staged={economicStaged}
        total={economicLimit}
        isLocked={economic?.is_locked}
        color="text-amber-400"
        note={`${economicStaged} / ${economicLimit} activations`}
      />
      <PillarProgress
        icon={Feather}
        label="Diplomatic"
        staged={diplomaticLocalStaged ? 1 : 0}
        total={diplomatic?.required ? 1 : 0}
        isLocked={diplomatic?.is_locked}
        color="text-purple-400"
        note={
          !diplomatic?.required ? 'No action required' :
          diplomaticLocalStaged ? 'Objective staged' :
          diplomatic?.has_pending_draw ? 'Select objective' :
          'Awaiting deal'
        }
      />

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {/* Lock button row + player lock status */}
      <div className="flex items-center gap-2">
        {planning_locked ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Planning Phase Locked
            </div>
            <button
              onClick={handleUnlock}
              disabled={unlocking}
              className="flex items-center gap-1 px-2 py-2 rounded border border-border text-muted-foreground text-xs hover:text-foreground hover:border-amber-500/50 transition-colors disabled:opacity-40"
              title="Unlock to edit staging"
            >
              {unlocking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleLock}
              disabled={locking || !allReady}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-display tracking-wider uppercase transition-all ${
                allReady
                  ? 'bg-primary text-primary-foreground hover:brightness-110 glow-primary'
                  : 'bg-muted/20 text-muted-foreground border border-border cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {locking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Lock In
            </button>
            <button onClick={load} disabled={loading} className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}

        {/* Player lock status — always visible in header */}
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
                    title={`${playerDef?.display_name ?? p.player_id}: ${p.planning_locked ? 'Locked' : 'Pending'}`}
                    className={`w-2 h-2 rounded-full border ${p.planning_locked ? 'bg-green-500 border-green-400' : 'bg-muted border-border'}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!allReady && !planning_locked && (
        <p className="text-[10px] text-muted-foreground">
          {!militaryReady ? '· Stage troops ' : ''}
          {!economicReady ? '· Stage activations ' : ''}
          {!diplomaticReady ? '· Select objective ' : ''}
          to unlock
        </p>
      )}
    </div>
  );
}