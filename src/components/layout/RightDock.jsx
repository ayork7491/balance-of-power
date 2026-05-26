/**
 * RightDock — Campaign screen right panel dock.
 * Houses: Campaign info, leaderboard, territory list, history tabs.
 * Collapsible with persistent toggle button visible when collapsed.
 * Scrollable content with proper mobile landscape support.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, PanelRight } from 'lucide-react';

export default function RightDock({ children, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <motion.div 
      className="relative flex flex-col shrink-0 bg-panel-bg border-l border-panel-border overflow-hidden"
      animate={{ width: collapsed ? 40 : 288 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ touchAction: 'none' }}
      data-dock="right"
    >
      {/* Content with smooth opacity transition and proper scrolling */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            className="flex-1 overflow-y-auto dock-scroll min-w-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ 
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              minHeight: 0,
            }}
          >
            <div className="p-3 min-h-full">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent collapse toggle - always visible, better positioning */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`absolute top-3 z-20 w-8 h-8 rounded-lg bg-panel-header border border-panel-border flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 transition-all active:scale-95 touch-manipulation shadow-lg ${
          collapsed ? 'left-1' : '-left-4'
        }`}
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        title={collapsed ? 'Open right panel' : 'Close right panel'}
      >
        {collapsed
          ? <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {/* Collapsed state indicator - shows dock icon when fully collapsed */}
      {collapsed && (
        <motion.div
          className="flex-1 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <PanelRight className="w-5 h-5 text-muted-foreground/50" />
        </motion.div>
      )}
    </motion.div>
  );
}