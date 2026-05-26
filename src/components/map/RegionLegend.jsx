/**
 * RegionLegend — compact region/continent legend overlay.
 * Top-left corner of the map viewport.
 */
export default function RegionLegend({ regions }) {
  if (!regions?.length) return null;

  return (
    <div className="absolute top-3 left-3 z-10 space-y-1 pointer-events-none">
      {regions.map(r => (
        <div key={r.id} className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded px-2 py-1">
          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
          <span className="font-display text-xs tracking-wider text-foreground/80">{r.name}</span>
          {r.control_bonus > 0 && (
            <span className="text-xs text-primary font-mono">+{r.control_bonus}</span>
          )}
        </div>
      ))}
    </div>
  );
}