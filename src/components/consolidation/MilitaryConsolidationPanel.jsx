/**
 * MilitaryConsolidationPanel — fully local-first (Atomic Architecture).
 *
 * All staging is LOCAL ONLY — no server writes during staging.
 * ConsolidationPhaseHeader submits the atomic lock payload (movements included).
 */
import { useState } from 'react';
import { ArrowRight, X, Shield } from 'lucide-react';
import MovementSelector from '@/components/phases/fortify/MovementSelector';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';
import { useConsolidationStagingStore } from '@/features/campaigns/consolidation/useConsolidationStagingStore';

export default function MilitaryConsolidationPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  adjacencyMap,
  selectedTerritoryId,
  onClearSelection,
  isLocked,
}) {
  const { effectiveActingPlayer } = useCampaignTestContext();
  const actionPlayer = effectiveActingPlayer ?? myPlayer;

  const stagingStore = useConsolidationStagingStore({
    campaignId: campaign?.id,
    playerId: actionPlayer?.id,
    round: campaign?.current_round ?? 1,
  });

  // Pure local state — no server reads during staging
  const [movements, setMovements] = useState(() => stagingStore.getMilitaryStaging());
  const [error, setError] = useState(null);

  const maxFortifications = campaign?.settings?.max_fortifications_per_phase ?? 3;
  const maxDistance = campaign?.settings?.max_fortification_distance ?? 4;

  const getTerritoryName = (tid) =>
    mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  const handleStageMovement = (origin, destination, troops) => {
    setError(null);
    const existing = movements.findIndex(
      m => m.origin_territory_id === origin && m.destination_territory_id === destination
    );
    const newMovement = {
      id: existing >= 0 ? movements[existing].id : `mov_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      origin_territory_id: origin,
      destination_territory_id: destination,
      committed_troops: troops,
    };
    const updated = existing >= 0
      ? movements.map((m, i) => i === existing ? newMovement : m)
      : [...movements, newMovement];
    setMovements(updated);
    stagingStore.setMilitaryStaging(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const handleDeleteMovement = (movId) => {
    setError(null);
    const updated = movements.filter(m => m.id !== movId);
    setMovements(updated);
    stagingStore.setMilitaryStaging(updated);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-red-400" />
        <p className="font-display text-xs tracking-widest uppercase text-red-400">Fortifications</p>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          {movements.length}/{maxFortifications}
        </span>
      </div>

      {error && (
        <div className="p-2 rounded border border-destructive/30 bg-destructive/10 text-xs text-destructive">{error}</div>
      )}

      {movements.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No fortifications staged yet.</p>
      ) : (
        <div className="space-y-1.5">
          {movements.map((mov) => (
            <div key={mov.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border border-red-500/20 bg-red-500/5">
              <span className="text-muted-foreground shrink-0 truncate flex-1">{getTerritoryName(mov.origin_territory_id)}</span>
              <ArrowRight className="w-3 h-3 text-red-400 shrink-0" />
              <span className="font-mono text-foreground shrink-0">{mov.committed_troops}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0 truncate flex-1">{getTerritoryName(mov.destination_territory_id)}</span>
              {!isLocked && (
                <button
                  onClick={() => handleDeleteMovement(mov.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLocked && movements.length < maxFortifications && (
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

      {isLocked && (
        <div className="p-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">
          ✓ Fortifications locked in.
        </div>
      )}

      {!isLocked && movements.length >= maxFortifications && (
        <p className="text-[10px] text-muted-foreground italic">
          Maximum fortifications staged ({maxFortifications}). Remove one to change selection.
        </p>
      )}
    </div>
  );
}