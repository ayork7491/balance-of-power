/**
 * ResourceDebugPanel — Admin debug view for Sprint 3B resource system.
 * Shows activated territories, generated resources, storage before/after, player ledgers.
 * Admin-only. Not shown to regular players.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Bug, RefreshCw, Zap, ChevronDown, ChevronRight } from 'lucide-react';

const RESOURCE_ICONS = { gold: '🥇', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const VALID_RESOURCES = ['gold', 'iron', 'timber', 'stone', 'food'];

function StorageSummary({ storage }) {
  if (!storage) return <span className="text-muted-foreground/50 text-[10px]">empty</span>;
  const entries = VALID_RESOURCES.filter(r => (storage[r] ?? 0) > 0);
  if (!entries.length) return <span className="text-muted-foreground/50 text-[10px]">empty</span>;
  return (
    <span className="flex gap-1 flex-wrap">
      {entries.map(r => (
        <span key={r} className="text-[10px] text-foreground">{RESOURCE_ICONS[r]}{storage[r]}</span>
      ))}
    </span>
  );
}

function PlayerDebugRow({ summary }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <div className="rounded border border-border bg-muted/10">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{summary.display_name}</span>
          <span className="text-[10px] text-muted-foreground">{summary.territories_owned} terr.</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] text-muted-foreground">Storage:</span>
          <StorageSummary storage={summary.territory_storage_totals} />
          {summary.ledger && (
            <>
              <span className="text-[10px] text-muted-foreground ml-2">Ledger:</span>
              <StorageSummary storage={summary.ledger} />
            </>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 space-y-1">
          {summary.territories.map(t => (
            <div key={t.territory_id} className="flex items-center justify-between text-[10px] py-0.5">
              <span className="text-muted-foreground font-mono">{t.territory_id}</span>
              <span className="text-foreground">{RESOURCE_ICONS[t.resource_type] ?? '?'} {t.resource_type}</span>
              <StorageSummary storage={t.resource_storage} />
              {t.has_resource_hub && <span className="text-status-info">🏭hub</span>}
            </div>
          ))}
          {summary.territories.length === 0 && (
            <p className="text-[10px] text-muted-foreground">No territories</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResourceDebugPanel({ campaign }) {
  const [debug, setDebug] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initing, setIniting] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  const loadDebug = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('resourcePhase', {
      action: 'getDebugState',
      campaign_id: campaign.id,
    });
    setDebug(res.data);
    setLoading(false);
  };

  const handleInit = async () => {
    setIniting(true);
    setInitResult(null);
    const res = await base44.functions.invoke('resourcePhase', {
      action: 'initResourceTypes',
      campaign_id: campaign.id,
    });
    setInitResult(res.data);
    setIniting(false);
    await loadDebug();
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    setGenResult(null);
    const res = await base44.functions.invoke('resourcePhase', {
      action: 'generateAll',
      campaign_id: campaign.id,
    });
    setGenResult(res.data);
    setGenerating(false);
    await loadDebug();
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1 flex items-center justify-between">
        <p className="font-display text-xs tracking-widest uppercase text-destructive flex items-center gap-2">
          <Bug className="w-3.5 h-3.5" /> Resource Debug
        </p>
        <button onClick={loadDebug} disabled={loading} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Admin actions */}
      <div className="space-y-2">
        <button
          onClick={handleInit}
          disabled={initing}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground font-display tracking-wider uppercase disabled:opacity-40"
        >
          {initing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Init Resource Types (idempotent)
        </button>
        {initResult && (
          <p className="text-[10px] text-status-locked text-center">
            ✓ Stamped {initResult.stamped}, skipped {initResult.skipped}
          </p>
        )}

        <button
          onClick={handleGenerateAll}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-status-pending/40 bg-status-pending/10 text-status-pending text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40"
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          Generate All (admin)
        </button>
        {genResult && (
          <p className="text-[10px] text-status-locked text-center">
            ✓ Generated for {genResult.territories_generated} territories
          </p>
        )}
      </div>

      {/* Debug state */}
      {!debug && !loading && (
        <button onClick={loadDebug} className="w-full text-xs text-muted-foreground hover:text-foreground py-2">
          Load debug state
        </button>
      )}

      {loading && <div className="flex items-center gap-2 text-muted-foreground text-xs py-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>}

      {debug && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Round {debug.round} · {debug.owned_territories}/{debug.total_territories} territories owned · Map: {debug.map_id}
          </p>
          {debug.player_summaries?.map(s => (
            <PlayerDebugRow key={s.player_id} summary={s} />
          ))}
        </div>
      )}
    </div>
  );
}