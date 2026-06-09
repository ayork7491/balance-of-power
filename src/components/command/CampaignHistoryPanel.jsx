/**
 * CampaignHistoryPanel — Sprint 5B
 *
 * Interactive campaign archive. Events are clickable when they reference
 * a battle card (navigates to BattleCardDetail) or territory.
 * Grouped by round for easy navigation.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHistoryLogs } from '@/features/campaigns/history/useHistoryLogs';
import {
  Clock, Swords, Shield, TrendingUp, Castle, Users,
  CheckCircle2, AlertCircle, Star, RefreshCw, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

const EVENT_CONFIG = {
  faction_selected:        { icon: Shield,       color: 'text-purple-400', label: 'Faction Selected' },
  territory_picked:        { icon: Shield,       color: 'text-blue-400',   label: 'Territory Claimed' },
  troop_staged:            { icon: Users,         color: 'text-foreground', label: 'Troops Staged' },
  player_locked:           { icon: Clock,         color: 'text-muted-foreground', label: 'Player Ready' },
  auto_submitted:          { icon: Clock,         color: 'text-muted-foreground', label: 'Auto-Submitted' },
  phase_advanced:          { icon: TrendingUp,    color: 'text-green-400',  label: 'Phase Advanced' },
  construction_revealed:   { icon: Castle,        color: 'text-amber-400',  label: 'Construction Started' },
  construction_completed:  { icon: Castle,        color: 'text-amber-400',  label: 'Construction Complete' },
  battle_card_generated:   { icon: Swords,        color: 'text-red-400',    label: 'Battle Generated' },
  battle_resolved:         { icon: CheckCircle2,  color: 'text-green-400',  label: 'Battle Resolved' },
  battle_forfeited:        { icon: AlertCircle,   color: 'text-destructive', label: 'Battle Forfeited' },
  campaign_victory:        { icon: Star,          color: 'text-primary',    label: 'Victory!' },
  objective_completed:     { icon: Star,          color: 'text-primary',    label: 'Objective Completed' },
  supply_route_created:    { icon: TrendingUp,    color: 'text-cyan-400',   label: 'Supply Route Created' },
  uprising:                { icon: Swords,        color: 'text-orange-400', label: 'Uprising' },
};

// Events that are clickable (reference a battle_card_id)
const BATTLE_CARD_EVENTS = new Set(['battle_card_generated','battle_resolved','battle_forfeited','battle_auto_resolved']);

function getPlayerHex(players, id) {
  const p = players?.find(pl => pl.id === id);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#64748b';
}

function LogEntry({ log, players, onOpenBattle, onOpenTerritory }) {
  const cfg = EVENT_CONFIG[log.event_type] ?? { icon: Clock, color: 'text-muted-foreground', label: log.event_type?.replace(/_/g, ' ') };
  const Icon = cfg.icon;
  const playerName = players?.find(p => p.id === log.player_id)?.display_name;
  const hex = log.player_id ? getPlayerHex(players, log.player_id) : null;

  const hasBattleCard = BATTLE_CARD_EVENTS.has(log.event_type) && log.payload?.battle_card_id;
  const hasTerritory  = log.payload?.territory_id;
  const isClickable   = hasBattleCard || hasTerritory;

  const handleClick = () => {
    if (hasBattleCard) onOpenBattle(log.payload.battle_card_id);
    else if (hasTerritory) onOpenTerritory?.(log.payload.territory_id);
  };

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`flex items-start gap-2.5 px-3 py-2 border-b border-border/50 text-xs transition-colors ${
        isClickable ? 'cursor-pointer hover:bg-muted/10 active:bg-muted/20' : ''
      }`}
    >
      <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{cfg.label}</span>
          {isClickable && <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />}
        </div>
        {playerName && (
          <div className="flex items-center gap-1 mt-0.5">
            {hex && <div className="w-1.5 h-1.5 rounded-full" style={{ background: hex }} />}
            <span className="text-muted-foreground">{playerName}</span>
          </div>
        )}
        {log.payload?.territory_id && (
          <span className="text-muted-foreground">{log.payload.territory_id}</span>
        )}
        {log.payload?.battle_type && (
          <span className="text-muted-foreground capitalize">{log.payload.battle_type?.replace(/_/g, ' ')}</span>
        )}
      </div>
      <span className="shrink-0 text-[9px] text-muted-foreground font-mono">
        {new Date(log.created_date).toLocaleDateString()}
      </span>
    </div>
  );
}

function RoundGroup({ round, logs, players, onOpenBattle, onOpenTerritory }) {
  const [open, setOpen] = useState(round === Math.max(...logs.map(l => l.round ?? 0)));

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-panel-header hover:bg-muted/20 transition-colors"
      >
        <span className="font-display text-[10px] tracking-widest uppercase text-muted-foreground">
          Round {round}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">{logs.length} events</span>
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {open && logs.map((log, i) => (
        <LogEntry key={log.id ?? i} log={log} players={players} onOpenBattle={onOpenBattle} onOpenTerritory={onOpenTerritory} />
      ))}
    </div>
  );
}

export default function CampaignHistoryPanel({ campaign, players }) {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();

  const { logs, isLoading, reload } = useHistoryLogs({
    campaignId: campaign?.id,
    enabled: !!campaign?.id,
  });

  const openBattle = (battleId) => navigate(`/campaigns/${campaignId}/battles/${battleId}`);

  // Group by round, newest first
  const byRound = {};
  for (const log of logs) {
    const r = log.round ?? 0;
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(log);
  }
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a);

  return (
    <div className="flex flex-col">
      {/* Header — sticky inside the outer scroll container */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-border bg-panel-header">
        <span className="font-display text-[10px] tracking-widest uppercase text-muted-foreground">
          Campaign Archive
        </span>
        <button onClick={reload} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && logs.length === 0 ? (
        <div className="p-4 space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />)}
        </div>
      ) : rounds.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          No campaign history yet. Events will appear here as the campaign progresses.
        </div>
      ) : (
        rounds.map(round => (
          <RoundGroup
            key={round}
            round={round}
            logs={byRound[round]}
            players={players}
            onOpenBattle={openBattle}
          />
        ))
      )}
    </div>
  );
}