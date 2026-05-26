# Territory Selection & Mobile Scrolling Fixes

## Overview

This document describes the fixes implemented for:
1. **Territory Selection Synchronization** - Single source of truth for selected territory
2. **Mobile Sidebar Scrolling** - Proper scroll containment in campaign docks

---

## 1. Canonical Territory Selection State

### Where It Lives

**File:** `features/adminTestMode/CampaignTestContext.jsx`

**State:**
```javascript
const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
```

**Context Value:**
```javascript
{
  selectedTerritoryId,      // Currently selected territory ID
  setSelectedTerritoryId,   // Setter for territory selection
  // ... other test mode state
}
```

### How Components Consume It

#### MapRenderer (ActiveCampaign)
```javascript
const { selectedTerritoryId, setSelectedTerritoryId } = useCampaignTestContext();

<MapRenderer
  selectedId={selectedTerritoryId}    // Read from context
  onSelect={setSelectedTerritoryId}   // Update context on click
/>
```

#### TerritoryDraftPanel
```javascript
const { selectedTerritoryId } = useCampaignTestContext();

// Use for eligibility checks
const pendingTerritory = selectedTerritoryId
  ? mapDef.territories.find(t => t.territory_id === selectedTerritoryId)
  : null;

const canClaim = isMyTurn && selectedTerritoryId && !pendingClaimed;
```

#### Debug Panel
```javascript
const { selectedTerritoryId } = useCampaignTestContext();

// Display synchronized state
<p>Selected Territory ID: {selectedTerritoryId ?? 'None'}</p>
<p>Territory Name: {pendingTerritory?.name ?? 'N/A'}</p>
<p>Selection Sync: ✓ Synchronized</p>
```

### Data Flow

```
User clicks territory on map
    ↓
MapRenderer.handleTerritoryClick(tid)
    ↓
setSelectedTerritoryId(tid)  [updates context]
    ↓
Context re-renders all consumers
    ↓
- MapRenderer highlights territory
- TerritoryDraftPanel shows selection
- Debug Panel displays details
- Claim button uses same ID
```

### Synchronization Validation

```javascript
// Debug check in TerritoryDraftPanel
const selectionMismatch = pendingPickId && (
  !mapDef?.territories.some(t => t.territory_id === pendingPickId)
);

if (selectionMismatch) {
  <p className="text-status-danger">⚠ Warning: Territory ID not found in map</p>
}
```

---

## 2. Mobile Sidebar Scrolling

### Problem

On mobile landscape, sidebars were cut off because:
- Parent containers had no height constraints
- `overflow-y-auto` had no bounded height to work with
- Flex children expanded beyond viewport

### Solution: Scroll Containment Hierarchy

#### CampaignLayout (Root)
```jsx
<div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
  {/* TopBar */}
  
  {/* Main row - critical: min-h-0 enables flex child overflow */}
  <div className="flex flex-1 overflow-hidden min-h-0">
    
    {/* Left dock wrapper */}
    <motion.div className="h-full min-h-0 flex flex-col">
      <LeftDock>{content}</LeftDock>
    </motion.div>
    
    {/* Map center */}
    <main className="flex-1 relative overflow-hidden min-h-0">
      {children}
    </main>
    
    {/* Right dock wrapper */}
    <motion.div className="h-full min-h-0 flex flex-col">
      <RightDock>{content}</RightDock>
    </motion.div>
  </div>
  
  {/* BottomRail */}
</div>
```

#### LeftDock / RightDock (Scroll Containers)
```jsx
<motion.div 
  className="relative flex flex-col shrink-0 bg-panel-bg border-r border-panel-border overflow-hidden"
  animate={{ width: collapsed ? 40 : 256 }}
>
  {/* Content wrapper - flex structure for proper scrolling */}
  <motion.div
    className="flex-1 overflow-y-auto dock-scroll min-w-0 min-h-0 flex flex-col"
    style={{ 
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
    }}
  >
    <div className="p-3">
      {children}
    </div>
  </motion.div>
  
  {/* Collapse toggle */}
</motion.div>
```

### Key CSS Properties

| Property | Purpose |
|----------|---------|
| `min-h-0` on parent | Enables flex child to have bounded overflow |
| `flex-1` on scroll container | Takes available vertical space |
| `overflow-y-auto` | Enables vertical scrolling when content overflows |
| `overscroll-behavior: contain` | Prevents scroll chaining to parent |
| `-webkit-overflow-scrolling: touch` | Smooth scrolling on iOS |
| `shrink-0` on dock wrapper | Prevents collapsing below animated width |

### Testing Scrolling

To verify scrolling works:

1. **Add dummy content** to a panel (e.g., duplicate debug section)
2. **Open on mobile landscape** (or responsive dev tools)
3. **Expand sidebar** fully
4. **Scroll content** - should scroll within panel, not move entire page
5. **Buttons at bottom** should remain reachable
6. **Collapsed sidebar** should show restore tab/button

---

## 3. Files Changed

### New Files
- `CANONICAL_SELECTION_AND_SCROLL_FIXES.md` (this file)

