/**
 * AdminTestMode — admin-only tool for simulating campaigns solo.
 * Allows: perspective switching, manual phase advance, auto-fill decisions, snapshot viewer.
 * CRITICAL: Must preserve hidden-information rules per perspective.
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { base44 } from '@/api/base44Client';
import { FlaskConical } from 'lucide-react';
import { useCampaign } from '@/features/campaigns';

// Admin components
import TestPlayerCreator from '@/components/admin/TestPlayerCreator';
import PerspectiveSwitcher from '@/components/admin/PerspectiveSwitcher';
import DebugOverlay from '@/components/admin/DebugOverlay';
import PhaseControls from '@/components/admin/PhaseControls';
import SnapshotInspector from '@/components/admin/SnapshotInspector';

export default function AdminTestMode() {
  const { id } = useParams();
  const { campaign, players, loading: loadingCampaign } = useCampaign(id);
  const [currentPerspective, setCurrentPerspective] = useState(null);
  const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(false);

  // Check admin access
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isCampaignAdmin, setIsCampaignAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsPlatformAdmin(user.role === 'admin');
      setIsCampaignAdmin(campaign?.admin_user_id === user.id);
      setIsLoading(false);
    });
  }, [campaign?.admin_user_id]);

  const hasAccess = isPlatformAdmin || isCampaignAdmin;
  const isTestCampaign = campaign?.is_test_campaign === true;

  if (isLoading || loadingCampaign) {
    return (
      <AppShell showBack title="Admin Test Mode">
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!hasAccess) {
    return (
      <AppShell showBack title="Admin Test Mode">
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <p className="text-destructive font-semibold mb-2">Access Denied</p>
          <p className="text-sm text-muted-foreground">Admin privileges required</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showBack title="Admin Test Mode">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Warning banner */}
        <div className="border border-status-pending/40 bg-status-pending/10 rounded p-3 flex items-start gap-3">
          <FlaskConical className="w-4 h-4 text-status-pending shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-display font-semibold tracking-wider text-status-pending uppercase">Test Mode Active</p>
            <div className="text-xs text-muted-foreground mt-0.5 space-y-1">
              <p>
                Campaign: <span className="text-foreground font-medium">{campaign?.name}</span>
                {isTestCampaign && <span className="ml-2 text-status-pending">• Test Campaign</span>}
              </p>
              <p>
                Access: <span className="text-foreground font-medium">{isPlatformAdmin ? 'Platform Admin' : 'Campaign Admin'}</span>
              </p>
              {!isTestCampaign && isCampaignAdmin && !isPlatformAdmin && (
                <p className="text-status-pending mt-1">
                  ⚠️ Limited access - some tools restricted to test campaigns or platform admins
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column */}
          <div className="space-y-5">
            {/* Test Player Creator - Campaign Admin or Platform Admin */}
            <div className="panel p-4">
              <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
                <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                  Add Test Player to Lobby
                  {campaign?.status !== 'lobby' && (
                    <span className="text-[10px] text-status-pending">(Lobby Phase Only)</span>
                  )}
                </h2>
              </div>
              {campaign?.status === 'lobby' ? (
                <TestPlayerCreator />
              ) : (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Test players can only be added during the lobby phase.
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Current status: <span className="text-foreground">{campaign?.status}</span>
                  </p>
                  {campaign?.status === 'active' && (
                    <p className="text-[10px] text-status-pending">
                      Campaign has already started. Test players would need to be added before starting.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Perspective Switcher */}
            <div className="panel p-4">
              <PerspectiveSwitcher
                campaign={campaign}
                players={players}
                currentPerspective={currentPerspective}
                onPerspectiveChange={setCurrentPerspective}
              />
            </div>

            {/* Phase Controls */}
            <div className="panel p-4">
              <PhaseControls
                campaign={campaign}
                onPhaseChanged={() => {}}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Debug Overlay - Restricted */}
            <div className="panel p-4">
              <DebugOverlay
                campaign={campaign}
                enabled={debugOverlayEnabled}
                onToggle={() => setDebugOverlayEnabled(!debugOverlayEnabled)}
              />
            </div>

            {/* Snapshot Inspector */}
            <div className="panel p-4">
              <SnapshotInspector campaign={campaign} />
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}