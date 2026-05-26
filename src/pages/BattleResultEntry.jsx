/**
 * BattleResultEntry — admin form to submit battle results; players approve.
 * Future: connected to battle_cards and battle_result_submissions entities.
 */
import AppShell from '@/components/layout/AppShell';
import { Trophy } from 'lucide-react';

export default function BattleResultEntry() {
  return (
    <AppShell showBack title="Enter Battle Result">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5" />
              Battle Result
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Winner</label>
              <select className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select winner...</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Surviving Tabletop Troops</label>
              <input type="number" placeholder="0" className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Notes (optional)</label>
              <textarea placeholder="Battle notes..." rows={3} className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 px-4 py-2 rounded border border-destructive/40 text-destructive text-xs font-display tracking-wider uppercase hover:bg-destructive/10 transition-colors">Forfeit</button>
              <button className="flex-1 px-4 py-2 rounded border border-border text-muted-foreground text-xs font-display tracking-wider uppercase hover:text-foreground transition-colors">Auto-Resolve</button>
              <button className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all">Submit</button>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}