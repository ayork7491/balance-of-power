/**
 * SetupInfoPanel — right dock during all setup phases.
 * Shows public setup log events and player readiness.
 */
import { useState, useEffect } from 'react';
import { Scroll, RefreshCw, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PLAYER_COLORS } from '@/config/theme';

function getPlayerHex(players, playerId) {
  const p = players.find(pl => pl.id === playerId);
  if (!p) return '#666';
  return PLAYER_COLORS.find(c => c.id === p.color)?.hex ?? '#666';
}

const PHASE_LABELS = {
  faction_selection: 'Faction Selection',
  territory_draft: 'Territory Draft',
  initial_deploy: 'Initial Deployment',
};

const EVENT_LABELS = {
  draft_order_set: 'Draft order randomized',
  faction_selected: 'Chose faction',
  territory_picked: 'Claimed territory',
  player_locked: 'Locked deployment',
  auto_submitted: 'Auto-submitted',
  phase_advanced: 'Phase advanced',
  troop_staged: 'Staged troops',
};

export default function SetupInfoPanel({ campaign, players }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!campaign?.id) return;
    setLoading(true);
    try {
      const data = await base44.entities.SetupLog.filter({ campaign_id: campaign.id });
      const publicLogs = data.filter(l => l.is_public).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setLogs(publicLogs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [campaign?.id]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!campaign?.id) return;
    const unsub = base44.entities.SetupLog.subscribe((event) => {
      if (event.data?.campaign_id !== campaign.id) return;
      if (!event.data?.is_public) return;
      if (event.type === 'create') {
        setLogs(prev => [event.data, ...prev]);
      }
    });
    return unsub;
  }, [campaign?.id]);

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
          <Scroll className="w-3.5 h-3.5" />
          Setup Log
        </p>
        <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Phase context */}
      <div className="text-xs px-3 py-2 rounded border border-border bg-muted/20">
        <p className="text-muted-foreground">Current Phase</p>
        <p className="text-foreground font-display tracking-wide font-semibold mt-0.5">
          {PHASE_LABELS[campaign?.current_phase] ?? campaign?.current_phase}
        </p>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No public events yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const player = log.player_id ? players.find(p => p.id === log.player_id) : null;
            const hex = player ? getPlayerHex(players, player.id) : null;
            return (
              <div key={log.id} className="flex gap-2 text-xs">
                <div className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/40" style={hex ? { backgroundColor: hex } : {}} />
                <div className="min-w-0">
                  <span className="text-foreground">
                    {player ? <span className="font-medium">{player.display_name} </span> : null}
                    {EVENT_LABELS[log.event_type] ?? log.event_type}
                    {log.payload?.faction_name ? ` — ${log.payload.faction_name}` : ''}
                    {log.payload?.territory_id
                      ? ` — ${log.payload.territory_id.replace(/_/g, ' ')}`
                      : ''
                    }
                    {log.payload?.next_phase ? ` → ${PHASE_LABELS[log.payload.next_phase] ?? log.payload.next_phase}` : ''}
                  </span>
                  <p className="text-muted-foreground/50 text-xs">
                    {new Date(log.created_date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}