/**
 * VictorySummaryPanel — Sprint 5A
 *
 * Shows the current leader per pillar, their score, and ranking.
 * Auto-refreshes with the parent leaderboard load.
 */
import { useMemo } from 'react';
import { Crown, TrendingUp } from 'lucide-react';
import { VICTORY_PILLAR_CONFIG, VICTORY_THRESHOLDS } from '@/config/victoryConfig';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#64748b';
}

function LeaderCard({ pillarKey, trackers, players, thresholds }) {
  const cfg = VICTORY_PILLAR_CONFIG[pillarKey];
  const scoreKey = pillarKey === 'military' ? 'occupancy_score' : pillarKey === 'economic' ? 'wealth_score' : 'influence_score';
  const threshold = thresholds[pillarKey];

  const ranked = useMemo(() => {
    return [...trackers]
      .map(t => ({ ...t, score: t[scoreKey] ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }, [trackers, scoreKey]);

  const leader = ranked[0];
  if (!leader) return null;

  const leaderPlayer = players?.find(p => p.id === leader.player_id);
  const hex = getPlayerHex(players, leader.player_id);
  const pct = Math.min(100, Math.round((leader.score / threshold) * 100));
  const met = leader.score >= threshold;

  return (
    <div className={`rounded border ${cfg.borderColor} ${cfg.bgColor} p-2.5`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{cfg.icon}</span>
        <span className={`text-[10px] font-display tracking-wider uppercase font-semibold ${cfg.color}`}>
          {cfg.label} Leader
        </span>
        {met && <Crown className="w-3 h-3 text-primary ml-auto" />}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: hex }} />
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {leaderPlayer?.display_name ?? '—'}
        </span>
        <span className={`text-[10px] font-mono font-bold ${met ? 'text-primary' : cfg.color}`}>
          {leader.score.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-1.5 w-full bg-muted/20 rounded-full h-1 overflow-hidden">
        <div
          className={`h-1 rounded-full transition-all duration-500 ${met ? 'bg-primary' : cfg.barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
        <span>{pct}% of {threshold.toLocaleString()}</span>
        <span>#{1} of {ranked.length}</span>
      </div>

      {/* Top 3 mini-ranks */}
      {ranked.length > 1 && (
        <div className="mt-1.5 space-y-0.5">
          {ranked.slice(1, 3).map((t, i) => {
            const pl = players?.find(p => p.id === t.player_id);
            const h = getPlayerHex(players, t.player_id);
            return (
              <div key={t.player_id} className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <span className="font-mono w-3">#{i + 2}</span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: h }} />
                <span className="truncate flex-1">{pl?.display_name ?? '—'}</span>
                <span className="font-mono">{t.score.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VictorySummaryPanel({ trackers = [], players = [], thresholds = VICTORY_THRESHOLDS }) {
  if (trackers.length === 0) {
    return (
      <div className="px-3 py-3 text-xs text-muted-foreground italic flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5" />
        Victory scores are calculated at the end of each Consolidation Phase.
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-2 space-y-2">
      <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
        <Crown className="w-3 h-3" /> Victory Leaders
      </p>
      <LeaderCard pillarKey="military"   trackers={trackers} players={players} thresholds={thresholds} />
      <LeaderCard pillarKey="economic"   trackers={trackers} players={players} thresholds={thresholds} />
      <LeaderCard pillarKey="diplomatic" trackers={trackers} players={players} thresholds={thresholds} />
    </div>
  );
}