/**
 * BattleCardDetail — full detail view of a generated battle card.
 * Future: populated from battle_cards entity with participants, troop scaling, result entry.
 */
import AppShell from '@/components/layout/AppShell';
import TacticalBadge from '@/components/ui/TacticalBadge';
import { Swords } from 'lucide-react';

export default function BattleCardDetail() {
  return (
    <AppShell showBack title="Battle Card">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Swords className="w-3.5 h-3.5" />
              Battle Details
            </h2>
            <TacticalBadge variant="pending">Awaiting Play</TacticalBadge>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {['Battle Type', 'Territory at Stake', 'Attacker', 'Defender', 'App Troops (A)', 'App Troops (D)', 'Scaled Points', 'Special Rules'].map(label => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground font-display tracking-wider uppercase">{label}</p>
                  <p className="text-sm text-foreground mt-0.5">—</p>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Result entry and approval UI will be built in a future prompt (Battle Resolution phase).</p>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}