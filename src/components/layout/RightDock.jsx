/**
 * RightDock — Campaign screen right panel dock.
 * Houses: Campaign info, leaderboard, territory list, history tabs.
 * Collapsible on small landscape screens.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function RightDock({ children, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`relative flex flex-col shrink-0 transition-all duration-200 ${
      collapsed ? 'w-8' : 'w-72'
    } bg-panel-bg border-l border-panel-border overflow-hidden`}>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-2 -left-3 z-10 w-6 h-6 rounded-full bg-panel-header border border-panel-border flex items-center justify-center hover:border-primary/50 transition-colors"
      >
        {collapsed
          ? <ChevronLeft className="w-3 h-3 text-muted-foreground" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground" />
        }
      </button>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto dock-scroll transition-opacity duration-150 ${
        collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        {children}
      </div>
    </div>
  );
}