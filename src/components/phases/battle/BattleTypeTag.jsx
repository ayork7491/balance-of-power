/**
 * BattleTypeTag — color-coded badge for all 12 v1 battle card types.
 */
const TYPE_CONFIG = {
  // Military
  skirmish:                    { label: 'Skirmish',                  color: 'text-muted-foreground  bg-muted/30            border-border' },
  siege:                       { label: 'Siege',                     color: 'text-status-pending    bg-status-pending/10   border-status-pending/40' },
  double_siege:                { label: 'Double Siege',              color: 'text-status-danger     bg-status-danger/10    border-status-danger/40' },
  capture_objectives:          { label: 'Capture Objectives',        color: 'text-status-info       bg-status-info/10      border-status-info/40' },
  bloodbath:                   { label: 'Bloodbath',                 color: 'text-red-400           bg-red-900/20          border-red-600/40' },
  // Economic
  supply_route_establishment:  { label: 'Route Establishment',       color: 'text-amber-400         bg-amber-900/20        border-amber-600/40' },
  supply_route_race:           { label: 'Route Race',                color: 'text-amber-300         bg-amber-900/15        border-amber-500/30' },
  supply_raid:                 { label: 'Supply Raid',               color: 'text-yellow-400        bg-yellow-900/20       border-yellow-600/40' },
  supply_caravan_escort:       { label: 'Caravan Escort',            color: 'text-amber-200         bg-amber-900/10        border-amber-400/30' },
  // Diplomatic
  uprising:                    { label: 'Uprising',                  color: 'text-blue-400          bg-blue-900/20         border-blue-600/40' },
  labor_strike:                { label: 'Labor Strike',              color: 'text-blue-300          bg-blue-900/15         border-blue-500/30' },
  tax_protest:                 { label: 'Tax Protest',               color: 'text-cyan-400          bg-cyan-900/20         border-cyan-600/40' },
  manufactured_crisis:         { label: 'Manufactured Crisis',       color: 'text-purple-400        bg-purple-900/20       border-purple-600/40' },
};

export default function BattleTypeTag({ type }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, color: 'text-muted-foreground border-border bg-muted/20' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-display tracking-wider uppercase font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}