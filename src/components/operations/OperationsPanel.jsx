/**
 * OperationsPanel — Sprint 4K Operations Phase panel.
 *
 * Shown in the Battle tab / right dock during battle phase.
 * Displays Military, Economic, and Diplomatic Operations.
 *
 * Military operations (attack-generated cards) are displayed read-only.
 * Diplomatic + Economic ops can be submitted here to generate new battle cards.
 *
 * Generated cards are listed and link to the existing BattleCardRow display.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Swords, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  OPERATION_DEFINITIONS,
  OPERATION_CATEGORY_CONFIG,
  BATTLE_SOURCE_LABELS,
} from '@/config/operationsConfig';
import OperationForm from './OperationForm';
import OperationSourceBadge from './OperationSourceBadge';

const CATEGORY_ORDER = ['diplomatic', 'economic'];

function GeneratedCardRow({ card, mapDef }) {
  const territoryName = mapDef?.territories?.find(t => t.territory_id === card.target_territory_id)?.name
    ?? card.target_territory_id;
  const sourceCfg = BATTLE_SOURCE_LABELS[card.battle_card_source];

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-border bg-muted/10 text-xs">
      <div className="min-w-0">
        <p className="text-foreground font-medium truncate">{territoryName}</p>
        <p className="text-[10px] text-muted-foreground capitalize">
          {card.status} · {card.tabletop_size ?? 0} pts
        </p>
      </div>
      {sourceCfg && (
        <span className={`text-[10px] shrink-0 ${sourceCfg.color}`}>{sourceCfg.icon}</span>
      )}
    </div>
  );
}

function OperationCategorySection({ category, operations, state, campaignId, actingPlayer, stateById, mapDef, onOpSuccess }) {
  const [expanded, setExpanded] = useState(false);
  const [activeOp, setActiveOp] = useState(null);
  const catCfg = OPERATION_CATEGORY_CONFIG[category];

  return (
    <div className={`rounded border ${catCfg.border} ${catCfg.bg}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className={`font-display text-xs tracking-wider uppercase font-semibold ${catCfg.color} flex items-center gap-1.5`}>
          <span>{catCfg.icon}</span> {catCfg.label}
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {operations.map(op => {
            const isDiplomatic = op.cost_type === 'influence';
            const isEconomic   = op.cost_type === 'resource';

            const canAfford = isDiplomatic
              ? Object.values(state?.region_pools ?? {}).some(amt => amt >= op.cost)
              : (state?.resources?.[op.cost_resource] ?? 0) >= op.cost;

            if (activeOp === op.operation_type) {
              return (
                <OperationForm
                  key={op.operation_type}
                  operationType={op.operation_type}
                  campaignId={campaignId}
                  actingPlayer={actingPlayer}
                  regionPools={state?.region_pools ?? {}}
                  resources={state?.resources ?? {}}
                  stateById={stateById}
                  mapDef={mapDef}
                  supplyRoutes={state?.supply_routes ?? []}
                  activeBuildings={state?.active_buildings ?? []}
                  onSuccess={(result) => {
                    setActiveOp(null);
                    onOpSuccess?.(result);
                  }}
                  onCancel={() => setActiveOp(null)}
                />
              );
            }

            return (
              <div
                key={op.operation_type}
                className="flex items-start justify-between gap-2 px-2 py-2 rounded border border-border bg-muted/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{op.icon}</span>
                    <p className="text-xs font-semibold text-foreground">{op.label}</p>
                    {isDiplomatic && (
                      <span className="text-[10px] text-cyan-400 font-mono">{op.cost} inf</span>
                    )}
                    {isEconomic && (
                      <span className="text-[10px] text-amber-400 font-mono">{op.cost} {op.cost_resource}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{op.description}</p>
                </div>
                <button
                  onClick={() => setActiveOp(op.operation_type)}
                  disabled={!canAfford}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded border border-primary/40 text-primary text-[10px] font-display tracking-wider uppercase hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Zap className="w-2.5 h-2.5" /> Execute
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OperationsPanel({
  campaign,
  myPlayer,
  isAdmin,
  actingAsPlayerId,
  stateById = {},
  mapDef,
  players = [],
}) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMilitary, setShowMilitary] = useState(false);

  const campaignId = campaign?.id;
  const actingPlayer = actingAsPlayerId
    ? players.find(p => p.id === actingAsPlayerId) ?? myPlayer
    : myPlayer;

  const load = useCallback(async () => {
    if (!campaignId || !actingPlayer?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('operationsPhase', {
        action: 'getOperationsState',
        campaign_id: campaignId,
        acting_as_player_id: actingPlayer.id,
      });
      setState(res.data);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to load operations state.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, actingPlayer?.id]);

  useEffect(() => { load(); }, [load]);

  const groupedOps = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = OPERATION_DEFINITIONS.filter(op => op.category === cat);
    return acc;
  }, {});

  const generatedCards = state?.generated_cards ?? [];

  return (
    <div className="px-3 pt-3 pb-2 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <Swords className="w-3 h-3" /> Operations
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading && !state ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Resource summary */}
          {state && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span>Gold: <span className="text-amber-400 font-mono">{state.resources?.gold ?? 0}</span></span>
              <span>Iron: <span className="text-foreground font-mono">{state.resources?.iron ?? 0}</span></span>
              <span>Timber: <span className="text-foreground font-mono">{state.resources?.timber ?? 0}</span></span>
            </div>
          )}

          {/* Military Operations — read-only, just explains attack card generation */}
          <div className="rounded border border-red-500/30 bg-red-500/10">
            <button
              onClick={() => setShowMilitary(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="font-display text-xs tracking-wider uppercase font-semibold text-red-400 flex items-center gap-1.5">
                ⚔️ Military Operations
              </span>
              {showMilitary ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {showMilitary && (
              <div className="px-3 pb-3 space-y-1.5 text-xs text-muted-foreground">
                <p>Military battle cards are generated during the <span className="text-foreground">Attack Phase</span> when players commit troops.</p>
                <p>All attack-generated cards use the same battle lifecycle as other Operations.</p>
              </div>
            )}
          </div>

          {/* Diplomatic + Economic Ops */}
          {CATEGORY_ORDER.map(cat => (
            <OperationCategorySection
              key={cat}
              category={cat}
              operations={groupedOps[cat]}
              state={state}
              campaignId={campaignId}
              actingPlayer={actingPlayer}
              stateById={stateById}
              mapDef={mapDef}
              onOpSuccess={load}
            />
          ))}

          {/* Generated cards this round */}
          {generatedCards.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Swords className="w-3 h-3" /> Generated This Round ({generatedCards.length})
              </p>
              <div className="space-y-1">
                {generatedCards.map(card => (
                  <GeneratedCardRow key={card.id} card={card} mapDef={mapDef} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}