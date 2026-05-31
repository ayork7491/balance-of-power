/**
 * DeployPlacementList — renders troop input fields for the current player's owned territories.
 * Only rendered when player has not yet locked.
 * Props:
 *   territories  — TerritoryState[] owned by this player
 *   mapDef       — MapDefinition (for names/terrain)
 *   placements   — { [territory_id]: number }
 *   onChange     — (territory_id, value) => void
 *   troopsRemaining — number
 *   maxTroops    — total income for this round
 *   lockedIds    — Set<string> of territory_ids locked by delayed battles
 */
import { Lock } from 'lucide-react';

export default function DeployPlacementList({
  territories,
  mapDef,
  placements,
  onChange,
  troopsRemaining,
  maxTroops,
  lockedIds,
}) {
  if (!territories.length) {
    return <p className="text-xs text-muted-foreground">You own no territories.</p>;
  }

  return (
    <div className="space-y-2">
      {territories.map(ts => {
        const def       = mapDef?.territories.find(t => t.territory_id === ts.territory_id);
        const current   = placements[ts.territory_id] ?? 0;
        const isLocked  = lockedIds?.has(ts.territory_id);
        return (
          <div key={ts.territory_id} className={`flex items-center gap-2 ${isLocked ? 'opacity-60' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate flex items-center gap-1">
                {def?.name ?? ts.territory_id}
                {isLocked && <Lock className="w-3 h-3 text-orange-400 shrink-0" title="Locked by delayed battle" />}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {def?.terrain ?? ''} · {ts.troop_count ?? 0} troops
                {isLocked && <span className="text-orange-400 ml-1">· Locked</span>}
              </p>
            </div>
            <input
              type="number"
              min="0"
              max={maxTroops}
              value={current}
              disabled={isLocked}
              onChange={e => onChange(ts.territory_id, e.target.value)}
              title={isLocked ? 'This territory is locked by a delayed battle' : undefined}
              className={`w-16 text-right bg-input border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                isLocked ? 'border-orange-500/40 cursor-not-allowed' : 'border-border'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}