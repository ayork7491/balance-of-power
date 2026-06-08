/**
 * ObjectiveOpportunity — Draw 3 / Keep 1 selection UI.
 *
 * States:
 *   idle         — no pending draw; shows "Draw Objectives" button
 *   selecting    — 3 cards shown; player picks 1 (optionally replaces an existing held card)
 *   done         — resolved; shows brief confirmation
 *
 * Props:
 *   campaignId
 *   actingPlayer       — CampaignPlayer
 *   currentHeld        — card_id[] currently held
 *   pendingDraw        — card_id[] | null (from getObjectiveState)
 *   cardDefinitions    — { [card_id]: SecretObjectiveCard }
 *   onResolved         — called after successful resolution (triggers parent reload)
 */
import { useState } from 'react';
import { Shuffle, Check, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ObjectiveCardDisplay from './ObjectiveCardDisplay';
import { OBJECTIVE_CATEGORY_CONFIG } from '@/config/objectiveDefinitions';

const MAX_HAND = 3;

export default function ObjectiveOpportunity({
  campaignId,
  actingPlayer,
  currentHeld,
  pendingDraw,
  cardDefinitions,
  onResolved,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [replaceCard, setReplaceCard] = useState(null);
  const [done, setDone] = useState(false);

  const hasPending = pendingDraw && pendingDraw.length > 0;
  const atCap = (currentHeld?.length ?? 0) >= MAX_HAND;

  const handleDraw = async () => {
    setLoading(true);
    setError(null);
    setSelectedCard(null);
    setReplaceCard(null);
    try {
      await base44.functions.invoke('objectivePhase', {
        action: 'drawOpportunity',
        campaign_id: campaignId,
        acting_as_player_id: actingPlayer?.id,
      });
      onResolved?.();
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to draw objectives.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedCard) return;
    if (atCap && !replaceCard) {
      setError('You have 3 active objectives. Select one to replace.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await base44.functions.invoke('objectivePhase', {
        action: 'resolveOpportunity',
        campaign_id: campaignId,
        acting_as_player_id: actingPlayer?.id,
        kept_card_id: selectedCard,
        replace_card_id: replaceCard ?? undefined,
      });
      setDone(true);
      onResolved?.();
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to resolve opportunity.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded border border-primary/30 bg-primary/5 text-xs text-primary">
        <Check className="w-3.5 h-3.5" />
        Objective opportunity resolved.
      </div>
    );
  }

  // ── Selecting state ─────────────────────────────────────────────────────────
  if (hasPending) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Choose 1 Objective
          </p>
          <span className="text-[10px] text-muted-foreground">
            {pendingDraw.length} drawn · keep 1
          </span>
        </div>

        {/* Card choices */}
        <div className="space-y-2">
          {pendingDraw.map(cid => {
            const def = cardDefinitions?.[cid];
            return def ? (
              <ObjectiveCardDisplay
                key={cid}
                cardDef={def}
                variant="choice"
                selected={selectedCard === cid}
                onSelect={() => setSelectedCard(cid)}
              />
            ) : (
              <div key={cid} className="text-xs text-muted-foreground px-2 py-1.5 rounded border border-border">
                {cid}
              </div>
            );
          })}
        </div>

        {/* Replace selector — only shown if at cap */}
        {atCap && selectedCard && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Replace which active objective?
            </p>
            <div className="space-y-1">
              {currentHeld.map(cid => {
                const def = cardDefinitions?.[cid];
                const catCfg = def ? OBJECTIVE_CATEGORY_CONFIG[def.category] : null;
                return (
                  <button
                    key={cid}
                    onClick={() => setReplaceCard(replaceCard === cid ? null : cid)}
                    className={[
                      'w-full text-left px-2.5 py-1.5 rounded border text-xs flex items-center justify-between transition-all',
                      replaceCard === cid
                        ? 'border-destructive/60 bg-destructive/10 text-destructive'
                        : 'border-border text-muted-foreground hover:border-muted-foreground',
                    ].join(' ')}
                  >
                    <span>{catCfg?.icon} {def?.title ?? cid}</span>
                    {replaceCard === cid && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleResolve}
          disabled={!selectedCard || loading || (atCap && !replaceCard)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase disabled:opacity-40 hover:brightness-110 transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Confirm Selection
        </button>
      </div>
    );
  }

  // ── Idle state ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}
      <button
        onClick={handleDraw}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-primary/40 text-primary text-xs font-display tracking-wider uppercase hover:bg-primary/10 disabled:opacity-40 transition-all"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
        Draw Objective Opportunity
      </button>
    </div>
  );
}