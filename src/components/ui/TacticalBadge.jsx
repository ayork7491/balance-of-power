/**
 * TacticalBadge — reusable status badge for phases, lock status, battle card state, etc.
 */
export default function TacticalBadge({ variant = 'info', children, className = '' }) {
  const variants = {
    locked:  'badge-locked',
    pending: 'badge-pending',
    danger:  'badge-danger',
    info:    'badge-info',
  };

  return (
    <span className={`${variants[variant] || variants.info} font-display tracking-wider uppercase ${className}`}>
      {children}
    </span>
  );
}