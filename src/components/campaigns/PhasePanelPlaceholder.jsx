/**
 * PhasePanelPlaceholder — Placeholder for incomplete phase panels.
 */

export default function PhasePanelPlaceholder({ campaign }) {
  const phase = campaign?.current_phase ?? 'deploy';
  const round = campaign?.current_round ?? 1;
  
  return (
    <div className="p-4 space-y-3">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-status-pending capitalize">
          Round {round} — {phase} Phase
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Phase controls will appear here.</p>
      <div className="space-y-2 pt-2">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-16 bg-muted/50 rounded animate-pulse" />
      </div>
    </div>
  );
}