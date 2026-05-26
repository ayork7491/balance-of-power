/**
 * CampaignCard — a campaign summary card shown on the Home dashboard.
 * Admin-only: shows an overflow menu with Delete/Archive action.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ChevronRight, Crown, MoreVertical, Trash2, Archive } from 'lucide-react';
import { CAMPAIGN_STATUS, PHASE_COLORS } from '@/config/theme';
import ConfirmCleanupModal from './ConfirmCleanupModal';
import { cleanupCampaign } from '@/features/campaigns';
import { base44 } from '@/api/base44Client';

export default function CampaignCard({ campaign, myPlayer, onRemoved }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen]     = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [userId, setUserId]         = useState(null);

  const status      = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.lobby;
  const phaseConfig = campaign.current_phase ? PHASE_COLORS[campaign.current_phase] : null;
  const isAdmin     = myPlayer?.is_admin;
  const isReady     = myPlayer?.is_ready;
  const needsAction = campaign.status === 'lobby' && !isReady;

  const href = campaign.status === 'lobby'
    ? `/campaigns/${campaign.id}/lobby`
    : `/campaigns/${campaign.id}`;

  const handleMenuOpen = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) {
      const u = await base44.auth.me();
      setUserId(u?.id);
    }
    setMenuOpen(v => !v);
  };

  const handleCleanupConfirm = async () => {
    const u = userId || (await base44.auth.me().then(u => u?.id));
    await cleanupCampaign(campaign.id, u);
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-semibold text-sm tracking-wider text-foreground truncate">
                  {campaign.name}
                </h3>
                {isAdmin && <Crown className="w-3 h-3 text-status-pending shrink-0" title="You are the admin" />}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs ${status.color}`}>{status.label}</span>
                {phaseConfig && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className={`text-xs ${phaseConfig.text}`}>{phaseConfig.label}</span>
                  </>
                )}
                {campaign.game_profile_name && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />{campaign.game_profile_name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {needsAction && <span className="badge-pending text-xs">Action needed</span>}
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Link>

        {/* Admin overflow menu */}
        {isAdmin && (
          <div className="relative shrink-0 pr-3">
            <button
              onClick={handleMenuOpen}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Campaign options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop to close */}
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-40 min-w-44 panel border shadow-lg">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowModal(true); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-display tracking-wider uppercase text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    {campaign.status === 'lobby'
                      ? <><Trash2 className="w-3.5 h-3.5" /> Delete Campaign</>
                      : <><Archive className="w-3.5 h-3.5" /> Archive Campaign</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <ConfirmCleanupModal
          campaign={campaign}
          onConfirm={handleCleanupConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}