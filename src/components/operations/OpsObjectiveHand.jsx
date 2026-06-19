/**
 * OpsObjectiveHand — Sprint 5B.6
 *
 * Read-only objective hand display for the Diplomatic Operations tab.
 * Shows the player's currently held secret objectives for reference only.
 * No draw/discard controls — those are Planning Phase only.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ScrollText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { OBJECTIVE_BY_ID, OBJECTIVE_CATEGORY_CONFIG, TIER_LABELS, OBJECTIVE_TIER_REWARDS } from '@/config/objectiveDefinitions.js';
import ObjectiveCardDisplay from '@/components/objectives/ObjectiveCardDisplay';

export default function OpsObjectiveHand({ campaign, actingPlayerId }) {
  const [heldCards, setHeldCards] = useState([]);
  const [cardDefs, setCardDefs] = useState({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('objectivePhase', {
        action: 'getObjectiveState',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      });
      const state = res.data ?? {};
      const held = state.held ?? state.objective_cards_json?.held ?? [];
      setHeldCards(held);
      setCardDefs(state.card_definitions ?? {});
    } catch {
      // silently ignore — objectives are supplementary
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { if (expanded) load(); }, [expanded, load]);

  return (
    <div className="panel border border-purple-500/20">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/5 transition-colors"
      >
        <span className="font-display text-[10px] tracking-widest uppercase text-purple-400 flex items-center gap-1.5">
          <ScrollText className="w-3 h-3" /> Secret Objectives
          {heldCards.length > 0 && (
            <span className="text-muted-foreground font-normal normal-case">({heldCards.length})</span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-muted-foreground italic">Read-only reference. Draw/discard during Planning Phase.</p>
            <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          ) : heldCards.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No objectives in hand.</p>
          ) : (
            <div className="space-y-2">
              {heldCards.map((cardId, i) => {
                // Prefer API-returned card_definitions, fall back to local static config
                const apiDef = cardDefs[cardId];
                const localDef = OBJECTIVE_BY_ID[cardId];
                const cardDef = apiDef ?? localDef;
                if (!cardDef) return (
                  <div key={i} className="px-2 py-1.5 rounded border border-border bg-muted/5 text-[10px] text-muted-foreground">
                    {cardId}
                  </div>
                );
                return (
                  <ObjectiveCardDisplay
                    key={cardId}
                    cardDef={cardDef}
                    variant="active"
                    isOwner={true}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}