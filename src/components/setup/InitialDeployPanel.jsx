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
import { useMemo, useState, useEffect } from 'react';
import { Loader2, Lock, Check, Wrench, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInitialDeploy, useDeployLockStatus } from '@/features/campaigns/setup';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';
import CapitalSelector from '@/components/setup/CapitalSelector';

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
  const { actingAsPlayer, actingAsCampaignPlayerId } = useCampaignTestContext();
  
  // Determine action player (acting-as or self)
  const actionPlayer = actingAsPlayer || myPlayer;

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
  
  // Calculate total placed troops — same parsing as hook and backend (floor, no NaN)
  const totalPlaced = useMemo(
    () => Object.values(placements).reduce((s, n) => s + Math.max(0, Math.floor(Number(n) || 0)), 0),
    [placements],
  );

  // Zero-troop territories: any owned territory with 0 allocation (invalid for lock)
  const zeroTroopTerritories = useMemo(
    () => myTerritories.filter(ts => (placements[ts.territory_id] ?? 0) < 1),
    [myTerritories, placements],
  );

  // Capital state — loaded during staging so player can set before locking
  const [capitalData, setCapitalData] = useState(null);
  const [capitalLoading, setCapitalLoading] = useState(false);
  useEffect(() => {
    if (!campaign?.id || !myPlayer?.id) return;
    setCapitalLoading(true);
    base44.functions.invoke('territoryDevelopment', {
      action: 'getPlayerDevelopment',
      campaign_id: campaign.id,
    }).then(res => setCapitalData(res.data)).catch(() => {}).finally(() => setCapitalLoading(false));
  }, [campaign?.id, myPlayer?.id]);

  const capitalTerritories = useMemo(() =>
    myTerritories.map(ts => ({
      territory_id: ts.territory_id,
      name: mapDef?.territories?.find(t => t.territory_id === ts.territory_id)?.name ?? ts.territory_id,
    })), [myTerritories, mapDef]);

  // Repair state
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState(null);
  const [repairError, setRepairError] = useState(null);
  const [processError, setProcessError] = useState(null);
  const [processErrorDetail, setProcessErrorDetail] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [revealDiagnostics, setRevealDiagnostics] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  const handleLockAndRefresh = async () => {
    await handleLock(onPhaseChanged, actingAsCampaignPlayerId || null);
    reloadLockStatus();
  };

  const handleRepair = async () => {
    setRepairing(true);
    setRepairResult(null);
    setRepairError(null);
    try {
      const res = await base44.functions.invoke('repairInitialDeploy', {
        campaign_id: campaign.id,
      });
      setRepairResult(res.data);
      onPhaseChanged?.(); // reload territory state + campaign
    } catch (err) {
      setRepairError(err?.response?.data?.error || 'Repair failed.');
    } finally {
      setRepairing(false);
    }
  };

  const handleProcessEnd = async () => {
    setProcessError(null);
    setProcessErrorDetail(null);
    setProcessing(true);
    const timestamp = new Date().toISOString();
    console.log('[Reveal] handler called at', timestamp, 'campaign_id:', campaign.id);
    try {
      console.log('[Reveal] calling initialDeploy/processPhaseEnd');
      const res = await base44.functions.invoke('initialDeploy', {
        action:      'processPhaseEnd',
        campaign_id: campaign.id,
      });
      console.log('[Reveal] SUCCESS:', res.data);
      if (res.data?.diagnostics) {
        setRevealDiagnostics({ ...res.data.diagnostics, checks: res.data.checks, timestamp, success: true });
      }
      onPhaseChanged?.();
    } catch (err) {
      const responseData = err?.response?.data;
      const httpStatus   = err?.response?.status;
      const msg = responseData?.error || err?.message || 'Unknown error advancing phase.';
      const detail = {
        timestamp,
        httpStatus,
        errorMessage: msg,
        responsePayload: responseData ?? null,
        stackTrace: err?.stack ?? null,
        axiosMessage: err?.message ?? null,
      };
      console.error('[Reveal] FAILED', detail);
      setProcessError(msg);
      setProcessErrorDetail(detail);
      setShowDebug(true);
    } finally {
      setProcessing(false);
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

      {/* Capital selection — REQUIRED before locking */}
      {!isLocked && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-display tracking-wider uppercase text-amber-400">Designate Capital</p>
          <p className="text-[10px] text-muted-foreground">
            Choose your capital territory. Starting resources and food will be routed here. <span className="text-amber-400 font-semibold">Required before locking.</span>
          </p>
          {capitalLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
          ) : (
            <CapitalSelector
              campaign={campaign}
              myPlayer={myPlayer}
              territories={capitalTerritories}
              currentCapitalId={capitalData?.capital_territory_id ?? null}
              lastSetRound={null}
              onCapitalSet={(tid) => setCapitalData(prev => ({ ...prev, capital_territory_id: tid }))}
              allowChangeLabel="Set Capital"
            />
          )}
        </div>
      )}

      {/* Zero-troop warning — shown before lock attempt so player can fix it */}
      {!isLocked && zeroTroopTerritories.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded border border-status-pending/40 bg-status-pending/10 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-status-pending shrink-0 mt-0.5" />
          <span className="text-status-pending">
            {zeroTroopTerritories.length} territory{zeroTroopTerritories.length > 1 ? 'ies need' : 'y needs'} at least 1 troop before locking.
          </span>
        </div>
      )}

      {/* Capital not set warning */}
      {!isLocked && !capitalData?.capital_territory_id && !capitalLoading && (
        <div className="flex items-start gap-2 px-3 py-2 rounded border border-amber-400/40 bg-amber-400/10 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-400">
            You must designate a capital territory before locking.
          </span>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Actions */}
      {!isLocked && (
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
            disabled={submitting || troopsRemaining !== 0 || !capitalData?.capital_territory_id}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Lock In
          </button>
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

      {/* Capital display — shown after locking (read-only) */}
      {isLocked && capitalData?.capital_territory_id && (
        <div className="space-y-2 pt-2 border-t border-border">
          <CapitalSelector
            campaign={campaign}
            myPlayer={myPlayer}
            territories={capitalTerritories}
            currentCapitalId={capitalData.capital_territory_id}
            lastSetRound={null}
            readonly={true}
          />
        </div>
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

      {/* Admin: process phase end + repair tool */}
      {isAdmin && (
        <div className="pt-2 border-t border-border space-y-2">

          {/* Pre-reveal diagnostics summary */}
          <div className="px-3 py-2 rounded border border-border bg-muted/20 text-[10px] font-mono text-muted-foreground space-y-0.5">
            <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Reveal Prerequisites</p>
            <p>campaign_id: <span className="text-foreground">{campaign.id}</span></p>
            <p>map_id: <span className="text-foreground">{campaign.map_id ?? '(none)'}</span></p>
            <p>players: <span className="text-foreground">{totalCount}</span> active, <span className={allLocked ? 'text-status-locked' : 'text-status-pending'}>{lockedCount} locked</span></p>
            <p>territories in state: <span className="text-foreground">{Object.keys(stateById).length}</span></p>
            <p>mapDef territories: <span className="text-foreground">{mapDef?.territories?.length ?? '(not loaded)'}</span></p>
            <div className="mt-1 space-y-0.5">
              <p className={allLocked ? 'text-status-locked' : 'text-status-pending'}>
                {allLocked ? '✓' : '✗'} All players locked ({lockedCount}/{totalCount})
              </p>
              <p className={Object.keys(stateById).length > 0 ? 'text-status-locked' : 'text-destructive'}>
                {Object.keys(stateById).length > 0 ? '✓' : '✗'} Territory states exist ({Object.keys(stateById).length})
              </p>
              <p className={mapDef ? 'text-status-locked' : 'text-destructive'}>
                {mapDef ? '✓' : '✗'} Map definition loaded
              </p>
            </div>
          </div>

          {processError && (
            <div className="space-y-1">
              <div className="flex items-start gap-2 px-3 py-2 rounded border border-destructive/40 bg-destructive/10 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="flex-1 break-all">{processError}</span>
              </div>
              {processErrorDetail && (
                <div className="space-y-1">
                  <button
                    onClick={() => setShowDebug(v => !v)}
                    className="text-[10px] text-muted-foreground underline"
                  >
                    {showDebug ? 'Hide' : 'Show'} full debug info
                  </button>
                  {showDebug && (
                    <div className="px-3 py-2 rounded border border-destructive/20 bg-destructive/5 text-[10px] font-mono text-destructive/80 space-y-1 overflow-auto max-h-64">
                      <p className="font-semibold">HTTP {processErrorDetail.httpStatus} — {processErrorDetail.timestamp}</p>
                      <p className="font-semibold text-destructive">Error: {processErrorDetail.errorMessage}</p>
                      {processErrorDetail.responsePayload && (
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(processErrorDetail.responsePayload, null, 2)}</pre>
                      )}
                      {processErrorDetail.stackTrace && (
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">Stack trace</summary>
                          <pre className="whitespace-pre-wrap break-all mt-1">{processErrorDetail.stackTrace}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Last successful reveal diagnostics */}
          {revealDiagnostics && (
            <div className="px-3 py-2 rounded border border-status-locked/30 bg-status-locked/5 text-[10px] font-mono space-y-0.5">
              <p className="font-display text-[10px] tracking-widest uppercase text-status-locked mb-1">Last Reveal Report — {revealDiagnostics.timestamp?.split('T')[1]?.slice(0,8)}</p>
              {revealDiagnostics.checks && Object.entries(revealDiagnostics.checks).map(([k, v]) => (
                <p key={k} className={v.pass ? 'text-status-locked' : 'text-destructive'}>
                  {v.pass ? '✓' : '✗'} {k}: {v.detail}
                </p>
              ))}
            </div>
          )}
          {allLocked ? (
            <button
              onClick={handleProcessEnd}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary transition-all disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Reveal &amp; Begin Round 1
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Waiting for all players to lock…</p>
              <button
                onClick={handleProcessEnd}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Force Advance (auto-fill missing)
              </button>
            </div>
          )}

          {/* ── Repair tool — admin only, temporary ────────────────────────────
              Fixes campaigns stuck due to 0-troop territories.
              Sets every owned territory to minimum 1 troop, balances total
              to startingTroops, then allows re-advancing. */}
          <div className="pt-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground font-display tracking-widest uppercase mb-1.5">
              Recovery Tools
            </p>
            <button
              onClick={handleRepair}
              disabled={repairing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-destructive/40 text-destructive text-xs font-display tracking-wider uppercase hover:bg-destructive/10 transition-colors disabled:opacity-40"
            >
              {repairing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
              Repair Initial Deployment
            </button>
            {repairError && (
              <p className="text-xs text-destructive mt-1.5">{repairError}</p>
            )}
            {repairResult && (
              <div className="mt-1.5 text-[10px] text-status-locked space-y-0.5">
                <p>✓ Repaired {repairResult.players_repaired} player(s), {repairResult.total_territory_changes} territory change(s).</p>
                <p className="text-muted-foreground">{repairResult.next_step}</p>
              </div>
            )}
          </div>
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