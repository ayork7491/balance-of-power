/**
 * BattlePanel — left-dock panel during battle phase.
 *
 * Shows:
 *   - Tally-all admin button (closes voting for all cards at once)
 *   - "Your Battles" section with inline preference dropdowns
 *   - "Other Battles" read-only section
 *   - Carried-over cards section
 *   - Phase advance controls
 */
import { Loader2, Swords, Check, RefreshCw, Clock, Shield, Zap, Users } from 'lucide-react';
import { useBattleCards } from '@/features/campaigns/battle';
import { base44 } from '@/api/base44Client';
import BattleCardRow from './BattleCardRow';
import { useState } from 'react';
import { PLAYER_COLORS } from '@/config/theme';

const PREF_OPTIONS = [
  { key: 'play_tabletop', label: 'Play Tabletop', color: 'text-status-locked' },
  { key: 'auto_resolve',  label: 'Auto-Resolve',  color: 'text-status-info' },
  { key: 'delay',         label: 'Delay',          color: 'text-yellow-400' },
  { key: 'forfeit',       label: 'Forfeit',         color: 'text-destructive' },
];

function prefLabel(pref) {
  return PREF_OPTIONS.find(o => o.key === pref)?.label ?? 'Play Tabletop';
}
function prefColor(pref) {
  return PREF_OPTIONS.find(o => o.key === pref)?.color ?? 'text-muted-foreground';
}
function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

