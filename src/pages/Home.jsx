/**
 * Home Dashboard — user's command center.
 * Shows: campaigns (admin + player), pending invites, action indicators.
 * Future: populated by Campaign entity data.
 */
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { Plus, LogIn, Shield, Bell, Swords } from 'lucide-react';
import { useUserProfile } from '@/features/auth/useUserProfile';

export default function Home() {
  const { user } = useUserProfile();
  const name = user?.display_name || user?.full_name || 'Commander';

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* Header row */}
        <div className="flex items-center justify-between">
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
              <LogIn className="w-3.5 h-3.5" />
              Join
            </Link>
            <Link
              to="/campaigns/create"
              className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              New Campaign
            </Link>
          </div>
        </div>

        {/* Pending invites */}
        <section>
          <h2 className="font-display text-xs tracking-widest uppercase text-status-pending mb-3 flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" />
            Pending Invites
          </h2>
          <div className="panel">
            <EmptyState
              icon={Bell}
              title="No pending invites"
              description="Campaign invitations will appear here."
            />
          </div>
        </section>

        {/* Active campaigns */}
        <section>
          <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Swords className="w-3.5 h-3.5" />
            Your Campaigns
          </h2>
          <div className="panel">
            <EmptyState
              icon={Shield}
              title="No campaigns yet"
              description="Create a campaign or join one with a campaign ID."
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
        </section>

        {/* Quick links */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Game Profiles', to: '/profiles', icon: Shield },
            { label: 'Settings', to: '/settings', icon: Shield },
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