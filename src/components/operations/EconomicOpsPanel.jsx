/**
 * EconomicOpsPanel — Sprint 5B.6
 *
 * Economic tab content during Operations Phase.
 * Shows:
 *   - Resource summary (global + territory storage)
 *   - Construction project staging with cost preview and affordability validation
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, HardHat, X, CheckCircle2, Hammer, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ALL_BUILDING_DEFINITIONS } from '@/config/buildingDefinitions.ts';
import { canPlaceBuilding } from '@/services/maps/structureSlots';
import { getBuildingPillar } from '@/config/buildingDefinitions.ts';
import { SC_TERRITORY_BY_ID } from '@/shared/maps/shatteredCrownConfig';
import ResourceSummaryPanel from './ResourceSummaryPanel';
import { useOperationsStagingStore } from '@/features/campaigns/operations/useOperationsStagingStore';

const PILLAR_COLORS = {
  military:   { text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10' },
  economic:   { text: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  diplomatic: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
};

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
// Food is a special resource (territory development only) — never shown as spendable for construction
const SPENDABLE_RESOURCE_KEYS = ['gold', 'iron', 'timber', 'stone'];

// Building options matching the definitions from buildingDefinitions.ts
const BUILDING_OPTIONS = ALL_BUILDING_DEFINITIONS.map(b => ({
  type: b.type,
  label: b.label,
  pillar: b.pillar,
  cost: b.cost,
  rounds: b.rounds,
  effect: b.effect,
  icon: {
    barracks: '🏰', war_council: '⚔️', logistics_corps: '🚩',
    embassy: '🏛️', council_chamber: '🏛', foreign_office: '🏢', monument: '🗿',
    marketplace: '🏪', builders_guild: '🔨', trade_network: '🔗',
    resource_hub: '🏭', supply_route: '🛤️', warehouse: '📦',
  }[b.type] ?? '🏗️',
}));

function CostDisplay({ cost, resources }) {
  const entries = Object.entries(cost).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([resource, needed]) => {
        const have = resources[resource] ?? 0;
        const ok = have >= needed;
        return (
          <span key={resource} className={`flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}>
            {RESOURCE_ICONS[resource] ?? resource} {needed}
            {!ok && <span className="ml-0.5 opacity-70">(have {have})</span>}
          </span>
        );
      })}
    </div>
  );
}

function canAffordBuilding(cost, resources) {
  return Object.entries(cost)
    .filter(([r]) => SPENDABLE_RESOURCE_KEYS.includes(r))
    .every(([r, needed]) => (resources[r] ?? 0) >= needed);
}

function MissingResources({ cost, resources }) {
  const missing = Object.entries(cost)
    .filter(([r, needed]) => (resources[r] ?? 0) < needed)
    .map(([r, needed]) => ({ resource: r, needed, have: resources[r] ?? 0 }));
  if (missing.length === 0) return null;
  return (
    <div className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5 space-y-1">
      <p className="text-[10px] text-destructive flex items-center gap-1.5">
        <AlertCircle className="w-3 h-3 shrink-0" /> Not enough resources to build this structure.
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        <div>
          <p className="text-muted-foreground mb-0.5">Need:</p>
          {Object.entries(cost).filter(([, v]) => v > 0).map(([r, v]) => (
            <p key={r}><span className="text-muted-foreground">{r}</span> <span className="font-mono text-foreground">{v}</span></p>
          ))}
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Available:</p>
          {Object.entries(cost).filter(([, v]) => v > 0).map(([r]) => (
            <p key={r}><span className="text-muted-foreground">{r}</span> <span className={`font-mono ${(resources[r] ?? 0) >= cost[r] ? 'text-green-400' : 'text-destructive'}`}>{resources[r] ?? 0}</span></p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EconomicOpsPanel({ campaign, myPlayer, actingAsPlayerId, players, mapDef, stateById, operationsStatus, onStaged }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 1;

  const stagingStore = useOperationsStagingStore({ campaignId: campaign?.id, playerId: actingPlayerId, round });

  const [staging, setStaging] = useState(null);
  const [resources, setResources] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removeError, setRemoveError] = useState(null);

  const isLocked = operationsStatus?.economic?.is_locked || operationsStatus?.operations_locked;

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('operationsLockPhase', {
        action: 'getOperationsStatus',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      });
      setStaging(res.data?.economic ?? null);
      setResources(res.data?.economic?.resources ?? {});
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load economic ops state');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (operationsStatus?.economic) {
      setStaging(operationsStatus.economic);
      if (operationsStatus.economic.resources) setResources(operationsStatus.economic.resources);
    }
  }, [operationsStatus?.economic]);

  const myTerritories = Object.values(stateById).filter(s => s.owner_player_id === actingPlayerId);
  const stagedProjects = staging?.staged ?? [];
  const atLimit = stagedProjects.length >= (staging?.projects_limit ?? 1);

  const selectedBuildingDef = BUILDING_OPTIONS.find(b => b.type === selectedBuilding);
  const isSupplyRoute = selectedBuilding === 'supply_route';

  // Territories with an active Resource Hub (has_resource_hub flag)
  const hubTerritories = myTerritories.filter(ts => ts.has_resource_hub);

  // For supply_route: valid "hub" territories are those that have a resource hub
  // AND have all required resources in their own storage (costs are paid from the hub territory).
  function hubCanAffordSupplyRoute(ts, buildingDef) {
    if (!buildingDef) return false;
    const storage = ts.resource_storage ?? {};
    return Object.entries(buildingDef.cost)
      .filter(([r]) => SPENDABLE_RESOURCE_KEYS.includes(r))
      .every(([r, needed]) => (storage[r] ?? 0) >= needed);
  }

  // For regular buildings: territory must have all resources in its own storage
  function territoryCanAffordBuilding(ts, buildingDef) {
    if (!buildingDef) return false;
    const storage = ts.resource_storage ?? {};
    return Object.entries(buildingDef.cost)
      .filter(([r]) => SPENDABLE_RESOURCE_KEYS.includes(r))
      .every(([r, needed]) => (storage[r] ?? 0) >= needed);
  }

  // For supply_route: "territory" selection means picking the hub territory whose resources fund it.
  // validTerritories for supply_route = hub territories that can afford the cost.
  // For other buildings: territories the player owns that can afford + have a slot (any owned = has base omni slot).
  const validTerritories = selectedBuildingDef
    ? isSupplyRoute
      ? hubTerritories.filter(ts => hubCanAffordSupplyRoute(ts, selectedBuildingDef))
      : myTerritories.filter(ts => territoryCanAffordBuilding(ts, selectedBuildingDef))
    : [];

  // Affordability: at least one valid territory
  const canAfford = validTerritories.length > 0;

  const handleStage = async () => {
    if (!selectedBuilding || !selectedTerritory || !canAfford) return;
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('operationsLockPhase', {
        action: 'stageEconomic',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        building_type: selectedBuilding,
        territory_id: selectedTerritory,
      });
      setSelectedBuilding(null);
      setSelectedTerritory('');
      // Mirror to localStorage for reactive header
      const res = await base44.functions.invoke('operationsLockPhase', {
        action: 'getOperationsStatus',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      });
      const serverStaged = res.data?.economic?.staged ?? [];
      stagingStore.setEconomicStaging(serverStaged);
      window.dispatchEvent(new Event('storage'));
      setStaging(res.data?.economic ?? null);
      if (res.data?.economic?.resources) setResources(res.data.economic.resources);
      onStaged?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to stage project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (index) => {
    setRemoveError(null);
    try {
      await base44.functions.invoke('operationsLockPhase', {
        action: 'removeStaged',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        pillar: 'economic',
        index,
      });
      // Mirror to localStorage for reactive header
      const res = await base44.functions.invoke('operationsLockPhase', {
        action: 'getOperationsStatus',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      });
      const serverStaged = res.data?.economic?.staged ?? [];
      stagingStore.setEconomicStaging(serverStaged);
      window.dispatchEvent(new Event('storage'));
      setStaging(res.data?.economic ?? null);
      onStaged?.();
    } catch (e) {
      setRemoveError(e?.response?.data?.error ?? 'Failed to remove project');
    }
  };

  const getTerritoryName = (tid) =>
    mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
          <HardHat className="w-3.5 h-3.5" /> Construction Projects
          {isLocked && <span className="ml-1 text-green-400">(locked)</span>}
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Resource summary — always visible, uses acting player context */}
      <ResourceSummaryPanel
        resources={resources}
        stateById={stateById}
        actingPlayerId={actingPlayerId}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
      {removeError && <p className="text-xs text-destructive">{removeError}</p>}

      {loading && !staging ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Capacity */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-display tracking-wide uppercase">Capacity</span>
            <span className={`font-mono font-bold ${atLimit ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {stagedProjects.length} / {staging?.projects_limit ?? 1}
            </span>
          </div>

          {/* Staged projects */}
          {stagedProjects.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Staged Projects</p>
              {stagedProjects.map((proj, i) => {
                const def = BUILDING_OPTIONS.find(b => b.type === proj.building_type);
                const colors = PILLAR_COLORS[def?.pillar ?? 'economic'];
                const tname = getTerritoryName(proj.territory_id);
                return (
                  <div key={i} className={`flex items-center gap-2 px-2 py-2 rounded border ${colors.border} ${colors.bg}`}>
                    <span className="text-base">{def?.icon ?? '🏗️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${colors.text}`}>{def?.label ?? proj.building_type}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{tname}</p>
                    </div>
                    {!isLocked && (
                      <button onClick={() => handleRemove(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isLocked && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {isLocked && (
            <div className="flex items-center gap-1.5 text-[10px] text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              Construction committed. Buildings enter 'planned' status.
            </div>
          )}

          {/* Building selector */}
          {!isLocked && !atLimit && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Stage a Construction Project</p>

              {/* No territories warning */}
              {myTerritories.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-2 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  You must own at least one territory to construct a building.
                </div>
              )}

              {/* Building type grid with cost preview */}
              <div className="space-y-1.5">
                {BUILDING_OPTIONS.map(b => {
                  const colors = PILLAR_COLORS[b.pillar];
                  const isSelected = selectedBuilding === b.type;
                  const noTerritories = myTerritories.length === 0;
                  // Supply route: requires a resource hub territory with sufficient resources
                  const affordable = b.type === 'supply_route'
                    ? hubTerritories.some(ts => hubCanAffordSupplyRoute(ts, b))
                    : myTerritories.some(ts => territoryCanAffordBuilding(ts, b));
                  // Supply route needs a hub first
                  const noHub = b.type === 'supply_route' && hubTerritories.length === 0;

                  return (
                    <button
                      key={b.type}
                      onClick={() => { setSelectedBuilding(isSelected ? null : b.type); setSelectedTerritory(''); }}
                      disabled={noTerritories || noHub}
                      className={`w-full flex items-start gap-2 px-2 py-2 rounded border text-left transition-all ${
                        isSelected
                          ? `${colors.border} ${colors.bg}`
                          : affordable && !noTerritories && !noHub
                          ? 'border-border bg-muted/10 hover:border-muted-foreground/30'
                          : 'border-border bg-muted/5 opacity-60'
                      }`}
                    >
                      <span className="text-sm shrink-0 mt-0.5">{b.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-[10px] font-semibold ${isSelected ? colors.text : affordable ? 'text-foreground' : 'text-muted-foreground'} truncate`}>
                            {b.label}
                          </p>
                          <span className={`text-[9px] capitalize px-1 py-0.5 rounded border ${colors.border} ${colors.text}`}>{b.pillar}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(b.cost).filter(([, v]) => v > 0).map(([r, needed]) => (
                            <span key={r} className="text-[9px] font-mono text-muted-foreground">
                              {RESOURCE_ICONS[r]}{needed}
                            </span>
                          ))}
                        </div>
                        {noHub && isSelected && (
                          <p className="text-[9px] text-destructive mt-0.5">Requires a Resource Hub in one of your territories.</p>
                        )}
                        {!affordable && !noHub && !noTerritories && isSelected && (
                          <p className="text-[9px] text-destructive mt-0.5">
                            {b.type === 'supply_route'
                              ? 'No Resource Hub territory has sufficient resources.'
                              : 'No single territory has all required resources stored.'}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedBuildingDef && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground italic">{selectedBuildingDef.effect}</p>

                  {/* Cost preview — uses selected territory's storage if one is selected, else global */}
                  <div className="panel p-2 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">Cost: <span className="text-foreground">{selectedBuildingDef.label}</span></p>
                    {(() => {
                      const ts = selectedTerritory ? myTerritories.find(t => t.territory_id === selectedTerritory) : null;
                      const storageToCheck = ts ? (ts.resource_storage ?? {}) : resources;
                      return (
                        <>
                          <CostDisplay cost={selectedBuildingDef.cost} resources={storageToCheck} />
                          {ts && !canAffordBuilding(selectedBuildingDef.cost, storageToCheck) && (
                            <MissingResources cost={selectedBuildingDef.cost} resources={storageToCheck} />
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Territory selector — for supply_route selects the hub territory; otherwise target territory */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                      {isSupplyRoute ? 'Select Resource Hub territory (funds the route):' : 'Select territory:'}
                    </p>
                    {isSupplyRoute && hubTerritories.length === 0 ? (
                      <div className="flex items-center gap-2 px-2 py-2 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        You need a Resource Hub building before establishing a supply route.
                      </div>
                    ) : validTerritories.length === 0 ? (
                      <div className="flex items-center gap-2 px-2 py-2 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {isSupplyRoute
                          ? 'No Resource Hub territory has sufficient resources.'
                          : 'No single territory has all required resources stored in it.'}
                      </div>
                    ) : (
                      <select
                        value={selectedTerritory}
                        onChange={e => setSelectedTerritory(e.target.value)}
                        className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
                      >
                        <option value="">— choose territory —</option>
                        {validTerritories.map(t => {
                          const name = getTerritoryName(t.territory_id);
                          return <option key={t.territory_id} value={t.territory_id}>{name}</option>;
                        })}
                      </select>
                    )}
                    {isSupplyRoute && selectedTerritory && (
                      <p className="text-[9px] text-muted-foreground italic">
                        The route will extend outward from this hub. Target unoccupied territories are set during battle resolution.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleStage}
                disabled={!selectedBuilding || !selectedTerritory || submitting || !canAfford}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hammer className="w-3.5 h-3.5" />}
                Stage Project
              </button>
            </div>
          )}

          {!isLocked && atLimit && (
            <p className="text-[10px] text-muted-foreground text-center italic">
              Construction capacity reached for this round. Remove a project to change selection.
            </p>
          )}

          {myTerritories.length === 0 && (
            <p className="text-xs text-muted-foreground">You own no territories.</p>
          )}
        </>
      )}
    </div>
  );
}