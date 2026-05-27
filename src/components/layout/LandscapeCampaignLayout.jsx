/**
 * LandscapeCampaignLayout — Full command-center layout for landscape / desktop.
 *
 * Structure:
 *   TopBar (full width, ~44px)
 *   [ LeftDock | MapCenter | RightDock ] (flex row, fills remaining height)
 *   BottomRail (tab navigation, ~48px)
 *
 * Panel behavior:
 *   - LeftDock: phase action panel, collapsible
 *   - RightDock: info panels (leaderboard, history, etc.), collapsible
 *   - Both docks can be collapsed to free map space
 *   - BottomRail tabs control the RightDock content
 *   - Map always visible (center column)
 *
 * compactLandscape: same structure but docks start collapsed.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopBar from './TopBar';
import LeftDock from './LeftDock';
import RightDock from './RightDock';
import BottomRail from './BottomRail';

export default function LandscapeCampaignLayout({
  campaign = null,
  isTestMode = false,
  players = [],
  isAdmin = false,
  currentPerspective = null,
  onPerspectiveChange = null,
  actingAsPlayerId = null,
  onActingAsChange = null,
  availableActingAsPlayers = [],
  leftDockContent = null,
  rightDockContent = null,
  children,
  defaultTab = 'map',
  onTabChange,
  compact = false, // compactLandscape mode — docks default collapsed
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <motion.div
      className="fixed inset-0 bg-background flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Top bar */}
      <TopBar
        campaign={campaign}
        isTestMode={isTestMode}
        players={players}
        isAdmin={isAdmin}
        currentPerspective={currentPerspective}
        onPerspectiveChange={onPerspectiveChange}
        actingAsPlayerId={actingAsPlayerId}
        onActingAsChange={onActingAsChange}
        availableActingAsPlayers={availableActingAsPlayers}
      />

      {/* Main row */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left dock */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="h-full min-h-0 flex flex-col w-[240px] lg:w-[280px] xl:max-w-[320px] shrink-0"
        >
          <LeftDock defaultCollapsed={compact}>
            {leftDockContent}
          </LeftDock>
        </motion.div>

        {/* Map center */}
        <main className="flex-1 relative overflow-hidden bg-background min-h-0">
          {children}
        </main>

        {/* Right dock */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="h-full min-h-0 flex flex-col w-[240px] lg:w-[280px] xl:max-w-[320px] shrink-0"
        >
          <RightDock defaultCollapsed={compact}>
            {rightDockContent}
          </RightDock>
        </motion.div>
      </div>

      {/* Bottom rail */}
      <BottomRail activeTab={activeTab} onTabChange={handleTabChange} />
    </motion.div>
  );
}