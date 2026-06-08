/**
 * RouteCreator — Sprint 4E
 *
 * UI for creating a new supply route.
 * Player selects hub territory, then destination territory.
 * Validates on server; shows clear error messages.
 */
import { useState } from 'react';
import { Plus, Loader2, GitBranch } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function RouteCreator({ campaign, myPlayer, hubs, mapDef, onCreated }) {
  const [hubId, setHubId] = useState('');
  const [destId, setDestId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!hubs || hubs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No Resource Hubs available. Build a Resource Hub in a territory first.
      </p>
    );
  }

  const hubsWithCapacity = hubs.filter(h => h.routes_remaining > 0);

  const getTerritoryName = (tid) =>
    mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  const handleCreate = async () => {
    if (!hubId || !destId) {
      setError('Select both a hub territory and a destination.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('logisticsPhase', {
        action: 'createRoute',
        campaign_id: campaign.id,
        hub_territory_id: hubId,
        destination_territory_id: destId,
      });
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setHubId('');
        setDestId('');
        onCreated?.();
      }
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to create route');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-destructive px-2 py-1.5 rounded border border-destructive/30 bg-destructive/10">
          ⚠ {error}
        </p>
      )}

      {/* Hub selector */}
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Hub Territory</label>
        <select
          value={hubId}
          onChange={e => { setHubId(e.target.value); setDestId(''); setError(null); }}
          className="w-full text-xs bg-muted/30 border border-border rounded px-2 py-1.5 text-foreground"
        >
          <option value="">— Select hub —</option>
          {hubsWithCapacity.map(h => (
            <option key={h.territory_id} value={h.territory_id}>
              {getTerritoryName(h.territory_id)} ({h.routes_used}/{h.route_capacity} slots used)
            </option>
          ))}
        </select>
        {hubsWithCapacity.length === 0 && (
          <p className="text-[10px] text-muted-foreground">All Resource Hubs are at capacity (3/3).</p>
        )}
      </div>

      {/* Destination input */}
      {hubId && (
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Destination Territory (≤3 steps)</label>
          <select
            value={destId}
            onChange={e => { setDestId(e.target.value); setError(null); }}
            className="w-full text-xs bg-muted/30 border border-border rounded px-2 py-1.5 text-foreground"
          >
            <option value="">— Select destination —</option>
            {(mapDef?.territories ?? [])
              .filter(t => t.territory_id !== hubId)
              .map(t => (
                <option key={t.territory_id} value={t.territory_id}>
                  {t.name}
                </option>
              ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            Routes traverse land, maritime, and river connections. Max 3 steps.
          </p>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!hubId || !destId || submitting || hubsWithCapacity.length === 0}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-accent/40 bg-accent/10 text-accent text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
      >
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
        Create Route
      </button>
    </div>
  );
}