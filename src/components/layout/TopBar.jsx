/**
 * TopBar — Campaign screen top status bar.
 * Shows: campaign name, round, phase, timer, lock status, test mode indicator.
 * In non-campaign screens, shows app branding only.
 */
import { Shield, Lock, FlaskConical } from 'lucide-react';
import PhaseTag from '@/components/ui/PhaseTag';
import CountdownTimer from '@/components/ui/CountdownTimer';

export default function TopBar({ campaign = null, isTestMode = false }) {
  return (
    <header className="h-10 bg-panel-header border-b border-panel-border flex items-center px-4 gap-4 shrink-0 z-20">
      {/* Brand / Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <Shield className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
          BoP
        </span>
      </div>

      <div className="w-px h-5 bg-border shrink-0" />

      {campaign ? (
        <>
          {/* Campaign name */}
          <span className="font-display text-sm font-semibold tracking-wide text-foreground truncate max-w-32">
            {campaign.name}
          </span>

          {/* Round */}
          <span className="text-xs text-muted-foreground shrink-0">
            Round {campaign.current_round || 1}
          </span>

          {/* Phase */}
          {campaign.current_phase && (
            <PhaseTag phase={campaign.current_phase} />
          )}

          {/* Timer */}
          {campaign.phase_deadline && (
            <CountdownTimer deadline={campaign.phase_deadline} />
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Lock status */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Lock className="w-3 h-3" />
            <span className="hidden sm:inline">Lock Status</span>
          </div>
        </>
      ) : (
        <span className="font-display text-sm tracking-widest text-muted-foreground uppercase flex-1">
          Balance of Power
        </span>
      )}

      {/* Test Mode indicator */}
      {isTestMode && (
        <div className="flex items-center gap-1 bg-status-pending/20 border border-status-pending/40 text-status-pending px-2 py-0.5 rounded text-xs font-display tracking-wider uppercase shrink-0">
          <FlaskConical className="w-3 h-3" />
          <span>Test Mode</span>
        </div>
      )}
    </header>
  );
}