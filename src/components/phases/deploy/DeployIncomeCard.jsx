/**
 * DeployIncomeCard — shows a single player's public income breakdown.
 * Income is always public; this component is safe to render for any player.
 */
import { TrendingUp } from 'lucide-react';

export default function DeployIncomeCard({ income, player, isMe }) {
  if (!income) return null;

  // Verify sum matches total (defensive display)
  const categorySum = (income.territory_bonus ?? 0) + (income.troop_bonus ?? 0)
    + (income.region_bonus ?? 0) + (income.continent_bonus ?? 0) + (income.building_bonus ?? 0);
  const displayTotal = income.total ?? categorySum;

  const row = (label, value, highlight) => (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={value > 0 ? (highlight ? 'text-green-400' : 'text-foreground') : 'text-muted-foreground/50'}>
        +{value}
      </span>
    </div>
  );

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
          +{displayTotal}
        </span>
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        {row('Territory Income', income.territory_bonus ?? 0)}
        {row('Troop-Based Income', income.troop_bonus ?? 0)}
        {row('Region Bonuses', income.region_bonus ?? 0)}
        {row('Continent Bonuses', income.continent_bonus ?? 0)}
        {row('Structure Bonuses (Barracks)', income.building_bonus ?? 0, true)}
      </div>
      {categorySum !== displayTotal && (
        <p className="text-[9px] text-amber-400/70 italic">
          ⚠ Sum mismatch: categories={categorySum}, total={displayTotal}
        </p>
      )}
    </div>
  );
}