/**
 * BattleCardRow — compact row for a single battle card in the battle list.
 */
import { Link } from 'react-router-dom';
import { ChevronRight, Hourglass } from 'lucide-react';
import BattleTypeTag from './BattleTypeTag';
import BattleStatusTag from './BattleStatusTag';
import { PLAYER_COLORS } from '@/config/theme';
import OperationSourceBadge from '@/components/operations/OperationSourceBadge';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

function PlayerDot({ players, playerId }) {
  const hex = getPlayerHex(players, playerId);
  const p   = players?.find(pl => pl.id === playerId);
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: hex }} />
      {p?.display_name ?? '?'}
    </span>
  );
}

export default function BattleCardRow({ card, players, mapDef, campaignId }) {
  const targetName = mapDef?.territories.find(t => t.territory_id === card.target_territory_id)?.name
    ?? card.target_territory_id;

  const attackerIds = [...new Set((card.attackers ?? []).map(a => a.player_id))];

  return (
    <Link
      to={`/campaigns/${campaignId}/battles/${card.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded border border-border bg-muted/10 hover:bg-muted/20 transition-colors group"
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <BattleTypeTag type={card.battle_type} />
          <span className="text-xs text-foreground font-medium truncate">{targetName}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {attackerIds.map(pid => <PlayerDot key={pid} players={players} playerId={pid} />)}
          {card.defender_player_id && (
            <>
              <span>vs</span>
              <PlayerDot players={players} playerId={card.defender_player_id} />
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>{card.tabletop_size} pts</span>
          <span className="text-border">·</span>
          <span>×{card.scale_factor?.toFixed(1)} scale</span>
          {card.battle_card_source && card.battle_card_source !== 'military_attack' && (
            <OperationSourceBadge source={card.battle_card_source} size="xs" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {['delayed', 'active_carryover', 'pending_approval'].includes(card.status) && (
          <span className={card.status === 'pending_approval' ? 'text-yellow-400' : 'text-orange-400'} title={card.status === 'active_carryover' ? 'Carried Over' : card.status === 'pending_approval' ? 'Pending Approval' : 'Delayed'}>
            <Hourglass className="w-3.5 h-3.5" />
          </span>
        )}
        <BattleStatusTag status={card.status} />
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  );
}