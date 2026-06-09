/**
 * PortraitCampaignLayout — Sprint 5B
 *
 * Map-dominant layout for portrait/mobile.
 * Three-tab navigation: World Status | Command Center | History
 * Map is always the base screen. Tabs open bottom sheets over it.
 */
import { useState } from 'react';
import PortraitTopBar from './PortraitTopBar';
import PortraitBottomNav from './PortraitBottomNav.jsx';
import PortraitBottomSheet from './PortraitBottomSheet';

const TAB_TITLES = {
  command: 'Command Center',
  world:   'World Status',
  history: 'History',
};

const TAB_HEIGHTS = {
  command: '88vh',
  world:   '80vh',
  history: '85vh',
};

export default function PortraitCampaignLayout({
  campaign = null,
  isTestMode = false,
  players = [],
  isAdmin = false,
  leftDockContent = null,
  rightDockContent = null,
  children,
  defaultTab = 'map',
  onTabChange,
}) {
  const [activeTab, setActiveTab] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleTabChange = (tab) => {
    if (tab === activeTab && sheetOpen) {
      setSheetOpen(false);
      setActiveTab(null);
      onTabChange?.('map');
      return;
    }
    setActiveTab(tab);
    setSheetOpen(true);
    onTabChange?.(tab);
  };

  const handleClose = () => {
    setSheetOpen(false);
    setActiveTab(null);
    onTabChange?.('map');
  };

  // command tab uses leftDockContent (CommandCenterPanel)
  // world/history use rightDockContent (WorldStatusPanel or CampaignHistoryPanel)
  const sheetContent = activeTab === 'command' ? leftDockContent : rightDockContent;
  const sheetTitle = TAB_TITLES[activeTab] ?? '';
  const sheetMaxHeight = TAB_HEIGHTS[activeTab] ?? '80vh';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'hsl(var(--background))',
      }}
    >
      <PortraitTopBar campaign={campaign} isAdmin={isAdmin} />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          zIndex: 0,
        }}
        className="bg-background"
      >
        {children}
      </main>

      <PortraitBottomNav activeTab={activeTab ?? 'map'} onTabChange={handleTabChange} />

      <PortraitBottomSheet
        isOpen={sheetOpen}
        onClose={handleClose}
        title={sheetTitle}
        maxHeight={sheetMaxHeight}
        activeTab={activeTab}
      >
        {sheetContent}
      </PortraitBottomSheet>
    </div>
  );
}