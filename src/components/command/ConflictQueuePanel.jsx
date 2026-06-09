/**
 * ConflictQueuePanel — Sprint 5B
 *
 * Battle phase: unified conflict queue.
 * Sections:
 *   - Your Conflicts (player is attacker / defender / intervener / source)
 *   - World Conflicts (other active cards)
 *   - Completed This Round
 *
 * Clicking a card navigates to BattleCardDetail.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, RefreshCw, Swords, Globe, CheckCircle2, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BattleTypeTag from '@/components/phases/battle/BattleTypeTag';
import BattleStatusTag from '@/components/phases/battle/BattleStatusTag';
import { BATTLE_SOURCE_LABELS } from '@/config/operationsConfig';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerName(players, id) {
  return players?.find(p => p.id === id)?.display_name ?? '—';
}

function getPlayerHex(players, id) {
  const p = players?.find(pl => pl.id === id);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#64748b';
}

function getTerritoryName(mapDef, territoryId) {
  return mapDef?.territories?.find(t => t.territory_id === territoryId)?.name ?? territoryId;
}

const ACTIVE_STATUSES = new Set(['pending','awaiting_result','active_carryover','pending_approval','result_submitted','awaiting_approval']);
const DONE_STATUSES   = new Set(['resolved','auto_resolved','forfeited']);

function CardRow({ card, players, mapDef, myPlayerId, onOpen }) {
  const sourceCfg = BATTLE_SOURCE_LABELS[card.battle_card_source ?? 'military_attack'];
  const territory = getTerritoryName(mapDef, card.target_territory_id);
  const defenderName = card.defender_player_id ? getPlayerName(players, card.defender_player_id) : 'Unoccupied';
  const attackerNames = (card.attackers ?? []).map(a => getPlayerName(players, a.player_id)).join(', ');

  const isInvolved = card.defender_player_id === myPlayerId
    || card.source_player_id === myPlayerId
    || (card.attackers ?? []).some(a => a.player_id === myPlayerId);

  const needsAction = isInvolved && ACTIVE_STATUSES.has(card.status)
    && !['resolved','auto_resolved','forfeited','delayed'].includes(card.status);

  return (
    <button
      onClick={() => onOpen(card.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-border hover:bg-muted/10 active:bg-muted/20 transition-colors text-left touch-manipulation"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <BattleTypeTag battleType={card.battle_type} />
          {sourceCfg && <span className={`text-[10px] ${sourceCfg.color}`}>{sourceCfg.icon}</span>}
          <span className="text-xs font-medium text-foreground truncate">{territory}</span>
          {needsAction && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          {attackerNames && <span>⚔ {attackerNames}</span>}
          {card.defender_player_id && <span>🛡 {defenderName}</span>}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <BattleStatusTag status={card.status} />
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    </button>
  );
}

function SectionHeader({ icon: Icon, title, count, color = 'text-muted-foreground' }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 bg-panel-header border-b border-border ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-display text-[10px] tracking-widest uppercase font-semibold">{title}</span>
      {count != null && (
        <span className="ml-auto text-[10px] font-mono bg-muted/30 px-1.5 py-0.5 rounded">{count}</span>
      )}
    </div>
  );
}

export default function ConflictQueuePanel({ campaign, players, myPlayer, mapDef, onPhaseChanged, actingAsPlayerId, isAdmin }) {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const myId = actingAsPlayerId ?? myPlayer?.id;

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await base44.entities.BattleCard.filter({ campaign_id: campaignId });
      setCards(data);
    } catch (e) {
      setError('Failed to load battles.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const openCard = (battleId) => navigate(`/campaigns/${campaignId}/battles/${battleId}`);

  const round = campaign?.current_round ?? 1;
  const roundCards = cards.filter(c => c.round === round);

  const myCards    = roundCards.filter(c => ACTIVE_STATUSES.has(c.status) && (
    c.defender_player_id === myId || c.source_player_id === myId || (c.attackers ?? []).some(a => a.player_id === myId)
  ));
  const worldCards = roundCards.filter(c => ACTIVE_STATUSES.has(c.status) && !myCards.includes(c));
  const doneCards  = roundCards.filter(c => DONE_STATUSES.has(c.status));

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading conflicts…
      </div>
    );
  }

  if (error) return <p className="text-xs text-destructive p-4">{error}</p>;

  return (
    <div className="flex flex-col">
      {/* Refresh */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-border">
        <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Your Conflicts */}
      <SectionHeader icon={Swords} title="Your Conflicts" count={myCards.length} color="text-red-400" />
      {myCards.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-2 italic">No active conflicts requiring your attention.</p>
      ) : (
        myCards.map(c => <CardRow key={c.id} card={c} players={players} mapDef={mapDef} myPlayerId={myId} onOpen={openCard} />)
      )}

      {/* World Conflicts */}
      <SectionHeader icon={Globe} title="World Conflicts" count={worldCards.length} />
      {worldCards.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-2 italic">No other active conflicts.</p>
      ) : (
        worldCards.map(c => <CardRow key={c.id} card={c} players={players} mapDef={mapDef} myPlayerId={myId} onOpen={openCard} />)
      )}

      {/* Completed This Round */}
      {doneCards.length > 0 && (
        <>
          <SectionHeader icon={CheckCircle2} title="Completed This Round" count={doneCards.length} color="text-green-400" />
          {doneCards.map(c => <CardRow key={c.id} card={c} players={players} mapDef={mapDef} myPlayerId={myId} onOpen={openCard} />)}
        </>
      )}

      {roundCards.length === 0 && (
        <div className="px-3 py-6 text-center">
          <Swords className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No battle cards generated this round.</p>
        </div>
      )}
    </div>
  );
}