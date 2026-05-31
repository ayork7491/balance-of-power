/**
 * BattlePanel — left-dock panel during battle phase.
 *
 * Shows:
 *   - All battle cards for the current round (public, all players)
 *   - Admin controls: auto-resolve individual cards, process phase end
 */
import { Loader2, Swords, Check, RefreshCw, Clock } from 'lucide-react';
import { useBattleCards } from '@/features/campaigns/battle';
import { base44 } from '@/api/base44Client';
import BattleCardRow from './BattleCardRow';
import { useState } from 'react';

export default function BattlePanel({ campaign, players, myPlayer, mapDef, onPhaseChanged }) {
  const round   = campaign?.current_round ?? 1;
  const isAdmin = myPlayer?.is_admin;
  const [processing, setProcessing] = useState(false);

  const { cards, delayedCards, loading, reload } = useBattleCards({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  // Current-round cards only for summary counts
  const currentRoundCards = cards.filter(c => c.round === round);
  const pendingCount  = cards.filter(c => ['pending','awaiting_result','result_submitted','awaiting_approval'].includes(c.status)).length;
  const resolvedCount = cards.filter(c => ['resolved','auto_resolved','forfeited'].includes(c.status)).length;
  // All resolved = no pending AND no unresolved delayed (delayed counts as "needs attention")
  const allResolved   = cards.length > 0 && pendingCount === 0 && delayedCards.length === 0;

  const handleProcessEnd = async () => {
    setProcessing(true);
    await base44.functions.invoke('battlePhase', {
      action: 'processPhaseEnd',
      campaign_id: campaign.id,
    });
    setProcessing(false);
    onPhaseChanged?.();
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-destructive flex items-center gap-2">
          <Swords className="w-3.5 h-3.5" />
          Round {round} — Battle Phase
        </p>
        <button onClick={reload} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="px-3 py-2 rounded border border-border bg-muted/20 text-center">
          <p className="text-muted-foreground">This Round</p>
          <p className="font-mono font-bold text-lg text-foreground">{currentRoundCards.length}</p>
        </div>
        <div className={`px-3 py-2 rounded border text-center ${allResolved ? 'border-status-locked/40 bg-status-locked/10' : 'border-border bg-muted/20'}`}>
          <p className="text-muted-foreground">Resolved</p>
          <p className={`font-mono font-bold text-lg ${allResolved ? 'text-status-locked' : 'text-foreground'}`}>{resolvedCount}/{cards.length}</p>
        </div>
      </div>

      {/* Delayed battles from prior rounds */}
      {delayedCards.length > 0 && (
        <div className="rounded border border-warning/40 bg-warning/5 p-3 space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-warning flex items-center gap-2">
            <Clock className="w-3 h-3" /> Carried Over ({delayedCards.length})
          </p>
          <p className="text-[10px] text-muted-foreground">These battles were delayed in a previous round and must be resolved.</p>
          {delayedCards.map(card => (
            <BattleCardRow
              key={card.id}
              card={card}
              players={players}
              mapDef={mapDef}
              campaignId={campaign.id}
            />
          ))}
        </div>
      )}

      {/* Battle card list */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading battles…
        </div>
      ) : currentRoundCards.length === 0 ? (
        <p className="text-xs text-muted-foreground">No battle cards for this round.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Round {round} Battles
          </p>
          {currentRoundCards.map(card => (
            <BattleCardRow
              key={card.id}
              card={card}
              players={players}
              mapDef={mapDef}
              campaignId={campaign.id}
            />
          ))}
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div className="pt-2 border-t border-border space-y-2">
          {allResolved ? (
            <button
              onClick={handleProcessEnd}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary transition-all disabled:opacity-40"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Advance to Fortify
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{pendingCount} battle{pendingCount !== 1 ? 's' : ''} pending resolution.</p>
              <button
                onClick={handleProcessEnd}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Force Advance (auto-resolve pending)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}