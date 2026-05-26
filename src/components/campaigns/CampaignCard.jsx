/**
 * CampaignCard — a campaign summary card shown on the Home dashboard.
 */
import { Link } from 'react-router-dom';
import { Shield, Users, Clock, ChevronRight, Crown } from 'lucide-react';
import { CAMPAIGN_STATUS, PHASE_COLORS } from '@/config/theme';

export default function CampaignCard({ campaign, myPlayer }) {
  const status = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.lobby;
  const phaseConfig = campaign.current_phase ? PHASE_COLORS[campaign.current_phase] : null;
  const isAdmin = myPlayer?.is_admin;
  const isReady = myPlayer?.is_ready;
  const needsAction = campaign.status === 'lobby' && !isReady;

  const href = campaign.status === 'lobby'
    ? `/campaigns/${campaign.id}/lobby`
    : `/campaigns/${campaign.id}`;

  return (
    <Link
      to={href}
      className={`panel hover:border-primary/40 transition-all flex items-center gap-0 overflow-hidden ${needsAction ? 'border-status-pending/50' : ''}`}
    >
      {/* Left accent bar */}
      <div
        className="w-1 self-stretch shrink-0"
        style={{
          backgroundColor: needsAction
            ? 'hsl(var(--status-pending))'
            : campaign.status === 'active' ? 'hsl(var(--status-locked))' : 'hsl(var(--border))',
        }}
      />

      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: name + meta */}
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

          {/* Right: action nudge */}
          <div className="flex items-center gap-2 shrink-0">
            {needsAction && (
              <span className="badge-pending text-xs">Action needed</span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Link>
  );
}