/**
 * PhaseTag — displays a campaign phase with its associated color styling.
 */
import { PHASE_COLORS } from '@/config/theme';

export default function PhaseTag({ phase, className = '', compact = false }) {
  const config = PHASE_COLORS[phase] || PHASE_COLORS.deploy;

  if (compact) {
    return (
      <span className={`text-[9px] font-display tracking-wider uppercase px-1.5 py-0.5 rounded border ${config.bg} ${config.border} ${config.text} ${className}`}>
        {config.label}
      </span>
    );
  }

  return (
    <span className={`text-xs font-display tracking-wider uppercase px-2 py-0.5 rounded border ${config.bg} ${config.border} ${config.text} ${className}`}>
      {config.label}
    </span>
  );
}