/**
 * BattleStatusTag — color-coded badge for BattleCard lifecycle status.
 */
const STATUS_CONFIG = {
  pending:            { label: 'Pending',            color: 'text-muted-foreground border-border bg-muted/20' },
  awaiting_result:    { label: 'Awaiting Result',    color: 'text-status-pending border-status-pending/40 bg-status-pending/10' },
  result_submitted:   { label: 'Result Submitted',   color: 'text-status-info border-status-info/40 bg-status-info/10' },
  awaiting_approval:  { label: 'Awaiting Approval',  color: 'text-yellow-400 border-yellow-600/40 bg-yellow-900/20' },
  resolved:           { label: 'Resolved',           color: 'text-status-locked border-status-locked/40 bg-status-locked/10' },
  auto_resolved:      { label: 'Auto-Resolved',      color: 'text-muted-foreground border-border bg-muted/30' },
  delayed:            { label: 'Delayed',            color: 'text-yellow-400 border-yellow-600/40 bg-yellow-900/20' },
  forfeited:          { label: 'Forfeited',          color: 'text-status-danger border-status-danger/40 bg-status-danger/10' },
};

export default function BattleStatusTag({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-muted-foreground border-border bg-muted/20' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-display tracking-wider uppercase ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}