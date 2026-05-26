/**
 * PhaseControls — Manual phase advancement and auto-fill controls.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FastForward, Shuffle, Loader2 } from 'lucide-react';
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

const PHASE_ORDER = [
  'faction_selection',
  'territory_draft',
  'initial_deploy',
  'deploy',
  'attack',
  'battle',
  'fortify',
];

export default function PhaseControls({ campaign, onPhaseChanged }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);

  const getNextPhase = () => {
    const currentIndex = PHASE_ORDER.indexOf(campaign?.current_phase || 'faction_selection');
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= PHASE_ORDER.length) {
      return 'deploy'; // Wrap to next round
    }
    
    return PHASE_ORDER[nextIndex];
  };

  const handleForceAdvance = async () => {
    if (!campaign) return;
    
    setIsLoading(true);
    try {
      const nextPhase = getNextPhase();
      const res = await base44.functions.invoke('forcePhaseAdvance', {
        campaign_id: campaign.id,
        target_phase: nextPhase,
      });

      toast.success(`Forced advance to ${nextPhase}`);
      onPhaseChanged?.(res.data.campaign);
      setShowAdvanceDialog(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to advance phase');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoFill = async () => {
    toast.info('Auto-fill decisions coming soon');
    // TODO: Implement auto-fill backend function
  };

  if (!campaign) return null;

  const nextPhase = getNextPhase();

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <FastForward className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-display tracking-widest uppercase text-muted-foreground">
            Phase Controls
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Force Phase Advance */}
          <div className="panel p-3 space-y-2">
            <div className="flex items-center gap-2 text-status-danger">
              <FastForward className="w-3.5 h-3.5" />
              <p className="font-display text-xs tracking-wider uppercase font-semibold">
                Force Advance
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Skip timer and advance to {nextPhase}
            </p>
            <Button
              onClick={() => setShowAdvanceDialog(true)}
              disabled={isLoading}
              variant="destructive"
              className="w-full h-7 text-xs"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Advance'}
            </Button>
          </div>

          {/* Auto-Fill Decisions */}
          <div className="panel p-3 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shuffle className="w-3.5 h-3.5" />
              <p className="font-display text-xs tracking-wider uppercase font-semibold">
                Auto-Fill
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Randomly fill all unstaged decisions
            </p>
            <Button
              onClick={handleAutoFill}
              disabled={isLoading}
              variant="outline"
              className="w-full h-7 text-xs"
            >
              Fill Decisions
            </Button>
          </div>
        </div>

        {/* Current Phase Info */}
        <div className="p-3 rounded border border-border bg-muted/10">
          <p className="text-xs font-display tracking-widest uppercase text-muted-foreground mb-1">
            Current Phase
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground capitalize">
              {campaign.current_phase ? campaign.current_phase.replace(/_/g, ' ') : 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground">
              Round {campaign.current_round}
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force Phase Advance?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  This will skip the timer and immediately advance the campaign from{' '}
                  <span className="font-semibold">{campaign.current_phase}</span> to{' '}
                  <span className="font-semibold">{nextPhase}</span>.
                </p>
                <div className="p-2 rounded border border-status-danger/40 bg-status-danger/10">
                  <p className="text-status-danger font-semibold text-[10px] uppercase">
                    ⚠️ Debug-Only Unsafe Switch
                  </p>
                  <ul className="text-[10px] text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                    <li>Does NOT auto-submit missing decisions</li>
                    <li>Does NOT apply deploy placements/resources</li>
                    <li>Does NOT reveal attacks or generate battles</li>
                    <li>Does NOT apply fortify/build results</li>
                    <li>Does NOT generate proper phase snapshots</li>
                  </ul>
                </div>
                <p className="text-[10px]">
                  Only use in test campaigns. For production, use the normal phase transition pipeline.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceAdvance}>
              Advance Phase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}