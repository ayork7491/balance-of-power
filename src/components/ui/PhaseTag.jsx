/**
 * PhaseTag — displays a campaign phase with its associated color styling.
 */
import { PHASE_COLORS } from '@/config/theme';

export default function PhaseTag({ phase, className = '' }) {
  const config = PHASE_COLORS[phase] || PHASE_COLORS.deploy;

  return (
    <span className={`text-xs font-display tracking-wider uppercase px-2 py-0.5 rounded border ${config.bg} ${config.border} ${config.text} ${className}`}>
      {config.label}
    </span>
  );
}