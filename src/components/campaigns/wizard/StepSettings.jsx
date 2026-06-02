/**
 * StepSettings — Gameplay configuration: troops, attacks, schedule, etc.
 */

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

function Setting({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-display tracking-wider text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumInput({ value, onChange, min = 1, max = 999 }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-20 bg-input border border-border rounded px-2 py-1 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-input border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {options.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

export default function StepSettings({ form, setField }) {
  const s = form.settings;
  const set = (key, val) => setField('settings', { ...s, [key]: val });

  return (
    <div className="space-y-0 divide-y divide-border">
      <Setting label="Max Players" hint="Maximum number of players in this campaign (2–8).">
        <NumInput value={s.max_players} onChange={v => set('max_players', v)} min={2} max={8} />
      </Setting>

      <Setting label="Starting Troops" hint="Troops each player receives before the initial deployment.">
        <NumInput value={s.starting_troops} onChange={v => set('starting_troops', v)} min={1} max={9999} />
      </Setting>

      <Setting label="Max Attacks / Phase" hint="How many attacks a player may declare each round.">
        <NumInput value={s.max_attacks_per_phase} onChange={v => set('max_attacks_per_phase', v)} min={1} max={20} />
      </Setting>

      <Setting label="Max Fortifications / Phase" hint="Max troop movements per round.">
        <NumInput value={s.max_fortifications_per_phase} onChange={v => set('max_fortifications_per_phase', v)} min={1} max={20} />
      </Setting>

      <Setting label="Phase Schedule" hint="How often the campaign advances.">
        <SelectInput
          value={s.phase_schedule}
          onChange={v => set('phase_schedule', v)}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'manual', label: 'Manual (admin advances)' },
          ]}
        />
      </Setting>

      <Setting label="Battle Day" hint="Day of the week when players meet for tabletop battles.">
        <SelectInput
          value={s.battle_day}
          onChange={v => set('battle_day', v)}
          options={DAYS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))}
        />
      </Setting>

      <Setting label="Battle Phase Start" hint="Time battle phase opens (24h). E.g. 01:00.">
        <input
          type="time"
          value={s.battle_phase_start_time ?? '01:00'}
          onChange={e => set('battle_phase_start_time', e.target.value)}
          className="bg-input border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </Setting>

      <Setting label="Voting Cutoff Time" hint="Time preference voting closes on battle day. E.g. 20:00.">
        <input
          type="time"
          value={s.battle_voting_cutoff_time ?? '20:00'}
          onChange={e => set('battle_voting_cutoff_time', e.target.value)}
          className="bg-input border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </Setting>

      <Setting label="Victory Condition">
        <SelectInput
          value={s.victory_condition}
          onChange={v => set('victory_condition', v)}
          options={[
            { value: 'domination', label: 'Domination' },
            { value: 'score', label: 'Score' },
          ]}
        />
      </Setting>

      <Setting label="Allow Duplicate Factions" hint="Can multiple players pick the same faction?">
        <button
          type="button"
          onClick={() => set('allow_faction_duplicates', !s.allow_faction_duplicates)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.allow_faction_duplicates ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${s.allow_faction_duplicates ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </Setting>
    </div>
  );
}