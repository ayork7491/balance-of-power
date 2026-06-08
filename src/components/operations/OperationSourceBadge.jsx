/**
 * OperationSourceBadge — small badge showing battle card source.
 * Used in BattleCardRow and OperationsPanel to indicate operation origin.
 */
import { BATTLE_SOURCE_LABELS } from '@/config/operationsConfig';

export default function OperationSourceBadge({ source, size = 'sm' }) {
  if (!source || source === 'military_attack') return null;
  const cfg = BATTLE_SOURCE_LABELS[source];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/30 ${cfg.color} ${size === 'xs' ? 'text-[9px]' : 'text-[10px]'}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}