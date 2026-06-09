/**
 * IntelligenceActionForm — inline form for submitting a single intelligence action.
 * Plugs into the Influence Action Framework — driven entirely by action config.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SC_REGION_LABELS = {
  outer_passes: 'Outer Passes', high_crown: 'High Crown', northern_wilds: 'Northern Wilds',
  deepwoods: 'Deepwoods', northern_ruins: 'Northern Ruins', central_crossroads: 'Central Crossroads',
  southern_ruins: 'Southern Ruins', western_plains: 'Western Plains', eastern_granaries: 'Eastern Granaries',
  northern_isles: 'Northern Isles', southern_fractures: 'Southern Fractures',
};

export default function IntelligenceActionForm({
  action,
  campaignId,
  actingPlayer,
  regionPools,
  mapDef,
  stateById,
  onSuccess,
  onCancel,
}) {
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedRegionTarget, setSelectedRegionTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const affordableRegions = Object.entries(regionPools ?? {})
    .filter(([, amt]) => amt >= action.cost)
    .map(([regionId]) => regionId);

  const territories = mapDef?.territories ?? [];
  const regions = Object.keys(SC_REGION_LABELS);

  const needsTerritory = action.target_rules === 'territory' || action.target_rules === 'territory_or_region';
  const needsRegionTarget = action.target_rules === 'region' || action.target_rules === 'territory_or_region';

  const canSubmit = selectedRegion &&
    (action.target_rules === 'territory' ? !!selectedTerritory :
     action.target_rules === 'region' ? !!selectedRegionTarget :
     action.target_rules === 'territory_or_region' ? (!!selectedTerritory || !!selectedRegionTarget) :
     true);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('intelligencePhase', {
        action: 'submitIntelAction',
        campaign_id: campaignId,
        acting_as_player_id: actingPlayer.id,
        intel_action_id: action.action_id,
        region_id: selectedRegion,
        target_territory_id: selectedTerritory || undefined,
        target_region_id: selectedRegionTarget || undefined,
      });
      onSuccess?.(res.data);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`rounded border ${action.border_color} ${action.bg_color} p-3 space-y-3`}>
      <div className="flex items-center gap-1.5">
        <span>{action.icon}</span>
        <span className={`text-xs font-semibold ${action.pillar_color}`}>{action.name}</span>
        <span className="text-[10px] text-cyan-400 font-mono ml-auto">{action.cost} inf</span>
      </div>

      {/* Influence source region */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-1">Influence Source Region</label>
        {affordableRegions.length === 0 ? (
          <p className="text-[10px] text-destructive">Not enough influence in any region (need {action.cost}).</p>
        ) : (
          <select
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            className="w-full bg-muted/20 border border-border rounded text-xs px-2 py-1.5 text-foreground"
          >
            <option value="">— Select region —</option>
            {affordableRegions.map(regionId => (
              <option key={regionId} value={regionId}>
                {SC_REGION_LABELS[regionId] ?? regionId} ({regionPools[regionId]} inf)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Territory target */}
      {needsTerritory && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">
            Target Territory {action.target_rules === 'territory_or_region' ? '(or Region below)' : ''}
          </label>
          <select
            value={selectedTerritory}
            onChange={e => setSelectedTerritory(e.target.value)}
            className="w-full bg-muted/20 border border-border rounded text-xs px-2 py-1.5 text-foreground"
          >
            <option value="">— Select territory —</option>
            {territories.map(t => (
              <option key={t.territory_id} value={t.territory_id}>{t.name ?? t.territory_id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Region target (for investigate_influence) */}
      {needsRegionTarget && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">
            Target Region {action.target_rules === 'territory_or_region' ? '(or Territory above)' : ''}
          </label>
          <select
            value={selectedRegionTarget}
            onChange={e => setSelectedRegionTarget(e.target.value)}
            className="w-full bg-muted/20 border border-border rounded text-xs px-2 py-1.5 text-foreground"
          >
            <option value="">— Select region —</option>
            {regions.map(r => (
              <option key={r} value={r}>{SC_REGION_LABELS[r] ?? r}</option>
            ))}
          </select>
        </div>
      )}

      {/* Reveals preview */}
      {action.reveals?.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          <span className="text-foreground">Reveals: </span>{action.reveals.join(' · ')}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting || affordableRegions.length === 0}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-primary/40 text-primary text-[10px] font-display tracking-wider uppercase hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : '⚡'}
          {submitting ? 'Gathering…' : 'Execute'}
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1.5 rounded border border-border text-muted-foreground text-[10px] hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}