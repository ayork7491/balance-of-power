/**
 * EconomicOpsPanel — Atomic Refactor (Phase 1).
 *
 * All staging is LOCAL-FIRST — zero server writes during staging.
 * Parent (CommandCenterPanel) owns localStaging state and passes it down.
 * Lock is handled by OperationsPhaseHeader which sends the atomic payload.
 */
import { useState, useMemo } from 'react';
import { HardHat, X, CheckCircle2, Hammer, AlertCircle } from 'lucide-react';
import { ALL_BUILDING_DEFINITIONS } from '@/config/buildingDefinitions.ts';
import { SC_ADJACENCY } from '@/shared/maps/shatteredCrownConfig';
import ResourceSummaryPanel from './ResourceSummaryPanel';

const PILLAR_COLORS = {
  military:   { text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10' },
  economic:   { text: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  diplomatic: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
};

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const SPENDABLE_RESOURCE_KEYS = ['gold', 'iron', 'timber', 'stone'];

const BUILDING_OPTIONS = ALL_BUILDING_DEFINITIONS.map(b => ({
  type: b.type, label: b.label, pillar: b.pillar, cost: b.cost, rounds: b.rounds, effect: b.effect,
  icon: {
    barracks: '🏰', war_council: '⚔️', logistics_corps: '🚩',
    embassy: '🏛️', council_chamber: '🏛', foreign_office: '🏢', monument: '🗿',
    marketplace: '🏪', builders_guild: '🔨', trade_network: '🔗',
    resource_hub: '🏭', supply_route: '🛤️', warehouse: '📦',
  }[b.type] ?? '🏗️',
}));

function CostDisplay({ cost, resources }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(cost).filter(([, v]) => v > 0).map(([r, needed]) => {
        const have = resources[r] ?? 0;
        const ok = have >= needed;
        return (
          <span key={r} className={`flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}>
            {RESOURCE_ICONS[r] ?? r} {needed}
            {!ok && <span className="ml-0.5 opacity-70">(have {have})</span>}
          </span>
        );
      })}
    </div>
  );
}

function buildAdjMap(scAdj) {
  const adj = {};
  for (const { from, to } of scAdj) {
    if (!adj[from]) adj[from] = [];
    if (!adj[to])   adj[to]   = [];
    adj[from].push(to);
    adj[to].push(from);
  }
  return adj;
}

function getTerritoriesInRange2(hubId, adjMap) {
  if (!hubId) return [];
  const inRange = [];
  const visited = new Set([hubId]);
  const queue = [[hubId, 0]];
  while (queue.length > 0) {
    const [cur, dist] = queue.shift();
    if (dist > 0) inRange.push(cur);
    if (dist < 2) {
      for (const nb of (adjMap[cur] ?? [])) {
        if (!visited.has(nb)) { visited.add(nb); queue.push([nb, dist + 1]); }
      }
    }
  }
  return inRange;
}

export default function EconomicOpsPanel({
  campaign, myPlayer, actingAsPlayerId, players, mapDef, stateById,
  operationsStatus, localStaging, onLocalChange, isLocked,
}) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const resources = operationsStatus?.economic?.resources ?? {};
  const projectsLimit = operationsStatus?.economic?.projects_limit ?? 1;

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedSourceTerritory, setSelectedSourceTerritory] = useState('');
  const [stageError, setStageError] = useState(null);

  const stagedProjects = localStaging ?? [];
  const atLimit = stagedProjects.length >= projectsLimit;
  const isSupplyRoute = selectedBuilding === 'supply_route';
  const selectedBuildingDef = BUILDING_OPTIONS.find(b => b.type === selectedBuilding);

  const myTerritories = Object.values(stateById).filter(s => s.owner_player_id === actingPlayerId);
  const hubTerritories = myTerritories.filter(ts => ts.has_resource_hub);

  const scAdjMap = useMemo(() => buildAdjMap(SC_ADJACENCY), []);

  const supplyRouteSourceTerritories = useMemo(() => {
    if (!isSupplyRoute || !selectedTerritory) return [];
    return getTerritoriesInRange2(selectedTerritory, scAdjMap)
      .filter(tid => tid !== selectedTerritory)
      .map(tid => {
        const ts = stateById[tid] ?? { territory_id: tid };
        const def = mapDef?.territories?.find(t => t.territory_id === tid);
        return { territory_id: tid, name: def?.name ?? tid, state: ts };
      });
  }, [isSupplyRoute, selectedTerritory, scAdjMap, stateById, mapDef]);

  // Available storage accounting for staged costs
  const availableStorage = useMemo(() => {
    const avail = {};
    for (const ts of myTerritories) avail[ts.territory_id] = { ...(ts.resource_storage ?? {}) };
    for (const proj of stagedProjects) {
      const costTid = proj.territory_id;
      if (!avail[costTid]) continue;
      for (const [r, amt] of Object.entries(proj.cost_paid ?? {})) {
        avail[costTid][r] = Math.max(0, (avail[costTid][r] ?? 0) - amt);
      }
    }
    return avail;
  }, [myTerritories, stagedProjects]);

  const canAffordAtTerritory = (tid, cost) => {
    const storage = availableStorage[tid] ?? {};
    return SPENDABLE_RESOURCE_KEYS.every(r => (storage[r] ?? 0) >= (cost[r] ?? 0));
  };

  const validTerritories = useMemo(() => {
    if (!selectedBuildingDef) return [];
    if (isSupplyRoute) return hubTerritories.filter(ts => canAffordAtTerritory(ts.territory_id, selectedBuildingDef.cost));
    return myTerritories.filter(ts => canAffordAtTerritory(ts.territory_id, selectedBuildingDef.cost));
  }, [selectedBuildingDef, isSupplyRoute, hubTerritories, myTerritories, availableStorage]);

  const getTerritoryName = (tid) => mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  const handleStage = () => {
    if (!selectedBuilding || !selectedTerritory) return;
    if (isSupplyRoute && !selectedSourceTerritory) return;
    setStageError(null);
    const def = selectedBuildingDef;
    if (!def) return;
    if (!canAffordAtTerritory(selectedTerritory, def.cost)) {
      setStageError(`Not enough resources in ${getTerritoryName(selectedTerritory)}.`);
      return;
    }
    onLocalChange([...stagedProjects, {
      building_type: selectedBuilding,
      territory_id: selectedTerritory,
      source_territory_id: isSupplyRoute ? selectedSourceTerritory : null,
      cost_paid: { ...def.cost },
      staged_at: new Date().toISOString(),
    }]);
    setSelectedBuilding(null);
    setSelectedTerritory('');
    setSelectedSourceTerritory('');
  };

  const handleRemove = (index) => onLocalChange(stagedProjects.filter((_, i) => i !== index));

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
          <HardHat className="w-3.5 h-3.5" /> Construction Projects
          {isLocked && <span className="ml-1 text-green-400">(locked)</span>}
        </p>
      </div>

      <ResourceSummaryPanel resources={resources} stateById={stateById} actingPlayerId={actingPlayerId} />

      {stageError && <p className="text-xs text-destructive">{stageError}</p>}

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-display tracking-wide uppercase">Capacity</span>
        <span className={`font-mono font-bold ${atLimit ? 'text-amber-400' : 'text-muted-foreground'}`}>
          {stagedProjects.length} / {projectsLimit}
        </span>
      </div>

      {stagedProjects.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Staged Projects</p>
          {stagedProjects.map((proj, i) => {
            const def = BUILDING_OPTIONS.find(b => b.type === proj.building_type);
            const colors = PILLAR_COLORS[def?.pillar ?? 'economic'];
            return (
              <div key={i} className={`flex items-center gap-2 px-2 py-2 rounded border ${colors.border} ${colors.bg}`}>
                <span className="text-base">{def?.icon ?? '🏗️'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${colors.text}`}>{def?.label ?? proj.building_type}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{getTerritoryName(proj.territory_id)}</p>
                  {proj.source_territory_id && <p className="text-[10px] text-muted-foreground truncate">→ {getTerritoryName(proj.source_territory_id)}</p>}
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
          <CheckCircle2 className="w-3 h-3" /> Construction committed.
        </div>
      )}

      {!isLocked && !atLimit && (
        <div className="space-y-2 pt-1 border-t border-border">
          <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Stage a Construction Project</p>

          {myTerritories.length === 0 && (
            <div className="flex items-center gap-2 px-2 py-2 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">
              <AlertCircle className="w-3 h-3 shrink-0" /> You must own at least one territory to construct a building.
            </div>
          )}

          <div className="space-y-1.5">
            {BUILDING_OPTIONS.map(b => {
              const colors = PILLAR_COLORS[b.pillar];
              const isSelected = selectedBuilding === b.type;
              const noHub = b.type === 'supply_route' && hubTerritories.length === 0;
              const affordable = b.type === 'supply_route'
                ? hubTerritories.some(ts => canAffordAtTerritory(ts.territory_id, b.cost))
                : myTerritories.some(ts => canAffordAtTerritory(ts.territory_id, b.cost));
              return (
                <button key={b.type}
                  onClick={() => { setSelectedBuilding(isSelected ? null : b.type); setSelectedTerritory(''); setSelectedSourceTerritory(''); }}
                  disabled={myTerritories.length === 0 || noHub}
                  className={`w-full flex items-start gap-2 px-2 py-2 rounded border text-left transition-all ${
                    isSelected ? `${colors.border} ${colors.bg}`
                    : affordable && !noHub ? 'border-border bg-muted/10 hover:border-muted-foreground/30'
                    : 'border-border bg-muted/5 opacity-60'
                  }`}
                >
                  <span className="text-sm shrink-0 mt-0.5">{b.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-[10px] font-semibold ${isSelected ? colors.text : affordable ? 'text-foreground' : 'text-muted-foreground'} truncate`}>{b.label}</p>
                      <span className={`text-[9px] capitalize px-1 py-0.5 rounded border ${colors.border} ${colors.text}`}>{b.pillar}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {Object.entries(b.cost).filter(([, v]) => v > 0).map(([r, needed]) => (
                        <span key={r} className="text-[9px] font-mono text-muted-foreground">{RESOURCE_ICONS[r]}{needed}</span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedBuildingDef && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground italic">{selectedBuildingDef.effect}</p>
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">{isSupplyRoute ? 'Step 1: Select Resource Hub territory:' : 'Select territory:'}</p>
                {isSupplyRoute && hubTerritories.length === 0 ? (
                  <div className="flex items-center gap-2 px-2 py-2 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive">
                    <AlertCircle className="w-3 h-3 shrink-0" /> You need an active Resource Hub building first.
                  </div>
                ) : validTerritories.length === 0 && !isSupplyRoute ? (
                  <div className="flex items-center gap-2 px-2 py-2 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive">
                    <AlertCircle className="w-3 h-3 shrink-0" /> No territory has all required resources stored.
                  </div>
                ) : (
                  <select value={selectedTerritory}
                    onChange={e => { setSelectedTerritory(e.target.value); setSelectedSourceTerritory(''); }}
                    className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground">
                    <option value="">— choose territory —</option>
                    {validTerritories.map(t => (
                      <option key={t.territory_id} value={t.territory_id}>{getTerritoryName(t.territory_id)}</option>
                    ))}
                  </select>
                )}

                {selectedTerritory && selectedBuildingDef && (
                  <CostDisplay cost={selectedBuildingDef.cost} resources={availableStorage[selectedTerritory] ?? {}} />
                )}

                {isSupplyRoute && selectedTerritory && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">Step 2: Select source territory (within range 2):</p>
                    {supplyRouteSourceTerritories.length === 0 ? (
                      <div className="flex items-center gap-2 px-2 py-2 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive">
                        <AlertCircle className="w-3 h-3 shrink-0" /> No territories within range 2.
                      </div>
                    ) : (
                      <select value={selectedSourceTerritory} onChange={e => setSelectedSourceTerritory(e.target.value)}
                        className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground">
                        <option value="">— choose source territory —</option>
                        {supplyRouteSourceTerritories.map(t => {
                          const ownerPlayer = players?.find(p => p.id === t.state?.owner_player_id);
                          const isEnemy = t.state?.owner_player_id && t.state.owner_player_id !== actingPlayerId;
                          return (
                            <option key={t.territory_id} value={t.territory_id}>
                              {t.name}{ownerPlayer ? ` (${ownerPlayer.display_name}${isEnemy ? ' — enemy ⚔' : ''})` : ' (unoccupied)'}
                            </option>
                          );
                        })}
                      </select>
                    )}
                    {selectedSourceTerritory && (() => {
                      const isEnemy = stateById[selectedSourceTerritory]?.owner_player_id && stateById[selectedSourceTerritory].owner_player_id !== actingPlayerId;
                      return isEnemy
                        ? <p className="text-[9px] text-amber-400 italic">⚔ Enemy — battle card generated on lock.</p>
                        : <p className="text-[9px] text-green-400 italic">✓ Friendly — supply route established on lock.</p>;
                    })()}
                  </div>
                )}
              </div>

              <button onClick={handleStage}
                disabled={!selectedBuilding || !selectedTerritory || (isSupplyRoute && !selectedSourceTerritory)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40">
                <Hammer className="w-3.5 h-3.5" /> Stage Project
              </button>
            </div>
          )}
        </div>
      )}

      {!isLocked && atLimit && (
        <p className="text-[10px] text-muted-foreground text-center italic">
          Construction capacity reached. Remove a project to change.
        </p>
      )}
    </div>
  );
}