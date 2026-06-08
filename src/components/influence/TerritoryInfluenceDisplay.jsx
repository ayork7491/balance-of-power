/**
 * TerritoryInfluenceDisplay — Sprint 4F
 *
 * Shows influence present in a territory, grouped by player.
 * Highlights the highest-influence holder.
 * If no influence exists, shows "No influence present".
 *
 * Props:
 *   influenceRecords  — array of { player_id, influence_amount } for this territory
 *   players           — CampaignPlayer[] for name/color resolution
 */
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerColor(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

function getPlayerName(players, playerId) {
  return players?.find(p => p.id === playerId)?.display_name ?? 'Unknown';
}

export default function TerritoryInfluenceDisplay({ influenceRecords, players }) {
  const records = (influenceRecords ?? []).filter(r => (r.influence_amount ?? 0) > 0);

  if (records.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No influence present</p>
    );
  }

  // Sort descending by influence_amount to find leader
  const sorted = [...records].sort((a, b) => b.influence_amount - a.influence_amount);
  const leaderId = sorted[0].player_id;

  return (
    <div className="space-y-1">
      {sorted.map(r => {
        const isLeader = r.player_id === leaderId;
        const color = getPlayerColor(players, r.player_id);
        const name = getPlayerName(players, r.player_id);
        return (
          <div
            key={r.player_id}
            className={`flex items-center justify-between text-xs px-2 py-1 rounded border ${
              isLeader
                ? 'border-accent/40 bg-accent/10'
                : 'border-border bg-muted/10'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className={isLeader ? 'text-accent font-medium' : 'text-muted-foreground'}>
                {name}
              </span>
              {isLeader && (
                <span className="text-[10px] text-accent/70 ml-0.5">★</span>
              )}
            </div>
            <span className={`font-mono font-bold ${isLeader ? 'text-accent' : 'text-foreground/70'}`}>
              {r.influence_amount}
            </span>
          </div>
        );
      })}
    </div>
  );
}