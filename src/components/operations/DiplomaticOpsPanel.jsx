/**
 * DiplomaticOpsPanel — Sprint 5B.5
 *
 * Diplomatic tab content during Operations Phase.
 * Shows a unified Influence Actions list including:
 *   - Intelligence actions (recon_territory, audit_stockpile, investigate_influence)
 *   - Diplomatic actions (war_rations, influence_network, merchant_convoy, etc.)
 *   - Battle-card-generating actions (uprising, labor_strike, tax_protest, manufactured_crisis)
 *
 * NO objective draw/discard (Planning Phase only).
 * Actions are staged here and committed on Operations Phase lock-in.
 *
 * Props:
 *   campaign
 *   myPlayer
 *   actingAsPlayerId
 *   players
 *   mapDef
 *   stateById
 *   operationsStatus    — from OperationsPhaseHeader
 *   onStaged            — called after staging changes
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Feather, X, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { INFLUENCE_ACTION_DEFINITIONS } from '@/config/influenceActionFramework';
import { OPERATION_DEFINITIONS } from '@/config/operationsConfig';
import OpsObjectiveHand from './OpsObjectiveHand';

// All influence actions unified: intel + diplomatic + battle-card-gen
const ALL_INFLUENCE_ACTIONS = [
  ...INFLUENCE_ACTION_DEFINITIONS,
  // Append battle-card-generating operations not already in the framework
  ...OPERATION_DEFINITIONS
    .filter(op => ['uprising','labor_strike','tax_protest','manufactured_crisis'].includes(op.operation_type))
    .map(op => ({
      action_id: op.operation_type,
      name: op.label,
      description: op.description,
      category: 'battle_card',
      cost_type: 'influence',
      cost: op.cost,
      target_rules: 'territory',
      icon: op.icon,
      pillar_color: 'text-orange-400',
      border_color: 'border-orange-500/30',
      bg_color: 'bg-orange-500/10',
      effect_summary: `Generates a ${op.label} battle card.`,
    })),
];

const CATEGORY_META = {
  intelligence:        { label: 'Intelligence',        color: 'text-cyan-400',    border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10' },
  diplomatic:          { label: 'Diplomatic',          color: 'text-status-info', border: 'border-status-info/30', bg: 'bg-status-info/10' },
  battle_manipulation: { label: 'Battle Manipulation', color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10' },
  economic_protection: { label: 'Economic Protection', color: 'text-amber-300',   border: 'border-amber-400/30',   bg: 'bg-amber-400/10' },
  military_support:    { label: 'Military Support',    color: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/10' },
  battle_card:         { label: 'Battle Operations',   color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/10' },
};

const CATEGORY_ORDER = ['intelligence', 'military_support', 'diplomatic', 'economic_protection', 'battle_manipulation', 'battle_card'];

function ActionForm({ action, regionPools, players, mapDef, stateById, onStage, onCancel }) {
  const [regionId, setRegionId] = useState('');
  const [targetTerritoryId, setTargetTerritoryId] = useState('');
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [targetPlayerBId, setTargetPlayerBId] = useState('');
  const [targetSupplyRouteId, setTargetSupplyRouteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const regions = Object.entries(regionPools).map(([id, amt]) => ({ id, amount: amt }));
  const selectedPool = regionPools[regionId] ?? 0;
  const canAfford = selectedPool >= action.cost;

  const territories = Object.values(stateById ?? {});

  const handleSubmit = async () => {
    if (!regionId) { setError('Select a region.'); return; }
    if ((action.target_rules === 'territory' || action.target_rules === 'territory_or_region') && !targetTerritoryId) {
      setError('Select a target territory.'); return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onStage({
        action_type: action.action_id,
        region_id: regionId,
        target_territory_id: targetTerritoryId || undefined,
        target_player_id: targetPlayerId || undefined,
        target_player_b_id: targetPlayerBId || undefined,
        target_supply_route_id: targetSupplyRouteId || undefined,
      });
    } catch (e) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to stage action.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      {/* Region selector */}
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Spend influence from region:</label>
        <select
          value={regionId}
          onChange={e => setRegionId(e.target.value)}
          className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">— select region —</option>
          {regions.map(r => (
            <option key={r.id} value={r.id} disabled={r.amount < action.cost}>
              {r.id.replace(/_/g, ' ')} ({r.amount} inf){r.amount < action.cost ? ' — insufficient' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Territory target */}
      {(action.target_rules === 'territory' || action.target_rules === 'territory_or_region') && (
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Target territory:</label>
          <select
            value={targetTerritoryId}
            onChange={e => setTargetTerritoryId(e.target.value)}
            className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">— select territory —</option>
            {territories.map(t => {
              const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
              return <option key={t.territory_id} value={t.territory_id}>{name}</option>;
            })}
          </select>
        </div>
      )}

      {/* Player target */}
      {(action.target_rules === 'player' || action.target_rules === 'two_players') && (
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Target player:</label>
          <select
            value={targetPlayerId}
            onChange={e => setTargetPlayerId(e.target.value)}
            className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">— select player —</option>
            {(players ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
      )}

      {action.target_rules === 'two_players' && (
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Second player:</label>
          <select
            value={targetPlayerBId}
            onChange={e => setTargetPlayerBId(e.target.value)}
            className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">— select player —</option>
            {(players ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
        >Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !canAfford || !regionId}
          className="flex-1 px-2 py-1.5 rounded border border-primary/40 bg-primary/10 text-primary text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Stage'}
        </button>
      </div>
    </div>
  );
}

function ActionCategory({ category, actions, regionPools, players, mapDef, stateById, isLocked, onStage }) {
  const [expanded, setExpanded] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const meta = CATEGORY_META[category] ?? { label: category, color: 'text-foreground', border: 'border-border', bg: 'bg-muted/10' };
  const totalAvailable = Math.max(...Object.values(regionPools), 0);

  return (
    <div className={`rounded border ${meta.border} ${meta.bg}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className={`font-display text-xs tracking-wider uppercase font-semibold ${meta.color} flex items-center gap-1.5`}>
          {meta.label} <span className="text-[10px] text-muted-foreground normal-case font-normal">({actions.length})</span>
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {actions.map(action => {
            const canAfford = totalAvailable >= action.cost;
            const isActive = activeAction === action.action_id;

            return (
              <div key={action.action_id} className="rounded border border-border bg-muted/5 overflow-hidden">
                <div className="flex items-start gap-2 px-2 py-2">
                  <span className="text-sm shrink-0 mt-0.5">{action.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-foreground">{action.name}</p>
                      <span className="text-[10px] text-cyan-400 font-mono">{action.cost} inf</span>
                      {!canAfford && <span className="text-[10px] text-destructive">(insufficient)</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{action.effect_summary ?? action.description}</p>
                  </div>
                  {!isLocked && (
                    <button
                      onClick={() => setActiveAction(isActive ? null : action.action_id)}
                      disabled={!canAfford && !isActive}
                      className="shrink-0 px-2 py-1 rounded border border-primary/40 text-primary text-[10px] font-display tracking-wider uppercase hover:bg-primary/10 disabled:opacity-40 transition-all"
                    >
                      {isActive ? 'Cancel' : 'Stage'}
                    </button>
                  )}
                </div>

                {isActive && !isLocked && (
                  <div className="px-2 pb-2">
                    <ActionForm
                      action={action}
                      regionPools={regionPools}
                      players={players}
                      mapDef={mapDef}
                      stateById={stateById}
                      onStage={async (params) => {
                        await onStage(params);
                        setActiveAction(null);
                      }}
                      onCancel={() => setActiveAction(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DiplomaticOpsPanel({ campaign, myPlayer, actingAsPlayerId, players, mapDef, stateById, operationsStatus, onStaged }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;

  const [staging, setStaging] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [removeError, setRemoveError] = useState(null);

  const isLocked = operationsStatus?.diplomatic?.is_locked || operationsStatus?.operations_locked;
  const regionPools = operationsStatus?.diplomatic?.region_pools ?? staging?.region_pools ?? {};

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('operationsLockPhase', {
        action: 'getOperationsStatus',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      });
      setStaging(res.data?.diplomatic ?? null);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load diplomatic ops state');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (operationsStatus?.diplomatic) setStaging(operationsStatus.diplomatic);
  }, [operationsStatus?.diplomatic]);

  const stagedActions = staging?.staged ?? [];

  const handleStage = async (params) => {
    await base44.functions.invoke('operationsLockPhase', {
      action: 'stageDiplomatic',
      campaign_id: campaign.id,
      acting_as_player_id: actingPlayerId,
      ...params,
    });
    await load();
    onStaged?.();
  };

  const handleRemove = async (index) => {
    setRemoveError(null);
    try {
      await base44.functions.invoke('operationsLockPhase', {
        action: 'removeStaged',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        pillar: 'diplomatic',
        index,
      });
      await load();
      onStaged?.();
    } catch (e) {
      setRemoveError(e?.response?.data?.error ?? 'Failed to remove action');
    }
  };

  // Group actions by category
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = ALL_INFLUENCE_ACTIONS.filter(a => a.category === cat);
    return acc;
  }, {});

  const totalPoolInfluence = Object.values(regionPools).reduce((s, v) => s + v, 0);

  return (
    <div className="p-3 space-y-3">
      {/* Read-only objective hand */}
      <OpsObjectiveHand campaign={campaign} actingPlayerId={actingPlayerId} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-purple-400 flex items-center gap-1.5">
          <Feather className="w-3.5 h-3.5" /> Influence Actions
          {isLocked && <span className="ml-1 text-green-400">(locked)</span>}
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {removeError && <p className="text-xs text-destructive">{removeError}</p>}

      {/* Influence pool summary */}
      <div className="panel p-2 space-y-1">
        <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Regional Influence Pools</p>
        {Object.keys(regionPools).length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">No spendable influence available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(regionPools).map(([rid, amt]) => (
              <div key={rid} className={`flex items-center justify-between px-2 py-1 rounded border ${amt > 0 ? 'border-purple-500/30 bg-purple-500/5' : 'border-border bg-muted/5'}`}>
                <span className="text-[10px] text-muted-foreground truncate">{rid.replace(/_/g, ' ')}</span>
                <span className={`text-[10px] font-mono font-bold ${amt > 0 ? 'text-purple-400' : 'text-muted-foreground'}`}>{amt}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-right">Total: <span className="text-foreground font-mono">{totalPoolInfluence}</span></p>
      </div>

      {loading && !staging ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Staged actions list */}
          {stagedActions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Staged Actions ({stagedActions.length})</p>
              {stagedActions.map((a, i) => {
                const def = ALL_INFLUENCE_ACTIONS.find(d => d.action_id === a.action_type);
                const meta = CATEGORY_META[def?.category ?? 'diplomatic'];
                return (
                  <div key={i} className={`flex items-center gap-2 px-2 py-2 rounded border ${meta.border} ${meta.bg}`}>
                    <span className="text-base shrink-0">{def?.icon ?? '🎯'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${meta.color}`}>{def?.name ?? a.action_type}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.region_id?.replace(/_/g, ' ')} · {a.cost} inf
                        {a.target_territory_id && ` · ${a.target_territory_id}`}
                      </p>
                    </div>
                    {!isLocked && (
                      <button onClick={() => handleRemove(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isLocked && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {isLocked && stagedActions.length === 0 && (
            <p className="text-[10px] text-green-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" /> No diplomatic actions staged. Phase locked.
            </p>
          )}

          {/* Action categories */}
          {!isLocked && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Available Actions</p>
              {CATEGORY_ORDER.map(cat => {
                const actions = grouped[cat] ?? [];
                if (actions.length === 0) return null;
                return (
                  <ActionCategory
                    key={cat}
                    category={cat}
                    actions={actions}
                    regionPools={regionPools}
                    players={players}
                    mapDef={mapDef}
                    stateById={stateById}
                    isLocked={isLocked}
                    onStage={handleStage}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}