/**
 * LeaderboardPanel — right dock panel showing player rankings + victory progress.
 */
import { useMemo } from 'react';
import { useLeaderboard } from '@/features/campaigns/leaderboard/useLeaderboard';
import { Trophy, Users, Shield, TrendingUp } from 'lucide-react';
import PlayerColorDot from '@/components/ui/PlayerColorDot';
import VictoryProgressPanel from '@/components/campaigns/VictoryProgressPanel';
import VictorySummaryPanel from '@/components/campaigns/VictorySummaryPanel';

export default function LeaderboardPanel({ campaign, players, trackers = [], thresholds }) {
  const { leaderboard, isLoading, error } = useLeaderboard(campaign?.id);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-xs text-destructive">
        Error loading leaderboard: {error}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">
          Campaign Standings
        </p>
      </div>

      {/* Victory Summary + Progress */}
      <div className="-mx-4 border-b border-border mb-3">
        <VictorySummaryPanel trackers={trackers} players={players} thresholds={thresholds} />
      </div>

      {leaderboard.length === 0 ? (
        <p className="text-xs text-muted-foreground">No standings available yet</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((player, idx) => (
            <div
              key={player.player_id}
              className={`p-2 rounded border text-xs ${
                player.is_eliminated 
                  ? 'bg-muted/20 border-border opacity-60' 
                  : 'bg-muted/10 border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs ${
                    idx === 0 ? 'bg-primary/20 text-primary' :
                    idx === 1 ? 'bg-muted/30 text-foreground' :
                    idx === 2 ? 'bg-muted/20 text-foreground' :
                    'bg-muted/10 text-muted-foreground'
                  }`}>
                    {idx === 0 ? <Trophy className="w-3 h-3" /> : `#${player.rank}`}
                  </div>
                  <PlayerColorDot color={player.color} size="sm" />
                  <span className={`font-medium ${player.is_eliminated ? 'line-through' : ''}`}>
                    {player.display_name}
                  </span>
                </div>
                {player.is_eliminated && (
                  <span className="text-xs text-muted-foreground">Eliminated</span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>{player.territory_count} territories</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{player.troop_total} troops</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{player.deploy_income} income</span>
                </div>
                {player.faction_name && (
                  <div className="text-xs truncate">
                    {player.faction_name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}