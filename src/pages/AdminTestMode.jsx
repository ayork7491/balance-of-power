/**
 * AdminTestMode — admin-only tool for simulating campaigns solo.
 * Allows: perspective switching, manual phase advance, auto-fill decisions, snapshot viewer.
 * CRITICAL: Must preserve hidden-information rules per perspective.
 * Future: connected to full phase engine and campaign state.
 */
import AppShell from '@/components/layout/AppShell';
import { FlaskConical, Eye, FastForward, Shuffle, Camera } from 'lucide-react';

export default function AdminTestMode() {
  return (
    <AppShell showBack title="Admin Test Mode">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Warning banner */}
        <div className="border border-status-pending/40 bg-status-pending/10 rounded p-3 flex items-start gap-3">
          <FlaskConical className="w-4 h-4 text-status-pending shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-display font-semibold tracking-wider text-status-pending uppercase">Test Mode Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">Hidden information rules are enforced per player perspective. Use the debug overlay to see all data.</p>
          </div>
        </div>

        {/* Perspective switcher */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Player Perspective
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Switch view to see the game as any player would see it. Private staged decisions will be hidden per player.</p>
            <select className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option>Select player perspective...</option>
            </select>
            <button className="w-full px-4 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors">
              Switch Perspective
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: FastForward, label: 'Force Phase Advance', desc: 'Skip timer and advance to next phase immediately.', danger: true },
            { icon: Shuffle,     label: 'Auto-Fill Decisions', desc: 'Randomly fill all unstaged player decisions.', danger: false },
            { icon: Camera,      label: 'View Snapshot',       desc: 'Inspect the current campaign state snapshot.', danger: false },
          ].map(({ icon: Icon, label, desc, danger }) => (
            <div key={label} className="panel p-4 flex flex-col gap-2">
              <div className={`flex items-center gap-2 ${danger ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Icon className="w-4 h-4" />
                <p className="font-display text-xs tracking-wider uppercase font-semibold">{label}</p>
              </div>
              <p className="text-xs text-muted-foreground flex-1">{desc}</p>
              <button className={`mt-2 w-full px-3 py-1.5 rounded text-xs font-display tracking-wider uppercase transition-colors ${
                danger
                  ? 'border border-destructive/40 text-destructive hover:bg-destructive/10'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
              }`}>
                {label}
              </button>
            </div>
          ))}
        </div>

        {/* Debug overlay toggle */}
        <div className="panel p-4 flex items-center justify-between">
          <div>
            <p className="font-display text-xs tracking-wider uppercase text-muted-foreground">Debug Overlay</p>
            <p className="text-xs text-muted-foreground mt-0.5">Show all private decision data regardless of perspective.</p>
          </div>
          <button className="px-3 py-1.5 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
            Enable
          </button>
        </div>

      </div>
    </AppShell>
  );
}