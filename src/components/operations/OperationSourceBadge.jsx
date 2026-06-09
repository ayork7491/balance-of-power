/**
 * OperationSourceBadge — compact badge showing v1 battle card source/pillar.
 */
import { BATTLE_SOURCE_LABELS } from '@/config/operationsConfig';

const PILLAR_CLASSES = {
  military:   'bg-red-500/15 text-red-400 border-red-500/30',
  economic:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  diplomatic: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function OperationSourceBadge({ source, size = 'sm' }) {
  const cfg = BATTLE_SOURCE_LABELS[source];
  if (!cfg) return null;

  const pillarClass = PILLAR_CLASSES[cfg.pillar] ?? 'bg-muted/20 text-muted-foreground border-border';
  const textClass = size === 'xs' ? 'text-[10px]' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-medium ${pillarClass} ${textClass}`}>
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}