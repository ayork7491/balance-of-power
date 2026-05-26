/**
 * FortifyPanel — left dock panel for the fortify phase.
 * Allows players to stage troop movements and start construction projects.
 */
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Check, X, Castle, Hammer, ArrowRight } from 'lucide-react';
import { useFortifyPhase } from '@/features/campaigns/fortify/useFortifyPhase';
import { useFortifyLockStatus } from '@/features/campaigns/fortify/useFortifyLockStatus';
import MovementSelector from './MovementSelector';
import ConstructionSelector from './ConstructionSelector';

export default function FortifyPanel({ campaign, players, myPlayer, stateById, mapDef, adjacencyMap, selectedTerritoryId, onClearSelection }) {
  const [movements, setMovements] = useState([]);
  const [construction, setConstruction] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { 
    stagedMovements, 
    stagedConstruction, 
    isLoading, 
    reload 
  } = useFortifyPhase({ campaign, myPlayer });
  
  const { allLockStatus, isLoading: loadingLocks } = useFortifyLockStatus({ campaign });

  const maxFortifications = campaign.settings?.max_fortifications_per_phase ?? 3;
  const maxDistance = campaign.settings?.max_fortification_distance ?? 4;

  // Sync with backend on mount
  useEffect(() => {
    if (stagedMovements) setMovements(stagedMovements);
    if (stagedConstruction) setConstruction(stagedConstruction);
  }, [stagedMovements, stagedConstruction]);

  const handleStageMovement = async (origin, destination, troops) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'stageMovement',
        campaign_id: campaign.id,
        origin_territory_id: origin,
        destination_territory_id: destination,
        committed_troops: troops,
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setMovements(res.data.movements);
        setSuccess('Movement staged');
        reload();
      }
    } catch (err) {
      setError(err.message);
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
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setMovements(res.data.movements);
        setSuccess('Movement removed');
        reload();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartConstruction = async (territoryId, structureType) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'startConstruction',
        campaign_id: campaign.id,
        territory_id: territoryId,
        structure_type: structureType,
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setConstruction({ project_id: res.data.project_id });
        setSuccess('Construction started');
        reload();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLock = async () => {
    setError(null);
    setSuccess(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'lockFortify',
        campaign_id: campaign.id,
      });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setSuccess('Fortifications locked');
        reload();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const isLocked = allLockStatus?.find(l => l.player_id === myPlayer.id)?.is_locked ?? false;

  return (
    <div className="p-4 space-y-4">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-status-pending">
          Fortify & Build Phase
        </p>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="p-3 rounded border border-destructive/30 bg-destructive/10 text-xs text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded border border-status-locked/30 bg-status-locked/10 text-xs text-status-locked">
          {success}
        </div>
      )}

      {/* Staged Movements */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Troop Movements ({movements.length}/{maxFortifications})
          </p>
        </div>
        
        {movements.length === 0 ? (
          <p className="text-xs text-muted-foreground">No movements staged yet</p>
        ) : (
          <div className="space-y-1.5">
            {movements.map((mov, idx) => {
              const originName = mapDef?.territories.find(t => t.territory_id === mov.origin_territory_id)?.name ?? mov.origin_territory_id;
              const destName = mapDef?.territories.find(t => t.territory_id === mov.destination_territory_id)?.name ?? mov.destination_territory_id;
              return (
                <div key={idx} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border border-border bg-muted/10">
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
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

        {/* Movement Selector */}
        {!isLocked && movements.length < maxFortifications && (
          <MovementSelector
            campaign={campaign}
            myPlayer={myPlayer}
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
      </div>

      {/* Construction Project */}
      <div className="space-y-2 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Construction
          </p>
        </div>

        {construction ? (
          <div className="p-3 rounded border border-border bg-muted/10 text-xs">
            <p className="text-muted-foreground">Active project</p>
            <p className="text-foreground font-medium mt-1">Loading project details...</p>
          </div>
        ) : (
          !isLocked && (
            <ConstructionSelector
              campaign={campaign}
              myPlayer={myPlayer}
              stateById={stateById}
              mapDef={mapDef}
              selectedTerritoryId={selectedTerritoryId}
              onStartConstruction={handleStartConstruction}
              onClearSelection={onClearSelection}
            />
          )
        )}
      </div>

      {/* Lock Button */}
      {!isLocked && (
        <button
          onClick={handleLock}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all mt-4"
        >
          <Check className="w-4 h-4" />
          Lock Fortifications
        </button>
      )}

      {isLocked && (
        <div className="p-3 rounded border border-status-locked/30 bg-status-locked/10 text-xs text-status-locked flex items-center gap-2">
          <Check className="w-4 h-4" />
          Fortifications Locked
        </div>
      )}

      {/* Other Players Lock Status */}
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
            {players.filter(p => !p.is_eliminated).map(player => {
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
    </div>
  );
}