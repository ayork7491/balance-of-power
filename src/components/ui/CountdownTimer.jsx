/**
 * CountdownTimer — displays time remaining until a phase deadline.
 * Accepts a deadline ISO string or null for "no timer set".
 */
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, '0')}h`;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function CountdownTimer({ deadline, className = '' }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      setRemaining(new Date(deadline) - new Date());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) {
    return (
      <span className={`flex items-center gap-1 text-muted-foreground text-xs font-mono ${className}`}>
        <Clock className="w-3 h-3" />
        <span>No deadline</span>
      </span>
    );
  }

  const isUrgent = remaining < 3600000 && remaining > 0; // < 1 hour
  const isExpired = remaining <= 0;

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