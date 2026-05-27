/**
 * StepReview — Summary of all campaign settings before creation.
 */
import { Shield, Users, Settings } from 'lucide-react';
import { AVAILABLE_MAPS } from '@/features/maps/mapData';

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-border last:border-0">
      <span className="text-xs font-display tracking-wider uppercase text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-medium text-right max-w-48 truncate">{value || '—'}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <h3 className="font-display text-xs tracking-widest uppercase text-muted-foreground">{title}</h3>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

export default function StepReview({ form }) {
  const s = form.settings;
  const selectedMap = AVAILABLE_MAPS.find(m => m.id === form.map_id);
  const mapDisplayName = selectedMap ? selectedMap.name : (form.map_id || '—');

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Review your campaign settings before creating. You can change most settings in the lobby.</p>

      <Section icon={Shield} title="Campaign">
        <Row label="Name" value={form.name} />
        {form.description && <Row label="Description" value={form.description} />}
      </Section>

      <Section icon={Shield} title="Game">
        <Row label="Profile" value={form.game_profile_name || 'None selected'} />
        <Row label="Map" value={mapDisplayName} />
        {selectedMap && (
          <Row label="Territories" value={`${selectedMap.territories.length} · ${selectedMap.min_players}–${selectedMap.max_players} players`} />
        )}
      </Section>

      {/* Debug block — map selection verification */}
      <div className="rounded border border-border bg-muted/30 p-3 space-y-1">
        <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1">Debug — Map</p>
        <p className="text-[10px] font-mono text-muted-foreground">
          Available IDs: <span className="text-foreground">{AVAILABLE_MAPS.map(m => m.id).join(', ')}</span>
        </p>
        <p className="text-[10px] font-mono text-muted-foreground">
          Selected map_id: <span className={form.map_id === 'shattered_crown_v1' ? 'text-green-400' : 'text-status-pending'}>{form.map_id || '(none)'}</span>
        </p>
        <p className="text-[10px] font-mono text-muted-foreground">
          Will save: <span className="text-foreground font-semibold">map_id: "{form.map_id || 'shattered_crown_v1'}"</span>
        </p>
      </div>

      <Section icon={Settings} title="Settings">
        <Row label="Max Players" value={s.max_players} />
        <Row label="Starting Troops" value={s.starting_troops} />
        <Row label="Max Attacks / Phase" value={s.max_attacks_per_phase} />
        <Row label="Schedule" value={s.phase_schedule.charAt(0).toUpperCase() + s.phase_schedule.slice(1)} />
        <Row label="Battle Day" value={s.battle_day.charAt(0).toUpperCase() + s.battle_day.slice(1)} />
        <Row label="Victory" value={s.victory_condition.charAt(0).toUpperCase() + s.victory_condition.slice(1)} />
      </Section>

      {form.invitee_emails?.length > 0 && (
        <Section icon={Users} title="Invites">
          {form.invitee_emails.map(email => (
            <Row key={email} label="" value={email} />
          ))}
        </Section>
      )}
    </div>
  );
}