/**
 * ResourcePhasePanel — Sprint 3B resource generation UI.
 *
 * Correct model:
 *   - Player has a limited number of activations per round (based on territory count + hubs).
 *   - Player selects up to that limit via checkboxes.
 *   - Clicking "Lock Resource Activations" generates +1 of each territory's resource type
 *     INTO that territory's storage. Resources stay in territories.
 *   - The ledger summary is aggregate/reference only — it shows totals across territories.
 *   - NO "Collect All" behavior.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Lock, Package } from 'lucide-react';
import { RESOURCE_KEYS, RESOURCE_CONFIG, calcActivationLimit, sumStorage } from '@/config/resourceConfig';

function ResourceBadge({ type, amount }) {
  const cfg = RESOURCE_CONFIG[type] ?? { label: type, icon: '?', color: 'text-foreground', bg: 'bg-muted/20', border: 'border-border' };
  if (!amount) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      {cfg.icon} {amount}
    </span>
  );
}

function StorageBadges({ storage }) {
  const entries = RESOURCE_KEYS.filter(r => (storage?.[r] ?? 0) > 0);
  if (!entries.length) return <span className="text-[10px] text-muted-foreground/50">empty</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {entries.map(r => <ResourceBadge key={r} type={r} amount={storage[r]} />)}
    </div>
  );
}

export default function ResourcePhasePanel({ campaign, myPlayer, mapDef }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [locking, setLocking] = useState(false);
  const [lockResult, setLockResult] = useState(null);

  const load = useCallback(async () => {
    if (!campaign?.id || !myPlayer) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('resourcePhase', {
        action: 'getResourceState',
        campaign_id: campaign.id,
      });
      setState(res.data);
      // Reset selection on fresh load
      setSelected(new Set());
      setLockResult(null);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load resource state');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, myPlayer]);

  useEffect(() => { load(); }, [load]);

  const territories = state?.territories ?? [];
  const hubCount = state?.hub_count ?? territories.filter(t => t.has_resource_hub).length;
  // Prefer server-computed limit (avoids client/server drift); fall back to local calc
  const activationLimit = state?.activation_limit ?? calcActivationLimit(territories.length, hubCount);

  const toggleTerritory = (tid) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tid)) {
        next.delete(tid);
      } else {
        if (next.size >= activationLimit) return prev; // at limit
        next.add(tid);
      }
      return next;
    });
  };

  const handleLock = async () => {
    if (selected.size === 0) return;
    setLocking(true);
    setLockResult(null);
    try {
      const res = await base44.functions.invoke('resourcePhase', {
        action: 'lockActivations',
        campaign_id: campaign.id,
        territory_ids: [...selected],
      });
      setLockResult(res.data);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to lock activations');
    } finally {
      setLocking(false);
    }
  };

  // Aggregate storage totals across all owned territories (reference display)
  const aggregateTotals = territories.reduce((acc, t) => {
    for (const r of RESOURCE_KEYS) {
      acc[r] = (acc[r] ?? 0) + (t.resource_storage?.[r] ?? 0);
    }
    return acc;
  }, {});

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

      {error && <p className="text-xs text-destructive py-2">{error}</p>}

      {state && (
        <>
          {/* Aggregate ledger — reference only */}
          <div className="panel p-3 space-y-2">
            <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">
              Territory Storage (reference)
            </p>
            <div className="grid grid-cols-5 gap-1">
              {RESOURCE_KEYS.map(r => {
                const cfg = RESOURCE_CONFIG[r];
                const amount = aggregateTotals[r] ?? 0;
                return (
                  <div key={r} className={`flex flex-col items-center p-1.5 rounded border ${cfg.border} ${cfg.bg}`}>
                    <span className="text-base leading-none">{cfg.icon}</span>
                    <span className={`text-xs font-mono font-bold mt-0.5 ${cfg.color}`}>{amount}</span>
                    <span className="text-[9px] text-muted-foreground">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Resources are stored in territories. They stay there until spent.
            </p>
          </div>

          {/* Activation selection */}
          {territories.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                  Select Territories to Activate
                </p>
                <span className={`text-xs font-mono font-bold ${selected.size >= activationLimit ? 'text-primary' : 'text-muted-foreground'}`}>
                  {selected.size} / {activationLimit}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                You have <span className="text-foreground font-medium">{activationLimit}</span> activation{activationLimit !== 1 ? 's' : ''} this round.
                {hubCount > 0 && <span className="text-status-info"> (+{hubCount} from Resource Hub{hubCount !== 1 ? 's' : ''})</span>}
              </p>

              {lockResult && (
                <p className="text-[10px] text-status-locked">
                  ✓ Activated {lockResult.activated_count} territory{lockResult.activated_count !== 1 ? 'ies' : 'y'}. Resources generated into territory storage.
                </p>
              )}

              <div className="space-y-1.5">
                {territories.map(t => {
                  const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
                  const cfg = RESOURCE_CONFIG[t.resource_type] ?? { label: t.resource_type, icon: '?', color: 'text-foreground', bg: 'bg-muted/20', border: 'border-border' };
                  const isSelected = selected.has(t.territory_id);
                  const isDisabled = !isSelected && selected.size >= activationLimit;

                  return (
                    <label
                      key={t.territory_id}
                      className={`flex items-start gap-2.5 rounded border px-3 py-2 cursor-pointer transition-all ${
                        isSelected
                          ? `${cfg.border} ${cfg.bg}`
                          : isDisabled
                          ? 'border-border bg-muted/5 opacity-50 cursor-not-allowed'
                          : 'border-border bg-muted/10 hover:border-muted-foreground/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !isDisabled && toggleTerritory(t.territory_id)}
                        disabled={isDisabled && !isSelected}
                        className="mt-0.5 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground truncate">{name}</p>
                          <span className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                        </div>
                        {sumStorage(t.resource_storage) > 0 && (
                          <div className="mt-1">
                            <StorageBadges storage={t.resource_storage} />
                          </div>
                        )}
                        {t.has_resource_hub && (
                          <p className="text-[10px] text-status-info mt-0.5">🏭 Resource Hub — future supply routes will connect here</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Lock button */}
              <button
                onClick={handleLock}
                disabled={selected.size === 0 || locking}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-primary/40 bg-primary/10 text-primary text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
              >
                {locking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Lock Resource Activations ({selected.size})
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                Generates +1 resource into each selected territory's storage.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">You own no territories.</p>
          )}
        </>
      )}
    </div>
  );
}