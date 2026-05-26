/**
 * InitialDeployPanel — left dock panel for initial_deploy phase.
 *
 * Each player privately stages troop placements on their owned territories.
 * Shows:
 * - Troops remaining to place
 * - Per-territory troop input (owned territories only)
 * - Lock button
 * - Other players' lock status (without revealing their placements)
 * - Admin "Process Phase End" button when all players locked
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2, Lock, Check, Shield, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function InitialDeployPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  onPhaseChanged,
}) {
  const [placements, setPlacements] = useState({});
  const [decision, setDecision] = useState(null);
  const [allDecisions, setAllDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const startingTroops = campaign?.settings?.starting_troops ?? 30;
  const isAdmin = myPlayer?.is_admin;

  // My owned territories
  const myTerritories = useMemo(() =>
    Object.values(stateById).filter(s => s.owner_player_id === myPlayer?.id),
    [stateById, myPlayer]
  );

  const totalPlaced = Object.values(placements).reduce((s, n) => s + (parseInt(n) || 0), 0);
  const troopsRemaining = startingTroops - totalPlaced;

  // Load my PhaseDecision
  const load = async () => {
    if (!campaign?.id || !myPlayer?.id) return;
    setLoading(true);
    try {
      const [myDec, allDec] = await Promise.all([
        base44.entities.PhaseDecision.filter({
          campaign_id: campaign.id,
          player_id: myPlayer.id,
          phase: 'initial_deploy',
        }),
        base44.entities.PhaseDecision.filter({
          campaign_id: campaign.id,
          phase: 'initial_deploy',
        }),
      ]);
      const d = myDec[0] ?? null;
      setDecision(d);
      setAllDecisions(allDec);
      if (d?.data?.placements) {
        setPlacements({ ...d.data.placements });
      } else {
        // Initialize with 0 for each owned territory
        const init = {};
        for (const t of myTerritories) init[t.territory_id] = 0;
        setPlacements(init);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [campaign?.id, myPlayer?.id, myTerritories.length]);

  const handleChange = (tid, value) => {
    const n = Math.max(0, parseInt(value) || 0);
    setPlacements(prev => ({ ...prev, [tid]: n }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (decision?.is_locked) return;
    setSubmitting(true);
    setError(null);
    try {
      const cleanPlacements = {};
      for (const [tid, v] of Object.entries(placements)) {
        cleanPlacements[tid] = parseInt(v) || 0;
      }
      await base44.functions.invoke('initialDeploy', {
        action: 'stageTroops',
        campaign_id: campaign.id,
        placements: cleanPlacements,
      });
      setSaved(true);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save placements.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLock = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('initialDeploy', {
        action: 'lockDeploy',
        campaign_id: campaign.id,
      });
      await load();
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to lock.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessEnd = async () => {
    setProcessing(true);
    setError(null);
    try {
      await base44.functions.invoke('initialDeploy', {
        action: 'processPhaseEnd',
        campaign_id: campaign.id,
      });
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to process phase end.');
    } finally {
      setProcessing(false);
    }
  };

  const isLocked = decision?.is_locked ?? false;
  const lockedCount = allDecisions.filter(d => d.is_locked).length;
  const totalCount = players.filter(p => !p.is_eliminated).length;
  const allLocked = lockedCount >= totalCount && totalCount > 0;

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

      {/* Placement inputs */}
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
                  className="w-16 text-right bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
            onClick={handleLock}
            disabled={submitting || troopsRemaining !== 0}
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

      {/* Player lock status */}
      <div className="space-y-1 pt-2 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">
          Player Status — {lockedCount}/{totalCount} Locked
        </p>
        {players.filter(p => !p.is_eliminated).map(p => {
          const dec = allDecisions.find(d => d.player_id === p.id);
          const locked = dec?.is_locked ?? false;
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full shrink-0 ${locked ? 'bg-status-locked' : 'bg-muted-foreground/30'}`} />
              <span className={locked ? 'text-foreground' : 'text-muted-foreground'}>
                {p.display_name}
                {p.id === myPlayer?.id && ' (you)'}
              </span>
              {locked
                ? <span className="ml-auto text-status-locked text-xs flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</span>
                : <span className="ml-auto text-muted-foreground/50 text-xs">Hidden</span>
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
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary transition-all disabled:opacity-40"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {processing ? 'Processing…' : 'Reveal & Begin Round 1'}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Waiting for all players to lock…</p>
              <button
                onClick={handleProcessEnd}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Force Advance (auto-fill missing)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}