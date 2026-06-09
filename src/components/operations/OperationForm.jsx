/**
 * OperationForm — v1 form for submitting a single operation.
 * Handles territory/region/supply-route/declared-resource/territory-B selection.
 */
import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { OPERATION_BY_TYPE } from '@/config/operationsConfig';

const REGION_LABELS = {
  outer_passes: 'Outer Passes', high_crown: 'High Crown',
  northern_wilds: 'Northern Wilds', deepwoods: 'Deepwoods',
  northern_ruins: 'Northern Ruins', central_crossroads: 'Central Crossroads',
  southern_ruins: 'Southern Ruins', western_plains: 'Western Plains',
  eastern_granaries: 'Eastern Granaries', northern_isles: 'Northern Isles',
  southern_fractures: 'Southern Fractures',
};

const RESOURCE_OPTIONS = [
  { value: 'gold', label: 'Gold' },
  { value: 'iron', label: 'Iron' },
  { value: 'timber', label: 'Timber' },
  { value: 'stone', label: 'Stone' },
  { value: 'food', label: 'Food' },
];

export default function OperationForm({
  operationType,
  campaignId,
  actingPlayer,
  regionPools = {},
  resources = {},
  stateById = {},
  mapDef,
  supplyRoutes = [],
  activeBuildings = [],
  onSuccess,
  onCancel,
}) {
  const opDef = OPERATION_BY_TYPE[operationType];
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedTerritoryB, setSelectedTerritoryB] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [declaredResource, setDeclaredResource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!opDef) return null;

  const isDiplomatic = opDef.cost_type === 'influence';
  const isEconomic   = opDef.cost_type === 'resource';

  // Available regions with enough spendable influence
  const availableRegions = Object.entries(regionPools)
    .filter(([, amt]) => amt >= opDef.cost)
    .map(([regionId, amt]) => ({ regionId, amt }));

  // Enemy supply routes (for supply_route_race)
  const enemyRoutes = supplyRoutes.filter(r => r.owner_player_id !== actingPlayer?.id);

  // Hub territories (for labor_strike)
  const hubTerritoryIds = new Set(
    activeBuildings.filter(b => b.building_type === 'resource_hub').map(b => b.territory_id)
  );

  const territories = mapDef?.territories ?? [];

  // Territory A options — filtered by op requirements
  const territoriesA = territories.filter(t => {
    const st = stateById[t.territory_id];
    if (opDef.target_must_be_enemy && st?.owner_player_id === actingPlayer?.id) return false;
    if (opDef.requires_hub && !hubTerritoryIds.has(t.territory_id)) return false;
    if (operationType === 'supply_route_establishment' && st?.owner_player_id === actingPlayer?.id) return false;
    return true;
  });

  // Territory B options — only occupied territories belonging to different players (for manufactured_crisis)
  const stateA = stateById[selectedTerritory];
  const territoriesB = territories.filter(t => {
    if (t.territory_id === selectedTerritory) return false;
    const st = stateById[t.territory_id];
    if (!st?.owner_player_id) return false; // must be occupied
    if (st.owner_player_id === actingPlayer?.id) return false; // not diplomat's own
    if (operationType === 'manufactured_crisis' && stateA?.owner_player_id && st.owner_player_id === stateA.owner_player_id) return false;
    return true;
  });

  const canAfford = isDiplomatic
    ? availableRegions.length > 0
    : (resources[opDef.cost_resource] ?? 0) >= opDef.cost;

  const handleSubmit = async () => {
    setError(null);
    if (!selectedTerritory) { setError('Select a target territory.'); return; }
    if (isDiplomatic && !selectedRegion) { setError('Select a region to spend influence from.'); return; }
    if (opDef.requires_supply_route && !selectedRoute) { setError('Select a supply route to target.'); return; }
    if (opDef.requires_declared_resource && !declaredResource) { setError('Declare a resource type.'); return; }
    if (opDef.requires_territory_b && !selectedTerritoryB) { setError('Select a second territory.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        action: 'submitOperation',
        campaign_id: campaignId,
        operation_type: operationType,
        target_territory_id: selectedTerritory,
        acting_as_player_id: actingPlayer?.id,
      };
      if (isDiplomatic) payload.region_id = selectedRegion;
      if (opDef.requires_supply_route) payload.target_supply_route_id = selectedRoute;
      if (opDef.requires_declared_resource) payload.declared_resource_type = declaredResource;
      if (opDef.requires_territory_b) payload.territory_b_id = selectedTerritoryB;

      const res = await base44.functions.invoke('operationsPhase', payload);
      if (res.data?.success) {
        onSuccess?.(res.data);
      } else {
        setError(res.data?.error ?? 'Operation failed.');
      }
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-3 rounded border border-border bg-muted/10">
      <div className="flex items-center gap-2">
        <span className="text-base">{opDef.icon}</span>
        <div>
          <p className="text-xs font-semibold text-foreground">{opDef.label}</p>
          <p className="text-[10px] text-muted-foreground">{opDef.description}</p>
        </div>
      </div>

      {/* Cost display */}
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-muted-foreground">Cost:</span>
        {isDiplomatic ? (
          <span className="text-cyan-400 font-mono">{opDef.cost} influence</span>
        ) : (
          <span className="text-amber-400 font-mono">{opDef.cost} {opDef.cost_resource}</span>
        )}
        {!canAfford && <span className="text-destructive ml-2">— Insufficient</span>}
      </div>

      {/* Win/Lose summary */}
      {opDef.win_condition_summary && (
        <p className="text-[10px] text-muted-foreground/70 italic border-l-2 border-border pl-2">
          {opDef.win_condition_summary}
        </p>
      )}

      {/* Region selector (diplomatic) */}
      {isDiplomatic && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Spend from Region</label>
          <select
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
          >
            <option value="">Select region…</option>
            {availableRegions.map(({ regionId, amt }) => (
              <option key={regionId} value={regionId}>
                {REGION_LABELS[regionId] ?? regionId} ({amt} influence)
              </option>
            ))}
            {availableRegions.length === 0 && <option disabled>No region with enough influence</option>}
          </select>
        </div>
      )}

      {/* Territory A selector */}
      <div>
        <label className="text-[10px] text-muted-foreground block mb-1">
          {opDef.requires_territory_b ? 'Territory A (primary)' : 'Target Territory'}
        </label>
        <select
          value={selectedTerritory}
          onChange={e => setSelectedTerritory(e.target.value)}
          className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
        >
          <option value="">Select territory…</option>
          {territoriesA.map(t => {
            const tState = stateById[t.territory_id];
            return (
              <option key={t.territory_id} value={t.territory_id}>
                {t.name} {tState?.owner_player_id ? `(${tState.troop_count ?? 0} troops)` : '(unoccupied)'}
              </option>
            );
          })}
        </select>
      </div>

      {/* Territory B selector (manufactured_crisis, supply_caravan_escort) */}
      {opDef.requires_territory_b && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">
            {operationType === 'supply_caravan_escort' ? 'Shipment Destination' : 'Territory B (second party)'}
          </label>
          <select
            value={selectedTerritoryB}
            onChange={e => setSelectedTerritoryB(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
          >
            <option value="">Select second territory…</option>
            {(operationType === 'supply_caravan_escort' ? territories : territoriesB).map(t => {
              const tState = stateById[t.territory_id];
              return (
                <option key={t.territory_id} value={t.territory_id}>
                  {t.name} {tState?.owner_player_id ? `(${tState.troop_count ?? 0} troops)` : '(unoccupied)'}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Supply route selector (supply_route_race) */}
      {opDef.requires_supply_route && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Target Supply Route</label>
          <select
            value={selectedRoute}
            onChange={e => setSelectedRoute(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
          >
            <option value="">Select enemy route…</option>
            {enemyRoutes.map(r => (
              <option key={r.id} value={r.id}>
                {r.hub_territory_id} → {r.source_territory_id} ({r.resource_type})
              </option>
            ))}
            {enemyRoutes.length === 0 && <option disabled>No enemy supply routes</option>}
          </select>
        </div>
      )}

      {/* Declared resource (supply_raid) */}
      {opDef.requires_declared_resource && (
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Declare Resource Type (to raid)</label>
          <select
            value={declaredResource}
            onChange={e => setDeclaredResource(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
          >
            <option value="">Select resource…</option>
            {RESOURCE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !canAfford}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          Execute Operation
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}