/**
 * BattleInfoPanel — right-dock panel during battle phase.
 * Shows a summary of battle progress and the public event log.
 */
import { Swords, RefreshCw, Loader2 } from 'lucide-react';
import { useBattleCards } from '@/features/campaigns/battle';
import { useSetupLogs } from '@/features/campaigns/setup';
import { PLAYER_COLORS } from '@/config/theme';
import BattleTypeTag from './BattleTypeTag';
import BattleStatusTag from './BattleStatusTag';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

const EVENT_LABELS = {
  battle_card_generated:   'Battle card generated',
  battle_result_submitted: 'Result submitted',
  battle_result_approved:  'Result approved',
  battle_auto_resolved:    'Auto-resolved',
  player_eliminated:       'Player eliminated',
  phase_advanced:          'Phase advanced → Fortify',
};

export default function BattleInfoPanel({ campaign, players }) {
  const round = campaign?.current_round ?? 1;

  const { cards, loading: loadingCards, reload: reloadCards } = useBattleCards({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  const { logs, loading: loadingLogs, reload: reloadLogs } = useSetupLogs({
    campaignId: campaign?.id,
    phase: 'battle',
  });

  const handleRefresh = () => { reloadCards(); reloadLogs(); };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
          <Swords className="w-3.5 h-3.5" />
          Battle Summary
        </p>
        <button onClick={handleRefresh} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Status overview */}
      {loadingCards ? (
        <div className="h-10 bg-muted/50 rounded animate-pulse" />
      ) : (
        <div className="space-y-1.5">
          {cards.map(card => {
            const targetName = card.target_territory_id?.replace(/_/g, ' ') ?? '—';
            return (
              <div key={card.id} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded border border-border bg-muted/10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BattleTypeTag type={card.battle_type} />
                    <span className="text-foreground capitalize truncate">{targetName}</span>
                  </div>
                </div>
                <BattleStatusTag status={card.status} />
              </div>
            );
          })}
          {cards.length === 0 && <p className="text-xs text-muted-foreground">No battles this round.</p>}
        </div>
      )}

      {/* Event log */}
      <div className="space-y-2 pt-2 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Event Log</p>
        {loadingLogs ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => {
              const label = EVENT_LABELS[log.event_type] ?? log.event_type;
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
                      {label}
                      {log.payload?.target_territory_id && (
                        <span className="text-muted-foreground"> — {log.payload.target_territory_id.replace(/_/g, ' ')}</span>
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
        )}
      </div>
    </div>
  );
}