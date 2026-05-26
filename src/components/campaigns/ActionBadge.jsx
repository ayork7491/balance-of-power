/**
 * ActionBadge — Badge indicating action needed status.
 * Extracted for reusability across components.
 */
export default function ActionBadge({ show = true, className = '' }) {
  if (!show) return null;

  return (
    <span className={`badge-pending text-xs ${className}`}>
      Action needed
    </span>
  );
}