/**
 * CapitalSelector — local-first capital staging widget.
 *
 * During the Planning Phase, capital selection is STAGED LOCALLY only.
 * No server write occurs here. The selected territory_id is committed
 * atomically via the lockPlanningPhase payload (_local_capital_territory_id).
 *
 * During initial_deploy, the component still uses the legacy immediate-write
 * path (onCapitalSet prop is called directly by parent with server write).
 *
 * Props:
 *   territories: [{ territory_id, name }]
 *   currentCapitalId: string | null   — currently active capital (from server)
 *   stagedCapitalId:  string | null   — locally staged value (overrides display if set)
 *   onCapitalSelected: (territoryId) => void  — called on every selection change (no server write)
 *   readonly: bool
 */
import { useState } from 'react';
import { Star } from 'lucide-react';

export default function CapitalSelector({
  territories = [],
  currentCapitalId = null,
  stagedCapitalId = null,
  onCapitalSelected,
  readonly = false,
}) {
  const displayCapitalId = stagedCapitalId ?? currentCapitalId;
  const displayCapitalName = territories.find(t => t.territory_id === displayCapitalId)?.name ?? displayCapitalId;

  const [selected, setSelected] = useState(stagedCapitalId ?? currentCapitalId ?? '');

  const handleChange = (e) => {
    const tid = e.target.value;
    setSelected(tid);
    if (tid) onCapitalSelected?.(tid);
  };

  if (readonly) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-amber-400/30 bg-amber-400/5 text-xs">
        <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div>
          <span className="text-amber-400 font-semibold">Capital: </span>
          <span className="text-foreground">{displayCapitalName ?? 'None'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {displayCapitalId && !stagedCapitalId && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <Star className="w-3 h-3" />
          Current: <span className="font-semibold">{displayCapitalName}</span>
        </div>
      )}
      {stagedCapitalId && (
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <Star className="w-3 h-3" />
          Staged: <span className="font-semibold">{displayCapitalName}</span>
          <span className="text-[10px] text-muted-foreground">(committed on lock)</span>
        </div>
      )}
      <select
        value={selected}
        onChange={handleChange}
        className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
      >
        <option value="">— choose capital territory —</option>
        {territories.map(t => (
          <option key={t.territory_id} value={t.territory_id}>{t.name}</option>
        ))}
      </select>
      {stagedCapitalId === undefined && (
        <p className="text-[10px] text-muted-foreground italic">Selection committed when you lock the Planning Phase.</p>
      )}
    </div>
  );
}