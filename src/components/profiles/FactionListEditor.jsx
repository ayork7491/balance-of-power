/**
 * FactionListEditor — inline editor for a profile's faction/army-type list.
 *
 * Validation enforced here:
 *  - Blank names are rejected on add
 *  - Duplicate names (case-insensitive) show an inline warning badge
 *  - Empty name on existing row is highlighted with a red border
 */
import { useState } from 'react';
import { Plus, Trash2, GripVertical, AlertTriangle } from 'lucide-react';

function isDuplicate(factions, targetId, name) {
  const lower = name.trim().toLowerCase();
  return factions.some((f) => f.id !== targetId && f.name.trim().toLowerCase() === lower);
}

export default function FactionListEditor({ factions = [], onChange }) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newNameError, setNewNameError] = useState(null);

  const addFaction = () => {
    const name = newName.trim();
    if (!name) { setNewNameError('Name cannot be blank.'); return; }
    if (isDuplicate(factions, '__new__', name)) { setNewNameError('A faction with this name already exists.'); return; }
    setNewNameError(null);
    onChange([
      ...factions,
      { id: crypto.randomUUID(), name, description: newDesc.trim() },
    ]);
    setNewName('');
    setNewDesc('');
  };

  const removeFaction = (id) => onChange(factions.filter((f) => f.id !== id));

  const updateFaction = (id, field, value) =>
    onChange(factions.map((f) => (f.id === id ? { ...f, [field]: value } : f)));

  return (
    <div className="space-y-3">
      {/* Existing factions */}
      {factions.length > 0 && (
        <div className="space-y-2">
          {factions.map((faction) => {
            const isBlank = !faction.name.trim();
            const isDupe = !isBlank && isDuplicate(factions, faction.id, faction.name);
            return (
              <div key={faction.id} className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0 opacity-40" />
                <div className="flex-1 space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={faction.name}
                      onChange={(e) => updateFaction(faction.id, 'name', e.target.value)}
                      placeholder="Faction name"
                      className={`bg-input border rounded px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${isBlank ? 'border-destructive' : 'border-border'}`}
                    />
                    <input
                      value={faction.description}
                      onChange={(e) => updateFaction(faction.id, 'description', e.target.value)}
                      placeholder="Optional description"
                      className="bg-input border border-border rounded px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {isBlank && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="w-3 h-3" /> Faction name cannot be blank.
                    </p>
                  )}
                  {isDupe && (
                    <p className="flex items-center gap-1 text-xs text-status-pending">
                      <AlertTriangle className="w-3 h-3" /> Duplicate faction name.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFaction(faction.id)}
                  className="mt-1.5 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new faction row */}
      <div className="flex items-start gap-2">
        <div className="w-4 shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); if (newNameError) setNewNameError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFaction())}
              placeholder="New faction name…"
              className={`bg-input border border-dashed rounded px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${newNameError ? 'border-destructive' : 'border-border'}`}
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFaction())}
              placeholder="Optional description"
              className="bg-input border border-dashed border-border rounded px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {newNameError && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="w-3 h-3" /> {newNameError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={addFaction}
          disabled={!newName.trim()}
          className="mt-0.5 p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {factions.length === 0 && !newName && (
        <p className="text-xs text-muted-foreground text-center py-1">
          No factions yet — type a name above and press Enter or +
        </p>
      )}
    </div>
  );
}