/**
 * CountdownTimer — displays time remaining until a phase deadline.
 * Accepts a deadline ISO string or null for "no timer set".
 */
import { Clock } from 'lucide-react';
import { useCountdown, formatDuration } from '@/features/campaigns/useCountdown';

export default function CountdownTimer({ deadline, className = '', compact = false }) {
  const { remaining, isUrgent, isExpired, hasDeadline } = useCountdown(deadline);

  if (!hasDeadline) {
    if (compact) return null; // portrait top bar: hide "no deadline" clutter
    return (
      <span className={`flex items-center gap-1 text-muted-foreground text-xs font-mono ${className}`}>
        <Clock className="w-3 h-3" />
        <span>No deadline</span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 font-mono ${compact ? 'text-[10px]' : 'text-xs'} ${
      isExpired ? 'text-destructive' :
      isUrgent  ? 'text-status-pending animate-pulse' :
                  'text-muted-foreground'
    } ${className}`}>
      <Clock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      <span>{isExpired ? 'EXP' : formatDuration(remaining)}</span>
    </span>
  );
}