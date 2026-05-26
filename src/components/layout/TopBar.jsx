/**
 * TopBar — Campaign screen top status bar.
 * Shows: campaign name, round, phase, timer, lock status, test mode indicator.
 * In non-campaign screens, shows app branding only.
 */
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, FlaskConical, Settings, Eye, User, TestTube } from 'lucide-react';
import PhaseTag from '@/components/ui/PhaseTag';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function TopBar({ 
  campaign = null, 
  isTestMode = false, 
  players = [],
  isAdmin = false,
}) {
  // Use centralized test context
  const {
    viewingAsCampaignPlayerId,
    actingAsCampaignPlayerId,
    viewingAsPlayer,
    actingAsPlayer,
    setViewingAsCampaignPlayerId,
    setActingAsCampaignPlayerId,
    availableActingAsPlayers,
  } = useCampaignTestContext();
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
          {/* Campaign name — better truncation */}
          <motion.span 
            className="font-display text-sm font-semibold tracking-wide text-foreground truncate max-w-[8rem] sm:max-w-[12rem]"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            title={campaign.name}
          >
            {campaign.name}
          </motion.span>

          {/* Round — compact on mobile */}
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

          {/* Timer — hide on very small screens */}
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

          {/* Lock status — simplified on mobile */}
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

      {/* Admin Test Mode controls (Viewing As + Acting As) */}
      {isAdmin && campaign?.id && players?.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {/* Viewing As selector - show in lobby, setup, and active campaign */}
          <div className="flex items-center gap-1.5 bg-muted/10 border border-border px-2 py-1 rounded">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider hidden sm:inline">Viewing As</span>
            <Select value={viewingAsCampaignPlayerId || 'admin'} onValueChange={(val) => {
              const player = val === 'admin' ? null : players.find(p => p.id === val);
              setViewingAsCampaignPlayerId(player?.id ?? null);
            }}>
              <SelectTrigger className="h-7 text-xs w-32 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Admin / My View
                  </span>
                </SelectItem>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.color ? `hsl(var(--${player.color}))` : '#888' }} />
                      {player.display_name} {player.is_test_player && '(Test)'}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Acting As selector (action delegation) - show in lobby, setup, and active campaign */}
          <div className="flex items-center gap-1.5 bg-status-pending/10 border border-status-pending/40 px-2 py-1 rounded">
            <TestTube className="w-3.5 h-3.5 text-status-pending" />
            <span className="text-[10px] text-status-pending uppercase tracking-wider hidden sm:inline">Acting As</span>
            <Select value={actingAsCampaignPlayerId || 'admin'} onValueChange={(val) => {
              setActingAsCampaignPlayerId(val === 'admin' ? null : val);
            }}>
              <SelectTrigger className="h-7 text-xs w-32 sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3 h-3" /> My Player
                  </span>
                </SelectItem>
                {availableActingAsPlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: player.color ? `hsl(var(--${player.color}))` : '#888' }} />
                      {player.display_name} {player.is_test_player && '(Test)'}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Link
            to={`/campaigns/${id}/admin`}
            className="flex items-center gap-1 bg-status-pending/20 border border-status-pending/40 text-status-pending px-2 py-0.5 rounded text-xs font-display tracking-wider uppercase shrink-0 hover:brightness-125 transition-all"
            title="Open Admin Test Mode"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin Mode</span>
          </Link>
        </div>
      )}

      {/* Test Mode indicator (fallback when no players) */}
      {isTestMode && campaign?.id && (players?.length === 0 || !players) && (
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