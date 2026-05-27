/**
 * DeployPanel — left-dock panel for the standard deploy phase (Round 1+).
 *
 * Responsibilities (UI only — no game logic):
 *   - Show the player's income breakdown (public)
 *   - Allow staged troop placement on owned territories (private)
 *   - Save / Lock actions
 *   - Show all players' lock status (no placement data)
 *   - Admin: Start Deploy (if not started) + Force Advance
 *
 * All state and actions come from hooks in features/campaigns/deploy/.
 * No rules logic lives here.
 *
 * Privacy:
 *   - Placement inputs only shown for the current player.
 *   - Other players' placements are never fetched or displayed.
 *   - Lock status shown via useDeployPhaseLockStatus (is_locked only).
 */
import { useMemo, useState } from 'react';
import { Loader2, Lock, Check, Play, ChevronDown, ChevronUp, TestTube } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDeployPhase, useDeployPhaseLockStatus, useDeployIncome } from '@/features/campaigns/deploy';
import { useActingAsPayload } from '@/features/adminTestMode/useActingAsPayload';
import DeployIncomeCard from './DeployIncomeCard';
import DeployLockStatusRow from './DeployLockStatusRow';
import DeployPlacementList from './DeployPlacementList';

export default function DeployPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  onPhaseChanged,
}) {
  const round         = campaign?.current_round ?? 1;
  const isAdmin       = myPlayer?.is_admin;
  const [startingErr, setStartingErr]   = useState(null);
  const [starting, setStarting]         = useState(false);
  const [advancing, setAdvancing]       = useState(false);
  const [showIncome, setShowIncome]     = useState(true);

  const myTerritories = useMemo(
    () => Object.values(stateById).filter(s => s.owner_player_id === myPlayer?.id),
    [stateById, myPlayer?.id],
  );

  const { getPayload, actingPlayer, actingAsId } = useActingAsPayload(myPlayer);
  const {
    placements, decision, income, troopsRemaining,
    loading, submitting, saved, error,
    handleChange, handleSave, handleLock, reload: reloadDecision,
  } = useDeployPhase({ campaign, myPlayer, myTerritories });
  
  const { lockStatus, reload: reloadLocks } = useDeployPhaseLockStatus({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  const { incomes, loading: loadingIncomes } = useDeployIncome({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  const activePlayers = players.filter(p => !p.is_eliminated);
  const lockedCount   = lockStatus.filter(s => s.is_locked).length;
  const allLocked     = lockedCount >= activePlayers.length && activePlayers.length > 0;
  const isLocked      = decision?.is_locked ?? false;
  const deployStarted = !!income; // income record exists = deploy was started

  const handleStartDeploy = async () => {
    setStarting(true);
    setStartingErr(null);
    try {
      await base44.functions.invoke('deployPhase', {
        action:      'startDeploy',
        campaign_id: campaign.id,
      });
      await reloadDecision();
    } catch (err) {
      setStartingErr(err?.response?.data?.error || 'Failed to start deploy phase.');
    } finally {
      setStarting(false);
    }
  };

  const handleLockAndRefresh = async () => {
    await handleLock(onPhaseChanged, actingAsId);
    reloadLocks();
  };

  const handleProcessEnd = async () => {
    setAdvancing(true);
    try {
      await base44.functions.invoke('deployPhase', {
        action:      'processPhaseEnd',
        campaign_id: campaign.id,
      });
      onPhaseChanged?.();
    } catch (err) {
      // surface in UI
      console.error(err);
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading deploy phase…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      {/* Phase header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1">
        <p className="font-display text-xs tracking-widest uppercase text-status-pending">
          Round {round} — Deploy Phase
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Stage troop placements. Decisions are hidden until reveal.
        </p>
      </div>

      {/* Admin: start deploy if not started */}
      {isAdmin && !deployStarted && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Deploy phase has not been started yet. Start it to calculate income and open staging.
          </p>
          {startingErr && <p className="text-xs text-destructive">{startingErr}</p>}
          <button
            onClick={handleStartDeploy}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 disabled:opacity-40"
          >
            {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Start Deploy Phase
          </button>
        </div>
      )}

      {/* Income section */}
      {deployStarted && (
        <div className="space-y-2">
          <button
            onClick={() => setShowIncome(v => !v)}
            className="flex items-center gap-2 text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <span>Income Breakdown</span>
            {showIncome ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showIncome && (
            <div className="space-y-1.5">
              {loadingIncomes
                ? <div className="h-8 bg-muted/50 rounded animate-pulse" />
                : activePlayers.map(p => {
                    const inc = incomes.find(i => i.player_id === p.id);
                    return (
                      <DeployIncomeCard
                        key={p.id}
                        income={inc}
                        player={p}
                        isMe={p.id === myPlayer?.id}
                      />
                    );
                  })
              }
            </div>
          )}
        </div>
      )}

      {/* Troops remaining indicator */}
      {deployStarted && (
        <div className={`flex items-center justify-between px-3 py-2 rounded border text-xs ${
          troopsRemaining === 0 ? 'border-status-locked/40 bg-status-locked/10' :
          troopsRemaining < 0  ? 'border-destructive/40 bg-destructive/10' :
                                  'border-border bg-muted/30'
        }`}>
          <span className="text-muted-foreground font-display tracking-wide uppercase">Troops to Place</span>
          <span className={`font-mono font-bold text-base ${
            troopsRemaining === 0 ? 'text-status-locked' :
            troopsRemaining < 0  ? 'text-destructive' :
                                    'text-foreground'
          }`}>{troopsRemaining}</span>
        </div>
      )}

      {/* Placement list — only when deploy started and not locked */}
      {deployStarted && !isLocked && (
        <div className="space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Your Territories</p>
          <DeployPlacementList
            territories={myTerritories}
            mapDef={mapDef}
            placements={placements}
            onChange={handleChange}
            troopsRemaining={troopsRemaining}
            maxTroops={income?.total ?? 0}
          />
        </div>
      )}

      {/* Locked state */}
      {deployStarted && isLocked && (
        <div className="px-3 py-2 rounded border border-status-locked/40 bg-status-locked/10 text-xs">
          <div className="flex items-center gap-2 text-status-locked">
            <Lock className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide">Deployment Locked</span>
          </div>
          <p className="text-muted-foreground mt-1">Hidden until all players reveal.</p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Save / Lock buttons */}
      {deployStarted && !isLocked && (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={submitting || troopsRemaining < 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-primary/40 text-primary text-xs font-display tracking-wider uppercase hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            {submitting && !saved ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {saved ? '✓ Saved' : 'Save'}
          </button>
          <button
            onClick={handleLockAndRefresh}
            disabled={submitting || troopsRemaining !== 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Lock as {actingPlayer?.display_name || 'Player'}
          </button>
        </div>
      )}

      {deployStarted && !isLocked && troopsRemaining !== 0 && (
        <p className="text-xs text-muted-foreground">
          {troopsRemaining > 0
            ? `Place ${troopsRemaining} more troop${troopsRemaining !== 1 ? 's' : ''} to lock.`
            : `Over by ${Math.abs(troopsRemaining)}. Reduce some placements.`
          }
        </p>
      )}

      {/* Acting-as indicator */}
      {actingAsId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-accent/40 bg-accent/10 text-xs">
          <TestTube className="w-3.5 h-3.5 text-accent" />
          <span className="text-accent font-display tracking-wide">Acting as {actingPlayer?.display_name}</span>
        </div>
      )}

      {/* Player lock status */}
      {deployStarted && (
        <div className="space-y-1 pt-2 border-t border-border">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">
            Players — {lockedCount}/{activePlayers.length} Locked
          </p>
          {activePlayers.map(p => {
            const status = lockStatus.find(s => s.player_id === p.id);
            return (
              <DeployLockStatusRow
                key={p.id}
                player={p}
                isLocked={status?.is_locked ?? false}
                isMe={p.id === myPlayer?.id}
              />
            );
          })}
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && deployStarted && (
        <div className="pt-2 border-t border-border space-y-2">
          {allLocked ? (
            <button
              onClick={handleProcessEnd}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary disabled:opacity-40"
            >
              {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Reveal &amp; Begin Attack Phase
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Waiting for all players to lock…</p>
              <button
                onClick={handleProcessEnd}
                disabled={advancing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
              >
                {advancing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Force Advance (auto-fill missing)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}