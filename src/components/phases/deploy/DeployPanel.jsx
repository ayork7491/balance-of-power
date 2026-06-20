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
import { useMemo, useState, useEffect } from 'react';
import { Loader2, Lock, ChevronDown, ChevronUp, TestTube } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDeployPhase, useDeployPhaseLockStatus, useDeployIncome } from '@/features/campaigns/deploy';
import { useActingAsPayload } from '@/features/adminTestMode/useActingAsPayload';
import DeployIncomeCard from './DeployIncomeCard';
import DeployLockStatusRow from './DeployLockStatusRow';
import DeployPlacementList from './DeployPlacementList';
import CapitalSelector from '@/components/setup/CapitalSelector';
export default function DeployPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  onPhaseChanged,
  onStagingChanged,
}) {
  const round         = campaign?.current_round ?? 1;
  const isAdmin       = myPlayer?.is_admin;
  const [showIncome, setShowIncome] = useState(true);
  const [capitalData, setCapitalData] = useState(null);

  const { actingPlayer, actingAsId } = useActingAsPayload(myPlayer);
  const actingPlayerId = actingAsId ?? myPlayer?.id;

  // CRITICAL: derive territories from actingPlayer (not myPlayer) so that
  // admins acting as test players get the correct territory list.
  const myTerritories = useMemo(
    () => Object.values(stateById).filter(s => s.owner_player_id === (actingPlayer?.id ?? myPlayer?.id)),
    [stateById, actingPlayer?.id, myPlayer?.id],
  );

  const {
    placements, decision, income, troopsRemaining,
    loading, submitting, error,
    handleChange, handleLock,
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
  const isLocked      = decision?.is_locked ?? false;
  const deployStarted = !!income; // income record exists = deploy was started



  // Load capital data once deploy starts
  useEffect(() => {
    if (!campaign?.id || !actingPlayerId) return;
    base44.functions.invoke('territoryDevelopment', {
      action: 'getPlayerDevelopment',
      campaign_id: campaign.id,
      acting_as_player_id: actingPlayerId,
    }).then(res => setCapitalData(res.data)).catch(() => {});
  }, [campaign?.id, actingPlayerId]);

  const capitalTerritories = useMemo(() =>
    myTerritories.map(ts => ({
      territory_id: ts.territory_id,
      name: mapDef?.territories?.find(t => t.territory_id === ts.territory_id)?.name ?? ts.territory_id,
    })), [myTerritories, mapDef]);

  const handleLockAndRefresh = async () => {
    await handleLock(onPhaseChanged, actingAsId);
    reloadLocks();
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
          Round {round} — Planning Phase
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Stage troop placements. Decisions are hidden until reveal.
        </p>
      </div>

      {/* Deploy not started yet */}
      {!deployStarted && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-muted/20 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Waiting for admin to start the deploy phase…</span>
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
            lockedIds={new Set(campaign?.locked_territory_ids ?? [])}
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

      {/* Capital change — available during Planning Phase (once per round) */}
      {deployStarted && myTerritories.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-display tracking-wider uppercase text-amber-400">Capital</p>
          <p className="text-[10px] text-muted-foreground">
            Change once per round. Food generated each round auto-invests into your capital.
          </p>
          <CapitalSelector
            campaign={campaign}
            myPlayer={myPlayer}
            actingAsPlayerId={actingAsId}
            territories={capitalTerritories}
            currentCapitalId={capitalData?.capital_territory_id ?? null}
            lastSetRound={capitalData?.capital_set_round ?? null}
            onCapitalSet={(tid) => setCapitalData(prev => ({ ...(prev ?? {}), capital_territory_id: tid, capital_set_round: round ?? 1 }))}
            allowChangeLabel="Change Capital"
          />
        </div>
      )}

      {deployStarted && !isLocked && troopsRemaining !== 0 && (
        <p className="text-xs text-muted-foreground">
          {troopsRemaining > 0
            ? `${troopsRemaining} troop${troopsRemaining !== 1 ? 's' : ''} left to place.`
            : `Over by ${Math.abs(troopsRemaining)}. Reduce some placements.`
          }
        </p>
      )}
      {deployStarted && !isLocked && (
        <p className="text-[10px] text-muted-foreground italic text-center">
          Lock deployment using the Planning Phase button above.
        </p>
      )}

      {/* Acting-as indicator */}
      {actingAsId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-accent/40 bg-accent/10 text-xs">
          <TestTube className="w-3.5 h-3.5 text-accent" />
          <span className="text-accent font-display tracking-wide">Acting as {actingPlayer?.display_name}</span>
        </div>
      )}

      {/* Admin controls moved to Admin tab in CommandCenterPanel */}
    </div>
  );
}