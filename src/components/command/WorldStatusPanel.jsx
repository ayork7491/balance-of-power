/**
 * WorldStatusPanel — Sprint 5B
 *
 * Informational panel showing:
 *   - Player leaderboard
 *   - Military / Economic / Diplomatic victory progress
 *   - Territory/region summaries
 */
import { useState } from 'react';
import { Trophy, Map, Globe } from 'lucide-react';
import LeaderboardPanel from '@/components/campaigns/LeaderboardPanel';
import VictoryProgressPanel from '@/components/campaigns/VictoryProgressPanel';
import VictorySummaryPanel from '@/components/campaigns/VictorySummaryPanel';
import RegionLegend from '@/components/map/RegionLegend';

const SECTION_TABS = [
  { id: 'standings', label: 'Standings', icon: Trophy },
  { id: 'victory',   label: 'Victory',   icon: Globe  },
  { id: 'regions',   label: 'Regions',   icon: Map    },
];

export default function WorldStatusPanel({ campaign, players, mapDef, stateById }) {
  const [activeSection, setActiveSection] = useState('standings');

  return (
    <div className="flex flex-col">
      {/* Section tabs — sticky inside the outer scroll container */}
      <div className="sticky top-0 z-10 flex border-b border-border bg-panel-header">
        {SECTION_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-display tracking-wider uppercase transition-all border-b-2 ${
              activeSection === id
                ? 'text-primary border-primary bg-primary/5'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Only mount panels when their tab is active — prevents background fetches */}
      {activeSection === 'standings' && (
        <LeaderboardPanel campaign={campaign} players={players} enabled={true} />
      )}

      {activeSection === 'victory' && (
        <div className="space-y-0">
          <VictorySummaryPanel players={players} />
          <div className="border-t border-border">
            <VictoryProgressPanel campaign={campaign} players={players} enabled={true} />
          </div>
        </div>
      )}

      {activeSection === 'regions' && (
        <div className="p-3 space-y-3">
          {mapDef?.regions?.length > 0 ? (
            <RegionLegend regions={mapDef.regions} />
          ) : (
            <p className="text-xs text-muted-foreground">No region data available.</p>
          )}
          <TerritoryOwnershipSummary players={players} stateById={stateById} />
        </div>
      )}
    </div>
  );
}

function TerritoryOwnershipSummary({ players, stateById }) {
  const states = Object.values(stateById ?? {});
  const totalTerritories = states.length;
  const owned = states.filter(s => s.owner_player_id).length;
  const unoccupied = totalTerritories - owned;

  const byPlayer = players
    .filter(p => !p.is_eliminated)
    .map(p => {
      const owned = states.filter(s => s.owner_player_id === p.id);
      return {
        ...p,
        count: owned.length,
        troops: owned.reduce((sum, s) => sum + (s.troop_count ?? 0), 0),
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="rounded border border-border overflow-hidden">
      <div className="bg-panel-header px-3 py-2 border-b border-border">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground">
          Territory Ownership
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {owned}/{totalTerritories} occupied · {unoccupied} unoccupied
        </p>
      </div>
      <div className="divide-y divide-border">
        {byPlayer.map(p => (
          <div key={p.id} className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="text-foreground">{p.display_name}</span>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{p.count} territories</span>
              <span>{p.troops} troops</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}