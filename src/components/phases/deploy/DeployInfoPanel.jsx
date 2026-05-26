/**
 * DeployInfoPanel — right-dock panel during deploy phase.
 * Shows public information only: income for all players, lock count, public logs.
 * Never shows staged placements.
 */
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { useDeployIncome } from '@/features/campaigns/deploy';
import { useSetupLogs } from '@/features/campaigns/setup';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#666';
}

const EVENT_LABELS = {
  phase_started:  'Deploy phase started',
  troop_staged:   'Staging troops',     // is_public=false — won't appear
  player_locked:  'Locked deployment',
  auto_submitted: 'Auto-submitted',     // is_public=false — won't appear
  phase_advanced: 'Reveal → Attack phase begins',
};

export default function DeployInfoPanel({ campaign, players }) {
  const round = campaign?.current_round ?? 1;

  const { incomes, loading: loadingIncome, reload: reloadIncome } = useDeployIncome({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  // Reuse SetupLog for the deploy phase — it's the same entity used for all phase events
  const { logs, loading: loadingLogs, reload: reloadLogs } = useSetupLogs({
    campaignId: campaign?.id,
    phase: 'deploy',
  });

  const activePlayers = players.filter(p => !p.is_eliminated);

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Round {round} — Deploy
        </p>
        <button
          onClick={() => { reloadIncome(); reloadLogs(); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Public income */}
      <div className="space-y-1.5">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Income This Round</p>
        {loadingIncome
          ? <div className="h-8 bg-muted/50 rounded animate-pulse" />
          : incomes.length === 0
            ? <p className="text-xs text-muted-foreground">Deploy not started yet.</p>
            : activePlayers.map(p => {
                const inc = incomes.find(i => i.player_id === p.id);
                if (!inc) return null;
                return (
                  <div key={p.id} className="flex items-center justify-between text-xs px-3 py-1.5 rounded border border-border bg-muted/20">
                    <span className="text-foreground">{p.display_name}</span>
                    <span className="font-mono font-bold text-status-info">+{inc.total}</span>
                  </div>
                );
              })
        }
      </div>

      {/* Public event log */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Event Log</p>
        </div>
        {loadingLogs
          ? <div className="flex items-center gap-2 text-muted-foreground text-xs py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
          : logs.length === 0
            ? <p className="text-xs text-muted-foreground">No public events yet.</p>
            : (
              <div className="space-y-2">
                {logs.map(log => {
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
                          {EVENT_LABELS[log.event_type] ?? log.event_type}
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