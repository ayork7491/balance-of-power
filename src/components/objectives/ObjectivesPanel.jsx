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
import ObjectiveCompleteModal from './ObjectiveCompleteModal';

export default function ObjectivesPanel({
  campaign,
  myPlayer,
  isAdmin,
  actingAsPlayerId,
  stateById = {},
  players = [],
}) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [completingCard, setCompletingCard] = useState(null); // card_id being completed

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

  useEffect(() => { load(); }, [load]);

  const cardDefs = state?.card_definitions ?? {};
  const held = state?.held ?? [];
  const pendingDraw = state?.pending_draw ?? null;
  const completed = state?.completed ?? [];
  const discarded = state?.discarded ?? [];

  const completingCardDef = completingCard ? cardDefs[completingCard] : null;

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
                    onComplete={() => setCompletingCard(cid)}
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

      {/* ── Complete modal ───────────────────────────────────────────────── */}
      {completingCard && completingCardDef && (
        <ObjectiveCompleteModal
          cardDef={completingCardDef}
          campaignId={campaignId}
          actingPlayer={actingPlayer}
          stateById={stateById}
          onCompleted={() => { setCompletingCard(null); load(); }}
          onClose={() => setCompletingCard(null)}
        />
      )}
    </div>
  );
}