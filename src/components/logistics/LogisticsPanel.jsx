/**
 * LogisticsPanel — Sprint 4E
 *
 * Player Logistics Summary panel.
 * Shows:
 *   - Supply Caravan capacity (from Trade Network buildings)
 *   - Hub summary (count, route slots)
 *   - Active routes list with delete
 *   - Route creation UI
 *   - Warehouse protection summary
 *   - Collect route resources button
 */
import { useState, useCallback } from 'react';
import { RefreshCw, Loader2, Package, GitBranch, Truck, Shield, Warehouse } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { usePlayerLogistics } from '@/features/campaigns/logistics/usePlayerLogistics';
import RouteCreator from './RouteCreator';
import RouteList from './RouteList';
import { getResourceConfig } from '@/config/resourceConfig';

const RESOURCE_KEYS = ['gold', 'iron', 'timber', 'stone', 'food'];

export default function LogisticsPanel({ campaign, myPlayer, mapDef }) {
  const {
    hubs, hub_count, caravan_capacity, active_routes,
    total_route_capacity, routes, warehouse_territories,
    loading, error, reload,
  } = usePlayerLogistics({ campaignId: campaign?.id, playerId: myPlayer?.id });

  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState(null);
  const [collectError, setCollectError] = useState(null);
  const [showCreator, setShowCreator] = useState(false);

  const handleCollect = async () => {
    setCollecting(true);
    setCollectResult(null);
    setCollectError(null);
    try {
      const res = await base44.functions.invoke('logisticsPhase', {
        action: 'collectRouteResources',
        campaign_id: campaign.id,
      });
      setCollectResult(res.data);
      await reload();
    } catch (e) {
      setCollectError(e?.response?.data?.error ?? 'Collection failed');
    } finally {
      setCollecting(false);
    }
  };

  const handleRouteCreated = useCallback(async () => {
    setShowCreator(false);
    await reload();
  }, [reload]);

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      {/* Header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-accent flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5" />
          Logistics
        </p>
        <button onClick={reload} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && hub_count === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading logistics…
        </div>
      )}

      {error && <p className="text-xs text-destructive py-2">{error}</p>}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="panel p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Hubs</p>
          <p className="text-lg font-display font-bold text-accent">{hub_count}</p>
        </div>
        <div className="panel p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Routes</p>
          <p className="text-lg font-display font-bold text-foreground">{active_routes}</p>
        </div>
        <div className="panel p-2 text-center">
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Truck className="w-3 h-3" /> Caravans</p>
          <p className="text-lg font-display font-bold text-foreground">{caravan_capacity}</p>
        </div>
      </div>

      {/* Hub Breakdown */}
      {hubs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Resource Hubs
          </p>
          {hubs.map(hub => (
            <div key={hub.territory_id} className="panel px-3 py-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Package className="w-3 h-3 text-accent" />
                  {mapDef?.territories?.find(t => t.territory_id === hub.territory_id)?.name ?? hub.territory_id}
                </span>
                <span className={`text-[10px] font-mono ${hub.routes_remaining > 0 ? 'text-status-locked' : 'text-muted-foreground'}`}>
                  {hub.routes_used}/{hub.route_capacity} slots
                </span>
              </div>
              {/* Slot bar */}
              <div className="flex gap-1">
                {Array.from({ length: hub.route_capacity }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < hub.routes_used ? 'bg-accent' : 'bg-muted/40'}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Routes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Supply Routes
          </p>
          {hubs.length > 0 && (
            <button
              onClick={() => setShowCreator(v => !v)}
              className="text-[10px] text-accent hover:text-accent/80 transition-colors"
            >
              {showCreator ? '↑ Cancel' : '+ New Route'}
            </button>
          )}
        </div>

        {showCreator && (
          <div className="panel p-3">
            <RouteCreator
              campaign={campaign}
              myPlayer={myPlayer}
              hubs={hubs}
              mapDef={mapDef}
              onCreated={handleRouteCreated}
            />
          </div>
        )}

        <RouteList
          campaign={campaign}
          routes={routes.filter(r => r.route_status === 'active')}
          mapDef={mapDef}
          onDeleted={reload}
        />
      </div>

      {/* Collect Resources via Routes */}
      {active_routes > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          {collectResult && (
            <div className="text-[10px] text-status-locked px-2 py-1.5 rounded border border-status-locked/20 bg-status-locked/10">
              ✓ Collected {collectResult.total_collected} resources via {collectResult.routes_processed} route{collectResult.routes_processed !== 1 ? 's' : ''}.
              {collectResult.total_collected > 0 && (
                <span className="ml-1">
                  ({RESOURCE_KEYS.filter(r => (collectResult.collected?.[r] ?? 0) > 0)
                    .map(r => {
                      const cfg = getResourceConfig(r);
                      return `${cfg.icon}${collectResult.collected[r]}`;
                    }).join(' ')})
                </span>
              )}
            </div>
          )}
          {collectError && (
            <p className="text-xs text-destructive">{collectError}</p>
          )}
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-accent/40 bg-accent/10 text-accent text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
          >
            {collecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
            Collect via Routes
          </button>
        </div>
      )}

      {/* Warehouse Protection */}
      {warehouse_territories.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-amber-400" />
            Protected Storage
          </p>
          {warehouse_territories.map(wt => (
            <div key={wt.territory_id} className="panel px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <Warehouse className="w-3 h-3" />
                  {mapDef?.territories?.find(t => t.territory_id === wt.territory_id)?.name ?? wt.territory_id}
                </span>
                <span className="text-[10px] text-amber-400/80">🔒 Protected</span>
              </div>
              {wt.storage_total > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {RESOURCE_KEYS.filter(r => (wt.storage?.[r] ?? 0) > 0).map(r => {
                    const cfg = getResourceConfig(r);
                    return (
                      <span key={r} className={`text-[10px] ${cfg.color}`}>
                        {cfg.icon}{wt.storage[r]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && hub_count === 0 && routes.length === 0 && (
        <div className="text-center py-6 space-y-1">
          <GitBranch className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground">No logistics network yet.</p>
          <p className="text-[10px] text-muted-foreground/60">
            Build a Resource Hub in a territory to establish supply routes.
          </p>
        </div>
      )}
    </div>
  );
}