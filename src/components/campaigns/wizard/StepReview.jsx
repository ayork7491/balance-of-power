/**
 * StepReview — Summary of all campaign settings before creation.
 */
import { Shield, Users, Settings, Calendar } from 'lucide-react';

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
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Review your campaign settings before creating. You can change most settings in the lobby.</p>

      <Section icon={Shield} title="Campaign">
        <Row label="Name" value={form.name} />
        {form.description && <Row label="Description" value={form.description} />}
      </Section>

      <Section icon={Shield} title="Game">
        <Row label="Profile" value={form.game_profile_name || 'None selected'} />
        <Row label="Map" value={form.map_id === 'map_v1_standard' ? 'Standard Map (V1)' : form.map_id} />
      </Section>

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