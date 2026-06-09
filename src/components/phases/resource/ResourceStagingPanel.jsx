/**
 * ResourceStagingPanel — Sprint 5B.2
 *
 * Staging-only version of ResourcePhasePanel for the Planning Phase.
 * Selections are staged (not immediately committed) and committed only
 * when the player locks in the full Planning Phase.
 *
 * Props:
 *   campaign
 *   myPlayer
 *   mapDef
 *   actingAsPlayerId
 *   onStaged           — called after staging is saved
 *   planningStatus     — optional: status from PlanningPhaseLockBar to sync staged state
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Package, CheckCircle2 } from 'lucide-react';
import { RESOURCE_KEYS, RESOURCE_CONFIG, calcActivationLimit, sumStorage } from '@/config/resourceConfig';
import { SC_TERRITORY_BY_ID } from '@/shared/maps/shatteredCrownConfig';

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

export default function ResourceStagingPanel({ campaign, myPlayer, mapDef, actingAsPlayerId, onStaged, planningStatus }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [staging, setStaging] = useState(false);
  const [stagingResult, setStagingResult] = useState(null);

  const isLocked = planningStatus?.economic?.is_locked ?? false;

  const load = useCallback(async () => {
    if (!campaign?.id || !myPlayer) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('resourcePhase', {
        action: 'getResourceState',
        campaign_id: campaign.id,
        ...(actingAsPlayerId ? { acting_as_player_id: actingAsPlayerId } : {}),
      });
      setState(res.data);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load resource state');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, myPlayer, actingAsPlayerId]);

  useEffect(() => { load(); }, [load]);

  // Sync staged selections from planningStatus if available
  useEffect(() => {
    const stagedIds = planningStatus?.economic?.staged_territory_ids;
    if (stagedIds && stagedIds.length > 0) {
      setSelected(new Set(stagedIds));
    }
  }, [planningStatus?.economic?.staged_territory_ids]);

  const territories = state?.territories ?? [];
  const hubCount = state?.hub_count ?? territories.filter(t => t.has_resource_hub).length;
  const activationLimit = state?.activation_limit ?? calcActivationLimit(territories.length, hubCount);

  const toggleTerritory = (tid) => {
    if (isLocked) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tid)) {
        next.delete(tid);
      } else {
        if (next.size >= activationLimit) return prev;
        next.add(tid);
      }
      return next;
    });
  };

  const handleStage = async () => {
    if (staging || isLocked) return;
    setStaging(true);
    setStagingResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('planningPhase', {
        action: 'stageActivations',
        campaign_id: campaign.id,
        territory_ids: [...selected],
        ...(actingAsPlayerId ? { acting_as_player_id: actingAsPlayerId } : {}),
      });
      setStagingResult(res.data);
      onStaged?.([...selected]);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to stage activations');
    } finally {
      setStaging(false);
    }
  };

  const aggregateTotals = territories.reduce((acc, t) => {
    for (const r of RESOURCE_KEYS) {
      acc[r] = (acc[r] ?? 0) + (t.resource_storage?.[r] ?? 0);
    }
    return acc;
  }, {});

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Resources
          {isLocked && <span className="ml-1 text-green-400">(locked)</span>}
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !state && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading resources…
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {state && (
        <>
          {/* Storage reference */}
          <div className="panel p-2.5 space-y-1.5">
            <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">
              Territory Storage
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
          </div>

          {/* Territory selection */}
          {territories.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                  Select Territories
                </p>
                <span className={`text-xs font-mono font-bold ${selected.size >= activationLimit ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  {selected.size} / {activationLimit}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Stage up to <span className="text-foreground font-medium">{activationLimit}</span> activation{activationLimit !== 1 ? 's' : ''}.
                Resources generate when you lock in Planning Phase.
              </p>

              {(stagingResult || planningStatus?.economic?.staged_territory_ids?.length > 0) && !isLocked && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                  <CheckCircle2 className="w-3 h-3" />
                  {selected.size} activation{selected.size !== 1 ? 's' : ''} staged. Lock in Planning Phase to commit.
                </div>
              )}

              {isLocked && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Activations committed. Resources generated into territory storage.
                </div>
              )}

              <div className="space-y-1.5">
                {territories.map(t => {
                  const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
                  const cfg = RESOURCE_CONFIG[t.resource_type] ?? { label: t.resource_type, icon: '?', color: 'text-foreground', bg: 'bg-muted/20', border: 'border-border' };
                  const isSelected = selected.has(t.territory_id);
                  const isDisabled = isLocked || (!isSelected && selected.size >= activationLimit);

                  return (
                    <label
                      key={t.territory_id}
                      className={`flex items-start gap-2.5 rounded border px-3 py-2 transition-all ${
                        isLocked
                          ? isSelected ? `${cfg.border} ${cfg.bg} opacity-60` : 'border-border bg-muted/5 opacity-40'
                          : isSelected
                          ? `${cfg.border} ${cfg.bg} cursor-pointer`
                          : isDisabled
                          ? 'border-border bg-muted/5 opacity-50 cursor-not-allowed'
                          : 'border-border bg-muted/10 hover:border-muted-foreground/40 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !isDisabled && toggleTerritory(t.territory_id)}
                        disabled={isDisabled}
                        className="mt-0.5 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground truncate">{name}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[10px] ${cfg.color}`}>{cfg.icon}</span>
                            {SC_TERRITORY_BY_ID[t.territory_id]?.secondary_resource && (() => {
                              const c2 = RESOURCE_CONFIG[SC_TERRITORY_BY_ID[t.territory_id].secondary_resource];
                              return c2 ? <span className={`text-[10px] opacity-60 ${c2.color}`}>{c2.icon}</span> : null;
                            })()}
                          </div>
                        </div>
                        {sumStorage(t.resource_storage) > 0 && (
                          <div className="mt-1"><StorageBadges storage={t.resource_storage} /></div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Stage button */}
              {!isLocked && (
                <button
                  onClick={handleStage}
                  disabled={selected.size === 0 || staging}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
                >
                  {staging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                  Stage {selected.size} Activation{selected.size !== 1 ? 's' : ''}
                </button>
              )}
              <p className="text-[10px] text-muted-foreground text-center">
                Resources generate into territory storage when Planning Phase is locked.
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