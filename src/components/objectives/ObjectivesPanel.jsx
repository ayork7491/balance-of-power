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

  // Compute progress data for each active card based on current game state
  const ownedTerritoryIds = Object.values(stateById)
    .filter(ts => ts.owner_player_id === actingPlayer?.id)
    .map(ts => ts.territory_id);

  function computeProgressData(cardDef) {
    if (!cardDef) return null;
    const condition = cardDef.completion_condition ?? cardDef.trigger_condition ?? '';
    if (!condition) return null;
    if (condition.startsWith('hold_territories:') || condition.startsWith('territories_count:')) {
      const required = parseInt(condition.split(':')[1]) || 0;
      return { current: ownedTerritoryIds.length, required, conditionMet: ownedTerritoryIds.length >= required };
    }
    if (condition.startsWith('hold_region:')) {
      const regionId = condition.split(':')[1];
      // Count territories in region vs owned in region
      const allTs = Object.values(stateById);
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
      const regionTs = allTs.filter(ts => SC_TERRITORY_REGION[ts.territory_id] === regionId);
      const ownedInRegion = regionTs.filter(ts => ts.owner_player_id === actingPlayer?.id).length;
      const required = regionTs.length;
      return { current: ownedInRegion, required, conditionMet: required > 0 && ownedInRegion >= required };
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