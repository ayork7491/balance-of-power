/**
 * AttackPanel — left-dock panel for the attack phase.
 *
 * Responsibilities:
 *   - List staged attacks (own only — private until reveal)
 *   - Show AttackTargetSelector when an owned territory is selected on map
 *   - Save / Lock / Skip actions
 *   - Show all players' lock status (no attack data)
 *   - Admin: Force Advance
 *
 * Privacy:
 *   - Staged attacks shown only for myPlayer (useAttackPhase is user-scoped).
 *   - Lock status via useAttackLockStatus (is_locked only, no attack data).
 *   - Other players' attack staging is NEVER fetched or shown.
 */
import { useMemo, useState } from 'react';
import { Loader2, Lock, Swords, Check, SkipForward } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAttackPhase, useAttackLockStatus } from '@/features/campaigns/attack';
import DeployLockStatusRow from '@/components/phases/deploy/DeployLockStatusRow';
import AttackStagingRow from './AttackStagingRow';
import AttackTargetSelector from './AttackTargetSelector';

export default function AttackPanel({
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
  const round   = campaign?.current_round ?? 1;
  const isAdmin = myPlayer?.is_admin;
  const [advancing, setAdvancing] = useState(false);

  const {
    attacks, decision, loading, submitting, error,
    isLocked, maxAttacks,
    handleStageAttack, handleDeleteAttack, handleLock,
    reload: reloadDecision,
  } = useAttackPhase({ campaign, myPlayer });

  const { lockStatus, reload: reloadLocks } = useAttackLockStatus({
    campaignId: campaign?.id,
    round,
    enabled: !!campaign?.id,
  });

  const activePlayers = players.filter(p => !p.is_eliminated);
  const lockedCount   = lockStatus.filter(s => s.is_locked).length;
  const allLocked     = lockedCount >= activePlayers.length && activePlayers.length > 0;

  // Determine if selected territory is a valid attack origin (owned by me, has troops)
  const selectedIsMyTerritory = selectedTerritoryId
    && stateById[selectedTerritoryId]?.owner_player_id === myPlayer?.id;

  const myTerritories = useMemo(
    () => Object.values(stateById).filter(s => s.owner_player_id === myPlayer?.id),
    [stateById, myPlayer?.id],
  );

  const handleLockAndRefresh = async () => {
    await handleLock(onPhaseChanged);
    reloadLocks();
  };

  const handleSkipAndLock = async () => {
    await handleLock(onPhaseChanged);
    reloadLocks();
  };

  const handleProcessEnd = async () => {
    setAdvancing(true);
    try {
      await base44.functions.invoke('attackPhase', {
        action:      'processPhaseEnd',
        campaign_id: campaign.id,
      });
      onPhaseChanged?.();
    } catch (err) {
      console.error(err);
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading attack phase…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      {/* Header */}
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1">
        <p className="font-display text-xs tracking-widest uppercase text-status-danger">
          Round {round} — Attack Phase
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Stage attacks from your territories. Hidden until reveal.
        </p>
      </div>

      {/* Attack counter */}
      <div className="flex items-center justify-between px-3 py-2 rounded border border-border bg-muted/30 text-xs">
        <span className="text-muted-foreground font-display tracking-wide uppercase">Attacks Staged</span>
        <span className={`font-mono font-bold text-base ${attacks.length >= maxAttacks ? 'text-status-danger' : 'text-foreground'}`}>
          {attacks.length} / {maxAttacks}
        </span>
      </div>

      {/* Attack target selector — shown when own territory selected on map */}
      {!isLocked && selectedIsMyTerritory && (
        <AttackTargetSelector
          originId={selectedTerritoryId}
          mapDef={mapDef}
          stateById={stateById}
          players={players}
          myPlayer={myPlayer}
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
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            Your Staged Attacks
          </p>
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
            <span className="font-display tracking-wide">Attacks Locked</span>
          </div>
          <p className="text-muted-foreground mt-1">Hidden until all players reveal.</p>
        </div>
      )}

      {!isLocked && !selectedIsMyTerritory && attacks.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Tap one of your territories on the map to stage an attack.
        </p>
      )}

      {error && !selectedIsMyTerritory && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Action buttons */}
      {!isLocked && (
        <div className="flex gap-2">
          <button
            onClick={handleSkipAndLock}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-border text-muted-foreground text-xs font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
            Skip
          </button>
          <button
            onClick={handleLockAndRefresh}
            disabled={submitting || attacks.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-status-danger text-white text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Lock Attacks
          </button>
        </div>
      )}

      {!isLocked && attacks.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Lock with no attacks to skip this round.
        </p>
      )}

      {/* Player lock status */}
      <div className="space-y-1 pt-2 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">
          Players — {lockedCount}/{activePlayers.length} Locked
        </p>
        {activePlayers.map(p => {
          const status = lockStatus.find(s => s.player_id === p.id);
          return (
            <DeployLockStatusRow
              key={p.id}
              player={p}
              isLocked={status?.is_locked ?? false}
              isMe={p.id === myPlayer?.id}
            />
          );
        })}
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="pt-2 border-t border-border space-y-2">
          {allLocked ? (
            <button
              onClick={handleProcessEnd}
              disabled={advancing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-status-danger text-white text-xs font-display tracking-widest uppercase hover:brightness-110 glow-primary disabled:opacity-40"
            >
              {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Reveal Attacks &amp; Generate Battles
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Waiting for all players to lock…</p>
              <button
                onClick={handleProcessEnd}
                disabled={advancing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-colors disabled:opacity-40"
              >
                {advancing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Force Reveal (skip missing)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}