/**
 * CampaignLayout — landscape-first docked layout for active campaign screens.
 * Structure:
 *   TopBar (full width)
 *   [ LeftDock | MapCenter | RightDock ]
 *   BottomRail (full width)
 *
 * Enforces landscape mode on mobile with a rotate-prompt overlay.
 */
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import TopBar from './TopBar';
import LeftDock from './LeftDock';
import RightDock from './RightDock';
import BottomRail from './BottomRail';

export default function CampaignLayout({
  campaign = null,
  isTestMode = false,
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
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Portrait rotate prompt (mobile only) */}
      <div className="landscape-required flex-col items-center justify-center gap-4 bg-background text-center px-8">
        <RotateCcw className="w-10 h-10 text-primary animate-spin" style={{ animationDuration: '3s' }} />
        <div>
          <p className="font-display text-lg font-bold tracking-wider uppercase text-foreground">
            Rotate Device
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Balance of Power is designed for landscape mode.
          </p>
        </div>
      </div>

      {/* Main landscape layout */}
      <div className="landscape-content flex-col w-full h-full">
        {/* Top bar */}
        <TopBar campaign={campaign} isTestMode={isTestMode} />

        {/* Main row */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left dock */}
          <LeftDock>
            {leftDockContent}
          </LeftDock>

          {/* Map / center content */}
          <main className="flex-1 relative overflow-hidden bg-background tactical-grid">
            {children}
          </main>

          {/* Right dock */}
          <RightDock>
            {rightDockContent}
          </RightDock>
        </div>

        {/* Bottom rail */}
        <BottomRail activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </div>
  );
}