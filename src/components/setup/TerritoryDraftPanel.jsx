/**
 * TerritoryDraftPanel — left dock panel for the territory_draft phase.
 *
 * Shows:
 * - Current picker (snake draft)
 * - Picks remaining
 * - Per-player territory counts
 * - "Pick" instruction when it's the current user's turn (territory selection via map click)
 *
 * Territory picking is triggered by clicking on the map (handled by ActiveCampaign
 * which passes the selectedId down here). When it's the player's turn and they
 * click an unclaimed territory, we submit the pick.
 */
import { useState, useEffect } from 'react';
import { Loader2, Map, ChevronRight, Check, Users } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';
import { base44 } from '@/api/base44Client';

function getPlayerHex(players, playerId) {
  const p = players.find(pl => pl.id === playerId);
  if (!p) return '#666';
  return PLAYER_COLORS.find(c => c.id === p.color)?.hex ?? '#666';
}

export default function TerritoryDraftPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  pendingPickId,   // territory_id the user clicked on the map (from ActiveCampaign)
  onClearPick,     // clear the map selection after pick
  onPhaseChanged,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [lastPick, setLastPick] = useState(null);

  const setupOrder = campaign?.setup_order ?? [];
  const currentIdx = campaign?.setup_current_index ?? 0;
  const currentPickerId = setupOrder[currentIdx];
  const isMyTurn = currentPickerId === myPlayer?.id;
  const picksRemaining = campaign?.draft_picks_remaining ?? 0;

  // Territory counts per player
  const countByPlayer = {};
  for (const s of Object.values(stateById)) {
    if (s.owner_player_id) {
      countByPlayer[s.owner_player_id] = (countByPlayer[s.owner_player_id] || 0) + 1;
    }
  }

  // Selected territory details
  const pendingTerritory = pendingPickId
    ? mapDef?.territories.find(t => t.territory_id === pendingPickId)
    : null;
  const pendingState = pendingPickId ? stateById[pendingPickId] : null;
  const pendingClaimed = !!pendingState;

  const handlePick = async () => {
    if (!pendingPickId || pendingClaimed || !isMyTurn) return;
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('setupPhase', {
        action: 'pickTerritory',
        campaign_id: campaign.id,
        territory_id: pendingPickId,
      });
      setLastPick(pendingTerritory?.name ?? pendingPickId);
      onClearPick?.();
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to pick territory.');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when user clicks map territory (if valid pick)
  useEffect(() => {
    if (isMyTurn && pendingPickId && !pendingClaimed && !submitting) {
      // Don't auto-pick — show confirmation in panel instead
    }
  }, [pendingPickId]);

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      {/* Phase header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1">
        <p className="font-display text-xs tracking-widest uppercase text-violet-300">
          Territory Draft
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Snake draft — {picksRemaining} pick{picksRemaining !== 1 ? 's' : ''} remaining
        </p>
      </div>

      {/* Current picker */}
      <div className={`px-3 py-2 rounded border text-xs ${
        isMyTurn
          ? 'border-primary/50 bg-primary/10 text-foreground'
          : 'border-border/50 bg-muted/30 text-muted-foreground'
      }`}>
        {isMyTurn
          ? <><span className="text-primary font-display tracking-wide font-semibold">Your turn!</span> Tap a territory on the map to claim it.</>
          : <>Waiting for <span className="text-foreground font-medium">{players.find(p => p.id === currentPickerId)?.display_name ?? '…'}</span> to pick…</>
        }
      </div>

      {/* Selected territory confirmation */}
      {isMyTurn && pendingPickId && (
        <div className={`p-3 rounded border space-y-2 ${
          pendingClaimed
            ? 'border-destructive/40 bg-destructive/5'
            : 'border-primary/50 bg-primary/5'
        }`}>
          <p className="text-xs font-display tracking-wide text-foreground">
            {pendingTerritory?.name ?? pendingPickId}
          </p>
          {pendingClaimed
            ? <p className="text-xs text-destructive">Already claimed — pick another.</p>
            : (
              <>
                <p className="text-xs text-muted-foreground capitalize">
                  {pendingTerritory?.terrain ?? ''} · {mapDef?.regions.find(r => r.id === pendingTerritory?.region_id)?.name ?? ''}
                </p>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  onClick={handlePick}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Claim Territory
                </button>
              </>
            )
          }
        </div>
      )}

      {lastPick && !pendingPickId && (
        <p className="text-xs text-status-locked">✓ Claimed {lastPick}</p>
      )}

      {/* Player territory counts */}
      <div className="space-y-1 pt-2 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">Territories Claimed</p>
        {setupOrder.map((pid, i) => {
          const p = players.find(pl => pl.id === pid);
          if (!p) return null;
          const count = countByPlayer[pid] || 0;
          const isCurrent = pid === currentPickerId;
          return (
            <div key={pid} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getPlayerHex(players, pid) }} />
              <span className={`flex-1 ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                {p.display_name}
              </span>
              <span className={`font-mono font-semibold ${count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{count}</span>
              {isCurrent && <ChevronRight className="w-3 h-3 text-primary" />}
            </div>
          );
        })}
      </div>

      {/* Direction indicator */}
      <div className="pt-1">
        <span className={`text-xs text-muted-foreground`}>
          Direction: <span className="text-foreground capitalize">{campaign?.draft_snake_direction ?? 'forward'}</span>
        </span>
      </div>
    </div>
  );
}