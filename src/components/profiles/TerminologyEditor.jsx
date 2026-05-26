/**
 * TerminologyEditor — lets users override BoP default terms with game-specific language.
 */

const TERMINOLOGY_FIELDS = [
  { key: 'troop',        label: 'Troops',         placeholder: 'e.g. Units, Models, Warriors' },
  { key: 'territory',    label: 'Territory',      placeholder: 'e.g. Province, Sector, Region' },
  { key: 'battle',       label: 'Battle',         placeholder: 'e.g. Engagement, Conflict, War' },
  { key: 'campaign',     label: 'Campaign',       placeholder: 'e.g. War, Crusade, Season' },
  { key: 'deploy_phase', label: 'Deploy Phase',   placeholder: 'e.g. Reinforcement, Muster' },
  { key: 'attack_phase', label: 'Attack Phase',   placeholder: 'e.g. Assault, Offensive, Strike' },
  { key: 'fortify_phase',label: 'Fortify Phase',  placeholder: 'e.g. Consolidate, Secure, Entrench' },
];

export default function TerminologyEditor({ terminology = {}, onChange }) {
  const update = (key, value) => onChange({ ...terminology, [key]: value || undefined });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Leave blank to use Balance of Power defaults. These override labels throughout the campaign.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TERMINOLOGY_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
              {label}
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground/50 shrink-0">BoP →</span>
              <input
                value={terminology[key] || ''}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-input border border-border rounded px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}