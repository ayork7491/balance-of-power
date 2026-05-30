/**
 * DeployIncomeCard — shows a single player's public income breakdown.
 * Income is always public; this component is safe to render for any player.
 */
import { TrendingUp } from 'lucide-react';

export default function DeployIncomeCard({ income, player, isMe }) {
  if (!income) return null;

  return (
    <div className={`rounded border px-3 py-2 text-xs space-y-1 ${
      isMe ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
    }`}>
      <div className="flex items-center justify-between">
        <span className={`font-display tracking-wider uppercase font-semibold ${isMe ? 'text-primary' : 'text-foreground'}`}>
          {player?.display_name ?? 'Unknown'}
          {isMe && ' (you)'}
        </span>
        <span className="flex items-center gap-1 font-mono font-bold text-sm text-foreground">
          <TrendingUp className="w-3 h-3 text-status-info" />
          +{income.total}
        </span>
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        <div className="flex justify-between">
          <span>Territory</span>
          <span className="text-foreground">+{income.territory_bonus ?? 0}</span>
        </div>
        {(income.troop_bonus ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Troops</span>
            <span className="text-foreground">+{income.troop_bonus}</span>
          </div>
        )}
        {(income.region_bonus ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Region Bonus</span>
            <span className="text-foreground">+{income.region_bonus}</span>
          </div>
        )}
        {(income.continent_bonus ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Continent Bonus</span>
            <span className="text-foreground">+{income.continent_bonus}</span>
          </div>
        )}
      </div>
    </div>
  );
}