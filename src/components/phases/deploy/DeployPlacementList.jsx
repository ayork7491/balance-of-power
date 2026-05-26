/**
 * DeployPlacementList — renders troop input fields for the current player's owned territories.
 * Only rendered when player has not yet locked.
 * Props:
 *   territories — TerritoryState[] owned by this player
 *   mapDef      — MapDefinition (for names/terrain)
 *   placements  — { [territory_id]: number }
 *   onChange    — (territory_id, value) => void
 *   troopsRemaining — number
 *   maxTroops   — total income for this round
 */
export default function DeployPlacementList({
  territories,
  mapDef,
  placements,
  onChange,
  troopsRemaining,
  maxTroops,
}) {
  if (!territories.length) {
    return <p className="text-xs text-muted-foreground">You own no territories.</p>;
  }

  return (
    <div className="space-y-2">
      {territories.map(ts => {
        const def     = mapDef?.territories.find(t => t.territory_id === ts.territory_id);
        const current = placements[ts.territory_id] ?? 0;
        return (
          <div key={ts.territory_id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">{def?.name ?? ts.territory_id}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {def?.terrain ?? ''} · {ts.troop_count ?? 0} troops
              </p>
            </div>
            <input
              type="number"
              min="0"
              max={maxTroops}
              value={current}
              onChange={e => onChange(ts.territory_id, e.target.value)}
              className="w-16 text-right bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        );
      })}
    </div>
  );
}