/**
 * PortraitTopBar — Compact top bar for portrait layout mode.
 * Shows essential campaign info in minimal vertical space.
 * Admin test mode controls hidden behind a compact icon.
 */
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Settings, TestTube } from 'lucide-react';
import PhaseTag from '@/components/ui/PhaseTag';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function PortraitTopBar({ campaign = null, isAdmin = false, isTestMode: isTestModeProp = false }) {
  const { id } = useParams();
  const { isTestMode: isTestModeCtx } = useCampaignTestContext();
  const isTestMode = isTestModeCtx || isTestModeProp;

  return (
    <motion.header
      className="h-10 bg-panel-header border-b border-panel-border flex items-center px-3 gap-2 shrink-0 z-20"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center gap-1.5 shrink-0 touch-manipulation active:scale-95 transition-transform"
        title="Dashboard"
      >
        <Shield className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-[10px] font-bold tracking-widest text-primary uppercase">BoP</span>
      </Link>

      <div className="w-px h-4 bg-border shrink-0" />

      {campaign ? (
        <>
          {/* Campaign name — more truncation on portrait */}
          <span
            className="font-display text-xs font-semibold tracking-wide text-foreground truncate max-w-[90px]"
            title={campaign.name}
          >
            {campaign.name}
          </span>

          {/* Phase badge */}
          {campaign.current_phase && (
            <PhaseTag phase={campaign.current_phase} compact />
          )}

          <div className="flex-1" />

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
        <span className="font-display text-xs tracking-widest text-muted-foreground uppercase flex-1">
          Balance of Power
        </span>
      )}

      {/* Admin test mode shortcut */}
      {isAdmin && isTestMode && campaign?.id && (
        <Link
          to={`/campaigns/${id}/admin`}
          className="flex items-center justify-center w-7 h-7 rounded bg-status-pending/20 border border-status-pending/40 shrink-0 hover:brightness-125 transition-all touch-manipulation"
          title="Admin Test Mode"
        >
          <TestTube className="w-3 h-3 text-status-pending" />
        </Link>
      )}
    </motion.header>
  );
}