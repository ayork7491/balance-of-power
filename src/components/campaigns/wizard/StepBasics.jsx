/**
 * StepBasics — Campaign name, description, and map selection.
 */
import { AVAILABLE_MAPS } from '@/features/maps/mapData';

export default function StepBasics({ form, setField, errors }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Campaign Name <span className="text-destructive">*</span>
        </label>
        <input
          value={form.name}
          onChange={e => setField('name', e.target.value)}
          placeholder="e.g. The Grimdark Crusade, Fall of Cadia…"
          maxLength={60}
          className={`w-full bg-input border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${errors.name ? 'border-destructive' : 'border-border'}`}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Description <span className="text-muted-foreground/50">(optional)</span>
        </label>
        <textarea
          value={form.description}
          onChange={e => setField('description', e.target.value)}
          placeholder="A brief description of this campaign's setting or narrative…"
          rows={3}
          maxLength={280}
          className="w-full bg-input border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        <p className="text-xs text-muted-foreground/50 text-right">{form.description.length}/280</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Map
        </label>
        <div className="grid gap-2">
          {AVAILABLE_MAPS.map(map => (
            <button
              key={map.id}
              type="button"
              onClick={() => setField('map_id', map.id)}
              className={`flex items-start gap-3 w-full text-left p-3 rounded border transition-colors ${
                form.map_id === map.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-input text-muted-foreground hover:border-primary/50'
              }`}
            >
              <div className={`mt-0.5 w-3 h-3 rounded-full border flex-shrink-0 ${form.map_id === map.id ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
              <div className="min-w-0">
                <p className="text-sm font-display tracking-wide font-semibold text-foreground">{map.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{map.description}</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {map.territories.length} territories · {map.min_players}–{map.max_players} players
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}