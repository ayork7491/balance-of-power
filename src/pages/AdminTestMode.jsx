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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(user => {
      setIsAdmin(user?.role === 'admin');
      setIsLoading(false);
    });
  }, []);

  if (isLoading || loadingCampaign) {
    return (
      <AppShell showBack title="Admin Test Mode">
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
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
            <p className="text-xs text-muted-foreground mt-0.5">
              Hidden information rules are enforced per player perspective. Use the debug overlay to see all data.
              {campaign && ` • Campaign: ${campaign.name}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column */}
          <div className="space-y-5">
            {/* Test Player Creator */}
            <div className="panel p-4">
              <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
                <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground">
                  Create Test Player
                </h2>
              </div>
              <TestPlayerCreator />
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
            {/* Debug Overlay */}
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