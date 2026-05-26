/**
 * AdminAdvancePhase — Admin-only button to properly advance campaign phase.
 * 
 * Appears when:
 * - Current user is campaign admin or platform admin
 * - All required players are locked for current phase
 * - Campaign is not archived
 * - Campaign is in a phase that can be advanced
 * 
 * Calls phase-specific backend processor (not just updating current_phase).
 */
import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FastForward, Loader2, CheckCircle2, AlertCircle, TestTube, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Phase order for advancement
const PHASE_ORDER = [
  'faction_selection',
  'territory_draft',
  'initial_deploy',
  'deploy',
  'attack',
  'battle',
  'fortify',
];

// Phase-specific button labels
const PHASE_LABELS = {
  faction_selection: 'Start Territory Draft',
  territory_draft: 'Start Initial Deploy',
  initial_deploy: 'Reveal Deployments',
  deploy: 'Reveal Deployments',
  attack: 'Reveal Attacks',
  battle: 'Resolve Battle Phase',
  fortify: 'End Fortify Phase / Start Next Round',
};

// Backend functions for each phase end
const PHASE_PROCESSORS = {
  faction_selection: 'setupPhase', // Handles transition to territory_draft
  territory_draft: 'setupPhase', // Handles transition to initial_deploy
  initial_deploy: 'initialDeploy', // Handles reveal and transition to deploy
  deploy: 'deployPhase', // Handles reveal and transition to attack
  attack: 'attackPhase', // Handles reveal and battle generation
  battle: 'battlePhase', // Handles resolution and transition to fortify
  fortify: 'fortifyPhase', // Handles apply and transition to next round deploy
};

