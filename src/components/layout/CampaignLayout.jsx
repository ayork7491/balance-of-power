/**
 * CampaignLayout — Responsive layout router for active campaign screens.
 *
 * Philosophy: portrait-supported / landscape-optimized.
 *   Portrait  → PortraitCampaignLayout  (map-dominant, bottom sheets)
 *   Landscape → LandscapeCampaignLayout (command center, side docks)
 *   compactLandscape → LandscapeCampaignLayout with compact=true (docks default collapsed)
 *
 * This component is a pure router — all layout structure lives in the
 * dedicated layout components. No gameplay logic here.
 *
 * See RESPONSIVE_LAYOUT_NOTES.md for full documentation.
 */
import { useLayoutMode } from '@/hooks/useLayoutMode';
import LandscapeCampaignLayout from './LandscapeCampaignLayout';
import PortraitCampaignLayout from './PortraitCampaignLayout';

export default function CampaignLayout({
  campaign = null,
  isTestMode = false,
  players = [],
  currentPerspective = null,
  onPerspectiveChange = null,
  actingAsPlayerId = null,
  onActingAsChange = null,
  availableActingAsPlayers = [],
  isAdmin = false,
  leftDockContent = null,
  rightDockContent = null,
  children,
  defaultTab = 'map',
  onTabChange,
}) {
  const layoutMode = useLayoutMode();

  const sharedProps = {
    campaign,
    isTestMode,
    players,
    isAdmin,
    leftDockContent,
    rightDockContent,
    children,
    defaultTab,
    onTabChange,
  };

  if (layoutMode === 'portrait') {
    return <PortraitCampaignLayout {...sharedProps} />;
  }

  // landscape or compactLandscape
  return (
    <LandscapeCampaignLayout
      {...sharedProps}
      currentPerspective={currentPerspective}
      onPerspectiveChange={onPerspectiveChange}
      actingAsPlayerId={actingAsPlayerId}
      onActingAsChange={onActingAsChange}
      availableActingAsPlayers={availableActingAsPlayers}
      compact={layoutMode === 'compactLandscape'}
    />
  );
}