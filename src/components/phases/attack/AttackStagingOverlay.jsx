/**
 * AttackStagingOverlay — map-level floating panel for staging an attack.
 *
 * Appears as an overlay anchored to the bottom of the map when:
 *   - attack phase is active
 *   - an attack origin has been selected
 *   - a preselected target exists (user clicked an enemy territory)
 *
 * This allows completing the full attack declaration from the map without
 * switching to the Phase tab in the dock.
 */
import { useState, useMemo } from 'react';
import { Loader2, Swords, X, ChevronDown } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

function getTerritoryName(territoryId, mapDef) {
  return mapDef?.territories.find(t => t.territory_id === territoryId)?.name ?? territoryId;
}

function getPlayerHex(players, playerId) {
  const p = players.find(pl => pl.id === playerId);
  if (!p) return null;
  return PLAYER_COLORS.find(c => c.id === p.color)?.hex ?? null;
}

export default function AttackStagingOverlay({
  originId,
  targetId,
  mapDef,
  stateById,
  players,
  actingPlayer,
  adjacencyMap,
  currentAttacks = [],
  maxAttacks = 3,
  onStage,
  onCancel,
  submitting = false,
  error = null,
}) {
  const [committedTroops, setCommitted] = useState(1);

  const originState  = stateById[originId];
  const targetState  = stateById[targetId];
  const targetOwner  = targetState?.owner_player_id
    ? players.find(p => p.id === targetState.owner_player_id) : null;
  const targetHex    = getPlayerHex(players, targetState?.owner_player_id);

  // Troops already committed from this origin in other staged attacks
  const alreadyCommitted = useMemo(
    () => currentAttacks
      .filter(a => a.origin_territory_id === originId)
      .reduce((s, a) => s + (a.committed_troops || 0), 0),
    [currentAttacks, originId],
  );
  const maxAvailable = Math.max(0, (originState?.troop_count ?? 0) - alreadyCommitted);

  // Clamp slider value to valid range
  const safeCommitted = Math.min(committedTroops, maxAvailable);

  const canAddMore   = currentAttacks.length < maxAttacks;
  const canStage     = canAddMore && safeCommitted >= 1 && safeCommitted <= maxAvailable;

  const handleConfirm = async () => {
    if (!canStage) return;
    await onStage({
      origin_territory_id: originId,
      target_territory_id: targetId,
      committed_troops: safeCommitted,
    });
    onCancel();
  };

  if (!originId || !targetId) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-2 pointer-events-none">
      <div className="panel pointer-events-auto shadow-2xl animate-fade-in border-status-danger/50">
        {/* Header */}
        <div className="panel-header flex items-center justify-between gap-2 border-b border-status-danger/30 bg-status-danger/10">
          <div className="flex items-center gap-2">
            <Swords className="w-3.5 h-3.5 text-status-danger shrink-0" />
            <span className="font-display text-xs tracking-widest uppercase text-status-danger font-semibold">
              Stage Attack
            </span>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Territory matchup */}
          <div className="flex items-center gap-2 text-xs">
            {/* Attacker */}
            <div className="flex-1 rounded border border-border bg-muted/20 px-2 py-1.5">
              <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-display">From</p>
              <p className="font-medium text-foreground truncate">{getTerritoryName(originId, mapDef)}</p>
              <p className="text-muted-foreground font-mono">{maxAvailable} avail.</p>
            </div>

            <ChevronDown className="w-4 h-4 text-status-danger shrink-0 rotate-[-90deg]" />

            {/* Defender */}
            <div className="flex-1 rounded border border-status-danger/40 bg-status-danger/5 px-2 py-1.5">
              <p className="text-muted-foreground uppercase tracking-wide text-[10px] font-display">Target</p>
              <p className="font-medium text-foreground truncate">{getTerritoryName(targetId, mapDef)}</p>
              <p className="font-mono" style={{ color: targetHex ?? undefined }}>
                {targetOwner ? `${targetOwner.display_name} · ${targetState?.troop_count ?? 0}` : 'Neutral'}
              </p>
            </div>
          </div>

          {!canAddMore && (
            <p className="text-xs text-destructive text-center">Max {maxAttacks} attacks reached.</p>
          )}

          {canAddMore && (
            <>
              {/* Troop slider + input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-muted-foreground font-display uppercase tracking-wide">Troops to Commit</label>
                  <button
                    onClick={() => setCommitted(maxAvailable)}
                    className="text-muted-foreground hover:text-status-danger transition-colors"
                  >
                    All ({maxAvailable})
                  </button>
                </div>
                <input
                  type="range"
                  min={1}
                  max={maxAvailable || 1}
                  value={safeCommitted}
                  onChange={e => setCommitted(Number(e.target.value))}
                  className="w-full accent-status-danger"
                  disabled={maxAvailable < 1}
                />
                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    min="1"
                    max={maxAvailable}
                    value={safeCommitted}
                    onChange={e => setCommitted(Math.max(1, Math.min(maxAvailable, parseInt(e.target.value) || 1)))}
                    className="w-20 text-right bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-status-danger"
                  />
                  {safeCommitted >= maxAvailable && maxAvailable > 0 && (
                    <p className="text-xs text-status-danger/80">Territory will be abandoned.</p>
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <button
                onClick={handleConfirm}
                disabled={submitting || !canStage}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-status-danger text-white text-xs font-display tracking-widest uppercase hover:brightness-110 disabled:opacity-40 transition-all"
              >
                {submitting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Swords className="w-3.5 h-3.5" />
                }
                Stage Attack as {actingPlayer?.display_name || 'Player'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}