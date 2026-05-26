/**
 * CampaignLayout — landscape-first docked layout for active campaign screens.
 * Structure:
 *   TopBar (full width)
 *   [ LeftDock | MapCenter | RightDock ]
 *   BottomRail (full width)
 *
 * Enforces landscape mode on mobile with a rotate-prompt overlay.
 */
import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TopBar from './TopBar';
import LeftDock from './LeftDock';
import RightDock from './RightDock';
import BottomRail from './BottomRail';

export default function CampaignLayout({
  campaign = null,
  isTestMode = false,
  players = [],
  currentPerspective = null,
  onPerspectiveChange = null,
  leftDockContent = null,
  rightDockContent = null,
  children, // map center
  defaultTab = 'map',
  onTabChange,
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
      {/* Portrait rotate prompt (mobile only) */}
      <motion.div 
        className="landscape-required flex-col items-center justify-center gap-4 bg-background text-center px-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <RotateCcw className="w-12 h-12 text-primary" style={{ animation: 'spin 3s linear infinite' }} />
        <div className="mt-4">
          <p className="font-display text-xl font-bold tracking-wider uppercase text-foreground">
            Rotate Device
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            Balance of Power is designed for landscape mode to provide the best strategic experience.
          </p>
        </div>
      </motion.div>

      {/* Main landscape layout */}
      <motion.div 
        className="landscape-content flex-col w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Top bar */}
        <TopBar 
          campaign={campaign} 
          isTestMode={isTestMode}
          players={players}
          currentPerspective={currentPerspective}
          onPerspectiveChange={onPerspectiveChange}
        />

        {/* Main row */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left dock */}
          <AnimatePresence>
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <LeftDock>
                {leftDockContent}
              </LeftDock>
            </motion.div>
          </AnimatePresence>

          {/* Map / center content */}
          <main className="flex-1 relative overflow-hidden bg-background tactical-grid">
            {children}
          </main>

          {/* Right dock */}
          <AnimatePresence>
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <RightDock>
                {rightDockContent}
              </RightDock>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom rail */}
        <BottomRail activeTab={activeTab} onTabChange={handleTabChange} />
      </motion.div>
    </motion.div>
  );
}