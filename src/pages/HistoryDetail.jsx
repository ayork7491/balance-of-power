/**
 * HistoryDetail — Full campaign history page with filtering and snapshots.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { useCampaign } from '@/features/campaigns';
import { getMap } from '@/features/maps';
import { PLAYER_COLORS } from '@/config/theme';
import { useHistoryLogs } from '@/features/campaigns/history/useHistoryLogs';
import { usePhaseSnapshots } from '@/features/campaigns/history/usePhaseSnapshots';
import { useBattleHistory } from '@/features/campaigns/history/useBattleHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Sword, Shield, TrendingUp, Castle, Users, FileText, Trophy } from 'lucide-react';

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

export default function HistoryDetail() {
  const { id } = useParams();
  const { campaign, players } = useCampaign(id);
  const mapDef = getMap(campaign?.map_id ?? 'map_v1_standard');
  
  const [activeTab, setActiveTab] = useState('logs');
  const [filterRound, setFilterRound] = useState('all');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterEventType, setFilterEventType] = useState('all');

  const { logs, isLoading: loadingLogs } = useHistoryLogs({
    campaignId: id,
    round: filterRound === 'all' ? null : parseInt(filterRound),
    phase: filterPhase === 'all' ? null : filterPhase,
    eventType: filterEventType === 'all' ? null : filterEventType,
    enabled: true,
  });

  const { snapshots, isLoading: loadingSnapshots } = usePhaseSnapshots({
    campaignId: id,
    round: filterRound === 'all' ? null : parseInt(filterRound),
    enabled: true,
  });

  const { battles, isLoading: loadingBattles } = useBattleHistory({
    campaignId: id,
    round: filterRound === 'all' ? null : parseInt(filterRound),
    enabled: true,
  });

  const rounds = Array.from(new Set([
    ...logs.map(l => l.round),
    ...snapshots.map(s => s.round),
    ...battles.map(b => b.round),
  ])).filter(Boolean).sort((a, b) => a - b);

  const getEventIcon = (eventType) => {
    const Icon = EVENT_ICONS[eventType] || Clock;
    return <Icon className="w-4 h-4 text-muted-foreground" />;
  };

  const getEventLabel = (eventType) => {
    return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player?.display_name || 'Unknown';
  };

  const getPlayerHex = (playerId) => {
    const player = players?.find(p => p.id === playerId);
    return PLAYER_COLORS.find(c => c.id === player?.color)?.hex ?? '#888';
  };

  const getTerritoryName = (tid) =>
    mapDef?.territories.find(t => t.territory_id === tid)?.name ?? tid ?? '—';

  return (
    <AppShell showBack title="Campaign History">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-wider">{campaign?.name || 'Loading...'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Round {campaign?.current_round} • {campaign?.current_phase?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="panel p-4 space-y-3">
          <p className="text-xs font-display tracking-widest uppercase text-muted-foreground mb-2">Filters</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={filterRound} onValueChange={setFilterRound}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filter by round" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rounds</SelectItem>
                {rounds.map(round => (
                  <SelectItem key={round} value={round}>Round {round}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPhase} onValueChange={setFilterPhase}>
              <SelectTrigger className="h-9 text-xs">
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
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {Object.keys(EVENT_ICONS).map(value => (
                  <SelectItem key={value} value={value}>{getEventLabel(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="logs">Event Logs</TabsTrigger>
            <TabsTrigger value="snapshots">Phase Snapshots</TabsTrigger>
            <TabsTrigger value="battles">Battle History</TabsTrigger>
          </TabsList>

          {/* Event Logs Tab */}
          <TabsContent value="logs" className="mt-4">
            <div className="panel">
              <ScrollArea className="h-[600px]">
                {loadingLogs ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No history events found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {logs.map((log, idx) => (
                      <div key={log.id || idx} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {getEventIcon(log.event_type)}
                            <div>
                              <p className="font-medium text-sm">{getEventLabel(log.event_type)}</p>
                              {log.player_id && (
                                <p className="text-xs text-muted-foreground">{getPlayerName(log.player_id)}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-right">
                            <p>Round {log.round}</p>
                            <p>{new Date(log.created_date).toLocaleString()}</p>
                          </div>
                        </div>
                        {log.payload && Object.keys(log.payload).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded p-2">
                            {Object.entries(log.payload).map(([key, value]) => (
                              <div key={key}>{key}: {value}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Phase Snapshots Tab */}
          <TabsContent value="snapshots" className="mt-4">
            <div className="panel">
              <ScrollArea className="h-[600px]">
                {loadingSnapshots ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 bg-muted/50 rounded animate-pulse" />
                    ))}
                  </div>
                ) : snapshots.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No phase snapshots found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {snapshots.map((snapshot, idx) => (
                      <div key={snapshot.id || idx} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-sm capitalize">
                              {snapshot.snapshot_type.replace('_', ' ')} - {snapshot.phase.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">Round {snapshot.round}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(snapshot.created_date).toLocaleString()}
                          </p>
                        </div>
                        
                        {/* Player Standings Summary */}
                        {snapshot.player_standings && snapshot.player_standings.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            {snapshot.player_standings.map((player, pIdx) => (
                              <div key={pIdx} className="p-2 rounded bg-muted/20 border border-border">
                                <p className="font-medium truncate">{player.display_name}</p>
                                <p className="text-muted-foreground">{player.territory_count} territories</p>
                                <p className="text-muted-foreground">{player.troop_total} troops</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Battle History Tab */}
          <TabsContent value="battles" className="mt-4">
            <div className="panel">
              <ScrollArea className="h-[600px]">
                {loadingBattles ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-muted/50 rounded animate-pulse" />
                    ))}
                  </div>
                ) : battles.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No battles found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {battles.map((battle, idx) => {
                      const attackerIds = [...new Set((battle.attackers ?? []).map(a => a.player_id))];
                      const totalTroops  = battle.total_troops_in_battle ?? 0;
                      const tabletopSize = battle.tabletop_size ?? 0;
                      const bopSurvivors = battle.result?.surviving_tabletop_troops != null && tabletopSize > 0
                        ? Math.round((battle.result.surviving_tabletop_troops / tabletopSize) * totalTroops)
                        : null;
                      return (
                        <div key={battle.id || idx} className="p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm capitalize">{battle.battle_type?.replace(/_/g, ' ')}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-mono capitalize ${
                                  battle.status === 'resolved' || battle.status === 'auto_resolved' ? 'bg-status-locked/20 text-status-locked' :
                                  battle.status === 'forfeited' ? 'bg-destructive/20 text-destructive' :
                                  battle.status === 'delayed'   ? 'bg-warning/20 text-warning' :
                                  'bg-muted text-muted-foreground'
                                }`}>{battle.status}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {getTerritoryName(battle.target_territory_id)} · Round {battle.round}
                              </p>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <p>{totalTroops} BOP troops</p>
                              <p className="text-primary font-mono">{tabletopSize} TT pts</p>
                            </div>
                          </div>

                          {/* Attackers & Defender */}
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {attackerIds.map(pid => (
                              <span key={pid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/10">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getPlayerHex(pid) }} />

                                {getPlayerName(pid)}
                                {(battle.attackers ?? []).filter(a => a.player_id === pid).length > 0 && (
                                  <span className="text-destructive font-mono">
                                    ({(battle.attackers ?? []).filter(a => a.player_id === pid).reduce((s, a) => s + (a.committed_troops ?? 0), 0)})
                                  </span>
                                )}
                              </span>
                            ))}
                            {battle.defender_player_id && (
                              <>
                                <span className="text-muted-foreground self-center">vs</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/10">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getPlayerHex(battle.defender_player_id) }} />
                                  {getPlayerName(battle.defender_player_id)}
                                  <span className="text-accent font-mono">({battle.defender_troops ?? 0})</span>
                                </span>
                              </>
                            )}
                          </div>

                          {/* Result */}
                          {battle.result?.winner_player_id && (
                            <div className="flex items-center gap-3 text-xs bg-muted/20 rounded px-2 py-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getPlayerHex(battle.result.winner_player_id) }} />
                              <span className="font-medium text-foreground">{getPlayerName(battle.result.winner_player_id)} wins</span>
                              {battle.result.surviving_tabletop_troops != null && (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="text-primary font-mono">{battle.result.surviving_tabletop_troops} TT survivors</span>
                                  {bopSurvivors != null && (
                                    <span className="text-muted-foreground">({bopSurvivors} BOP)</span>
                                  )}
                                </>
                              )}
                              {battle.result.result_source && (
                                <span className="text-muted-foreground ml-auto capitalize">{battle.result.result_source}</span>
                              )}
                            </div>
                          )}
                          {battle.result?.notes && (
                            <p className="text-xs text-muted-foreground italic">{battle.result.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}