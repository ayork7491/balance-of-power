/**
 * ResourceSummaryPanel — Sprint 5B.6
 *
 * Compact resource overview for the Economic Operations tab.
 * Shows global available resources + territory-level storage breakdown.
 */
import { Coins } from 'lucide-react';

const RESOURCE_CONFIG = {
  gold:   { label: 'Gold',   icon: '🟡', color: 'text-amber-400' },
  iron:   { label: 'Iron',   icon: '⚙️', color: 'text-slate-300' },
  timber: { label: 'Timber', icon: '🪵', color: 'text-green-400' },
  stone:  { label: 'Stone',  icon: '🪨', color: 'text-stone-400' },
  food:   { label: 'Food',   icon: '🌾', color: 'text-lime-400'  },
};

const RESOURCE_ORDER = ['gold', 'iron', 'timber', 'stone', 'food'];

function ResourceRow({ resource, amount }) {
  const cfg = RESOURCE_CONFIG[resource] ?? { label: resource, icon: '📦', color: 'text-foreground' };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </span>
      <span className={`text-[10px] font-mono font-bold ${amount > 0 ? cfg.color : 'text-muted-foreground'}`}>
        {amount}
      </span>
    </div>
  );
}

export default function ResourceSummaryPanel({ resources = {}, stateById = {}, actingPlayerId }) {
  // Build territory storage map: territories owned by acting player that have any stored resources
  const territoryStorage = [];
  if (actingPlayerId) {
    Object.values(stateById).forEach(ts => {
      if (ts.owner_player_id !== actingPlayerId) return;
      const storage = ts.resource_storage ?? {};
      const hasAny = RESOURCE_ORDER.some(r => (storage[r] ?? 0) > 0);
      if (hasAny) {
        territoryStorage.push({ territory_id: ts.territory_id, storage });
      }
    });
  }

  const hasResources = RESOURCE_ORDER.some(r => (resources[r] ?? 0) > 0);

  return (
    <div className="panel p-2 space-y-2">
      <p className="text-[10px] font-display tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
        <Coins className="w-3 h-3" /> Resources Available
      </p>

      {/* Global totals */}
      <div className="grid grid-cols-5 gap-x-2 gap-y-1">
        {RESOURCE_ORDER.map(r => {
          const cfg = RESOURCE_CONFIG[r];
          const amt = resources[r] ?? 0;
          return (
            <div key={r} className="flex flex-col items-center gap-0.5">
              <span className="text-xs">{cfg.icon}</span>
              <span className={`text-[10px] font-mono font-bold ${amt > 0 ? cfg.color : 'text-muted-foreground'}`}>
                {amt}
              </span>
              <span className="text-[9px] text-muted-foreground">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Territory storage breakdown */}
      {territoryStorage.length > 0 && (
        <div className="border-t border-border pt-1.5 space-y-1.5">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Stored by Territory</p>
          {territoryStorage.map(({ territory_id, storage }) => (
            <div key={territory_id} className="rounded border border-border bg-muted/5 px-2 py-1.5">
              <p className="text-[10px] font-medium text-foreground mb-1">{territory_id}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {RESOURCE_ORDER.filter(r => (storage[r] ?? 0) > 0).map(r => (
                  <ResourceRow key={r} resource={r} amount={storage[r]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasResources && territoryStorage.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic">No resources available.</p>
      )}
    </div>
  );
}