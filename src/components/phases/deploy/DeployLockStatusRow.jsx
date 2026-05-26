/**
 * DeployLockStatusRow — shows lock state for one player.
 * Never shows placement data — only a boolean lock indicator.
 */
import { Lock } from 'lucide-react';

export default function DeployLockStatusRow({ player, isLocked, isMe }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full shrink-0 ${isLocked ? 'bg-status-locked' : 'bg-muted-foreground/30'}`} />
      <span className={isLocked ? 'text-foreground' : 'text-muted-foreground'}>
        {player?.display_name ?? 'Unknown'}{isMe && ' (you)'}
      </span>
      {isLocked
        ? <span className="ml-auto text-status-locked flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Locked</span>
        : <span className="ml-auto text-muted-foreground/50">Staging…</span>
      }
    </div>
  );
}