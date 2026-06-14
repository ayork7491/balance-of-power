/**
 * CapitalSelector — reusable capital designation widget.
 * Used during initial_deploy (after lock) and deploy phase (military tab, once per round).
 *
 * Props:
 *   campaign, myPlayer, actingAsPlayerId
 *   territories: [{ territory_id, name }]
 *   currentCapitalId: string | null
 *   lastSetRound: number | null   — round capital was last changed
 *   onCapitalSet: (territoryId) => void
 *   allowChangeLabel: string      — label for the change button (default: "Set Capital")
 *   readonly: bool                — show current capital only, no change UI
 */
import { useState } from 'react';
import { Star, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CapitalSelector({
  campaign,
  myPlayer,
  actingAsPlayerId,
  territories = [],
  currentCapitalId = null,
  lastSetRound = null,
  onCapitalSet,
  allowChangeLabel = 'Set Capital',
  readonly = false,
}) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 0;
  const alreadyChangedThisRound = lastSetRound != null && lastSetRound === round;

  const [selected, setSelected] = useState(currentCapitalId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSet = async () => {
    if (!selected || selected === currentCapitalId) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await base44.functions.invoke('territoryDevelopment', {
        action: 'setCapital',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        territory_id: selected,
      });
      setSuccess(true);
      onCapitalSet?.(selected);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to set capital');
    } finally {
      setSaving(false);
    }
  };

  const currentCapitalName = territories.find(t => t.territory_id === currentCapitalId)?.name ?? currentCapitalId;

  if (readonly || alreadyChangedThisRound) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-amber-400/30 bg-amber-400/5 text-xs">
        <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div>
          <span className="text-amber-400 font-semibold">Capital: </span>
          <span className="text-foreground">{currentCapitalName ?? 'None'}</span>
          {alreadyChangedThisRound && !readonly && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Capital already changed this round.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {currentCapitalId && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <Star className="w-3 h-3" />
          Current: <span className="font-semibold">{currentCapitalName}</span>
        </div>
      )}

      <div className="flex gap-2">
        <select
          value={selected}
          onChange={e => { setSelected(e.target.value); setSuccess(false); }}
          className="flex-1 bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">— choose capital territory —</option>
          {territories.map(t => (
            <option key={t.territory_id} value={t.territory_id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handleSet}
          disabled={saving || !selected || selected === currentCapitalId}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 text-[10px] font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
          {allowChangeLabel}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-1.5 text-[10px] text-green-400">
          <CheckCircle2 className="w-3 h-3" /> Capital set successfully.
        </div>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}