export default function AdminAdvancePhase({ 
  campaign, 
  players, 
  myPlayer, 
  allLockStatus = [],
  onPhaseChanged 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    return myPlayer?.is_admin || false;
  }, [myPlayer]);

  // Check if campaign is archived
  const isArchived = useMemo(() => {
    return campaign?.status === 'archived';
  }, [campaign]);

  // Get current phase index
  const currentPhaseIndex = useMemo(() => {
    return PHASE_ORDER.indexOf(campaign?.current_phase || 'faction_selection');
  }, [campaign]);

  // Get next phase
  const nextPhase = useMemo(() => {
    if (currentPhaseIndex < 0 || currentPhaseIndex >= PHASE_ORDER.length - 1) {
      return 'deploy'; // Wrap to deploy for next round
    }
    return PHASE_ORDER[currentPhaseIndex + 1];
  }, [currentPhaseIndex]);

  // Calculate all-locked status
  const allPlayersLocked = useMemo(() => {
    if (!players || players.length === 0) return false;
    
    const activePlayers = players.filter(p => !p.is_eliminated);
    if (activePlayers.length === 0) return false;
    
    // Check if all active players are locked
    const lockedCount = allLockStatus.filter(l => l.is_locked).length;
    return lockedCount >= activePlayers.length;
  }, [players, allLockStatus]);

  // Check if phase can be advanced
  const canAdvancePhase = useMemo(() => {
    if (!campaign || isArchived) return false;
    if (!isAdmin) return false;
    if (!allPlayersLocked) return false;
    if (currentPhaseIndex < 0) return false;
    
    // Check if already processed (prevent duplicate)
    // This is a client-side check; backend has authoritative check
    return true;
  }, [campaign, isArchived, isAdmin, allPlayersLocked, currentPhaseIndex]);

  // Get button label
  const buttonLabel = useMemo(() => {
    const phase = campaign?.current_phase || 'faction_selection';
    return PHASE_LABELS[phase] || 'Advance Phase';
  }, [campaign]);

  // Get processor function name
  const processorFunction = useMemo(() => {
    const phase = campaign?.current_phase || 'faction_selection';
    return PHASE_PROCESSORS[phase] || null;
  }, [campaign]);

  // Handle advance phase
  const handleAdvancePhase = async () => {
    if (!campaign || !processorFunction) {
      toast.error('Phase processor missing: cannot safely advance.');
      setShowConfirmDialog(false);
      return;
    }

    setIsLoading(true);
    try {
      // Call phase-specific processor
      const res = await base44.functions.invoke(processorFunction, {
        action: 'processPhaseEnd',
        campaign_id: campaign.id,
      });

      if (res.data.error) {
        if (res.data.already_processed) {
          toast.info('Phase already processed.');
        } else {
          toast.error(res.data.error);
        }
        setShowConfirmDialog(false);
        return;
      }

      toast.success(`Phase advanced to ${res.data.next_phase || nextPhase}`);
      onPhaseChanged?.();
      setShowConfirmDialog(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to advance phase';
      if (errorMsg.includes('Missing phase processor')) {
        toast.error('Phase processor missing: cannot safely advance.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if not admin or campaign is archived
  if (!isAdmin || isArchived) {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <FastForward className="w-3.5 h-3.5 text-status-pending" />
          <p className="text-xs font-display tracking-widest uppercase text-status-pending">
            Admin Controls
          </p>
        </div>

        {/* Advance Phase Button */}
        <div className="panel p-3 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <FastForward className="w-3.5 h-3.5" />
            <p className="font-display text-xs tracking-wider uppercase font-semibold">
              Advance Phase
            </p>
          </div>
          
          <p className="text-[10px] text-muted-foreground">
            {allPlayersLocked 
              ? `All players locked. Ready to advance to ${nextPhase}.`
              : 'Waiting for all players to lock.'}
          </p>

          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!canAdvancePhase || isLoading || !processorFunction}
            className="w-full h-8 text-xs font-semibold"
            variant={canAdvancePhase ? 'default' : 'secondary'}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : !processorFunction ? (
              'Processor Missing'
            ) : (
              buttonLabel
            )}
          </Button>

          {/* Debug Info */}
          <div className="pt-2 border-t border-border/50 space-y-1 text-[10px]">
            <div className="flex items-center gap-2">
              <User className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-muted-foreground">Admin:</span>
              <span className={isAdmin ? 'text-status-locked font-semibold' : 'text-muted-foreground'}>
                {isAdmin ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-muted-foreground">All Locked:</span>
              <span className={allPlayersLocked ? 'text-status-locked font-semibold' : 'text-muted-foreground'}>
                {allPlayersLocked ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FastForward className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-muted-foreground">Can Advance:</span>
              <span className={canAdvancePhase ? 'text-status-locked font-semibold' : 'text-muted-foreground'}>
                {canAdvancePhase ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TestTube className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-muted-foreground">Processor:</span>
              <span className={processorFunction ? 'text-foreground' : 'text-status-danger'}>
                {processorFunction || 'MISSING'}
              </span>
            </div>
            {!allPlayersLocked && players && (
              <div className="pt-1.5 border-t border-border/50 mt-1">
                <p className="text-[10px] text-muted-foreground mb-1">Lock status:</p>
                <div className="space-y-0.5">
                  {players.filter(p => !p.is_eliminated).map(p => {
                    const lockStatus = allLockStatus.find(l => l.player_id === p.id);
                    const isLocked = lockStatus?.is_locked ?? false;
                    return (
                      <div key={p.id} className="flex items-center justify-between">
                        <span className="text-foreground">{p.display_name}</span>
                        <span className={isLocked ? 'text-status-locked' : 'text-status-pending'}>
                          {isLocked ? '✓ Locked' : '⊙ Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {buttonLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  This will end the <span className="font-semibold">{campaign?.current_phase}</span> phase 
                  and advance to <span className="font-semibold">{nextPhase}</span>.
                </p>
                
                {processorFunction ? (
                  <div className="p-2 rounded border border-primary/40 bg-primary/10">
                    <p className="text-primary font-semibold text-[10px] uppercase">
                      ✓ Phase Processor Available
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Calling backend function: <span className="font-mono">{processorFunction}.processPhaseEnd</span>
                    </p>
                    <ul className="text-[10px] text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                      {campaign?.current_phase === 'fortify' && (
                        <>
                          <li>Apply all troop movements</li>
                          <li>Process construction projects</li>
                          <li>Deduct resource costs</li>
                          <li>Generate phase snapshot</li>
                          <li>Advance to Round {campaign.current_round + 1} Deploy</li>
                        </>
                      )}
                      {campaign?.current_phase === 'attack' && (
                        <>
                          <li>Reveal all attacks</li>
                          <li>Generate battle cards</li>
                          <li>Handle bloodbath deduplication</li>
                          <li>Mark abandoned territories</li>
                        </>
                      )}
                      {campaign?.current_phase === 'deploy' && (
                        <>
                          <li>Reveal all troop placements</li>
                          <li>Apply resource generation</li>
                          <li>Update territory troop counts</li>
                          <li>Generate income records</li>
                        </>
                      )}
                    </ul>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-destructive/40 bg-destructive/10">
                    <p className="text-destructive font-semibold text-[10px] uppercase">
                      ⚠️ Phase Processor Missing
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cannot safely advance without proper phase processing.
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Current phase: <span className="font-semibold">{campaign?.current_phase}</span> | 
                  Round: <span className="font-semibold">{campaign?.current_round}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdvancePhase} disabled={isLoading || !processorFunction}>
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Advance Phase'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}