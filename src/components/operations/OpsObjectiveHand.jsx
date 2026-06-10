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

export default function OpsObjectiveHand({ campaign, actingPlayerId }) {
  const [heldCards, setHeldCards] = useState([]);
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
      // held cards are stored in objective_cards_json.held
      const held = state.held ?? state.objective_cards_json?.held ?? [];
      setHeldCards(held);
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
            <div className="space-y-1.5">
              {heldCards.map((cardId, i) => {
                const def = OBJECTIVE_BY_ID[cardId];
                if (!def) return (
                  <div key={i} className="px-2 py-1.5 rounded border border-border bg-muted/5 text-[10px] text-muted-foreground">
                    {cardId}
                  </div>
                );
                const catCfg = OBJECTIVE_CATEGORY_CONFIG[def.category] ?? {};
                const reward = OBJECTIVE_TIER_REWARDS[def.tier] ?? 0;
                const tierLabel = TIER_LABELS[def.tier] ?? def.tier;
                return (
                  <div key={i} className={`px-2 py-2 rounded border ${catCfg.border ?? 'border-border'} ${catCfg.bg ?? 'bg-muted/5'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-xs">{catCfg.icon}</span>
                          <p className={`text-xs font-semibold ${catCfg.color ?? 'text-foreground'}`}>{def.title}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{def.description}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${catCfg.badgeClass ?? 'border-border'}`}>
                          Tier {tierLabel}
                        </span>
                        <span className="text-[9px] text-purple-400 font-mono">+{reward} inf</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}