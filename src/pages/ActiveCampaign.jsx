/**
 * ActiveCampaign — primary gameplay screen with landscape docked layout.
 * Houses: map center, left phase dock, right info dock, bottom tab rail.
 * Future: all panels populated with real campaign, territory, and phase data.
 */
import { useState } from 'react';
import CampaignLayout from '@/components/layout/CampaignLayout';
import { Map, Shield, Swords, Trophy, Grid3x3, ScrollText } from 'lucide-react';

// Placeholder panel content — each will become its own component in later prompts
function PhasePanelPlaceholder() {
  return (
    <div className="p-4 space-y-3">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-status-pending">Deploy Phase</p>
      </div>
      <p className="text-xs text-muted-foreground">Phase action panel — deploy, attack, fortify controls will appear here based on the active phase.</p>
      <div className="space-y-2 pt-2">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-16 bg-muted/50 rounded animate-pulse" />
      </div>
      <button disabled className="w-full mt-4 px-4 py-2 rounded border border-primary/30 text-primary/40 text-xs font-display tracking-wider uppercase cursor-not-allowed">
        Lock Decisions
      </button>
    </div>
  );
}

function InfoPanelPlaceholder({ activeTab }) {
  const content = {
    leaderboard:  { label: 'Standings',   desc: 'Player rankings, territory counts, troop totals.' },
    territories:  { label: 'Territories', desc: 'Full territory list sortable by owner, troops, region.' },
    history:      { label: 'History',     desc: 'Phase snapshots, decision logs, battle history.' },
    battles:      { label: 'Battles',     desc: 'Active battle cards, pending approvals, results.' },
  };
  const info = content[activeTab] || content.leaderboard;

  return (
    <div className="p-4">
      <p className="font-display text-xs tracking-widest uppercase text-muted-foreground mb-2">{info.label}</p>
      <p className="text-xs text-muted-foreground">{info.desc}</p>
      <div className="space-y-2 mt-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
      <div className="opacity-20">
        <Map className="w-20 h-20 text-primary" />
      </div>
      <div className="text-center">
        <p className="font-display text-sm font-bold tracking-widest uppercase text-foreground">
          Campaign Map
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-48">
          SVG territory map renderer will be built in a future prompt.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 opacity-40">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="w-16 h-12 rounded border border-border bg-secondary/30" />
        ))}
      </div>
    </div>
  );
}

const mockCampaign = {
  name: 'Test Campaign',
  current_round: 1,
  current_phase: 'deploy',
  phase_deadline: null,
};

export default function ActiveCampaign() {
  const [activeTab, setActiveTab] = useState('map');
  const [isTestMode] = useState(false);

  return (
    <CampaignLayout
      campaign={mockCampaign}
      isTestMode={isTestMode}
      leftDockContent={<PhasePanelPlaceholder />}
      rightDockContent={<InfoPanelPlaceholder activeTab={activeTab} />}
      defaultTab={activeTab}
      onTabChange={setActiveTab}
    >
      <MapPlaceholder />
    </CampaignLayout>
  );
}