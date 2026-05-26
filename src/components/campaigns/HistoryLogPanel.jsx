/**
 * HistoryLogPanel — right dock panel showing public campaign history.
 */
import { useState } from 'react';
import { useHistoryLogs } from '@/features/campaigns/history/useHistoryLogs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Sword, Shield, TrendingUp, Castle, Users } from 'lucide-react';

const EVENT_ICONS = {
  faction_selected: Shield,
  territory_picked: Sword,
  troop_staged: Users,
  player_locked: Clock,
  auto_submitted: Clock,
  phase_advanced: TrendingUp,
  construction_started: Castle,
  battle_resolved: Sword,
};

const EVENT_LABELS = {
  faction_selected: 'Faction Selected',
  territory_picked: 'Territory Picked',
  troop_staged: 'Troops Staged',
  player_locked: 'Player Locked',
  auto_submitted: 'Auto-Submitted',
  phase_advanced: 'Phase Advanced',
  construction_started: 'Construction Started',
  battle_resolved: 'Battle Resolved',
};

export default function HistoryLogPanel({ campaign, players }) {
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterEventType, setFilterEventType] = useState('all');
  
  const { logs, isLoading, reload } = useHistoryLogs({
    campaignId: campaign?.id,
    phase: filterPhase === 'all' ? null : filterPhase,
    eventType: filterEventType === 'all' ? null : filterEventType,
    enabled: true,
  });

  const getEventIcon = (eventType) => {
    const Icon = EVENT_ICONS[eventType] || Clock;
    return <Icon className="w-3 h-3 text-muted-foreground" />;
  };

  const getEventLabel = (eventType) => {
    return EVENT_LABELS[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player?.display_name || 'Unknown';
  };

  return (
    <div className="p-4 space-y-3">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">
          Campaign History
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <Select value={filterPhase} onValueChange={setFilterPhase}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Filter by phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            <SelectItem value="faction_selection">Faction Selection</SelectItem>
            <SelectItem value="territory_draft">Territory Draft</SelectItem>
            <SelectItem value="initial_deploy">Initial Deploy</SelectItem>
            <SelectItem value="deploy">Deploy</SelectItem>
            <SelectItem value="attack">Attack</SelectItem>
            <SelectItem value="battle">Battle</SelectItem>
            <SelectItem value="fortify">Fortify</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterEventType} onValueChange={setFilterEventType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Filter by event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {Object.entries(EVENT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* History Log */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No history events yet</p>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <div
                key={log.id || idx}
                className="p-2 rounded border border-border bg-muted/10 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  {getEventIcon(log.event_type)}
                  <span className="font-medium text-foreground">
                    {getEventLabel(log.event_type)}
                  </span>
                </div>
                
                {log.player_id && (
                  <div className="text-muted-foreground">
                    {getPlayerName(log.player_id)}
                  </div>
                )}
                
                {log.payload && Object.keys(log.payload).length > 0 && (
                  <div className="mt-1 text-muted-foreground">
                    {log.payload.territory_id && `Territory: ${log.payload.territory_id}`}
                    {log.payload.faction && `Faction: ${log.payload.faction}`}
                    {log.payload.troops && `Troops: ${log.payload.troops}`}
                  </div>
                )}
                
                <div className="mt-1 text-xs text-muted-foreground">
                  Round {log.round} • {new Date(log.created_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}