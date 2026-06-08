/**
 * TerritoryHubInfo — Sprint 4E
 *
 * Shows Resource Hub capacity and connected supply routes for a specific territory.
 * Displayed within TerritoryDetailPanel when the territory has a Resource Hub.
 */
import { GitBranch, Package } from 'lucide-react';
import { getResourceConfig } from '@/config/resourceConfig';

export default function TerritoryHubInfo({ hubData, mapDef }) {
  if (!hubData) return null;

  const { routes_used, route_capacity, routes_remaining, connected_routes } = hubData;

  const getTerritoryName = (tid) =>
    mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  return (
    <div className="space-y-2">
      {/* Capacity bar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Package className="w-3 h-3 text-accent" />
          Hub Capacity
        </span>
        <span className={`font-mono text-[10px] ${routes_remaining > 0 ? 'text-status-locked' : 'text-destructive'}`}>
          {routes_used}/{route_capacity}
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: route_capacity }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < routes_used ? 'bg-accent' : 'bg-muted/40'}`}
          />
        ))}
      </div>

      {/* Connected routes */}
      {connected_routes && connected_routes.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Connected Routes</p>
          {connected_routes.map(r => {
            const resCfg = getResourceConfig(r.resource_type);
            return (
              <div key={r.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <GitBranch className="w-3 h-3 text-accent shrink-0" />
                <span className="truncate">{getTerritoryName(r.destination_territory_id)}</span>
                <span className={resCfg?.color}>{resCfg?.icon}</span>
                <span>{r.range_distance ?? '?'}★</span>
              </div>
            );
          })}
        </div>
      )}

      {routes_remaining > 0 && (
        <p className="text-[10px] text-accent/70">
          {routes_remaining} route slot{routes_remaining !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  );
}