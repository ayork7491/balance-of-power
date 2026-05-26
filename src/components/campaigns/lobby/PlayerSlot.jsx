/**
 * PlayerSlot — renders one player row in the campaign lobby.
 */
import { Crown, Check, Clock, Shield, X } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

export default function PlayerSlot({ player, isMe, canKick, onKick }) {
  const color = PLAYER_COLORS.find(c => c.id === player.color);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${isMe ? 'bg-primary/5' : ''}`}>
      {/* Color swatch */}
      <div
        className="w-3 h-8 rounded-sm shrink-0"
        style={{ backgroundColor: color?.hex ?? '#888' }}
      />

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-sm font-semibold tracking-wider text-foreground truncate">
            {player.display_name}
          </span>
          {isMe && (
            <span className="text-xs text-primary/70 font-body">(you)</span>
          )}
          {player.is_admin && (
            <span className="flex items-center gap-1 badge-pending">
              <Crown className="w-3 h-3" /> Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {color && (
            <span className="text-xs text-muted-foreground">{color.label}</span>
          )}
          {player.faction_name && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground">{player.faction_name}</span>
            </>
          )}
        </div>
      </div>

      {/* Ready status */}
      <div className="shrink-0">
        {player.is_ready ? (
          <span className="flex items-center gap-1 badge-locked text-xs">
            <Check className="w-3 h-3" /> Ready
          </span>
        ) : (
          <span className="flex items-center gap-1 badge-pending text-xs">
            <Clock className="w-3 h-3" /> Waiting
          </span>
        )}
      </div>

      {/* Admin kick */}
      {canKick && !player.is_admin && (
        <button
          onClick={() => onKick(player)}
          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          title="Remove player"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}