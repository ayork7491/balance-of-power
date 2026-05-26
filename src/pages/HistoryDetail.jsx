/**
 * HistoryDetail — campaign history log with phase snapshots, decision logs, and battle records.
 * Future: connected to decision_logs and campaign_snapshots entities with reveal-time gating.
 */
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import { ScrollText } from 'lucide-react';

const HISTORY_SECTIONS = ['Decision History', 'Battle History', 'Phase Snapshots', 'Territory Captures', 'Structure History'];

export default function HistoryDetail() {
  return (
    <AppShell showBack title="Campaign History">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Filters placeholder */}
        <div className="panel p-3 flex gap-2 flex-wrap">
          {['All', 'Round', 'Phase', 'Player', 'Territory'].map(f => (
            <button key={f} className="px-3 py-1 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
              {f}
            </button>
          ))}
        </div>

        {HISTORY_SECTIONS.map(section => (
          <div key={section} className="panel">
            <div className="panel-header">
              <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <ScrollText className="w-3.5 h-3.5" />
                {section}
              </h2>
            </div>
            <EmptyState
              icon={ScrollText}
              title="No records yet"
              description="History is recorded as phases complete. Hidden decisions appear only after reveal."
            />
          </div>
        ))}

      </div>
    </AppShell>
  );
}