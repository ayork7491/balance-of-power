/**
 * useCountdown — Hook for countdown timer logic.
 * Extracted from CountdownTimer component for reusability.
 */
import { useState, useEffect } from 'react';

export function useCountdown(deadline) {
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

  const isUrgent = remaining < 3600000 && remaining > 0; // < 1 hour
  const isExpired = remaining <= 0;

  return {
    remaining,
    isUrgent,
    isExpired,
    hasDeadline: !!deadline,
  };
}

export function formatDuration(ms) {
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