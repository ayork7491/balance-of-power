/**
 * BattlePreferencePanel — single-choice battle resolution preference per player.
 *
 * Replaces separate delay/auto-resolve/forfeit vote buttons.
 * Preferences are blind until voting closes (admin/debug can reveal).
 *
 * Options:
 *   play_tabletop — default; fight in person
 *   auto_resolve  — let the system decide (requires unanimous)
 *   delay         — push to next round (requires unanimous)
 *   forfeit       — surrender; lose committed troops
 */
import { Clock, Swords, Shield, Flag } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

const PREFERENCE_OPTIONS = [
  {
    key: 'play_tabletop',
    label: 'Play Tabletop',
    icon: Shield,
    activeClass: 'border-status-locked bg-status-locked/10 text-status-locked',
    hint: 'Fight the battle in person (default).',
  },
  {
    key: 'auto_resolve',
    label: 'Auto-Resolve',
    icon: Swords,
    activeClass: 'border-status-info bg-status-info/10 text-status-info',
    hint: 'Requires all players to agree. Weighted random result.',
  },
  {
    key: 'delay',
    label: 'Delay',
    icon: Clock,
    activeClass: 'border-yellow-500 bg-yellow-900/20 text-yellow-400',
    hint: 'Requires all players to agree. Carries battle to next round.',
  },
  {
    key: 'forfeit',
    label: 'Forfeit',
    icon: Flag,
    activeClass: 'border-destructive bg-destructive/10 text-destructive',
    hint: 'Surrender. You lose your committed troops.',
  },
];

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

function prefLabel(pref) {
  return PREFERENCE_OPTIONS.find(o => o.key === pref)?.label ?? pref;
}

/** Shows the tally result once voting is closed. */
function TallyResult({ tally }) {
  if (!tally?.outcome) return null;
  const outcomeLabels = {
    auto_resolve: { label: 'Auto-Resolve', color: 'text-status-info' },
    delay: { label: 'Delayed', color: 'text-yellow-400' },
    tabletop: { label: 'Play Tabletop', color: 'text-status-locked' },
    forfeit_only: { label: 'Forfeit(s) Applied', color: 'text-destructive' },
  };
  const cfg = outcomeLabels[tally.outcome] ?? { label: tally.outcome, color: 'text-muted-foreground' };
  return (
    <div className="px-2 py-1.5 rounded border border-border bg-muted/10 text-xs">
      <span className="text-muted-foreground">Tally outcome: </span>
      <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}

export function PreferenceRecord({ card, players, participantIds }) {
  const prefs = card.battle_preferences ?? {};
  if (Object.keys(prefs).length === 0) return null;
  return (
    <div className="panel p-3 space-y-1.5">
      <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-2">
        <Shield className="w-3 h-3" /> Battle Preferences
      </p>
      {participantIds.map(pid => {
        const pref = prefs[pid] ?? 'play_tabletop';
        const p = players.find(pl => pl.id === pid);
        const hex = getPlayerHex(players, pid);
        const opt = PREFERENCE_OPTIONS.find(o => o.key === pref);
        return (
          <div key={pid} className="flex items-center gap-2 text-xs px-2 py-1 rounded border border-border bg-muted/10">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
            <span className="flex-1">{p?.display_name ?? '?'}</span>
            <span className={`font-medium ${opt?.activeClass?.split(' ').find(c => c.startsWith('text-')) ?? 'text-foreground'}`}>
              {prefLabel(pref)}
            </span>
          </div>
        );
      })}
      <TallyResult tally={card.tally_result} />
    </div>
  );
}

export default function BattlePreferencePanel({
  card,
  players,
  participantIds,
  effectivePlayer,
  actingAsId,
  myPreference,
  votingClosed,
  canSetPreference,
  actionLoading,
  isAdmin,
  onSetPreference,
  onCloseVoting,
}) {
  const prefs = card.battle_preferences ?? {};
  const votingClosesAt = card.voting_closes_at ? new Date(card.voting_closes_at) : null;

  // How many participants have set a non-default preference
  const votedCount = participantIds.filter(pid => prefs[pid] && prefs[pid] !== 'play_tabletop').length;

  return (
    <div className="panel p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Battle Preference</p>
        {votingClosesAt && !votingClosed && (
          <p className="text-[10px] text-muted-foreground">
            Voting closes {votingClosesAt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {votingClosed ? (
        <PreferenceRecord card={card} players={players} participantIds={participantIds} />
      ) : (
        <>
          {/* Participant status — preferences are blind until closed */}
          <div className="space-y-1">
            {participantIds.map(pid => {
              const pref = prefs[pid];
              const p = players.find(pl => pl.id === pid);
              const hex = getPlayerHex(players, pid);
              const isMe = pid === effectivePlayer?.id;
              return (
                <div key={pid} className="flex items-center gap-2 text-xs px-2 py-1 rounded border border-border bg-muted/10">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  <span className="flex-1">{p?.display_name ?? '?'}</span>
                  {/* Show own selection; others are blind until closed */}
                  {isMe && pref
                    ? <span className="font-medium text-primary">{prefLabel(pref)}</span>
                    : isMe
                    ? <span className="text-muted-foreground/60 italic">Not set (Play Tabletop)</span>
                    : pref
                    ? <span className="text-status-locked font-medium">Preference set</span>
                    : <span className="text-muted-foreground/50 italic">No preference yet</span>
                  }
                </div>
              );
            })}
          </div>

          {/* Preference buttons — one active at a time */}
          {canSetPreference && (
            <div className="grid grid-cols-2 gap-2">
              {PREFERENCE_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isActive = myPreference === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => onSetPreference(opt.key)}
                    disabled={actionLoading}
                    title={opt.hint}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded border text-xs font-display tracking-widest uppercase transition-all disabled:opacity-40 ${
                      isActive
                        ? opt.activeClass
                        : 'border-border bg-muted/10 text-muted-foreground hover:bg-muted/20'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {opt.label}
                    {actingAsId && effectivePlayer && isActive ? ` ✓` : ''}
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            {votedCount}/{participantIds.length} players set a preference.
            Unanimous auto-resolve or delay triggers automatically when voting closes.
          </p>

          {/* Admin: manual close voting */}
          {isAdmin && (
            <button
              onClick={onCloseVoting}
              disabled={actionLoading}
              className="w-full px-3 py-2 rounded border border-warning text-warning text-xs font-display tracking-widest uppercase hover:bg-warning/10 transition-all disabled:opacity-40"
            >
              Close Voting &amp; Tally Now
            </button>
          )}
        </>
      )}
    </div>
  );
}