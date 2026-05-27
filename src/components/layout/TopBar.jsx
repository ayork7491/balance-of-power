/**
 * TopBar — Campaign screen top status bar (Landscape / Desktop).
 * Shows: campaign name, round, phase, timer, lock status, test mode indicator.
 * In non-campaign screens, shows app branding only.
 *
 * Admin test mode now uses a single unified "Perspective" selector
 * (replaces separate View As / Act As controls).
 */
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, FlaskConical, Settings } from 'lucide-react';
import PhaseTag from '@/components/ui/PhaseTag';
import CountdownTimer from '@/components/ui/CountdownTimer';
import PerspectiveSelector from './PerspectiveSelector';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function TopBar({ 
  campaign = null, 
  players = [],
  isAdmin = false,
}) {
  const { isTestMode } = useCampaignTestContext();
  const { id } = useParams();

  return (
    <motion.header 
      className="h-11 bg-panel-header border-b border-panel-border flex items-center px-3 sm:px-4 gap-3 sm:gap-4 shrink-0 z-20"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Brand / Logo — always a home link */}
      <Link to="/" className="flex items-center gap-2 shrink-0 group touch-manipulation active:scale-95 transition-transform" title="Back to Dashboard">
        <motion.div
          whileHover={{ rotate: 15, scale: 1.1 }}
          transition={{ duration: 0.2 }}
        >
          <Shield className="w-4 h-4 text-primary group-hover:brightness-125 transition-all" />
        </motion.div>
        <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase hidden xs:block">
          BoP
        </span>
      </Link>

      <div className="w-px h-5 bg-border shrink-0" />

      {campaign ? (
        <>
          {/* Campaign name */}
          <motion.span 
            className="font-display text-sm font-semibold tracking-wide text-foreground truncate max-w-[8rem] sm:max-w-[12rem]"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            title={campaign.name}
          >
            {campaign.name}
          </motion.span>

          {/* Round */}
          <motion.span 
            className="text-xs text-muted-foreground shrink-0 hidden sm:inline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            R{campaign.current_round || 1}
          </motion.span>

          {/* Phase */}
          {campaign.current_phase && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <PhaseTag phase={campaign.current_phase} />
            </motion.div>
          )}

          {/* Timer */}
          {campaign.phase_deadline && (
            <motion.div
              className="hidden xs:block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              <CountdownTimer deadline={campaign.phase_deadline} />
            </motion.div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Lock status */}
          <motion.div 
            className="flex items-center gap-1 text-xs text-muted-foreground shrink-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Locked</span>
          </motion.div>
        </>
      ) : (
        <motion.span 
          className="font-display text-sm tracking-widest text-muted-foreground uppercase flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Balance of Power
        </motion.span>
      )}

      {/* Admin Test Mode controls */}
      {isAdmin && campaign?.id && (
        <div className="flex items-center gap-2 shrink-0">
          {/* Unified Perspective selector (only shown in test mode with test players) */}
          <PerspectiveSelector />

          {/* Admin link */}
          {isTestMode && (
            <Link
              to={`/campaigns/${id}/admin`}
              className="flex items-center gap-1 bg-status-pending/20 border border-status-pending/40 text-status-pending px-2 py-0.5 rounded text-xs font-display tracking-wider uppercase shrink-0 hover:brightness-125 transition-all"
              title="Open Admin Test Mode"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </div>
      )}

      {/* Test Mode indicator (fallback when no players) */}
      {isTestMode && campaign?.id && (!players || players.length === 0) && (
        <Link
          to={`/campaigns/${id}/admin`}
          className="flex items-center gap-1 bg-status-pending/20 border border-status-pending/40 text-status-pending px-2 py-0.5 rounded text-xs font-display tracking-wider uppercase shrink-0 hover:brightness-125 transition-all"
          title="Open Admin Test Mode"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Test Mode</span>
        </Link>
      )}
    </motion.header>
  );
}