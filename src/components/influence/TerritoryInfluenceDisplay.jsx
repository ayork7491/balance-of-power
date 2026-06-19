/**
 * TerritoryInfluenceDisplay — Sprint 4G
 *
 * Shows Permanent Influence per player in a territory.
 * Displays threshold progress bar (spread triggers at threshold).
 *
 * Props:
 *   influenceRecords  — [{ player_id, influence_amount }] for this territory
 *   players           — CampaignPlayer[]
 *   spreadThreshold   — number (default 10)
 */
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerColor(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

function getPlayerName(players, playerId) {
  return players?.find(p => p.id === playerId)?.display_name ?? 'Unknown';
}

export default function TerritoryInfluenceDisplay({ influenceRecords, players, spreadThreshold = 10 }) {
  // Records with null influence_amount are hidden (other players' data — privacy gate)
  const records = (influenceRecords ?? []).filter(r => r.influence_amount != null && r.influence_amount > 0);
  const hiddenCount = (influenceRecords ?? []).filter(r => r.influence_amount === null).length;

  if (records.length === 0 && hiddenCount === 0) {
    return <p className="text-xs text-muted-foreground italic">No influence present</p>;
  }

  const sorted = [...records].sort((a, b) => (b.influence_amount ?? 0) - (a.influence_amount ?? 0));
  const leaderId = sorted[0]?.player_id;

  return (
    <div className="space-y-1.5">
      {sorted.map(r => {
        const isLeader = r.player_id === leaderId;
        const color = getPlayerColor(players, r.player_id);
        const name = getPlayerName(players, r.player_id);
        const pct = Math.min(100, Math.round(((r.influence_amount ?? 0) / spreadThreshold) * 100));
        const atThreshold = (r.influence_amount ?? 0) >= spreadThreshold;

        return (
          <div key={r.player_id} className="space-y-0.5">
            <div className={`flex items-center justify-between text-xs px-2 py-1 rounded border ${isLeader ? 'border-accent/40 bg-accent/10' : 'border-border bg-muted/10'}`}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className={isLeader ? 'text-accent font-medium' : 'text-muted-foreground'}>{name}</span>
                {isLeader && <span className="text-[10px] text-accent/70">★</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`font-mono font-bold text-xs ${isLeader ? 'text-accent' : 'text-foreground/70'}`}>
                  {r.influence_amount}
                </span>
                {atThreshold && (
                  <span className="text-[9px] text-status-locked font-bold px-1 py-0.5 rounded bg-status-locked/10 border border-status-locked/30">
                    ↗ spread
                  </span>
                )}
              </div>
            </div>
            <div className="px-2">
              <div className="w-full h-1 rounded-full bg-muted/30 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${atThreshold ? 'bg-status-locked' : 'bg-accent/50'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
                <span>Spread at {spreadThreshold}</span>
                <span>{pct}%</span>
              </div>
            </div>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <p className="text-[10px] text-muted-foreground/60 italic px-1">
          +{hiddenCount} hidden (requires Investigate Influence)
        </p>
      )}
    </div>
  );
}