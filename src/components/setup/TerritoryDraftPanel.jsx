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
import { Loader2, Map, ChevronRight, Check, Users, Shield } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';
import { base44 } from '@/api/base44Client';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

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
  selectedTerritoryId, // Use centralized selectedTerritoryId from context
  onClearSelection,
  onPhaseChanged,
  currentPerspective, // simulated perspective from admin mode
}) {
  // Use centralized test context
  const { 
    actingAsPlayer,
    actingAsCampaignPlayerId,
    viewingAsCampaignPlayerId,
    selectedTerritoryId: contextSelectedId, // Alias for clarity
  } = useCampaignTestContext();
  
  // Use prop (from context) or fallback to context directly
  const pendingPickId = selectedTerritoryId ?? contextSelectedId;
  const onClearPick = onClearSelection;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [lastPick, setLastPick] = useState(null);

  const setupOrder = campaign?.setup_order ?? [];
  const currentIdx = campaign?.setup_current_index ?? 0;
  const currentPickerId = setupOrder[currentIdx];
  const activePlayer = currentPerspective || myPlayer; // Use simulated perspective if set
  const isMyTurn = currentPickerId === actingAsPlayer?.id; // Check if it's acting-as player's turn
  const picksRemaining = campaign?.draft_picks_remaining ?? 0;

  // Territory counts per player
  const countByPlayer = {};
  for (const s of Object.values(stateById)) {
    if (s.owner_player_id) {
      countByPlayer[s.owner_player_id] = (countByPlayer[s.owner_player_id] || 0) + 1;
    }
  }

  // Selected territory details (using centralized state)
  const pendingTerritory = pendingPickId
    ? mapDef?.territories.find(t => t.territory_id === pendingPickId)
    : null;
  const pendingState = pendingPickId ? stateById[pendingPickId] : null;
  const pendingClaimed = !!pendingState;
  
  // Debug: Check if map highlight and selectedTerritoryId are synchronized
  const selectionMismatch = pendingPickId && (!mapDef?.territories.some(t => t.territory_id === pendingPickId));
  
  // Debug info for draft state
  const isInDraftPhase = campaign?.current_phase === 'territory_draft';
  const canClaim = isMyTurn && pendingPickId && !pendingClaimed && actingAsPlayer && isInDraftPhase;
  const claimBlockedReason = !actingAsPlayer
    ? 'No acting-as player selected'
    : !isMyTurn
      ? `Not ${actingAsPlayer?.display_name ?? 'player'}'s turn`
      : !pendingPickId
        ? 'No territory selected'
        : pendingClaimed
          ? 'Territory already claimed'
          : !isInDraftPhase
            ? 'Campaign is not in draft phase'
            : null;

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

      {/* Selected territory + Claim Action Panel */}
      <div className="panel border-border bg-muted/10">
        <div className="p-3 space-y-3">
          {/* Territory name - synchronized with map highlight */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-display font-semibold text-foreground">
              {pendingTerritory?.name ?? pendingPickId ?? 'No territory selected'}
            </p>
            {pendingPickId && (
              <span className="text-[10px] text-muted-foreground capitalize">
                {pendingTerritory?.terrain ?? ''}
              </span>
            )}
          </div>
          
          {/* Territory details */}
          {pendingPickId && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Region: {mapDef?.regions.find(r => r.id === pendingTerritory?.region_id)?.name ?? 'Unknown'}</p>
              <p>Status: {pendingClaimed ? (
                <span className="text-status-danger flex items-center gap-1 mt-1">
                  <Shield className="w-3 h-3" />
                  Claimed by {players.find(p => p.id === pendingState?.owner_player_id)?.display_name ?? 'Unknown'}
                </span>
              ) : (
                <span className="text-status-locked">Unclaimed</span>
              )}</p>
              {selectionMismatch && (
                <p className="text-status-danger text-[10px] mt-1">
                  ⚠ Warning: Territory ID not found in map
                </p>
              )}
            </div>
          )}
          
          {/* Claim button or status message */}
          {!pendingPickId ? (
            <p className="text-xs text-muted-foreground italic">Click a territory on the map to select it</p>
          ) : pendingClaimed ? (
            <p className="text-xs text-status-danger">This territory has already been claimed. Select another.</p>
          ) : !isMyTurn ? (
            <p className="text-xs text-muted-foreground">
              Waiting for <span className="text-foreground font-medium">{players.find(p => p.id === currentPickerId)?.display_name ?? 'current player'}</span>...
            </p>
          ) : !isInDraftPhase ? (
            <p className="text-xs text-status-danger">Campaign is not in draft phase</p>
          ) : !activePlayer ? (
            <p className="text-xs text-status-pending">Select a player perspective from the dropdown above</p>
          ) : (
            <>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                onClick={handlePick}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-primary text-primary-foreground text-sm font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Claim Territory
              </button>
            </>
          )}
        </div>
      </div>

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
      
      {/* Draft Debug Panel - Always show in test/admin mode */}
      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-[10px] font-display tracking-widest uppercase text-muted-foreground mb-2">
          Draft Debug {currentPerspective && '(Simulated)'}
        </p>
        <div className="space-y-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Campaign Status:</span>
            <span className="text-foreground">{campaign?.status ?? 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Setup Phase:</span>
            <span className="text-foreground">{campaign?.current_phase ?? 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Current Picker:</span>
            <span className="text-foreground">{players.find(p => p.id === currentPickerId)?.display_name ?? 'Unknown'}</span>
            {isMyTurn && <span className="text-status-locked">✓ Active</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Authenticated User:</span>
            <span className="text-foreground">{myPlayer?.display_name ?? 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Viewing As:</span>
            <span className="text-foreground">
              {currentPerspective ? `${currentPerspective.display_name}${currentPerspective.is_test_player ? ' (Test)' : ''}` : 'Admin / My View'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Acting As:</span>
            <span className="text-foreground">
              {actingAsPlayer ? `${actingAsPlayer.display_name}${actingAsPlayer.is_test_player ? ' (Test)' : ''}` : `My Player (fallback)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Is Acting-As Active:</span>
            <span className={isMyTurn ? 'text-status-locked font-semibold' : 'text-muted-foreground'}>
              {isMyTurn ? '✓ Yes' : '✗ No'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Selected Territory ID:</span>
            <span className="text-foreground font-mono">{pendingPickId ?? 'None'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Territory Name:</span>
            <span className="text-foreground">{pendingTerritory?.name ?? 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Territory Status:</span>
            <span className={pendingClaimed ? 'text-status-danger' : 'text-status-locked'}>
              {pendingClaimed ? 'Claimed' : 'Unclaimed'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Selection Sync:</span>
            {selectionMismatch ? (
              <span className="text-status-danger font-semibold">⚠ Mismatch</span>
            ) : (
              <span className="text-status-locked font-semibold">✓ Synchronized</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Claimable:</span>
            {canClaim ? (
              <span className="text-status-locked font-semibold">Yes</span>
            ) : (
              <span className="text-status-danger font-semibold">{claimBlockedReason || 'No'}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}