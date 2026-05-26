/**
 * CampaignLobby — pre-game lobby before campaign starts.
 * Future: connected to campaign and campaign_players entities.
 * Admin sees join requests; all players see ready status.
 */
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import { Shield, Users, Play } from 'lucide-react';

export default function CampaignLobby() {
  const isAdmin = true; // Future: derived from campaign_players role

  return (
    <AppShell showBack title="Campaign Lobby">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Campaign summary */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Campaign Details
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {['Campaign Name', 'Map', 'Game Profile', 'Admin'].map(label => (
              <div key={label}>
                <p className="text-xs text-muted-foreground font-display tracking-wider uppercase">{label}</p>
                <p className="text-sm text-foreground mt-0.5">—</p>
              </div>
            ))}
          </div>
        </div>

        {/* Players */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Players
            </h2>
          </div>
          <EmptyState
            icon={Users}
            title="Waiting for players"
            description="Players who join will appear here with their chosen colors and names."
          />
        </div>

        {/* Admin start button */}
        {isAdmin && (
          <div className="flex justify-end">
            <button
              disabled
              className="flex items-center gap-2 px-6 py-3 rounded bg-primary/30 text-primary-foreground/40 text-xs font-display tracking-widest uppercase cursor-not-allowed border border-primary/20"
            >
              <Play className="w-4 h-4" />
              Start Campaign
              <span className="text-primary/40 font-body normal-case tracking-normal">(requires players)</span>
            </button>
          </div>
        )}

      </div>
    </AppShell>
  );
}