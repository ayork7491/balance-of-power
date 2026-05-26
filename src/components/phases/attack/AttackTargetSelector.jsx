/**
 * AttackTargetSelector — appears in left dock when a player selects an owned territory.
 *
 * Shows:
 *   - Origin territory name + troop count
 *   - Adjacent territories (valid attack targets highlighted)
 *   - Troop commitment input
 *   - Confirm / Cancel buttons
 *
 * Client-side validation mirrors server-side rules for fast UX feedback.
 * Server is always authoritative on submit.
 */
import { useState, useMemo } from 'react';
import { Loader2, Swords, X, TestTube } from 'lucide-react';

function getTerritoryName(territoryId, mapDef) {
  return mapDef?.territories.find(t => t.territory_id === territoryId)?.name ?? territoryId;
}

export default function AttackTargetSelector({
  originId,
  mapDef,
  stateById,
  players,
  myPlayer,
  adjacencyMap,
  currentAttacks,
  maxAttacks,
  onStage,
  onCancel,
  submitting,
  error,
}) {
  const [targetId, setTargetId]         = useState(null);
  const [committedTroops, setCommitted] = useState(1);

  const originState = stateById[originId];
  const originName  = getTerritoryName(originId, mapDef);
  
  // Check if origin is owned by acting player (not just myPlayer)
  const originOwner = originState?.owner_player_id ? players.find(p => p.id === originState.owner_player_id) : null;

  // Troops already committed from this origin in other staged attacks
  const alreadyCommittedFromOrigin = useMemo(
    () => currentAttacks
      .filter(a => a.origin_territory_id === originId)
      .reduce((s, a) => s + (a.committed_troops || 0), 0),
    [currentAttacks, originId],
  );
  const maxAvailable = (originState?.troop_count ?? 0) - alreadyCommittedFromOrigin;

  // Adjacent territories
  const adjacentIds = useMemo(
    () => Array.from(adjacencyMap[originId] ?? []),
    [adjacencyMap, originId],
  );

  const canAddMore = currentAttacks.length < maxAttacks;

  const handleConfirm = async () => {
    if (!targetId || committedTroops < 1) return;
    await onStage({
      origin_territory_id: originId,
      target_territory_id: targetId,
      committed_troops: committedTroops,
    });
    onCancel();
  };

  return (
    <div className="space-y-3 p-3 rounded border border-status-danger/40 bg-status-danger/5">
      {/* Origin */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-display tracking-wider uppercase text-status-danger">Staging Attack</p>
            <p className="text-xs text-foreground font-medium mt-0.5">
              From: <span className="text-status-pending">{originName}</span>
              <span className="text-muted-foreground ml-1">({maxAvailable} available)</span>
            </p>
            {originOwner && originOwner.id !== myPlayer?.id && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-accent">
                <TestTube className="w-2.5 h-2.5" />
                <span>Acting as {originOwner.display_name}</span>
              </div>
            )}
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!canAddMore && (
        <p className="text-xs text-destructive">Max {maxAttacks} attacks reached.</p>
      )}

      {/* Target selector */}
      {canAddMore && (
        <>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">Select Target</p>
            <div className="space-y-1 max-h-40 overflow-y-auto dock-scroll">
              {adjacentIds.map(tid => {
                const ts     = stateById[tid];
                const owner  = ts?.owner_player_id
                  ? players.find(p => p.id === ts.owner_player_id)
                  : null;
                const isOwn  = ts?.owner_player_id === myPlayer?.id;
                const isSelected = tid === targetId;

                if (isOwn) return null; // can't attack own territory

                return (
                  <button
                    key={tid}
                    onClick={() => setTargetId(tid)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                      isSelected
                        ? 'bg-status-danger/20 border border-status-danger/60 text-foreground'
                        : 'border border-border bg-muted/10 hover:border-status-danger/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{getTerritoryName(tid, mapDef)}</span>
                    <span className={`font-mono text-xs ${owner ? 'text-status-pending' : 'text-muted-foreground/50'}`}>
                      {owner ? `${owner.display_name} · ${ts?.troop_count ?? 0}` : 'Neutral'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Troops input */}
          {targetId && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-display uppercase tracking-wide">Troops to Commit</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={maxAvailable}
                  value={committedTroops}
                  onChange={e => setCommitted(Math.max(1, Math.min(maxAvailable, parseInt(e.target.value) || 1)))}
                  className="w-20 text-right bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-status-danger"
                />
                <button
                  onClick={() => setCommitted(maxAvailable)}
                  className="text-xs text-muted-foreground hover:text-status-danger transition-colors"
                >
                  All ({maxAvailable})
                </button>
              </div>
              {committedTroops >= maxAvailable && (
                <p className="text-xs text-status-danger/80">Abandoning territory — no troops will remain.</p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {targetId && (
            <button
              onClick={handleConfirm}
              disabled={submitting || committedTroops < 1 || committedTroops > maxAvailable}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-status-danger text-white text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40"
            >
              {submitting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Swords className="w-3.5 h-3.5" />
              }
              Stage as {myPlayer?.display_name || 'Player'}
            </button>
          )}
        </>
      )}
    </div>
  );
}