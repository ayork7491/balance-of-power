/**
 * FactionSelectionPanel — left dock panel for the faction_selection setup phase.
 *
 * Shows:
 * - Randomized draft order
 * - Whose turn it is
 * - Available factions (from game profile)
 * - Selected factions per player
 * - "Select" button when it's the current user's turn
 */
import { useState } from 'react';
import { Crown, Check, Loader2, Users, ChevronRight } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';
import { base44 } from '@/api/base44Client';

function getPlayerHex(players, playerId) {
  const p = players.find(pl => pl.id === playerId);
  if (!p) return '#666';
  const pc = PLAYER_COLORS.find(c => c.id === p.color);
  return pc?.hex ?? '#666';
}

export default function FactionSelectionPanel({ campaign, players, myPlayer, gameProfile, onPhaseChanged }) {
  const [selectedFaction, setSelectedFaction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const setupOrder = campaign?.setup_order ?? [];
  const currentIdx = campaign?.setup_current_index ?? 0;
  const currentPickerId = setupOrder[currentIdx];
  const isMyTurn = currentPickerId === myPlayer?.id;

  const factions = gameProfile?.factions ?? [];
  const takenFactions = new Set(players.map(p => p.faction_name).filter(Boolean));
  const allowDuplicates = campaign?.settings?.allow_faction_duplicates ?? false;

  const handleSelect = async () => {
    if (!selectedFaction || !isMyTurn) return;
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('setupPhase', {
        action: 'selectFaction',
        campaign_id: campaign.id,
        faction_name: selectedFaction,
      });
      setSelectedFaction('');
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to submit faction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('setupPhase', {
        action: 'skipFaction',
        campaign_id: campaign.id,
      });
      onPhaseChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to skip.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      {/* Phase header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1">
        <p className="font-display text-xs tracking-widest uppercase text-violet-300">
          Faction Selection
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Players choose factions in randomized order.
        </p>
      </div>

      {/* Draft order */}
      <div className="space-y-1">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">Draft Order</p>
        {setupOrder.map((pid, i) => {
          const p = players.find(pl => pl.id === pid);
          if (!p) return null;
          const isCurrent = i === currentIdx;
          const isDone = i < currentIdx || !!p.faction_name;
          return (
            <div
              key={pid}
              className={`flex items-center gap-2 px-3 py-2 rounded text-xs transition-all ${
                isCurrent ? 'bg-violet-900/30 border border-violet-600/40' :
                isDone     ? 'opacity-50' :
                             'opacity-70'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getPlayerHex(players, pid) }} />
              <span className={`flex-1 font-display tracking-wide ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                {p.display_name}
                {p.id === myPlayer?.id && <span className="text-muted-foreground ml-1">(you)</span>}
              </span>
              {p.faction_name
                ? <span className="text-xs text-violet-300 font-medium">{p.faction_name}</span>
                : isCurrent ? <ChevronRight className="w-3 h-3 text-violet-400" /> : null
              }
              {isDone && p.faction_name && <Check className="w-3 h-3 text-status-locked" />}
            </div>
          );
        })}
      </div>

      {/* Faction picker — only when it's your turn */}
      {isMyTurn && factions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-display tracking-wider uppercase text-status-pending">Your Pick</p>
          <div className="grid gap-1.5">
            {factions.map(f => {
              const taken = !allowDuplicates && takenFactions.has(f.name) && f.name !== selectedFaction;
              return (
                <button
                  key={f.id}
                  disabled={taken || submitting}
                  onClick={() => setSelectedFaction(f.name)}
                  className={`w-full text-left px-3 py-2 rounded border text-xs transition-all ${
                    selectedFaction === f.name
                      ? 'border-primary bg-primary/10 text-foreground'
                      : taken
                        ? 'border-border/30 text-muted-foreground/30 cursor-not-allowed'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  <span className="font-display tracking-wide">{f.name}</span>
                  {taken && <span className="ml-2 text-xs opacity-50">(taken)</span>}
                  {f.description && <p className="text-muted-foreground/70 text-xs mt-0.5 leading-tight">{f.description}</p>}
                </button>
              );
            })}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSelect}
              disabled={!selectedFaction || submitting}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Confirm
            </button>
            <button
              onClick={handleSkip}
              disabled={submitting}
              className="px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* No factions configured */}
      {isMyTurn && factions.length === 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">No factions configured in this game profile. Click Skip to continue.</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Continue
          </button>
        </div>
      )}

      {/* Waiting for others */}
      {!isMyTurn && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Waiting for <span className="text-foreground font-medium">
              {players.find(p => p.id === currentPickerId)?.display_name ?? '…'}
            </span> to pick.
          </p>
        </div>
      )}
    </div>
  );
}