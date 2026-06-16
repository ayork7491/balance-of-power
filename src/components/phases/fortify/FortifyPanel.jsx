/**
 * FortifyPanel — left dock panel for the fortify & build phase.
 * Allows players to stage troop movements and start construction projects.
 *
 * Perspective: uses unified actingAsCampaignPlayerId from CampaignTestContext.
 * Both fortification staging and construction staging submit for the acting player.
 *
 * Admin controls:
 *  - AdminAdvancePhase appears when all players are locked and user is admin.
 *  - Debug panel shows payload details in test mode.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Check, X, ArrowRight, TestTube, User, ChevronDown } from 'lucide-react';
import { useFortifyPhase } from '@/features/campaigns/fortify/useFortifyPhase';
import { useFortifyLockStatus } from '@/features/campaigns/fortify/useFortifyLockStatus';
import MovementSelector from './MovementSelector';
import ConstructionSelector from './ConstructionSelector';
import AdminAdvancePhase from '@/components/admin/AdminAdvancePhase';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

// ── Drawer-only fortification form (no map selection required) ────────────────
function DrawerFortifyForm({ myPlayer, stateById, mapDef, adjacencyMap, maxDistance, existingMovements, onStageMovement }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [troops, setTroops] = useState('');

  const myTerritories = useMemo(() =>
    Object.values(stateById).filter(s => s.owner_player_id === myPlayer?.id),
    [stateById, myPlayer]
  );

  const validDestinations = useMemo(() => {
    if (!origin || !adjacencyMap) return [];
    const playerId = myPlayer?.id;
    const visited = new Set([origin]);
    const queue = [[origin, 0]];
    const valid = [];
    while (queue.length > 0) {
      const [current, dist] = queue.shift();
      if (dist > 0 && dist <= maxDistance) {
        const s = stateById[current];
        if (s?.owner_player_id === playerId) valid.push(current);
        else continue;
      }
      if (dist < maxDistance) {
        const neighbors = adjacencyMap[origin] instanceof Set ? Array.from(adjacencyMap[origin]) : (adjacencyMap[current] ?? []);
        const neighborList = Array.isArray(neighbors) ? neighbors : Array.from(neighbors);
        for (const n of neighborList) {
          if (!visited.has(n)) {
            const ns = stateById[n];
            if (ns?.owner_player_id === playerId || n === origin) {
              visited.add(n);
              queue.push([n, dist + 1]);
            }
          }
        }
      }
    }
    return valid;
  }, [origin, myPlayer, stateById, adjacencyMap, maxDistance]);

  const availableTroops = useMemo(() => {
    if (!origin) return 0;
    const s = stateById[origin];
    const committed = existingMovements.filter(m => m.origin_territory_id === origin).reduce((sum, m) => sum + (m.committed_troops || 0), 0);
    return Math.max(0, (s?.troop_count || 0) - committed);
  }, [origin, stateById, existingMovements]);

  const getName = (tid) => mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  const handleStage = () => {
    if (!origin || !destination || !troops) return;
    onStageMovement(origin, destination, parseInt(troops));
    setOrigin('');
    setDestination('');
    setTroops('');
  };

  return (
    <div className="space-y-2 p-3 rounded border border-border bg-muted/10">
      <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Stage Fortification</p>
      <div className="space-y-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Origin territory</label>
          <select value={origin} onChange={e => { setOrigin(e.target.value); setDestination(''); setTroops(''); }}
            className="w-full text-xs bg-muted/20 border border-border rounded px-2 py-1.5 text-foreground">
            <option value="">— select origin —</option>
            {myTerritories.map(s => (
              <option key={s.territory_id} value={s.territory_id}>{getName(s.territory_id)} ({s.troop_count ?? 0} troops)</option>
            ))}
          </select>
        </div>
        {origin && (
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Destination territory</label>
            {validDestinations.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No valid destinations within {maxDistance} hops.</p>
            ) : (
              <select value={destination} onChange={e => setDestination(e.target.value)}
                className="w-full text-xs bg-muted/20 border border-border rounded px-2 py-1.5 text-foreground">
                <option value="">— select destination —</option>
                {validDestinations.map(tid => (
                  <option key={tid} value={tid}>{getName(tid)}</option>
                ))}
              </select>
            )}
          </div>
        )}
        {origin && destination && (
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Troops to move (max {availableTroops})</label>
            <input type="number" min="1" max={availableTroops} value={troops} onChange={e => setTroops(e.target.value)}
              placeholder="0"
              className="w-full text-xs bg-muted/20 border border-border rounded px-2 py-1.5 text-foreground" />
          </div>
        )}
        <button
          onClick={handleStage}
          disabled={!origin || !destination || !troops || parseInt(troops) < 1 || parseInt(troops) > availableTroops}
          className="w-full text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 transition-all"
        >
          Stage Movement
        </button>
      </div>
    </div>
  );
}

export default function FortifyPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  adjacencyMap,
  selectedTerritoryId,
  onClearSelection,
  onPhaseChanged,
}) {
  // Unified perspective from centralized context
  const {
    actingAsPlayer,
    actingAsCampaignPlayerId,
    effectiveActingPlayer,
    isTestMode,
    isAdmin,
  } = useCampaignTestContext();

  // Action player: if admin has set acting-as perspective, use that; else use myPlayer
  const actionPlayer = effectiveActingPlayer ?? myPlayer;

  const [movements, setMovements] = useState([]);
  const [construction, setConstruction] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // TerritoryBuilding records for the selected territory — used for accurate slot occupancy.
  // Includes in-progress construction so slots are correctly reserved.
  const [selectedTerritoryBuildings, setSelectedTerritoryBuildings] = useState([]);

  const loadTerritoryBuildings = useCallback(async (territoryId) => {
    if (!territoryId || !campaign?.id) { setSelectedTerritoryBuildings([]); return; }
    try {
      const buildings = await base44.entities.TerritoryBuilding.filter({
        campaign_id: campaign.id,
        territory_id: territoryId,
      });
      setSelectedTerritoryBuildings(buildings);
    } catch {
      setSelectedTerritoryBuildings([]);
    }
  }, [campaign?.id]);

  useEffect(() => {
    loadTerritoryBuildings(selectedTerritoryId);
  }, [selectedTerritoryId, loadTerritoryBuildings]);

  const { stagedMovements, stagedConstruction, isLoading, reload } = useFortifyPhase({
    campaign,
    myPlayer,
  });

  const { allLockStatus, isLoading: loadingLocks } = useFortifyLockStatus({ campaign });

  const maxFortifications = campaign?.settings?.max_fortifications_per_phase ?? 3;
  const maxDistance = campaign?.settings?.max_fortification_distance ?? 4;

  // Sync staged data from backend
  useEffect(() => {
    if (stagedMovements) setMovements(stagedMovements);
    if (stagedConstruction) setConstruction(stagedConstruction);
  }, [stagedMovements, stagedConstruction]);

  // Determine lock status for the ACTION player (acting-as or self)
  const isLocked = useMemo(() => {
    const targetId = actionPlayer?.id ?? myPlayer?.id;
    return allLockStatus?.find(l => l.player_id === targetId)?.is_locked ?? false;
  }, [allLockStatus, actionPlayer, myPlayer]);

  // All players locked?
  const allPlayersLocked = useMemo(() => {
    const activePlayers = players?.filter(p => !p.is_eliminated) ?? [];
    if (activePlayers.length === 0) return false;
    const lockedCount = allLockStatus.filter(l => l.is_locked).length;
    return lockedCount >= activePlayers.length;
  }, [players, allLockStatus]);

  // Build acting_as_player_id payload field
  const actingPayload = () => ({
    acting_as_player_id: actingAsCampaignPlayerId ?? null,
  });

  const handleStageMovement = async (origin, destination, troops) => {
    setError(null);
    setSuccess(null);
    const payload = {
      action: 'stageMovement',
      campaign_id: campaign.id,
      origin_territory_id: origin,
      destination_territory_id: destination,
      committed_troops: troops,
      ...actingPayload(),
    };
    if (isTestMode) console.log('[FortifyPanel] stageMovement payload', payload);
    try {
      const res = await base44.functions.invoke('fortifyPhase', payload);
      if (res.data.error) {
        setError(`stageMovement failed: ${res.data.error}`);
      } else {
        setMovements(res.data.movements);
        setSuccess('Movement staged');
        reload();
      }
    } catch (err) {
      setError(`stageMovement error (fn: fortifyPhase): ${err.message}`);
    }
  };

  const handleDeleteMovement = async (movementId) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'deleteMovement',
        campaign_id: campaign.id,
        movement_id: movementId,
        ...actingPayload(),
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setMovements(res.data.movements);
        setSuccess('Movement removed');
        reload();
      }
    } catch (err) {
      setError(`deleteMovement error: ${err.message}`);
    }
  };

  const handleStartConstruction = async (territoryId, structureType) => {
    setError(null);
    setSuccess(null);
    const payload = {
      action: 'startConstruction',
      campaign_id: campaign.id,
      territory_id: territoryId,
      structure_type: structureType,
      ...actingPayload(),
    };
    if (isTestMode) console.log('[FortifyPanel] startConstruction payload', payload);
    try {
      const res = await base44.functions.invoke('fortifyPhase', payload);
      if (res.data.error) {
        setError(`startConstruction failed: ${res.data.error}`);
      } else {
        setConstruction({ territory_id: territoryId, structure_type: structureType });
        setSuccess('Construction staged');
        reload();
        loadTerritoryBuildings(territoryId);
      }
    } catch (err) {
      setError(`startConstruction error (fn: fortifyPhase): ${err.message}`);
    }
  };

  const handleLock = async () => {
    setError(null);
    setSuccess(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'lockFortify',
        campaign_id: campaign.id,
        ...actingPayload(),
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setSuccess('Fortifications locked');
        reload();
      }
    } catch (err) {
      setError(`lockFortify error: ${err.message}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-status-pending">
          Fortify & Build Phase
        </p>
        {actionPlayer && actionPlayer.id !== myPlayer?.id && (
          <p className="text-[10px] text-status-pending mt-0.5">
            Acting as: {actionPlayer.display_name}
          </p>
        )}
      </div>

      {/* Error / Success */}
      {error && (
        <div className="p-3 rounded border border-destructive/30 bg-destructive/10 text-xs text-destructive break-words">
          ⚠ {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded border border-status-locked/30 bg-status-locked/10 text-xs text-status-locked">
          ✓ {success}
        </div>
      )}

      {/* Staged Movements */}
      <div className="space-y-2">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Troop Movements ({movements.length}/{maxFortifications})
        </p>

        {movements.length === 0 ? (
          <p className="text-xs text-muted-foreground">No movements staged yet</p>
        ) : (
          <div className="space-y-1.5">
            {movements.map((mov, idx) => {
              const originName = mapDef?.territories.find(t => t.territory_id === mov.origin_territory_id)?.name ?? mov.origin_territory_id;
              const destName = mapDef?.territories.find(t => t.territory_id === mov.destination_territory_id)?.name ?? mov.destination_territory_id;
              return (
                <div key={idx} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border border-border bg-muted/10">
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{originName}</span>
                  <span className="font-mono text-foreground">{mov.committed_troops}</span>
                  <span className="flex-1 truncate">{destName}</span>
                  {!isLocked && (
                    <button
                      onClick={() => handleDeleteMovement(mov.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Movement Selector — map flow (requires map selection) */}
        {!isLocked && movements.length < maxFortifications && selectedTerritoryId && (
          <MovementSelector
            campaign={campaign}
            myPlayer={actionPlayer}
            stateById={stateById}
            mapDef={mapDef}
            adjacencyMap={adjacencyMap}
            selectedTerritoryId={selectedTerritoryId}
            maxDistance={maxDistance}
            existingMovements={movements}
            onStageMovement={handleStageMovement}
            onClearSelection={onClearSelection}
          />
        )}

        {/* Drawer-only fortification form (no map selection needed) */}
        {!isLocked && movements.length < maxFortifications && !selectedTerritoryId && (
          <DrawerFortifyForm
            myPlayer={actionPlayer}
            stateById={stateById}
            mapDef={mapDef}
            adjacencyMap={adjacencyMap}
            maxDistance={maxDistance}
            existingMovements={movements}
            onStageMovement={handleStageMovement}
          />
        )}
      </div>

      {/* Construction Project */}
      <div className="space-y-2 pt-4 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Construction
        </p>

        {construction ? (
          <div className="p-3 rounded border border-border bg-muted/10 text-xs">
            <p className="text-status-locked font-medium">
              ✓ Construction staged: {construction.structure_type} in {
                mapDef?.territories.find(t => t.territory_id === construction.territory_id)?.name ?? construction.territory_id
              }
            </p>
          </div>
        ) : (
          !isLocked && (
            <ConstructionSelector
              campaign={campaign}
              myPlayer={actionPlayer}
              stateById={stateById}
              mapDef={mapDef}
              selectedTerritoryId={selectedTerritoryId}
              territoryBuildings={selectedTerritoryBuildings}
              onStartConstruction={handleStartConstruction}
              onClearSelection={onClearSelection}
            />
          )
        )}
      </div>

      {/* Lock Button */}
      {!isLocked ? (
        <button
          onClick={handleLock}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all mt-4"
        >
          <Check className="w-4 h-4" />
          Lock Fortifications
        </button>
      ) : (
        <div className="p-3 rounded border border-status-locked/30 bg-status-locked/10 text-xs text-status-locked flex items-center gap-2">
          <Check className="w-4 h-4" />
          Fortifications Locked
        </div>
      )}

      {/* Player Lock Status */}
      <div className="pt-4 border-t border-border space-y-2">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Player Status
        </p>
        {loadingLocks ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="space-y-1">
            {players?.filter(p => !p.is_eliminated).map(player => {
              const lockStatus = allLockStatus?.find(l => l.player_id === player.id);
              const isPlayerLocked = lockStatus?.is_locked ?? false;
              return (
                <div key={player.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border bg-muted/10">
                  <span className="text-foreground">{player.display_name}</span>
                  {isPlayerLocked ? (
                    <span className="text-status-locked flex items-center gap-1">
                      <Check className="w-3 h-3" /> Locked
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Pending</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Advance Phase — visible when all locked and user is admin */}
      {isAdmin && (
        <div className="pt-4 border-t border-border">
          <AdminAdvancePhase
            campaign={campaign}
            players={players}
            myPlayer={myPlayer}
            allLockStatus={allLockStatus}
            onPhaseChanged={onPhaseChanged}
          />
        </div>
      )}

      {/* Debug panel (test mode only) */}
      {isTestMode && (
        <div className="pt-4 border-t border-border">
          <p className="text-[10px] font-display tracking-widest uppercase text-muted-foreground mb-2">
            Debug — Perspective
          </p>
          <div className="space-y-1 text-[10px]">
            <div className="flex gap-2">
              <User className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">Auth player:</span>
              <span className="text-foreground">{myPlayer?.display_name ?? '—'}</span>
            </div>
            <div className="flex gap-2">
              <TestTube className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">Acting as:</span>
              <span className="text-foreground">{actingAsPlayer ? `${actingAsPlayer.display_name} (Test)` : '(self)'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Submit player:</span>
              <span className="text-status-pending font-semibold">{actionPlayer?.display_name ?? '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">acting_as_player_id:</span>
              <span className="text-foreground font-mono">{actingAsCampaignPlayerId ?? 'null'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Function:</span>
              <span className="text-foreground font-mono">fortifyPhase</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">My lock:</span>
              <span className={isLocked ? 'text-status-locked' : 'text-status-pending'}>
                {isLocked ? '✓ Locked' : '⊙ Pending'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">All locked:</span>
              <span className={allPlayersLocked ? 'text-status-locked' : 'text-status-pending'}>
                {allPlayersLocked ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Admin advance:</span>
              <span className={isAdmin && allPlayersLocked ? 'text-status-locked' : 'text-muted-foreground'}>
                {isAdmin ? (allPlayersLocked ? '✓ Available' : '✗ Waiting for locks') : '✗ Not admin'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}