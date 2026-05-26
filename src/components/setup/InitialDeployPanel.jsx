/**
 * InitialDeployPanel — left dock panel for initial_deploy phase.
 *
 * Privacy:
 *   - Own deployment data: fetched via useInitialDeploy (own PhaseDecision only).
 *   - Other players' lock status: fetched via useDeployLockStatus (no placement data).
 *   - Other players' placements: NEVER fetched on the client.
 *
 * See SETUP_NOTES.md for full privacy contract.
 */
import { useMemo } from 'react';
import { Loader2, Lock, Check, TestTube, User, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInitialDeploy, useDeployLockStatus } from '@/features/campaigns/setup';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function InitialDeployPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  onPhaseChanged,
}) {
  const startingTroops = campaign?.settings?.starting_troops ?? 30;
  const isAdmin = myPlayer?.is_admin;
  
  // Use centralized test context
  const { actingAsPlayer, actingAsCampaignPlayerId, viewingAsPlayer } = useCampaignTestContext();
  
  // Determine action player (acting-as or self)
  const actionPlayer = actingAsPlayer || myPlayer;
  const canDelegateActions = !!actingAsPlayer;

  // My owned territories
  const myTerritories = useMemo(
    () => Object.values(stateById).filter(s => s.owner_player_id === myPlayer?.id),
    [stateById, myPlayer?.id],
  );

  // Own deployment logic (only my PhaseDecision)
  const {
    placements,
    decision,
    troopsRemaining,
    loading,
    submitting,
    saved,
    error,
    handleChange,
    handleSave,
    handleLock,
  } = useInitialDeploy({ campaign, myPlayer, myTerritories });

  // Lock status for all players — no placement data (server enforced)
  const { lockStatus, reload: reloadLockStatus } = useDeployLockStatus({
    campaignId: campaign?.id,
    enabled: !!campaign?.id,
  });

  const isLocked    = decision?.is_locked ?? false;
  const activePlayers = players.filter(p => !p.is_eliminated);
  const lockedCount = lockStatus.filter(s => s.is_locked).length;
  const totalCount  = activePlayers.length;
  const allLocked   = lockedCount >= totalCount && totalCount > 0;

  const handleLockAndRefresh = async () => {
    await handleLock(onPhaseChanged, actingAsCampaignPlayerId || null);
    reloadLockStatus();
  };

  const handleProcessEnd = async () => {
    try {
      await base44.functions.invoke('initialDeploy', {
        action:      'processPhaseEnd',
        campaign_id: campaign.id,
      });
      onPhaseChanged?.();
    } catch (err) {
      // error surfaces via the hook; swallow here
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      {/* Phase header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1">
        <p className="font-display text-xs tracking-widest uppercase text-yellow-300">
          Initial Deployment
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Secretly place your starting troops. Reveal is simultaneous.
        </p>
      </div>

      {/* Troops remaining */}
      <div className={`flex items-center justify-between px-3 py-2 rounded border text-xs ${
        troopsRemaining === 0 ? 'border-status-locked/40 bg-status-locked/10' :
        troopsRemaining < 0  ? 'border-destructive/40 bg-destructive/10' :
                               'border-border bg-muted/30'
      }`}>
        <span className="text-muted-foreground font-display tracking-wide uppercase">Troops Remaining</span>
        <span className={`font-mono font-bold text-base ${
          troopsRemaining === 0 ? 'text-status-locked' :
          troopsRemaining < 0  ? 'text-destructive' :
                                 'text-foreground'
        }`}>{troopsRemaining}</span>
      </div>

      {/* Placement inputs — only shown when not locked */}
      {!isLocked ? (
        <div className="space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Your Territories</p>
          {myTerritories.length === 0 && (
            <p className="text-xs text-muted-foreground">You have no territories. Something went wrong.</p>
          )}
          {myTerritories.map(ts => {
            const def = mapDef?.territories.find(t => t.territory_id === ts.territory_id);
            return (
              <div key={ts.territory_id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{def?.name ?? ts.territory_id}</p>
                  <p className="text-xs text-muted-foreground capitalize">{def?.terrain ?? ''}</p>
                </div>
                <input
                  type="number"
                  min="0"
                  max={startingTroops}
                  value={placements[ts.territory_id] ?? 0}
                  onChange={e => handleChange(ts.territory_id, e.target.value)}
                  // Mobile zoom prevention: 16px font-size minimum
                  className="w-20 text-right bg-input border border-border rounded px-2 py-1.5 text-[16px] leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary touch-manipulation"
                  style={{ fontSize: '16px' }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-3 py-2 rounded border border-status-locked/40 bg-status-locked/10 text-xs">
          <div className="flex items-center gap-2 text-status-locked">
            <Lock className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide">Deployment Locked</span>
          </div>
          <p className="text-muted-foreground mt-1">Hidden until reveal.</p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Actions */}
      {!isLocked && (
        <div className="space-y-2">
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
              Lock In
            </button>
          </div>
          
          {/* Acting-As Debug Panel */}
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] font-display tracking-widest uppercase text-muted-foreground mb-2">
              Acting-As Debug
            </p>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Authenticated:</span>
                <span className="text-foreground">{myPlayer?.display_name ?? 'None'}</span>
              </div>
              <div className="flex items-center gap-2">
                <TestTube className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Acting-As:</span>
                <span className="text-foreground">{actingAsPlayer ? `${actingAsPlayer.display_name}${actingAsPlayer.is_test_player ? ' (Test)' : ''}` : '(self)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Viewing-As:</span>
                <span className="text-foreground">{viewingAsPlayer ? `${viewingAsPlayer.display_name}${viewingAsPlayer.is_test_player ? ' (Test)' : ''}` : 'Admin / My View'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Submit For:</span>
                <span className="text-foreground font-medium">{actionPlayer?.display_name ?? 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Delegation Allowed:</span>
                <span className={canDelegateActions ? 'text-status-locked font-semibold' : 'text-muted-foreground'}>
                  {canDelegateActions ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {troopsRemaining !== 0 && !isLocked && (
        <p className="text-xs text-muted-foreground">
          {troopsRemaining > 0
            ? `Place ${troopsRemaining} more troop${troopsRemaining !== 1 ? 's' : ''} before locking.`
            : `You've placed ${Math.abs(troopsRemaining)} too many. Reduce placements.`
          }
        </p>
      )}

      {/* Player lock status — is_locked ONLY, no placement data */}
      <div className="space-y-1 pt-2 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">
          Player Status — {lockedCount}/{totalCount} Locked
        </p>
        {activePlayers.map(p => {
          const status = lockStatus.find(s => s.player_id === p.id);
          const locked = status?.is_locked ?? false;
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full shrink-0 ${locked ? 'bg-status-locked' : 'bg-muted-foreground/30'}`} />
              <span className={locked ? 'text-foreground' : 'text-muted-foreground'}>
                {p.display_name}
                {p.id === myPlayer?.id && ' (you)'}
              </span>
              {locked
                ? <span className="ml-auto text-status-locked text-xs flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</span>
                : <span className="ml-auto text-muted-foreground/50 text-xs">Staging…</span>
              }
            </div>
          );
        })}
      </div>

      {/* Admin: process phase end */}
      {isAdmin && (
        <div className="pt-2 border-t border-border">
          {allLocked ? (
            <button
              onClick={handleProcessEnd}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary transition-all"
            >
              <Check className="w-4 h-4" />
              Reveal &amp; Begin Round 1
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Waiting for all players to lock…</p>
              <button
                onClick={handleProcessEnd}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors"
              >
                Force Advance (auto-fill missing)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit button text update */}
      {!isLocked && (
        <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
          Lock In will submit for: <span className="text-status-pending font-semibold">{actionPlayer?.display_name ?? 'Unknown'}</span>
        </p>
      )}
    </div>
  );
}