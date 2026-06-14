/**
 * MilitaryConsolidationPanel — Sprint 5B.7
 *
 * Military tab content during Consolidation Phase.
 * Shows ONLY fortification content:
 *   - Staged fortification movements
 *   - Movement selector (while unlocked)
 *   - Existing fortifications summary
 *
 * No construction, no admin controls, no debug panels.
 * Lock-in is handled by ConsolidationPhaseHeader.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, ArrowRight, X, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useFortifyPhase } from '@/features/campaigns/fortify/useFortifyPhase';
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
}) {
  const { actingAsCampaignPlayerId, effectiveActingPlayer } = useCampaignTestContext();
  const actionPlayer = effectiveActingPlayer ?? myPlayer;

  const stagingStore = useConsolidationStagingStore({
    campaignId: campaign?.id,
    playerId: actionPlayer?.id,
    round: campaign?.current_round ?? 1,
  });

  const [movements, setMovements] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const maxFortifications = campaign?.settings?.max_fortifications_per_phase ?? 3;
  const maxDistance = campaign?.settings?.max_fortification_distance ?? 4;
  const round = campaign?.current_round ?? 1;

  const { stagedMovements, isLoading, reload } = useFortifyPhase({ campaign, myPlayer });

  useEffect(() => {
    if (stagedMovements) setMovements(stagedMovements);
  }, [stagedMovements]);

  // Determine if acting player is locked (phase+round specific)
  const [isLocked, setIsLocked] = useState(false);
  const loadLockStatus = useCallback(async () => {
    if (!campaign?.id || !actionPlayer?.id) return;
    try {
      const decisions = await base44.entities.PhaseDecision.filter({
        campaign_id: campaign.id,
        player_id: actionPlayer.id,
        phase: 'fortify',
        round,
      });
      setIsLocked(decisions[0]?.is_locked ?? false);
    } catch { setIsLocked(false); }
  }, [campaign?.id, actionPlayer?.id, round]);

  useEffect(() => { loadLockStatus(); }, [loadLockStatus]);

  const actingPayload = () => ({ acting_as_player_id: actingAsCampaignPlayerId ?? null });

  const handleStageMovement = async (origin, destination, troops) => {
    setError(null); setSuccess(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'stageMovement',
        campaign_id: campaign.id,
        origin_territory_id: origin,
        destination_territory_id: destination,
        committed_troops: troops,
        ...actingPayload(),
      });
      const updatedMovements = res.data.movements;
      setMovements(updatedMovements);
      // Mirror to localStorage for reactive ConsolidationPhaseHeader
      stagingStore.setMilitaryStaging(updatedMovements);
      window.dispatchEvent(new Event('storage'));
      setSuccess('Fortification staged');
      reload();
    } catch (err) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to stage movement');
    }
  };

  const handleDeleteMovement = async (movementId) => {
    setError(null); setSuccess(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'deleteMovement',
        campaign_id: campaign.id,
        movement_id: movementId,
        ...actingPayload(),
      });
      const updatedMovements = res.data.movements;
      setMovements(updatedMovements);
      // Mirror to localStorage for reactive ConsolidationPhaseHeader
      stagingStore.setMilitaryStaging(updatedMovements);
      window.dispatchEvent(new Event('storage'));
      setSuccess('Movement removed');
      reload();
    } catch (err) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to remove movement');
    }
  };

  const getTerritoryName = (tid) =>
    mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading fortifications…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Section header */}
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
      {success && (
        <div className="p-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">{success}</div>
      )}

      {/* Staged movements */}
      {movements.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No fortifications staged yet.</p>
      ) : (
        <div className="space-y-1.5">
          {movements.map((mov, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border border-red-500/20 bg-red-500/5">
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

      {/* Movement selector — only when not locked and under limit */}
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