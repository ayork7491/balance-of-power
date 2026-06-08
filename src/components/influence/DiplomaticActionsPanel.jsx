/**
 * DiplomaticActionsPanel — Sprint 4H
 *
 * Main panel showing:
 *   - Action capacity (remaining / max)
 *   - Regional spendable influence
 *   - Action buttons with costs and target selectors
 *   - Active diplomatic effects
 */
import { useState } from 'react';
import { Feather, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useDiplomaticActions } from '@/features/campaigns/influence/useDiplomaticActions';
import DiplomaticActionForm from './DiplomaticActionForm';
import ActiveDiplomaticEffects from './ActiveDiplomaticEffects';
import { PLAYER_COLORS } from '@/config/theme';

const REGION_LABELS = {
  outer_passes:       'Outer Passes',
  high_crown:         'High Crown',
  northern_wilds:     'Northern Wilds',
  deepwoods:          'Deepwoods',
  northern_ruins:     'Northern Ruins',
  central_crossroads: 'Central Crossroads',
  southern_ruins:     'Southern Ruins',
  western_plains:     'Western Plains',
  eastern_granaries:  'Eastern Granaries',
  northern_isles:     'Northern Isles',
  southern_fractures: 'Southern Fractures',
};

const ACTION_DEFS = [
  { type: 'war_rations',         label: 'War Rations',         cost: 2, desc: 'Reduce food upkeep this round.' },
  { type: 'influence_network',   label: 'Influence Network',   cost: 2, desc: '+1 Permanent Influence to all adjacent territories.' },
  { type: 'merchant_convoy',     label: 'Merchant Convoy',     cost: 2, desc: 'Protect a supply route from disruption.' },
  { type: 'non_aggression_pact', label: 'Non-Aggression Pact', cost: 4, desc: 'Target player cannot attack you for 1 round.' },
  { type: 'broker_peace',        label: 'Broker Peace',        cost: 4, desc: 'Negate battle generation at a target territory.' },
  { type: 'coalition_warfare',   label: 'Coalition Warfare',   cost: 6, desc: 'Force another player to contribute to your battle.' },
  { type: 'power_broker',        label: 'Power Broker',        cost: 6, desc: 'Create a Non-Aggression Pact between two other players.' },
];

export default function DiplomaticActionsPanel({
  campaign,
  myPlayer,
  players,
  mapDef,
  actingAsPlayerId,
  stateById,
}) {
  const [selectedAction, setSelectedAction] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [showEffects, setShowEffects] = useState(true);

  const {
    actionsRemaining,
    maxActions,
    actionsUsed,
    councilChambers,
    regionPools,
    activeEffects,
    actionCosts,
    loading,
    error,
    reload,
    submitAction,
  } = useDiplomaticActions({
    campaignId: campaign?.id,
    playerId: myPlayer?.id,
    actingAsPlayerId,
    enabled: !!campaign?.id && !!myPlayer?.id,
  });

  const handleSubmit = async (params) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const result = await submitAction(params);
      setSubmitSuccess(result?.message ?? 'Action submitted.');
      setSelectedAction(null);
      reload();
    } catch (e) {
      setSubmitError(e?.response?.data?.error ?? e?.message ?? 'Failed to submit action.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading diplomatic state…
      </div>
    );
  }

  const noActions = actionsRemaining <= 0;

  return (
    <div className="space-y-3 p-3">
      {/* Header — action capacity */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Feather className="w-3.5 h-3.5 text-status-info" />
          <span className="font-display text-xs tracking-wider uppercase text-foreground">Diplomatic Actions</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
          noActions ? 'bg-muted/30 text-muted-foreground' : 'bg-status-info/10 text-status-info'
        }`}>
          {actionsRemaining}/{maxActions}
          <span className="font-normal font-body text-[9px] text-muted-foreground">
            remaining
          </span>
        </div>
      </div>

      {councilChambers > 0 && (
        <p className="text-[10px] text-accent">
          +{councilChambers} from Council Chamber{councilChambers > 1 ? 's' : ''}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-destructive px-2 py-1.5 rounded border border-destructive/30 bg-destructive/10">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {submitSuccess && (
        <div className="flex items-start gap-1.5 text-xs text-status-locked px-2 py-1.5 rounded border border-status-locked/30 bg-status-locked/10">
          <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
          {submitSuccess}
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-1.5 text-xs text-destructive px-2 py-1.5 rounded border border-destructive/30 bg-destructive/10">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {submitError}
        </div>
      )}

      {/* Regional influence summary */}
      <RegionPoolSummary regionPools={regionPools} actionCosts={actionCosts} />

      {/* Action list */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Available Actions</p>
        {ACTION_DEFS.map(def => {
          const cost = actionCosts[def.type] ?? def.cost;
          const isSelected = selectedAction === def.type;
          // Check if player has enough influence anywhere for this action
          const maxRegionInfluence = Math.max(0, ...Object.values(regionPools));
          const canAfford = maxRegionInfluence >= cost;

          return (
            <div key={def.type} className="rounded border border-border overflow-hidden">
              <button
                onClick={() => {
                  setSelectedAction(isSelected ? null : def.type);
                  setSubmitError(null);
                  setSubmitSuccess(null);
                }}
                disabled={noActions && !isSelected}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-status-info/10 border-b border-status-info/30'
                    : noActions
                    ? 'bg-muted/10 opacity-50 cursor-not-allowed'
                    : !canAfford
                    ? 'bg-muted/10 hover:bg-muted/20 opacity-70'
                    : 'bg-panel-header hover:bg-muted/20'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{def.label}</span>
                    {!canAfford && !noActions && (
                      <span className="text-[9px] text-muted-foreground">(low influence)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{def.desc}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    canAfford ? 'bg-status-info/15 text-status-info' : 'bg-muted/30 text-muted-foreground'
                  }`}>
                    {cost} 🕊
                  </span>
                  {isSelected ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              </button>

              {isSelected && (
                <DiplomaticActionForm
                  actionType={def.type}
                  cost={cost}
                  regionPools={regionPools}
                  players={players}
                  myPlayer={myPlayer}
                  mapDef={mapDef}
                  stateById={stateById}
                  campaign={campaign}
                  onSubmit={handleSubmit}
                  onCancel={() => setSelectedAction(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Active effects */}
      {activeEffects.length > 0 && (
        <div>
          <button
            onClick={() => setShowEffects(o => !o)}
            className="flex items-center gap-1.5 text-[10px] font-display tracking-wider uppercase text-muted-foreground mb-1.5 hover:text-foreground transition-colors"
          >
            {showEffects ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Active Effects ({activeEffects.length})
          </button>
          {showEffects && (
            <ActiveDiplomaticEffects effects={activeEffects} players={players} campaign={campaign} />
          )}
        </div>
      )}

      {noActions && (
        <p className="text-[10px] text-muted-foreground italic text-center py-1">
          All diplomatic actions used this round.
        </p>
      )}
    </div>
  );
}

function RegionPoolSummary({ regionPools, actionCosts }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(regionPools).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground italic px-1">
        No spendable influence available. Generate influence via monuments or direct actions.
      </div>
    );
  }

  return (
    <div className="rounded border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-panel-header hover:bg-muted/20 transition-colors text-left"
      >
        <span className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">
          Regional Influence (Spendable)
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-status-info font-bold">
            {entries.reduce((s, [, v]) => s + v, 0)} total
          </span>
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-border">
          {entries.map(([regionId, amount]) => (
            <div key={regionId} className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span className="text-foreground">{REGION_LABELS[regionId] ?? regionId}</span>
              <span className="font-mono font-bold text-status-info">{amount} 🕊</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}