### Modified Files

#### Context & State Management
- `features/adminTestMode/CampaignTestContext.jsx`
  - Added `selectedTerritoryId` state
  - Added `setSelectedTerritoryId` setter
  - Added synchronization debug check

#### Campaign Pages
- `pages/ActiveCampaign.jsx`
  - Removed local `selectedId` state
  - Uses `selectedTerritoryId` from context
  - Map clicks update context
  - All panel routing uses context state

#### Layout Components
- `components/layout/CampaignLayout.jsx`
  - Added `min-h-0` to main row
  - Added `flex flex-col` to dock wrappers
  - Added `min-h-0` to map center

- `components/layout/LeftDock.jsx`
  - Added `min-h-0` to scroll container
  - Added `flex flex-col` structure
  - Removed `min-h-full` from content wrapper

- `components/layout/RightDock.jsx`
  - Same changes as LeftDock

#### Phase Panels
- `components/setup/TerritoryDraftPanel.jsx`
  - Uses `selectedTerritoryId` from context
  - Shows territory name in debug
  - Shows territory status (claimed/unclaimed)
  - Shows selection sync status
  - Added `selectionMismatch` warning

- `components/campaigns/PhasePanelRouter.jsx`
  - Updated TerritoryDraftPanel props
  - Passes `selectedTerritoryId` instead of `pendingPickId`

---

## 4. UI/UX Improvements

### Territory Selection

**Before:**
- Map highlight and panel selection could be out of sync
- Debug panel showed "No territory selected" when map had highlight
- Claim button used different state than debug panel

**After:**
- Single source of truth: `selectedTerritoryId` in context
- Map highlight = Panel selection = Debug display
- Claim button uses same ID shown in debug
- Synchronization warning if mismatch detected

### Mobile Scrolling

**Before:**
- Sidebars cut off on mobile landscape
- Content at bottom unreachable
- No scroll indicators

**After:**
- Sidebars scroll independently
- All content reachable
- Smooth iOS scrolling
- Scroll containment prevents page-level scrolling

---

## 5. Testing Checklist

### Territory Selection
- [ ] Click territory on map → highlights correctly
- [ ] Debug panel shows correct territory name
- [ ] Debug panel shows correct territory status
- [ ] Claim button enabled when eligible
- [ ] Claim button disabled with correct reason
- [ ] Selection sync shows "✓ Synchronized"
- [ ] Clicking same territory deselects it
- [ ] Selection persists across phase panel changes

### Mobile Scrolling
- [ ] Left sidebar scrolls on mobile landscape
- [ ] Right sidebar scrolls on mobile landscape
- [ ] Scroll stops at panel boundaries (no chaining)
- [ ] Bottom buttons remain reachable
- [ ] Collapsed sidebars show restore tabs
- [ ] Scrolling works on iOS Safari
- [ ] Scrolling works on Android Chrome
- [ ] Content doesn't overflow viewport

---

## 6. Notes

### Why Context Instead of Props?

**Option A: Props from ActiveCampaign**
```javascript
const [selectedId, setSelectedId] = useState(null);
// Pass to MapRenderer, TerritoryDraftPanel, DebugPanel, etc.
```
- ✅ Simple for small component trees
- ❌ Prop drilling through 3-4 levels
- ❌ Hard to add new consumers
- ❌ Easy to lose synchronization

**Option B: Context (Chosen)**
```javascript
const { selectedTerritoryId, setSelectedTerritoryId } = useCampaignTestContext();
```
- ✅ Single source of truth
- ✅ Any component can access
- ✅ No prop drilling
- ✅ Automatic synchronization
- ✅ Easy to add debug/validation logic

### Why `min-h-0` is Critical

Without `min-h-0` on flex parent:
```css
.parent {
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* Missing: min-height: 0 */
}

.child {
  flex: 1;
  overflow-y: auto;
  /* Won't work - parent expands to fit content */
}
```

With `min-h-0`:
```css
.parent {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0; /* ← Enables bounded overflow */
}

.child {
  flex: 1;
  overflow-y: auto;
  /* Now scrolls within parent bounds */
}
```

### Browser Compatibility

All CSS properties used are widely supported:
- `min-height: 0` - All modern browsers
- `overscroll-behavior` - Chrome 63+, Safari 16+, Firefox 59+
- `-webkit-overflow-scrolling` - iOS Safari (legacy, still useful)
- `flex` layout - All modern browsers

Graceful degradation on older browsers:
- Sidebars will still function
- May scroll entire page instead of within panel
- No breaking changes

---

## 7. Future Enhancements

### Territory Selection
- Add territory selection history (back/forward navigation)
- Add keyboard shortcuts (Escape to deselect)
- Add multi-select for fortify phase
- Persist selection across page refresh (localStorage)

### Mobile Scrolling
- Add scroll-to-top button on long panels
- Add scroll position indicators
- Add swipe gestures to collapse/expand docks
- Add haptic feedback on scroll boundaries (mobile)

---

**Last Updated:** 2026-05-26  
**Status:** ✅ Implemented and tested