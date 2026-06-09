/**
 * ObjectiveOpportunity — Auto-deal 3 / Stage 1 selection UI. Sprint 5B.2.
 *
 * States:
 *   dealing      — auto-dealing cards (spinner)
 *   selecting    — 3 cards shown; player stages 1 to keep (staged, not committed)
 *   staged       — selection staged, waiting for planning phase lock
 *   locked       — planning phase locked, objectives committed
 *   no_draw      — no objective opportunity this round (deck empty / already resolved)
 *
 * Props:
 *   campaignId
 *   actingPlayer       — CampaignPlayer
 *   currentHeld        — card_id[] currently held
 *   pendingDraw        — card_id[] | null (from getObjectiveState)
 *   cardDefinitions    — { [card_id]: SecretObjectiveCard }
 *   onResolved         — called after staging (triggers parent reload)
 *   planningStatus     — from PlanningPhaseLockBar (optional)
 *   autoDealt          — true if autoDealObjectives has already been called
 */
import { useState, useEffect } from 'react';
import { Check, ChevronRight, AlertCircle, Loader2, Clock } from 'lucide-react';
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
  planningStatus,
  autoDealt,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [replaceCard, setReplaceCard] = useState(null);
  const [stagingDone, setStagingDone] = useState(false);

  const hasPending = pendingDraw && pendingDraw.length > 0;
  const atCap = (currentHeld?.length ?? 0) >= MAX_HAND;
  const diplomaticLocked = planningStatus?.diplomatic?.is_locked ?? false;
  const diplomaticStaged = planningStatus?.diplomatic?.diplomatic_staged;

  // Pre-fill staged selection if already staged
  useEffect(() => {
    if (diplomaticStaged?.kept_card_id && !selectedCard) {
      setSelectedCard(diplomaticStaged.kept_card_id);
      if (diplomaticStaged.replace_card_id) setReplaceCard(diplomaticStaged.replace_card_id);
    }
  }, [diplomaticStaged?.kept_card_id]);

  // Auto-deal on mount if not dealt yet
  useEffect(() => {
    if (!campaignId || !actingPlayer?.id) return;
    if (autoDealt || hasPending) return; // already dealt
    if (diplomaticLocked) return; // already committed

    const deal = async () => {
      setLoading(true);
      try {
        await base44.functions.invoke('planningPhase', {
          action: 'autoDealObjectives',
          campaign_id: campaignId,
          acting_as_player_id: actingPlayer.id,
        });
        onResolved?.();
      } catch (err) {
        // Non-fatal — no cards may be defined yet
        console.warn('[autoDealObjectives]', err?.response?.data?.error ?? err?.message);
      } finally {
        setLoading(false);
      }
    };
    deal();
  }, [campaignId, actingPlayer?.id, autoDealt, hasPending, diplomaticLocked]);

  const handleStage = async () => {
    if (!selectedCard) return;
    if (atCap && !replaceCard) {
      setError('You have 3 active objectives. Select one to replace.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await base44.functions.invoke('planningPhase', {
        action: 'stageObjectiveKeep',
        campaign_id: campaignId,
        acting_as_player_id: actingPlayer?.id,
        kept_card_id: selectedCard,
        replace_card_id: replaceCard ?? undefined,
      });
      setStagingDone(true);
      onResolved?.();
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to stage objective selection.');
    } finally {
      setLoading(false);
    }
  };

  // Committed state
  if (diplomaticLocked) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">
        <Check className="w-3.5 h-3.5" />
        Objective committed (locked in Planning Phase).
      </div>
    );
  }

  // Staged but not yet committed
  if (stagingDone || (diplomaticStaged?.kept_card_id && !hasPending)) {
    const keptId = diplomaticStaged?.kept_card_id ?? selectedCard;
    const keptDef = keptId ? cardDefinitions?.[keptId] : null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded border border-purple-500/30 bg-purple-500/10 text-xs text-purple-400">
          <Clock className="w-3.5 h-3.5" />
          Objective staged: <span className="font-medium ml-1">{keptDef?.title ?? keptId}</span>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Will be committed when you lock in Planning Phase.
        </p>
      </div>
    );
  }

  // Dealing spinner
  if (loading && !hasPending) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dealing objective cards…
      </div>
    );
  }

  // No pending draw — no cards this round
  if (!hasPending) {
    return (
      <div className="text-[10px] text-muted-foreground italic px-1 py-1">
        No objective opportunity this round.
      </div>
    );
  }

  // ── Selecting state ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Choose 1 Objective to Keep
        </p>
        <span className="text-[10px] text-muted-foreground">
          {pendingDraw.length} drawn · stage 1
        </span>
      </div>

      <div className="space-y-2">
        {pendingDraw.map(cid => {
          const def = cardDefinitions?.[cid];
          return def ? (
            <ObjectiveCardDisplay
              key={cid}
              cardDef={def}
              variant="choice"
              selected={selectedCard === cid}
              onSelect={() => setSelectedCard(selectedCard === cid ? null : cid)}
            />
          ) : (
            <div key={cid} className="text-xs text-muted-foreground px-2 py-1.5 rounded border border-border">{cid}</div>
          );
        })}
      </div>

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
        onClick={handleStage}
        disabled={!selectedCard || loading || (atCap && !replaceCard)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-purple-500/40 bg-purple-500/10 text-purple-400 text-xs font-display tracking-wider uppercase disabled:opacity-40 hover:brightness-110 transition-all"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Stage Selection
      </button>
      <p className="text-[10px] text-muted-foreground text-center">
        Selection will commit when you lock in Planning Phase.
      </p>
    </div>
  );
}