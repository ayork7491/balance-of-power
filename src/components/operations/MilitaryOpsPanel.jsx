/**
 * MilitaryOpsPanel — Sprint 5B.5
 *
 * Military tab content during Operations Phase.
 * Shows only staged attacks and the target selector.
 * No player lock status. No admin controls. No global lock-in.
 *
 * Props match AttackPanel's attack-specific props.
 */
import { useMemo } from 'react';
import { Loader2, Lock, Swords, SkipForward, TestTube } from 'lucide-react';
import { useAttackPhase } from '@/features/campaigns/attack';
import { useActingAsPayload } from '@/features/adminTestMode/useActingAsPayload';
import AttackStagingRow from '@/components/phases/attack/AttackStagingRow';
import AttackTargetSelector from '@/components/phases/attack/AttackTargetSelector';

export default function MilitaryOpsPanel({
  campaign,
  players,
  myPlayer,
  stateById,
  mapDef,
  adjacencyMap,
  selectedTerritoryId,
  preselectedTargetId,
  onClearSelection,
  onPhaseChanged,
}) {
  const round = campaign?.current_round ?? 1;
  const { actingPlayer, actingAsId } = useActingAsPayload(myPlayer);

  const {
    attacks, decision, loading, submitting, error,
    isLocked, maxAttacks,
    handleStageAttack, handleDeleteAttack, handleLock,
  } = useAttackPhase({ campaign, myPlayer });

  const myTerritories = useMemo(
    () => Object.values(stateById).filter(s => s.owner_player_id === actingPlayer?.id),
    [stateById, actingPlayer?.id],
  );

  const selectedIsMyTerritory = selectedTerritoryId
    && stateById[selectedTerritoryId]?.owner_player_id === actingPlayer?.id;

  const handleSaveAttacks = async () => {
    // Save staged attacks (lock will happen via phase header)
    await handleLock(undefined, actingAsId);
    onPhaseChanged?.();
  };

  const handleSkip = async () => {
    await handleLock(undefined, actingAsId);
    onPhaseChanged?.();
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading attacks…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1">
        <p className="font-display text-xs tracking-widest uppercase text-status-danger">
          Round {round} — Military Operations
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Stage attacks. Hidden until reveal.
        </p>
      </div>

      {/* Acting-as indicator */}
      {actingAsId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-accent/40 bg-accent/10 text-xs">
          <TestTube className="w-3.5 h-3.5 text-accent" />
          <span className="text-accent font-display tracking-wide">Acting as {actingPlayer?.display_name}</span>
        </div>
      )}

      {/* Attack counter */}
      <div className="flex items-center justify-between px-3 py-2 rounded border border-border bg-muted/30 text-xs">
        <span className="text-muted-foreground font-display tracking-wide uppercase">Attacks Staged</span>
        <span className={`font-mono font-bold text-base ${attacks.length >= maxAttacks ? 'text-status-danger' : 'text-foreground'}`}>
          {attacks.length} / {maxAttacks}
        </span>
      </div>

      {/* Attack target selector — shown when acting player's territory selected */}
      {!isLocked && selectedTerritoryId && stateById[selectedTerritoryId]?.owner_player_id === actingPlayer?.id && (
        <AttackTargetSelector
          originId={selectedTerritoryId}
          preselectedTargetId={preselectedTargetId}
          mapDef={mapDef}
          stateById={stateById}
          players={players}
          myPlayer={actingPlayer}
          adjacencyMap={adjacencyMap}
          currentAttacks={attacks}
          maxAttacks={maxAttacks}
          onStage={handleStageAttack}
          onCancel={onClearSelection}
          submitting={submitting}
          error={error}
        />
      )}

      {/* Staged attack list */}
      {attacks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Staged Attacks</p>
          {attacks.map(atk => (
            <AttackStagingRow
              key={atk.id}
              attack={atk}
              mapDef={mapDef}
              onDelete={handleDeleteAttack}
              disabled={isLocked}
            />
          ))}
        </div>
      )}

      {/* Locked state */}
      {isLocked && (
        <div className="px-3 py-2 rounded border border-status-locked/40 bg-status-locked/10 text-xs">
          <div className="flex items-center gap-2 text-status-locked">
            <Lock className="w-3.5 h-3.5" />
            <span className="font-display tracking-wide">Attacks Staged</span>
          </div>
          <p className="text-muted-foreground mt-1">Use "Lock Operations Phase" above to commit.</p>
        </div>
      )}

      {!isLocked && !selectedIsMyTerritory && attacks.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Tap one of {actingPlayer?.display_name}'s territories on the map to stage an attack.
        </p>
      )}

      {error && !selectedIsMyTerritory && <p className="text-xs text-destructive">{error}</p>}

      {/* Stage button */}
      {!isLocked && (
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-border text-muted-foreground text-xs font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
            Skip Attacks
          </button>
          <button
            onClick={handleSaveAttacks}
            disabled={submitting || attacks.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-status-danger/40 text-status-danger text-xs font-display tracking-wider uppercase hover:bg-status-danger/10 disabled:opacity-40 transition-all"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Swords className="w-3.5 h-3.5" />}
            Save Attacks
          </button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground italic text-center">
        Use "Lock Operations Phase" in the header to commit all pillars.
      </p>
    </div>
  );
}