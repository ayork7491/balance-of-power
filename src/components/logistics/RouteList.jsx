/**
 * RouteList — Sprint 4E
 *
 * Displays all active supply routes for a player with delete capability.
 */
import { useState } from 'react';
import { Trash2, Loader2, GitBranch, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getResourceConfig } from '@/config/resourceConfig';

export default function RouteList({ campaign, routes, mapDef, onDeleted }) {
  const [deletingId, setDeletingId] = useState(null);

  if (!routes || routes.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No active supply routes.</p>;
  }

  const getTerritoryName = (tid) =>
    mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  const handleDelete = async (routeId) => {
    setDeletingId(routeId);
    try {
      await base44.functions.invoke('logisticsPhase', {
        action: 'deleteRoute',
        campaign_id: campaign.id,
        route_id: routeId,
      });
      onDeleted?.();
    } catch {
      // silently ignore; parent will reload
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-1.5">
      {routes.map(route => {
        const resCfg = getResourceConfig(route.resource_type);
        const isDeleting = deletingId === route.id;
        const path = route.path ?? [];

        return (
          <div
            key={route.id}
            className="flex items-start gap-2 px-2.5 py-2 rounded border border-accent/20 bg-accent/5 text-xs"
          >
            <GitBranch className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-foreground font-medium truncate">
                  {getTerritoryName(route.hub_territory_id)}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-foreground truncate">
                  {getTerritoryName(route.destination_territory_id)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] ${resCfg?.color ?? 'text-muted-foreground'}`}>
                  {resCfg?.icon} {resCfg?.label ?? route.resource_type}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {route.range_distance} step{route.range_distance !== 1 ? 's' : ''}
                </span>
                {path.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    via {path.length - 2 > 0 ? `${path.length - 2} intermediate` : 'direct'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDelete(route.id)}
              disabled={isDeleting}
              className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              title="Remove route"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}