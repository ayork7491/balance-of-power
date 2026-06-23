/**
 * VictoryProgressPanel — Sprint 5A
 *
 * Shows each player's progress toward all three victory conditions.
 * Driven by VictoryTracker records fetched from victoryPhase backend.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { VICTORY_PILLAR_CONFIG, VICTORY_THRESHOLDS } from '@/config/victoryConfig';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#64748b';
}

function ScoreBar({ score, threshold, barColor }) {
  const pct = Math.min(100, Math.round((score / threshold) * 100));
  return (
    <div className="w-full bg-muted/20 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PlayerVictoryRow({ tracker, player, thresholds }) {
  const hex = getPlayerHex([player], player?.id);
  if (!tracker || !player) return null;

  const pillars = [
    { key: 'military',   score: tracker.occupancy_score  ?? 0, ...VICTORY_PILLAR_CONFIG.military },
    { key: 'economic',   score: tracker.wealth_score     ?? 0, ...VICTORY_PILLAR_CONFIG.economic },
    { key: 'diplomatic', score: tracker.diplomatic_score ?? (tracker.influence_score ?? 0), ...VICTORY_PILLAR_CONFIG.diplomatic },
  ];

  return (
    <div className="px-3 py-2.5 border-b border-border last:border-0">
      {/* Player header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: hex }} />
        <span className="text-xs font-display tracking-wide text-foreground">{player.display_name}</span>
        {tracker.has_won && <Trophy className="w-3 h-3 text-primary ml-auto" />}
      </div>

      {/* Per-pillar scores */}
      <div className="space-y-1.5">
        {pillars.map(pillar => {
          const threshold = thresholds[pillar.key];
          const pct = Math.min(100, Math.round((pillar.score / threshold) * 100));
          const met = pillar.score >= threshold;
          return (
            <div key={pillar.key} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className={`flex items-center gap-1 ${pillar.color}`}>
                  {pillar.icon} {pillar.scoreLabel}
                </span>
                <span className={`font-mono ${met ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  {pillar.score.toLocaleString()} / {threshold.toLocaleString()} ({pct}%)
                </span>
              </div>
              <ScoreBar score={pillar.score} threshold={threshold} barColor={met ? 'bg-primary' : pillar.barColor} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VictoryProgressPanel({ campaign, players, enabled = false }) {
  const [trackers, setTrackers] = useState([]);
  const [thresholds, setThresholds] = useState(VICTORY_THRESHOLDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!campaign?.id || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('victoryPhase', {
        action: 'getScores',
        campaign_id: campaign.id,
      });
      setTrackers(res.data?.trackers ?? []);
      if (res.data?.thresholds) setThresholds(res.data.thresholds);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load victory scores.');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id]);

  useEffect(() => { if (enabled) load(); }, [load, enabled]);

  const activePlayers = players?.filter(p => !p.is_eliminated) ?? [];

  return (
    <div className="px-0 pt-0 pb-2">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <Trophy className="w-3 h-3" /> Victory Progress
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive px-3 py-2">{error}</p>}

      {loading && trackers.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : trackers.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-3 italic">
          Victory scores are calculated at the end of each Consolidation Phase.
        </p>
      ) : (
        <div>
          {activePlayers.map(player => {
            const tracker = trackers.find(t => t.player_id === player.id);
            return (
              <PlayerVictoryRow
                key={player.id}
                tracker={tracker ?? { occupancy_score: 0, wealth_score: 0, influence_score: 0 }}
                player={player}
                thresholds={thresholds}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}