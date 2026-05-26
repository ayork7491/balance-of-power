/**
 * JoinCampaign — players join via invite or campaign ID.
 * Future: connected to campaign_invites and campaign_join_requests entities.
 */
import AppShell from '@/components/layout/AppShell';
import { LogIn, Bell } from 'lucide-react';

export default function JoinCampaign() {
  return (
    <AppShell showBack title="Join Campaign">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Via campaign ID */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <LogIn className="w-3.5 h-3.5" />
              Join by Campaign ID
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Campaign ID</label>
              <input
                type="text"
                placeholder="Enter campaign ID..."
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono tracking-wider"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A join request will be sent to the campaign admin for approval.
            </p>
            <button className="w-full px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all">
              Send Join Request
            </button>
          </div>
        </div>

        {/* Pending invites */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" />
              Pending Invites
            </h2>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground text-center py-4">No pending invites. Invite notifications will appear here.</p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}