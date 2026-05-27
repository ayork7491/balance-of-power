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
import { useState, useEffect, useRef, useCallback } from 'react';
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
  const topBarRef = useRef(null);

  // ── Diagnostic hit-test logger (test mode only) ──────────────────────────
  const [diagInfo, setDiagInfo] = useState(null);
  const handleDiagPointer = useCallback((e) => {
    if (!isTestMode) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const topBarEl = topBarRef.current;
    const topBarRect = topBarEl?.getBoundingClientRect();
    const inTopBar = topBarRect
      ? e.clientX >= topBarRect.left && e.clientX <= topBarRect.right
        && e.clientY >= topBarRect.top && e.clientY <= topBarRect.bottom
      : false;
    const path = e.composedPath?.()?.slice(0, 5).map(n =>
      n.tagName ? `${n.tagName}${n.className ? '.' + String(n.className).trim().split(/\s+/).join('.') : ''}` : String(n)
    ) ?? [];
    setDiagInfo({
      xy: `${Math.round(e.clientX)},${Math.round(e.clientY)}`,
      target: `${e.target?.tagName ?? '?'}${e.target?.className ? ' .' + String(e.target.className).trim().split(/\s+/)[0] : ''}`,
      fromPoint: el ? `${el.tagName}${el.id ? '#'+el.id : ''}` : '?',
      inTopBar,
      path: path.slice(0, 3).join(' → '),
    });
  }, [isTestMode]);

  useEffect(() => {
    if (!isTestMode) return;
    window.addEventListener('pointerdown', handleDiagPointer, { capture: true });
    return () => window.removeEventListener('pointerdown', handleDiagPointer, { capture: true });
  }, [isTestMode, handleDiagPointer]);

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
      {/* Compact top bar — shrink-0 keeps it in flow above map */}
      <div ref={topBarRef} style={{ position: 'relative', zIndex: 100, pointerEvents: 'auto', flexShrink: 0 }}>
        <PortraitTopBar campaign={campaign} isAdmin={isAdmin} />
      </div>

      {/* Map — takes all available space. z-index: 0 keeps it below top bar (z:100) and bottom nav (z:50). touchAction is handled by MapRenderer itself, not here. */}
      <main
        className="flex-1 min-h-0 relative overflow-hidden bg-background tactical-grid"
        style={{ zIndex: 0 }}
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

      {/* Diagnostic overlay — test mode only, pointer-events-none */}
      {isTestMode && diagInfo && (
        <div
          className="fixed top-10 left-0 right-0 bg-black/85 text-green-400 text-[9px] font-mono px-2 py-1 space-y-0.5 pointer-events-none"
          style={{ zIndex: 9999 }}
        >
          <div className="flex gap-3 flex-wrap">
            <span><span className="text-yellow-400">xy:</span> {diagInfo.xy}</span>
            <span><span className="text-yellow-400">target:</span> {diagInfo.target}</span>
            <span><span className="text-yellow-400">fromPt:</span> {diagInfo.fromPoint}</span>
            <span className={diagInfo.inTopBar ? 'text-green-300 font-bold' : 'text-red-400 font-bold'}>
              topbar:{diagInfo.inTopBar ? 'HIT✓' : 'MISS✗'}
            </span>
          </div>
          <div><span className="text-yellow-400">path:</span> {diagInfo.path}</div>
        </div>
      )}
    </div>
  );
}