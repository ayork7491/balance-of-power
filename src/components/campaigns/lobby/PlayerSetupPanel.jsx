/**
 * PlayerSetupPanel — lets a player edit their display name, color, and faction in the lobby.
 */
import { useState, useEffect } from 'react';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';
import { updatePlayerSetup } from '@/features/campaigns';

export default function PlayerSetupPanel({ myPlayer, players, gameProfile, onUpdated }) {
  const [name, setName] = useState(myPlayer.display_name);
  const [color, setColor] = useState(myPlayer.color);
  const [faction, setFaction] = useState(myPlayer.faction_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Taken colors by other players
  const takenColors = players
    .filter(p => p.id !== myPlayer.id)
    .map(p => p.color);

  const takenNames = players
    .filter(p => p.id !== myPlayer.id)
    .map(p => p.display_name.trim().toLowerCase());

  const factions = gameProfile?.factions ?? [];

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError('Display name cannot be empty.'); return; }
    if (takenNames.includes(name.trim().toLowerCase())) { setError('This name is already taken by another player.'); return; }
    if (takenColors.includes(color)) { setError('This color is already taken. Please choose another.'); return; }

    setSaving(true);
    try {
      await updatePlayerSetup(myPlayer.id, {
        display_name: name.trim(),
        color,
        faction_name: faction || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdated?.();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Display name */}
      <div className="space-y-1">
        <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Your Name in Campaign
        </label>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          maxLength={32}
          placeholder="Commander name…"
          className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Color picker */}
      <div className="space-y-2">
        <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Player Color
        </label>
        <div className="flex flex-wrap gap-2">
          {PLAYER_COLORS.map(pc => {
            const taken = takenColors.includes(pc.id) && pc.id !== color;
            const selected = color === pc.id;
            return (
              <button
                key={pc.id}
                type="button"
                disabled={taken}
                onClick={() => { setColor(pc.id); setError(null); }}
                title={taken ? `${pc.label} (taken)` : pc.label}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  selected ? 'border-white scale-110 ring-2 ring-white/40' :
                  taken    ? 'border-transparent opacity-25 cursor-not-allowed' :
                             'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: pc.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* Faction picker */}
      {factions.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Faction <span className="text-muted-foreground/50">(optional)</span>
          </label>
          <select
            value={faction}
            onChange={e => setFaction(e.target.value)}
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">— No faction —</option>
            {factions.map(f => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2 rounded border border-destructive/40 bg-destructive/5">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
        {saved ? 'Saved' : 'Save Setup'}
      </button>
    </div>
  );
}