/** Inline preference dropdown for a single battle card */
function InlinePreferenceRow({ card, players, effectivePlayerId, campaignId, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const prefs = card.battle_preferences ?? {};
  // null = no preference submitted yet (shows placeholder)
  const myPref = prefs[effectivePlayerId] ?? null;

  const participantIds = [
    ...(card.attackers ?? []).map(a => a.player_id),
    ...(card.defender_player_id ? [card.defender_player_id] : []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const handleChange = async (e) => {
    const pref = e.target.value;
    if (!pref) return; // placeholder selected — ignore
    if (pref === 'forfeit') {
      const player = players.find(p => p.id === effectivePlayerId);
      if (!window.confirm(`Forfeit as ${player?.display_name ?? 'you'}? You will lose all committed troops.`)) return;
    }
    setLoading(true);
    // Optimistic update — patch card locally before API returns
    onUpdated?.(card.id, {
      battle_preferences: { ...prefs, [effectivePlayerId]: pref },
    });
    await base44.functions.invoke('battlePhase', {
      action: 'setPreference',
      campaign_id: campaignId,
      battle_card_id: card.id,
      preference: pref,
      acting_as_player_id: effectivePlayerId,
    });
    setLoading(false);
  };

  const votingClosed = card.voting_closed;
  const canVote = ['pending', 'awaiting_result', 'active_carryover'].includes(card.status) && !votingClosed;

  return (
    <div className="space-y-1">
      {/* Other participants' status (blind) */}
      <div className="flex gap-1 flex-wrap">
        {participantIds.map(pid => {
          const p   = players.find(pl => pl.id === pid);
          const hex = getPlayerHex(players, pid);
          const isMe = pid === effectivePlayerId;
          const pref = prefs[pid] ?? null;
          return (
            <span key={pid} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/10">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
              {p?.display_name ?? '?'}
              {isMe && pref
                ? <span className={`font-medium ${prefColor(pref)}`}> · {prefLabel(pref)}</span>
                : isMe
                ? <span className="text-muted-foreground/50"> · no preference submitted</span>
                : pref
                ? <span className="text-status-locked"> · set</span>
                : <span className="text-muted-foreground/40"> · waiting</span>
              }
            </span>
          );
        })}
      </div>

      {/* Preference selector */}
      {canVote ? (
        <div className="flex items-center gap-2">
          <select
            value={myPref ?? ''}
            onChange={handleChange}
            disabled={loading}
            className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="" disabled>Select resolution preference</option>
            {PREF_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
      ) : votingClosed ? (
        <p className="text-[10px] text-muted-foreground italic">Voting closed.</p>
      ) : null}
    </div>
  );
}

/** Compact battle card row with inline voting for the current player */
function BattleCardVoteRow({ card, players, mapDef, campaignId, effectivePlayerId, onUpdated }) {
  const targetName = mapDef?.territories?.find(t => t.territory_id === card.target_territory_id)?.name
    ?? card.target_territory_id ?? '—';

  const attackerNames = (card.attackers ?? []).map(a => {
    return players.find(p => p.id === a.player_id)?.display_name ?? '?';
  }).join(', ');
  const defenderName = card.defender_player_id
    ? (players.find(p => p.id === card.defender_player_id)?.display_name ?? '?')
    : null;

  const typeLabel = {
    siege: 'Siege', double_siege: 'Double Siege', skirmish: 'Skirmish',
    capture_objectives: 'Objectives', bloodbath: 'Bloodbath',
  }[card.battle_type] ?? card.battle_type;

  const isCarryover = ['active_carryover', 'pending_approval'].includes(card.status);

  return (
    <div className={`rounded border px-3 py-2.5 space-y-2 ${isCarryover ? 'border-orange-500/40 bg-orange-950/20' : 'border-border bg-muted/10'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{targetName}</p>
          <p className="text-[10px] text-muted-foreground">
            {typeLabel} · {attackerNames}{defenderName ? ` vs ${defenderName}` : ''}
          </p>
          {isCarryover && (
            <p className="text-[10px] text-orange-400">Carried over from Round {card.round}</p>
          )}
          {card.result?.conversion_history && (
            <p className="text-[10px] text-yellow-400">
              ⚔ {card.result.conversion_history.reason}
            </p>
          )}
        </div>
        <span className="text-[10px] text-primary font-mono shrink-0">{card.tabletop_size ?? 0} pts</span>
      </div>
      <InlinePreferenceRow
        card={card}
        players={players}
        effectivePlayerId={effectivePlayerId}
        campaignId={campaignId}
        onUpdated={onUpdated}
      />
    </div>
  );
}

export default function BattlePanel({ campaign, players, myPlayer, mapDef, onPhaseChanged }) {
  const round   = campaign?.current_round ?? 1;
  const isAdmin = myPlayer?.is_admin;
  const [processing, setProcessing]   = useState(false);
  const [tallying, setTallying]       = useState(false);
  const [tallyResult, setTallyResult] = useState(null);

  const { cards, delayedCards, loading, reload, updateCard } = useBattleCards({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  const currentRoundCards = cards.filter(c => c.round === round);
  const UNRESOLVED_STATUSES = ['pending','awaiting_result','result_submitted','awaiting_approval','active_carryover','pending_approval'];
  const pendingCount  = cards.filter(c => UNRESOLVED_STATUSES.includes(c.status)).length;
  const resolvedCount = cards.filter(c => ['resolved','auto_resolved','forfeited'].includes(c.status)).length;
  const resolvedCarriedOver = cards.filter(c => c.round !== round && ['resolved','auto_resolved','forfeited'].includes(c.status));
  const hasUnresolvedCarryover = delayedCards.some(c => ['active_carryover','pending_approval','awaiting_approval','result_submitted'].includes(c.status));
  const allResolved   = cards.length > 0 && pendingCount === 0 && delayedCards.length === 0;

  // Determine effective player id (from perspective selector via myPlayer)
  const effectivePlayerId = myPlayer?.id ?? null;

  // Split cards into "mine" vs "other" based on participation
  const VOTABLE_STATUSES = ['pending', 'awaiting_result', 'active_carryover'];
  const activeCards = [...currentRoundCards, ...delayedCards.filter(c => c.round !== round)];

  const myCards    = activeCards.filter(c =>
    effectivePlayerId && (
      (c.attackers ?? []).some(a => a.player_id === effectivePlayerId) ||
      c.defender_player_id === effectivePlayerId
    )
  );
  const otherCards = activeCards.filter(c =>
    !effectivePlayerId || (
      !(c.attackers ?? []).some(a => a.player_id === effectivePlayerId) &&
      c.defender_player_id !== effectivePlayerId
    )
  );

  // Cards still open for voting (not yet closed)
  const tallyCandidates = activeCards.filter(c =>
    VOTABLE_STATUSES.includes(c.status) && !c.voting_closed
  );

  const handleTallyAll = async () => {
    setTallying(true);
    setTallyResult(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'tallyAllCards',
      campaign_id: campaign.id,
    });
    setTallying(false);
    if (res.data?.success) {
      setTallyResult(res.data);
      await reload();
    }
  };

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

      {/* Admin: Tally All button */}
      {isAdmin && tallyCandidates.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={handleTallyAll}
            disabled={tallying}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-warning text-warning text-xs font-display tracking-widest uppercase hover:bg-warning/10 transition-all disabled:opacity-40"
          >
            {tallying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Close Battle Voting &amp; Tally All Cards
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Tallies preferences for all {tallyCandidates.length} open battle{tallyCandidates.length !== 1 ? 's' : ''}.
          </p>
          {tallyResult && (
            <p className="text-[10px] text-status-locked text-center">
              ✓ Tallied {tallyResult.tallied} card{tallyResult.tallied !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      )}

      {/* Your Battles */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading battles…
        </div>
      ) : (
        <>
          {myCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <Shield className="w-3 h-3 text-primary" /> Your Battles
              </p>
              {myCards.map(card => (
                VOTABLE_STATUSES.includes(card.status) && !card.voting_closed ? (
                  <BattleCardVoteRow
                    key={card.id}
                    card={card}
                    players={players}
                    mapDef={mapDef}
                    campaignId={campaign.id}
                    effectivePlayerId={effectivePlayerId}
                    onUpdated={updateCard}
                  />
                ) : (
                  <BattleCardRow key={card.id} card={card} players={players} mapDef={mapDef} campaignId={campaign.id} />
                )
              ))}
            </div>
          )}

          {otherCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <Users className="w-3 h-3" /> Other Battles
              </p>
              {otherCards.map(card => (
                <BattleCardRow key={card.id} card={card} players={players} mapDef={mapDef} campaignId={campaign.id} />
              ))}
            </div>
          )}

          {myCards.length === 0 && otherCards.length === 0 && currentRoundCards.length === 0 && (
            <p className="text-xs text-muted-foreground">No battle cards for this round.</p>
          )}
        </>
      )}

      {/* Resolved carried-over battles */}
      {resolvedCarriedOver.length > 0 && (
        <div className="rounded border border-border bg-muted/5 p-3 space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-2">
            <Check className="w-3 h-3 text-status-locked" /> Resolved Carried-Over ({resolvedCarriedOver.length})
          </p>
          {resolvedCarriedOver.map(card => (
            <BattleCardRow key={card.id} card={card} players={players} mapDef={mapDef} campaignId={campaign.id} />
          ))}
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div className="pt-2 border-t border-border space-y-2">
          {hasUnresolvedCarryover && (
            <p className="text-xs text-orange-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Resolve all carried-over battles before advancing.
            </p>
          )}
          {allResolved && !hasUnresolvedCarryover ? (
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
                disabled={processing || hasUnresolvedCarryover}
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