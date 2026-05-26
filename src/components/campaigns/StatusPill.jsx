/**
 * StatusPill — Reusable status indicator pill.
 * Extracted for consistent status display across components.
 */
export default function StatusPill({ status, phase, gameProfile }) {
  if (!status && !phase && !gameProfile) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status && (
        <span className={`text-xs ${status.color}`}>{status.label}</span>
      )}
      {phase && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className={`text-xs ${phase.text}`}>{phase.label}</span>
        </>
      )}
      {gameProfile && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {gameProfile.icon && <gameProfile.icon className="w-2.5 h-2.5" />}
            {gameProfile.name}
          </span>
        </>
      )}
    </div>
  );
}