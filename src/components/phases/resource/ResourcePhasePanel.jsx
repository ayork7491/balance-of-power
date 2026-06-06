/**
 * ResourcePhasePanel — Sprint 3B resource generation UI.
 *
 * Shows during the deploy phase (alongside troop deployment).
 * Players can see their territory resource types, activate generation,
 * and view stored resources.
 *
 * Does NOT replace or overlap with troop deployment UI.
 * This is a separate sub-panel — show it in the right dock or as a tab.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Zap, Package, ZapOff } from 'lucide-react';

const RESOURCE_CONFIG = {
  gold:   { label: 'Gold',   icon: '🥇', color: 'text-yellow-400',  bg: 'bg-yellow-900/20',  border: 'border-yellow-600/30' },
  iron:   { label: 'Iron',   icon: '⚙️', color: 'text-slate-400',   bg: 'bg-slate-800/30',   border: 'border-slate-600/30'  },
  timber: { label: 'Timber', icon: '🪵', color: 'text-amber-600',   bg: 'bg-amber-900/20',   border: 'border-amber-700/30'  },
  stone:  { label: 'Stone',  icon: '🪨', color: 'text-stone-400',   bg: 'bg-stone-800/20',   border: 'border-stone-600/30'  },
  food:   { label: 'Food',   icon: '🌾', color: 'text-green-400',   bg: 'bg-green-900/20',   border: 'border-green-600/30'  },
};

function ResourceBadge({ type, amount }) {
  const cfg = RESOURCE_CONFIG[type] ?? { label: type, icon: '?', color: 'text-foreground', bg: 'bg-muted/20', border: 'border-border' };
  if (!amount) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      {cfg.icon} {amount}
    </span>
  );
}

function ResourceSummaryRow({ label, totals }) {
  const entries = Object.entries(totals).filter(([, v]) => v > 0);
  if (!entries.length) return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground/50 text-[10px]">none</span>
    </div>
  );
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-1">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1 justify-end">
        {entries.map(([type, amount]) => <ResourceBadge key={type} type={type} amount={amount} />)}
      </div>
    </div>
  );
}

function TerritoryResourceRow({ territory, mapDef, onActivate, activating }) {
  const name = mapDef?.territories?.find(t => t.territory_id === territory.territory_id)?.name ?? territory.territory_id;
  const cfg = RESOURCE_CONFIG[territory.resource_type] ?? { label: territory.resource_type, icon: '?', color: 'text-foreground', bg: 'bg-muted/20', border: 'border-border' };
  const storageEntries = Object.entries(territory.resource_storage ?? {}).filter(([, v]) => v > 0);
  const isActivating = activating === territory.territory_id;

  return (
    <div className={`rounded border ${cfg.border} ${cfg.bg} px-2.5 py-2 space-y-1.5`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground">{name}</p>
          <p className={`text-[10px] ${cfg.color}`}>{cfg.icon} {cfg.label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {storageEntries.length > 0 && (
            <div className="flex gap-1">
              {storageEntries.map(([type, amount]) => (
                <ResourceBadge key={type} type={type} amount={amount} />
              ))}
            </div>
          )}
          <button
            onClick={() => onActivate(territory.territory_id)}
            disabled={isActivating}
            title="Activate resource generation (+1 this round)"
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-display tracking-wider uppercase transition-all disabled:opacity-40 ${
              cfg.border + ' hover:brightness-110 ' + cfg.bg
            } ${cfg.color}`}
          >
            {isActivating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
            +1
          </button>
        </div>
      </div>
      {territory.has_resource_hub && (
        <p className="text-[10px] text-status-info">🏭 Resource Hub</p>
      )}
    </div>
  );
}

export default function ResourcePhasePanel({ campaign, myPlayer, mapDef, isAdmin }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(null);
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState(null);
  const [buildingHub, setBuildingHub] = useState(null);

  const load = useCallback(async () => {
    if (!campaign?.id) return;
    setLoading(true);
    const res = await base44.functions.invoke('resourcePhase', {
      action: 'getResourceState',
      campaign_id: campaign.id,
    });
    setState(res.data);
    setLoading(false);
  }, [campaign?.id]);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async (territoryId) => {
    setActivating(territoryId);
    await base44.functions.invoke('resourcePhase', {
      action: 'activateTerritory',
      campaign_id: campaign.id,
      territory_id: territoryId,
    });
    setActivating(null);
    await load();
  };

  const handleCollect = async () => {
    setCollecting(true);
    setCollectResult(null);
    const res = await base44.functions.invoke('resourcePhase', {
      action: 'collectResources',
      campaign_id: campaign.id,
    });
    setCollectResult(res.data);
    setCollecting(false);
    await load();
  };

  const handleBuildHub = async (territoryId) => {
    setBuildingHub(territoryId);
    await base44.functions.invoke('resourcePhase', {
      action: 'buildResourceHub',
      campaign_id: campaign.id,
      territory_id: territoryId,
    });
    setBuildingHub(null);
    await load();
  };

  const RESOURCES = ['gold', 'iron', 'timber', 'stone', 'food'];

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      {/* Header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-status-info flex items-center gap-2">
          <Package className="w-3.5 h-3.5" />
          Resources
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !state && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading resources…
        </div>
      )}

      {state && (
        <>
          {/* Ledger summary */}
          <div className="panel p-3 space-y-1">
            <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">Your Ledger</p>
            <div className="grid grid-cols-5 gap-1">
              {RESOURCES.map(r => {
                const cfg = RESOURCE_CONFIG[r];
                const amount = state.ledger?.[r] ?? 0;
                return (
                  <div key={r} className={`flex flex-col items-center p-1.5 rounded border ${cfg.border} ${cfg.bg}`}>
                    <span className="text-base leading-none">{cfg.icon}</span>
                    <span className={`text-xs font-mono font-bold mt-0.5 ${cfg.color}`}>{amount}</span>
                    <span className="text-[9px] text-muted-foreground">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Territory storage totals */}
          {state.territory_storage_totals && (
            <div className="panel p-3">
              <ResourceSummaryRow label="In territories" totals={state.territory_storage_totals} />
            </div>
          )}

          {/* Collect button */}
          {state.territories?.length > 0 && (
            <button
              onClick={handleCollect}
              disabled={collecting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-status-info/40 bg-status-info/10 text-status-info text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
            >
              {collecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
              Collect All Resources
            </button>
          )}
          {collectResult && collectResult.total_collected > 0 && (
            <p className="text-[10px] text-status-locked text-center">
              ✓ Collected {collectResult.total_collected} resource{collectResult.total_collected !== 1 ? 's' : ''} into your ledger.
            </p>
          )}
          {collectResult && collectResult.total_collected === 0 && (
            <p className="text-[10px] text-muted-foreground text-center">Nothing to collect yet.</p>
          )}

          {/* Territory list */}
          {state.territories?.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                Your Territories ({state.territories.length})
              </p>
              {state.territories.map(t => (
                <div key={t.territory_id} className="space-y-1">
                  <TerritoryResourceRow
                    territory={t}
                    mapDef={mapDef}
                    onActivate={handleActivate}
                    activating={activating}
                  />
                  {/* Resource Hub build button (if not already built) */}
                  {!t.has_resource_hub && (
                    <button
                      onClick={() => handleBuildHub(t.territory_id)}
                      disabled={buildingHub === t.territory_id}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-status-pending/40 transition-colors disabled:opacity-40"
                    >
                      {buildingHub === t.territory_id
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        : <ZapOff className="w-2.5 h-2.5" />}
                      Build Resource Hub
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">You own no territories.</p>
          )}
        </>
      )}
    </div>
  );
}