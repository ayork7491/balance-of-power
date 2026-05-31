/**
 * CampaignCard — a campaign summary card shown on the Home dashboard.
 * Admin-only: shows an overflow menu with Delete/Archive action.
 * Refactored to use reusable components.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronRight, Crown, MoreVertical, Settings } from 'lucide-react';
import { CAMPAIGN_STATUS, PHASE_COLORS } from '@/config/theme';
import ConfirmCleanupModal from './ConfirmCleanupModal';
import { cleanupCampaign } from '@/features/campaigns';
import AdminMenu from './AdminMenu';
import StatusPill from './StatusPill';
import ActionBadge from './ActionBadge';

export default function CampaignCard({ campaign, myPlayer, onRemoved }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const status = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.lobby;
  const phaseConfig = campaign.current_phase ? PHASE_COLORS[campaign.current_phase] : null;
  const isAdmin = myPlayer?.is_admin;
  const isReady = myPlayer?.is_ready;
  const needsAction = campaign.status === 'lobby' && !isReady;

  const href = campaign.status === 'lobby'
    ? `/campaigns/${campaign.id}/lobby`
    : `/campaigns/${campaign.id}`;

  // AdminMenu calls this to open the confirmation modal — does NOT delete immediately
  const handleRequestCleanup = () => {
    setShowModal(true);
  };

  // Modal confirmed — now actually delete
  const handleConfirmCleanup = async () => {
    await cleanupCampaign(campaign.id);
    setShowModal(false);
    onRemoved?.();
  };

  return (
    <>
      <div className={`panel hover:border-primary/40 transition-all flex items-center gap-0 overflow-hidden relative ${needsAction ? 'border-status-pending/50' : ''}`}>
        {/* Left accent bar */}
        <div
          className="w-1 self-stretch shrink-0"
          style={{
            backgroundColor: needsAction
              ? 'hsl(var(--status-pending))'
              : campaign.status === 'active' ? 'hsl(var(--status-locked))' : 'hsl(var(--border))',
          }}
        />

        {/* Main clickable area */}
        <Link to={href} className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-display font-semibold text-sm tracking-wider text-foreground truncate">
                  {campaign.name}
                </h3>
                {isAdmin && <Crown className="w-3 h-3 text-status-pending shrink-0" title="You are the admin" />}
              </div>
              {isAdmin && campaign.status === 'active' && (
                <Link
                  to={`/campaigns/${campaign.id}/admin`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Settings className="w-3 h-3" />
                  Admin Mode
                </Link>
              )}
              <StatusPill status={status} phase={phaseConfig} gameProfile={{ name: campaign.game_profile_name, icon: Shield }} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ActionBadge show={needsAction} />
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Link>

        {/* Admin overflow menu */}
        {isAdmin && (
          <div className="relative shrink-0 pr-3">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v); }}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Campaign options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AdminMenu
              campaign={campaign}
              onCleanup={handleRequestCleanup}
              isOpen={menuOpen}
              onOpenChange={setMenuOpen}
            />
          </div>
        )}
      </div>

      {showModal && (
        <ConfirmCleanupModal
          campaign={campaign}
          onConfirm={handleConfirmCleanup}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}