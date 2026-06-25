/**
 * ObjectivesPanel — Sprint 4I main objective management panel.
 * Shown in the Influence tab of RightDockRouter.
 *
 * Sections:
 *   1. Objective Opportunity (Draw 3 / Keep 1)
 *   2. Active Objectives (held hand — secret)
 *   3. Completed Objectives (revealed)
 *   4. Discard History (collapsed by default)
 *
 * Props:
 *   campaign
 *   myPlayer         — the viewing/acting player (CampaignPlayer)
 *   isAdmin
 *   actingAsPlayerId — test mode override
 *   stateById        — TerritoryState map (for completion placement picker)
 *   players          — CampaignPlayer[]
 */
import { useState, useEffect, useCallback } from 'react';
import { Target, ChevronDown, ChevronRight, Loader2, RefreshCw, Trophy, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ObjectiveCardDisplay from './ObjectiveCardDisplay';
import ObjectiveOpportunity from './ObjectiveOpportunity';

export default function ObjectivesPanel({
  campaign,
  myPlayer,
  isAdmin,
  actingAsPlayerId,
  stateById = {},
  players = [],
  planningStatus = null,
}) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const campaignId = campaign?.id;
  const actingPlayer = actingAsPlayerId
    ? players.find(p => p.id === actingAsPlayerId) ?? myPlayer
    : myPlayer;

  const load = useCallback(async () => {
    if (!campaignId || !actingPlayer?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('objectivePhase', {
        action: 'getObjectiveState',
        campaign_id: campaignId,
        acting_as_player_id: actingPlayer.id,
      });
      setState(res.data);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to load objectives.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, actingPlayer?.id]);

  // Debounced load — staggered to avoid concurrent 429s with other panel fetches
  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 500);
    return () => clearTimeout(timer);
  }, [load]);

  const cardDefs = state?.card_definitions ?? {};
  const held = state?.held ?? [];
  const pendingDraw = state?.pending_draw ?? null;
  const completed = state?.completed ?? [];
  const discarded = state?.discarded ?? [];

  // Compute progress data for each active card based on current game state (client-side approximation)
  const SC_TERRITORY_REGION = {
    I8:'outer_passes',I4:'outer_passes',I6:'outer_passes',I7:'outer_passes',
    I1:'high_crown',I2:'high_crown',I3:'high_crown',I5:'high_crown',
    W1:'northern_wilds',W2:'northern_wilds',W3:'northern_wilds',W4:'northern_wilds',W5:'northern_wilds',
    W6:'deepwoods',W7:'deepwoods',W8:'deepwoods',W9:'deepwoods',
    B1:'northern_ruins',B3:'northern_ruins',B2:'northern_ruins',B4:'northern_ruins',
    B5:'central_crossroads',B6:'central_crossroads',B7:'central_crossroads',
    B8:'southern_ruins',B9:'southern_ruins',B10:'southern_ruins',
    S1:'western_plains',S4:'western_plains',S7:'western_plains',S2:'western_plains',
    S5:'eastern_granaries',S8:'eastern_granaries',S3:'eastern_granaries',
    S6:'eastern_granaries',S9:'eastern_granaries',
    C1:'northern_isles',C2:'northern_isles',C3:'northern_isles',C4:'northern_isles',
    C5:'southern_fractures',C6:'southern_fractures',C7:'southern_fractures',C8:'southern_fractures',
  };
  const SC_RESOURCE_TYPES = { I1:'iron',I2:'iron',I3:'stone',I4:'iron',I5:'stone',I6:'timber',I7:'timber',I8:'iron',W1:'timber',W2:'stone',W3:'timber',W4:'timber',W5:'timber',W6:'timber',W7:'gold',W8:'gold',W9:'iron',B1:'stone',B2:'stone',B3:'stone',B4:'stone',B5:'iron',B6:'stone',B7:'stone',B8:'stone',B9:'iron',B10:'gold',S1:'timber',S2:'gold',S3:'iron',S4:'gold',S5:'gold',S6:'stone',S7:'timber',S8:'gold',S9:'iron',C1:'iron',C2:'gold',C3:'iron',C4:'gold',C5:'gold',C6:'gold',C7:'stone',C8:'gold' };
  const allTs = Object.values(stateById);
  const ownedTs = allTs.filter(ts => ts.owner_player_id === actingPlayer?.id);
  const ownedIds = new Set(ownedTs.map(ts => ts.territory_id));

  function computeProgressData(cardDef) {
    if (!cardDef) return null;
    const condition = cardDef.completion_condition ?? cardDef.trigger_condition ?? '';
    const params = cardDef.condition_params ?? {};
    if (!condition) return null;

    // Legacy formats
    if (condition.startsWith('hold_territories:') || condition.startsWith('territories_count:')) {
      const required = parseInt(condition.split(':')[1]) || (params.count ?? 0);
      return { current: ownedTs.length, required, conditionMet: ownedTs.length >= required };
    }
    if (condition.startsWith('hold_region:')) {
      const regionId = condition.split(':')[1];
      const regionTs = allTs.filter(ts => SC_TERRITORY_REGION[ts.territory_id] === regionId);
      const ownedInRegion = regionTs.filter(ts => ts.owner_player_id === actingPlayer?.id).length;
      return { current: ownedInRegion, required: regionTs.length, conditionMet: regionTs.length > 0 && ownedInRegion >= regionTs.length };
    }

    // Modern conditions
    if (condition === 'occupy_territories') {
      const required = params.count ?? 8;
      return { current: ownedTs.length, required, conditionMet: ownedTs.length >= required };
    }
    if (condition === 'occupy_regions') {
      const required = params.count ?? 4;
      const regions = new Set(ownedTs.map(ts => SC_TERRITORY_REGION[ts.territory_id]).filter(Boolean));
      return { current: regions.size, required, conditionMet: regions.size >= required };
    }
    if (condition === 'occupy_full_region') {
      const regionCounts = {};
      const regionOwned = {};
      for (const ts of allTs) {
        const r = SC_TERRITORY_REGION[ts.territory_id]; if (!r) continue;
        regionCounts[r] = (regionCounts[r] ?? 0) + 1;
        if (ts.owner_player_id === actingPlayer?.id) regionOwned[r] = (regionOwned[r] ?? 0) + 1;
      }
      let bestOwned = 0, bestTotal = 1;
      for (const [r, total] of Object.entries(regionCounts)) {
        const owned = regionOwned[r] ?? 0;
        if (owned / total > bestOwned / bestTotal) { bestOwned = owned; bestTotal = total; }
      }
      return { current: bestOwned, required: bestTotal, conditionMet: bestOwned >= bestTotal && bestTotal > 0 };
    }
    if (condition === 'control_resource_territories') {
      const resource = params.resource; const required = params.count ?? 3;
      const count = ownedTs.filter(ts => (ts.resource_type ?? SC_RESOURCE_TYPES[ts.territory_id]) === resource).length;
      return { current: count, required, conditionMet: count >= required };
    }
    if (condition === 'control_resource_hubs') {
      const required = params.count ?? 3;
      const count = ownedTs.filter(ts => ts.has_resource_hub).length;
      return { current: count, required, conditionMet: count >= required };
    }
    if (condition === 'hold_influence_in_regions') {
      const required = params.count ?? 2;
      // Client-side: count regions where player owns any territory (proxy for influence)
      const regions = new Set(ownedTs.map(ts => SC_TERRITORY_REGION[ts.territory_id]).filter(Boolean));
      return { current: regions.size, required, conditionMet: regions.size >= required };
    }
    if (condition === 'territory_on_every_continent') {
      const CONTINENT_PREFIX = { I: 'ironspine', W: 'wild_frontier', B: 'fracture_basin', S: 'sunfields', C: 'shattered_coast' };
      const allConts = new Set(Object.values(CONTINENT_PREFIX));
      const ownedConts = new Set(ownedTs.map(ts => CONTINENT_PREFIX[ts.territory_id?.[0]]).filter(Boolean));
      return { current: ownedConts.size, required: allConts.size, conditionMet: [...allConts].every(c => ownedConts.has(c)) };
    }
    return null;
  }

  return (
    <div className="px-3 pt-3 pb-2 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <Target className="w-3 h-3" /> Secret Objectives
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {loading && !state ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading objectives…
        </div>
      ) : (
        <>
          {/* ── Deck status ─────────────────────────────────────────────── */}
          {state && (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Deck: <span className="text-foreground font-mono">{state.deck_draw_count}</span></span>
              <span>·</span>
              <span>Discard: <span className="text-foreground font-mono">{state.deck_discard_count}</span></span>
              <span>·</span>
              <span>Hand: <span className="text-foreground font-mono">{held.length}/3</span></span>
            </div>
          )}

          {/* ── Objective Opportunity ────────────────────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Objective Opportunity
            </p>
            <ObjectiveOpportunity
              campaignId={campaignId}
              actingPlayer={actingPlayer}
              currentHeld={held}
              pendingDraw={pendingDraw}
              cardDefinitions={cardDefs}
              onResolved={load}
              planningStatus={planningStatus}
              autoDealt={planningStatus?.diplomatic?.objective_dealt ?? false}
            />
          </section>

          {/* ── Active Objectives ───────────────────────────────────────── */}
          <section>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              Active Objectives
              <span className="font-mono text-foreground">{held.length}/3</span>
            </p>
            {held.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No active objectives. Draw an opportunity above.</p>
            ) : (
              <div className="space-y-2">
                {held.map(cid => (
                  <ObjectiveCardDisplay
                    key={cid}
                    cardDef={cardDefs[cid]}
                    variant="active"
                    isOwner={true}
                    progressData={computeProgressData(cardDefs[cid])}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Completed Objectives ───────────────────────────────────── */}
          {completed.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-primary" />
                Completed ({completed.length})
              </p>
              <div className="space-y-2">
                {completed.map((entry, i) => (
                  <ObjectiveCardDisplay
                    key={`${entry.card_id}-${i}`}
                    cardDef={cardDefs[entry.card_id]}
                    variant="completed"
                    completedEntry={entry}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Discard History (collapsed) ─────────────────────────────── */}
          {discarded.length > 0 && (
            <section>
              <button
                onClick={() => setShowDiscard(v => !v)}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-full text-left"
              >
                {showDiscard ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Trash2 className="w-3 h-3" />
                Discarded ({discarded.length})
              </button>
              {showDiscard && (
                <div className="mt-2 space-y-2">
                  {discarded.map((entry, i) => (
                    <ObjectiveCardDisplay
                      key={`${entry.card_id}-${i}`}
                      cardDef={cardDefs[entry.card_id]}
                      variant="discarded"
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Objective completion is automatic — no manual complete UI */}
    </div>
  );
}