/**
 * BattleTypeTag — color-coded badge for battle card types.
 */
const TYPE_CONFIG = {
  skirmish:           { label: 'Skirmish',           color: 'text-muted-foreground  bg-muted/30          border-border' },
  siege:              { label: 'Siege',               color: 'text-status-pending    bg-status-pending/10  border-status-pending/40' },
  double_siege:       { label: 'Double Siege',        color: 'text-status-danger     bg-status-danger/10   border-status-danger/40' },
  capture_objectives: { label: 'Capture Objectives',  color: 'text-status-info       bg-status-info/10     border-status-info/40' },
  bloodbath:          { label: 'Bloodbath',           color: 'text-red-400           bg-red-900/20         border-red-600/40' },
};

export default function BattleTypeTag({ type }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, color: 'text-muted-foreground border-border bg-muted/20' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-display tracking-wider uppercase font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}