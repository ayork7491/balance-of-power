/**
 * RightDock — Campaign screen right panel dock.
 * Houses: Campaign info, leaderboard, territory list, history tabs.
 * Collapsible on small landscape screens.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function RightDock({ children, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <motion.div 
      className="relative flex flex-col shrink-0 bg-panel-bg border-l border-panel-border overflow-hidden"
      animate={{ width: collapsed ? 32 : 288 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ touchAction: 'none' }}
    >
      {/* Collapse toggle - larger touch target */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-2 -left-3 z-10 w-7 h-7 rounded-full bg-panel-header border border-panel-border flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 transition-all active:scale-95 touch-manipulation"
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {collapsed
          ? <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        }
      </button>

      {/* Content with smooth opacity transition */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            className="flex-1 overflow-y-auto dock-scroll"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ 
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="p-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}