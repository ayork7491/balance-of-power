/**
 * PortraitCampaignLayout — Map-dominant layout for portrait / mobile portrait mode.
 *
 * Hierarchy (spec-compliant):
 *   App root:      fixed inset-0, flex flex-col, overflow-hidden
 *   PortraitTopBar: shrink-0, z-[1000], pointer-events-auto, NO transforms
 *   Content area:  flex-1, min-h-0, relative, overflow-hidden (map lives here)
 *   Bottom nav:    shrink-0, z-[900], pointer-events-auto
 *   Bottom sheet:  fixed overlay, z-[800] — never inside map container
 *
 * The top bar is a direct flex child — never inside the map container,
 * never inside a gesture handler, never inside an overflow-clipped panel.
 */
import { useState, useEffect } from 'react';
import PortraitTopBar from './PortraitTopBar';
import PortraitBottomNav from './PortraitBottomNav';
import PortraitBottomSheet from './PortraitBottomSheet';

const TAB_TITLES = {
  phase:       'Phase Actions',
  battles:     'Battles',
  leaderboard: 'Standings',
  territories: 'Territories',
  history:     'History',
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
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
    setSheetOpen(tab !== 'map');
  };

  useEffect(() => {
    if (activeTab === 'map') setSheetOpen(false);
  }, [activeTab]);

  const sheetTitle = TAB_TITLES[activeTab] ?? 'Info';
  const sheetContent = activeTab === 'phase' ? leftDockContent : rightDockContent;

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
      {/* ── Top bar — direct flex child, isolated from map gestures ── */}
      <PortraitTopBar campaign={campaign} isAdmin={isAdmin} />

      {/* ── Map content area — pan/gesture handlers live ONLY here ── */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          zIndex: 0,
        }}
        className="bg-background tactical-grid"
      >
        {children}
      </main>

      {/* ── Bottom nav — direct flex child, isolated from map ── */}
      <PortraitBottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Bottom sheet — fixed overlay, outside all containers ── */}
      <PortraitBottomSheet
        isOpen={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setActiveTab('map');
          onTabChange?.('map');
        }}
        title={sheetTitle}
        maxHeight="75vh"
      >
        {sheetContent}
      </PortraitBottomSheet>
    </div>
  );
}