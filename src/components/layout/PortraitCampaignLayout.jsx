/**
 * PortraitCampaignLayout — Map-dominant layout for portrait / mobile portrait mode.
 *
 * Structure:
 *   PortraitTopBar (compact, ~40px)
 *   Map (flex-1, takes almost all vertical space)
 *   PortraitBottomNav (tabs, ~52px + safe area)
 *
 * Panel behavior:
 *   - "Phase" tab → opens PortraitBottomSheet with leftDockContent (phase actions)
 *   - All other tabs (Battles, Standings, Territories, History) →
 *       opens PortraitBottomSheet with rightDockContent (info panels)
 *   - "Map" tab → closes any open sheet, showing map full-screen
 *
 * No permanent sidebars. All panels are on-demand via bottom sheet.
 */
import { useState, useEffect } from 'react';
import PortraitTopBar from './PortraitTopBar';
import PortraitBottomNav from './PortraitBottomNav';
import PortraitBottomSheet from './PortraitBottomSheet';

// Tab → sheet title mapping
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
  leftDockContent = null,   // Phase action panel
  rightDockContent = null,  // Info panels (leaderboard, history, etc.)
  children,                 // Map
  defaultTab = 'map',
  onTabChange,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
    if (tab === 'map') {
      setSheetOpen(false);
    } else {
      setSheetOpen(true);
    }
  };

  // Close sheet if tab switches back to map externally
  useEffect(() => {
    if (activeTab === 'map') setSheetOpen(false);
  }, [activeTab]);

  const sheetTitle = TAB_TITLES[activeTab] ?? 'Info';
  // Phase tab uses left dock (action panel); all others use right dock (info)
  const sheetContent = activeTab === 'phase' ? leftDockContent : rightDockContent;

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Compact top bar */}
      <PortraitTopBar campaign={campaign} isAdmin={isAdmin} isTestMode={isTestMode} />

      {/* Map — takes all available space */}
      <main
        className="flex-1 min-h-0 relative overflow-hidden bg-background tactical-grid"
        style={{ touchAction: 'none' }}
      >
        {children}
      </main>

      {/* Bottom nav */}
      <PortraitBottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Bottom sheet — overlays map for non-map tabs */}
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