/**
 * CountdownTimer — displays time remaining until a phase deadline.
 * Accepts a deadline ISO string or null for "no timer set".
 */
import { Clock } from 'lucide-react';
import { useCountdown, formatDuration } from '@/features/campaigns/useCountdown';

export default function CountdownTimer({ deadline, className = '' }) {
  const { remaining, isUrgent, isExpired, hasDeadline } = useCountdown(deadline);

  if (!hasDeadline) {
    return (
      <span className={`flex items-center gap-1 text-muted-foreground text-xs font-mono ${className}`}>
        <Clock className="w-3 h-3" />
        <span>No deadline</span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-xs font-mono ${
      isExpired ? 'text-destructive' :
      isUrgent  ? 'text-status-pending animate-pulse' :
                  'text-muted-foreground'
    } ${className}`}>
      <Clock className="w-3 h-3" />
      <span>{isExpired ? 'EXPIRED' : formatDuration(remaining)}</span>
    </span>
  );
}