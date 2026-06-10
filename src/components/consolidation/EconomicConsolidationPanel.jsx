/**
 * EconomicConsolidationPanel — Sprint 5B.7
 *
 * Economic tab content during Consolidation Phase.
 * Shows ONLY caravan/logistics content:
 *   - Active supply routes (caravans) with destinations and resource contents
 *   - Caravan status per route
 *
 * No territory activation, no planning-phase resource generation.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Coins, Package, Truck } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'text-green-400',       border: 'border-green-500/30',  bg: 'bg-green-500/5' },
  disrupted: { label: 'Disrupted', color: 'text-amber-400',       border: 'border-amber-500/30',  bg: 'bg-amber-500/5' },
  inactive:  { label: 'Inactive',  color: 'text-muted-foreground', border: 'border-border',        bg: 'bg-muted/10' },
};

function RouteCard({ route, mapDef }) {
  const hubName    = mapDef?.territories?.find(t => t.territory_id === route.hub_territory_id)?.name    ?? route.hub_territory_id;
  const sourceName = mapDef?.territories?.find(t => t.territory_id === route.source_territory_id)?.name ?? route.source_territory_id;
  const cfg        = STATUS_CONFIG[route.route_status] ?? STATUS_CONFIG.active;

  return (
    <div className={`rounded border ${cfg.border} ${cfg.bg} px-3 py-2.5 space-y-1.5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">{sourceName}</span>
          <span className="text-[10px] text-muted-foreground">→</span>
          <span className="text-xs text-foreground truncate">{hubName}</span>
        </div>
        <span className={`text-[10px] font-display tracking-wide uppercase shrink-0 ml-2 ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
        <span>Resource: <span className="text-foreground">{RESOURCE_ICONS[route.resource_type] ?? ''} {route.resource_type ?? '—'}</span></span>
        <span>Range: <span className="font-mono text-foreground">{route.range_distance ?? 1}</span></span>
        {route.created_round && <span>Est. Round {route.created_round}</span>}
      </div>
    </div>
  );
}

export default function EconomicConsolidationPanel({ campaign, myPlayer, actingAsPlayerId, mapDef }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const [routes, setRoutes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await base44.entities.SupplyRoute.filter({
        campaign_id: campaign.id,
        owner_player_id: actingPlayerId,
      });
      setRoutes(data ?? []);
    } catch {
      setError('Failed to load caravan routes.');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { load(); }, [load]);

  const activeRoutes    = routes.filter(r => r.route_status === 'active');
  const disruptedRoutes = routes.filter(r => r.route_status === 'disrupted');
  const inactiveRoutes  = routes.filter(r => r.route_status === 'inactive');

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <p className="font-display text-xs tracking-widest uppercase text-amber-400">Caravans</p>
        </div>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading routes…
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Active',    count: activeRoutes.length,    color: 'text-green-400' },
              { label: 'Disrupted', count: disruptedRoutes.length, color: 'text-amber-400' },
              { label: 'Inactive',  count: inactiveRoutes.length,  color: 'text-muted-foreground' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex flex-col items-center py-2 rounded border border-border bg-muted/10">
                <span className={`text-lg font-mono font-bold ${color}`}>{count}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {routes.length === 0 ? (
            <div className="py-6 text-center">
              <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No caravan routes established.</p>
              <p className="text-[10px] text-muted-foreground mt-1">Create supply routes via the Logistics panel in other phases.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {routes.map(r => <RouteCard key={r.id} route={r} mapDef={mapDef} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}