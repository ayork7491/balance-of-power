/**
 * PlayerSlot — renders one player row in the campaign lobby.
 */
import { Crown, Check, Clock, Shield, X, FlaskConical, TestTube } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

export default function PlayerSlot({ player, isMe, canKick, onKick, canAdminToggleReady, onAdminToggleReady, isTestPlayer: isTestPlayerProp }) {
  const color = PLAYER_COLORS.find(c => c.id === player.color);
  
  // Fallback safety check: treat as test player if is_test_player is true OR user_id starts with test_player_
  const isTestPlayer = isTestPlayerProp ?? (player.is_test_player === true || (player.user_id && player.user_id.startsWith('test_player_')));

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
          {isTestPlayer && (
            <span className="flex items-center gap-1 text-[10px] text-status-info px-1.5 py-0.5 rounded border border-status-info/40">
              <FlaskConical className="w-2.5 h-2.5" /> Test
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

      {/* Ready status + admin controls */}
      <div className="flex items-center gap-2 shrink-0">
        {player.is_ready ? (
          <span className="flex items-center gap-1 badge-locked text-xs">
            <Check className="w-3 h-3" /> Ready
          </span>
        ) : (
          <span className="flex items-center gap-1 badge-pending text-xs">
            <Clock className="w-3 h-3" /> Waiting
          </span>
        )}
        
        {/* Admin ready toggle for test players only */}
        {canAdminToggleReady && isTestPlayer && (
          <button
            onClick={() => onAdminToggleReady(player)}
            className={`p-1.5 rounded text-xs transition-colors shrink-0 border ${
              player.is_ready
                ? 'bg-status-locked/20 text-status-locked border-status-locked/40 hover:bg-status-locked/30'
                : 'bg-status-pending/20 text-status-pending border-status-pending/40 hover:bg-status-pending/30'
            }`}
            title={player.is_ready ? 'Mark as not ready' : 'Mark as ready'}
          >
            <TestTube className="w-3 h-3" />
          </button>
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