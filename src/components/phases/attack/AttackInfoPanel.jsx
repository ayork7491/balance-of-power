/**
 * AttackInfoPanel — right-dock panel during attack phase.
 *
 * Shows PUBLIC information only:
 *   - Lock status (who has locked, no attack data)
 *   - Public event log (lock events, phase_advanced, skirmish_resolved)
 *   - After reveal: revealed attack summary (AttackReveal records)
 *
 * Never shows:
 *   - Other players' staged attack targets or troop counts before reveal.
 */
import { Swords, RefreshCw, Loader2, Lock } from 'lucide-react';
import { useAttackLockStatus, useAttackReveals } from '@/features/campaigns/attack';
import { useSetupLogs } from '@/features/campaigns/setup';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#666';
}

const EVENT_LABELS = {
  player_locked:          'Locked attacks',
  auto_submitted:         'Auto-submitted (skipped)',
  phase_advanced:         'Reveal → Battle phase begins',
  skirmish_resolved:      'Skirmish auto-resolved',
  battle_card_generated:  'Battle card generated',
  attack_staged:          null, // private — won't appear
};

function TerritoryName({ id, mapDef }) {
  const name = mapDef?.territories.find(t => t.territory_id === id)?.name ?? id;
  return <span className="font-medium">{name}</span>;
}

export default function AttackInfoPanel({ campaign, players, mapDef }) {
  const round = campaign?.current_round ?? 1;

  const { lockStatus, loading: loadingLocks, reload: reloadLocks } = useAttackLockStatus({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  const { reveals, loading: loadingReveals, reload: reloadReveals } = useAttackReveals({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  const { logs, loading: loadingLogs, reload: reloadLogs } = useSetupLogs({
    campaignId: campaign?.id,
    phase: 'attack',
  });

  const activePlayers = players.filter(p => !p.is_eliminated);
  const lockedCount   = lockStatus.filter(s => s.is_locked).length;
  const hasReveals    = reveals.length > 0;

  const handleRefresh = () => {
    reloadLocks();
    reloadReveals();
    reloadLogs();
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
          <Swords className="w-3.5 h-3.5" />
          Round {round} — Attack
        </p>
        <button onClick={handleRefresh} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Lock status */}
      <div className="space-y-1.5">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Lock Status — {lockedCount}/{activePlayers.length}
        </p>
        {loadingLocks
          ? <div className="h-8 bg-muted/50 rounded animate-pulse" />
          : activePlayers.map(p => {
              const status = lockStatus.find(s => s.player_id === p.id);
              const locked = status?.is_locked ?? false;
              return (
                <div key={p.id} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-border bg-muted/20">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: getPlayerHex(players, p.id) }}
                  />
                  <span className={locked ? 'text-foreground' : 'text-muted-foreground flex-1'}>
                    {p.display_name}
                  </span>
                  {locked
                    ? <span className="ml-auto text-status-locked text-xs flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</span>
                    : <span className="ml-auto text-muted-foreground/50 text-xs">Staging…</span>
                  }
                </div>
              );
            })
        }
      </div>

      {/* Revealed attacks (post-reveal only) */}
      {hasReveals && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Revealed Attacks</p>
          {loadingReveals
            ? <div className="h-8 bg-muted/50 rounded animate-pulse" />
            : reveals.map((r, i) => {
                const attacker = players.find(p => p.id === r.player_id);
                const hex      = getPlayerHex(players, r.player_id);
                return (
                  <div key={i} className="flex items-start gap-2 text-xs px-2.5 py-1.5 rounded border border-border bg-muted/10">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: hex }} />
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{attacker?.display_name ?? '?'}</span>
                      {' attacked '}
                      <TerritoryName id={r.target_territory_id} mapDef={mapDef} />
                      {' from '}
                      <TerritoryName id={r.origin_territory_id} mapDef={mapDef} />
                      <span className="text-status-danger font-mono ml-1">({r.committed_troops})</span>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* Public event log */}
      <div className="space-y-2 pt-2 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Event Log</p>
        {loadingLogs
          ? <div className="flex items-center gap-2 text-muted-foreground text-xs py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
          : logs.length === 0
            ? <p className="text-xs text-muted-foreground">No public events yet.</p>
            : (
              <div className="space-y-2">
                {logs.map(log => {
                  const label = EVENT_LABELS[log.event_type];
                  if (label === null) return null; // private event
                  const player = log.player_id ? players.find(p => p.id === log.player_id) : null;
                  const hex    = player ? getPlayerHex(players, player.id) : null;
                  return (
                    <div key={log.id} className="flex gap-2 text-xs">
                      <div
                        className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/40"
                        style={hex ? { backgroundColor: hex } : {}}
                      />
                      <div className="min-w-0">
                        <span className="text-foreground">
                          {player && <span className="font-medium">{player.display_name} </span>}
                          {label ?? log.event_type}
                          {log.payload?.target_territory_id && (
                            <span className="text-muted-foreground"> — <TerritoryName id={log.payload.target_territory_id} mapDef={mapDef} /></span>
                          )}
                        </span>
                        <p className="text-muted-foreground/50 text-xs">
                          {new Date(log.created_date).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
        }
      </div>
    </div>
  );
}