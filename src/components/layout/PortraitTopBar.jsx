/**
 * PortraitTopBar — Compact top bar for portrait layout mode.
 *
 * Shows: BoP logo (home link), campaign name, phase tag, round, timer.
 * Admin extras: Perspective selector (compact), Admin Mode link.
 *
 * The BoP logo is ALWAYS a <Link to="/"> so it navigates to the Home Dashboard
 * in portrait, landscape, and compact-landscape modes without relying on browser back.
 *
 * Admin test mode:
 *  - Unified Perspective selector (compact variant) visible when admin + test players present.
 *  - Admin Mode link always visible to campaign admins (TestTube icon, portrait-friendly).
 */
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, TestTube } from 'lucide-react';
import PhaseTag from '@/components/ui/PhaseTag';
import CountdownTimer from '@/components/ui/CountdownTimer';
import PerspectiveSelector from './PerspectiveSelector';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function PortraitTopBar({ campaign = null, isAdmin = false }) {
  const { id } = useParams();
  const { isTestMode } = useCampaignTestContext();

  return (
    <motion.header
      className="h-10 bg-panel-header border-b border-panel-border flex items-center px-2 gap-1.5 shrink-0 z-20"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Logo — always navigates to Home Dashboard */}
      <Link
        to="/"
        className="flex items-center gap-1 shrink-0 touch-manipulation active:scale-95 transition-transform"
        title="Back to Dashboard"
      >
        <Shield className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-[10px] font-bold tracking-widest text-primary uppercase">BoP</span>
      </Link>

      <div className="w-px h-4 bg-border shrink-0" />

      {campaign ? (
        <>
          {/* Campaign name */}
          <span
            className="font-display text-xs font-semibold tracking-wide text-foreground truncate max-w-[72px]"
            title={campaign.name}
          >
            {campaign.name}
          </span>

          {/* Phase badge */}
          {campaign.current_phase && (
            <PhaseTag phase={campaign.current_phase} compact />
          )}

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Timer */}
          {campaign.phase_deadline && (
            <CountdownTimer deadline={campaign.phase_deadline} compact />
          )}

          {/* Round */}
          <span className="text-[10px] text-muted-foreground shrink-0">
            R{campaign.current_round || 1}
          </span>
        </>
      ) : (
        <span className="font-display text-xs tracking-widest text-muted-foreground uppercase flex-1 truncate">
          Balance of Power
        </span>
      )}

      {/* Admin controls (only for campaign admins) */}
      {isAdmin && campaign?.id && (
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Unified Perspective selector — compact, only shown when test players exist */}
          <PerspectiveSelector compact />

          {/* Admin Mode link — always visible to campaign admins in portrait */}
          <Link
            to={`/campaigns/${id}/admin`}
            className="flex items-center justify-center w-7 h-7 rounded bg-status-pending/20 border border-status-pending/40 shrink-0 hover:brightness-125 transition-all touch-manipulation"
            title="Admin Mode"
          >
            <TestTube className="w-3 h-3 text-status-pending" />
          </Link>
        </div>
      )}
    </motion.header>
  );
}