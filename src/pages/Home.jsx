/**
 * Home Dashboard — user's command center.
 * Shows: active campaigns, pending invites, action indicators.
 */
import { Link } from 'react-router-dom';
import { Plus, LogIn, Shield, Bell, Swords, Loader2, Settings } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import CampaignCard from '@/components/campaigns/CampaignCard';
import { useUserProfile } from '@/features/auth/useUserProfile';
import { useMyCampaigns, useMyInvites } from '@/features/campaigns';

export default function Home() {
  const { user } = useUserProfile();
  const name = user?.display_name || user?.full_name || 'Commander';
  const { campaigns, players, loading: loadingCampaigns } = useMyCampaigns();
  const { invites, loading: loadingInvites } = useMyInvites();

  // Build a quick lookup: campaign_id → my CampaignPlayer record
  const myPlayerByCampaign = Object.fromEntries(players.map(p => [p.campaign_id, p]));

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-widest uppercase text-foreground">
              Command Center
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Welcome back, <span className="text-foreground font-medium">{name}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/campaigns/join"
              className="flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Join
            </Link>
            <Link
              to="/campaigns/create"
              className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New Campaign
            </Link>
          </div>
        </div>

        {/* Pending invites */}
        {(loadingInvites || invites.length > 0) && (
          <section>
            <h2 className="font-display text-xs tracking-widest uppercase text-status-pending mb-3 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" />
              Pending Invites
              {invites.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-status-pending/20 text-status-pending text-xs">{invites.length}</span>
              )}
            </h2>
            <div className="panel">
              {loadingInvites ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between p-4 gap-3">
                      <div>
                        <p className="text-sm font-display font-semibold tracking-wider text-foreground">{invite.campaign_name}</p>
                        <p className="text-xs text-muted-foreground">from {invite.invited_by_name}</p>
                      </div>
                      <Link
                        to="/campaigns/join"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all shrink-0"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Campaigns */}
        <section>
          <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Swords className="w-3.5 h-3.5" /> Your Campaigns
          </h2>
          {loadingCampaigns ? (
            <div className="panel flex items-center justify-center py-10 gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={Shield}
                title="No campaigns yet"
                description="Create a campaign or join one with an invite code."
                action={
                  <Link
                    to="/campaigns/create"
                    className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
                  >
                    Create Campaign
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  myPlayer={myPlayerByCampaign[campaign.id]}
                />
              ))}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Game Profiles', to: '/profiles', icon: Shield },
            { label: 'Settings', to: '/settings', icon: Settings },
            { label: 'Join Campaign', to: '/campaigns/join', icon: LogIn },
          ].map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="panel p-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-display tracking-wider uppercase">{label}</span>
            </Link>
          ))}
        </section>

      </div>
    </AppShell>
  );
}