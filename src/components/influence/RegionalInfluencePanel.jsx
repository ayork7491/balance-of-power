/**
 * RegionalInfluencePanel — Sprint 4G
 *
 * Displays per-region influence summaries:
 *   - Permanent Influence (from TerritoryInfluence records, aggregated by region)
 *   - Spendable Influence (from RegionalInfluencePool)
 *
 * Shows a player summary with total permanent + spendable.
 *
 * Props:
 *   influenceByRegion  — { [region_id]: [{ player_id, spendable_influence }] }
 *   playerTotals       — { [player_id]: { permanent, spendable, by_region_permanent } }
 *   players            — CampaignPlayer[]
 *   loading            — boolean
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

const REGION_LABELS = {
  outer_passes:       'Outer Passes',
  high_crown:         'High Crown',
  northern_wilds:     'Northern Wilds',
  deepwoods:          'Deepwoods',
  northern_ruins:     'Northern Ruins',
  central_crossroads: 'Central Crossroads',
  southern_ruins:     'Southern Ruins',
  western_plains:     'Western Plains',
  eastern_granaries:  'Eastern Granaries',
  northern_isles:     'Northern Isles',
  southern_fractures: 'Southern Fractures',
};

function getPlayerColor(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

function getPlayerName(players, playerId) {
  return players?.find(p => p.id === playerId)?.display_name ?? 'Unknown';
}

function RegionRow({ regionId, spendableEntries, permanentByPlayer, players }) {
  const [open, setOpen] = useState(false);

  // Merge players from both permanent and spendable
  const allPlayerIds = new Set([
    ...spendableEntries.map(e => e.player_id),
    ...Object.keys(permanentByPlayer),
  ]);

  const rows = [...allPlayerIds].map(pid => ({
    player_id: pid,
    permanent: permanentByPlayer[pid] ?? 0,
    spendable: spendableEntries.find(e => e.player_id === pid)?.spendable_influence ?? 0,
  })).filter(r => r.permanent > 0 || r.spendable > 0)
    .sort((a, b) => (b.permanent + b.spendable) - (a.permanent + a.spendable));

  if (rows.length === 0) return null;

  return (
    <div className="border border-border rounded overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-panel-header hover:bg-muted/20 transition-colors text-left"
      >
        <span className="font-display text-xs tracking-wider text-foreground">
          {REGION_LABELS[regionId] ?? regionId}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{rows.length} player{rows.length !== 1 ? 's' : ''}</span>
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-border">
          {rows.map(r => {
            const color = getPlayerColor(players, r.player_id);
            const name = getPlayerName(players, r.player_id);
            return (
              <div key={r.player_id} className="flex items-center gap-2 px-3 py-2 bg-muted/5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-foreground flex-1 truncate">{name}</span>
                <div className="flex items-center gap-3 text-[10px] shrink-0">
                  <div className="text-center">
                    <div className="font-mono font-bold text-accent">{r.permanent}</div>
                    <div className="text-muted-foreground">Perm</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono font-bold text-status-info">{r.spendable}</div>
                    <div className="text-muted-foreground">Spend</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RegionalInfluencePanel({ influenceByRegion, playerTotals, players, loading }) {
  const [showSummary, setShowSummary] = useState(true);

  // Build permanent-by-region for each region from playerTotals
  const permByRegion = {};
  for (const [playerId, totals] of Object.entries(playerTotals ?? {})) {
    for (const [regionId, amount] of Object.entries(totals.by_region_permanent ?? {})) {
      if (!permByRegion[regionId]) permByRegion[regionId] = {};
      permByRegion[regionId][playerId] = amount;
    }
  }

  // All region IDs that have any influence
  const allRegionIds = new Set([
    ...Object.keys(influenceByRegion ?? {}),
    ...Object.keys(permByRegion),
  ]);

  const activePlayers = Object.entries(playerTotals ?? {})
    .filter(([, t]) => t.permanent > 0 || t.spendable > 0)
    .sort(([, a], [, b]) => (b.permanent + b.spendable) - (a.permanent + a.spendable));

  if (loading) {
    return <p className="text-xs text-muted-foreground p-3">Loading influence data…</p>;
  }

  if (allRegionIds.size === 0) {
    return <p className="text-xs text-muted-foreground italic p-3">No influence has been established yet.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Player summary */}
      {activePlayers.length > 0 && (
        <div>
          <button
            onClick={() => setShowSummary(o => !o)}
            className="flex items-center gap-1.5 text-[10px] font-display tracking-wider uppercase text-muted-foreground mb-1.5 hover:text-foreground transition-colors"
          >
            {showSummary ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Player Totals
          </button>
          {showSummary && (
            <div className="space-y-1">
              {activePlayers.map(([playerId, totals]) => {
                const color = getPlayerColor(players, playerId);
                const name = getPlayerName(players, playerId);
                return (
                  <div
                    key={playerId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-muted/5 text-xs"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="flex-1 truncate text-foreground">{name}</span>
                    <div className="flex items-center gap-3 shrink-0 text-[10px]">
                      <div className="text-center">
                        <div className="font-mono font-bold text-accent">{totals.permanent}</div>
                        <div className="text-muted-foreground">Perm</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono font-bold text-status-info">{totals.spendable}</div>
                        <div className="text-muted-foreground">Spend</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Regional breakdown */}
      <div>
        <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground mb-1.5">
          By Region
        </p>
        <div className="space-y-1.5">
          {[...allRegionIds].sort().map(regionId => (
            <RegionRow
              key={regionId}
              regionId={regionId}
              spendableEntries={influenceByRegion?.[regionId] ?? []}
              permanentByPlayer={permByRegion[regionId] ?? {}}
              players={players}
            />
          ))}
        </div>
      </div>
    </div>
  );
}