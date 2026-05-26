/**
 * StepBasics — Campaign name and description.
 */
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
    </div>
  );
}