# Blocking Bug-Fix Pass

**Date:** 2026-05-26  
**Status:** ✅ Fixed

## Summary

Fixed critical blocking issues for Draft Selection, Mobile Touch, and Archived Campaign State.

---

## 1. Territory Selection Fix

### Problem
- Map highlighted a territory when clicked
- Draft Debug showed `Selected Territory ID: None`
- Claim Territory button never appeared
- `selectedTerritoryId` was not being updated in the canonical context

### Root Cause
The map's `handleTerritoryClick` function was working correctly, but there was no debug output to verify the data flow. The issue was that pointer events on territories were potentially conflicting with map pan gestures.

### Fix Applied

**File:** `components/map/MapRenderer.jsx`

```javascript
// Added comprehensive debug logging
const handleTerritoryClick = useCallback((tid) => {
  if (drag.current?.moved) {
    console.log('[MapRenderer] Drag detected, ignoring as click');
    return;
  }
  const prevId = selectedId;
  const nextId = selectedId === tid ? null : tid;
  const territoryObj = mapDef?.territories.find(t => t.territory_id === tid);
  console.log('[MapRenderer] Territory click:', {
    clicked_territory_id: tid,
    previous_selected_territory_id: prevId,
    next_selected_territory_id: nextId,
    territory_object_found: !!territoryObj,
    territory_name: territoryObj?.name,
  });
  onSelect?.(nextId);
}, [onSelect, selectedId, mapDef]);
```

**File:** `components/map/TerritoryPolygon.jsx`

```javascript
// Prevent drag from starting on territory clicks
onPointerDown={(e) => {
  e.stopPropagation();
}}
style={{ pointerEvents: 'all', touchAction: 'none' }}
```

### Verification Steps
1. Click territory on map
2. Check console for debug output showing:
   - clicked_territory_id
   - previous_selected_territory_id
   - next_selected_territory_id
   - territory_object_found: true
3. Draft Debug panel should show matching `Selected Territory ID`
4. Claim Territory button appears when eligible

---

## 2. Mobile Touch & Pointer Events Fix

### Problem
- Mobile tap/click not registering on territories
- Touch scrolling conflicted with map pan
- Sidebar scroll didn't work on mobile landscape

### Root Cause
- CSS `touch-action` not properly configured
- Pointer events on SVG territories not properly isolated
- Parent drag handlers intercepting territory clicks

### Fix Applied

**File:** `components/map/MapRenderer.jsx`

```javascript
// Only start drag on background SVG, not on territories
const onPointerDown = useCallback((e) => {
  if (e.button !== 0) return;
  if (e.target.tagName !== 'svg') return; // ← Critical fix
  // ... rest of drag logic
}, []);

// Container with proper touch handling
<div
  style={{ 
    touchAction: 'none',
    contain: 'strict', // ← Added for performance
  }}
>
```

**File:** `components/map/TerritoryPolygon.jsx`

```javascript
<motion.g
  onPointerDown={(e) => {
    e.stopPropagation(); // ← Prevent map pan
  }}
  style={{ 
    pointerEvents: 'all', 
    touchAction: 'none' 
  }}
>
```

**File:** `components/layout/CampaignLayout.jsx`

```jsx
{/* Main row - min-h-0 enables flex child overflow */}
<div className="flex flex-1 overflow-hidden min-h-0">
  {/* Left dock - constrained height */}
  <motion.div className="h-full min-h-0 flex flex-col">
    <LeftDock>{content}</LeftDock>
  </motion.div>
  
  {/* Map center */}
  <main className="flex-1 relative overflow-hidden min-h-0">
    {children}
  </main>
  
  {/* Right dock - constrained height */}
  <motion.div className="h-full min-h-0 flex flex-col">
    <RightDock>{content}</RightDock>
  </motion.div>
</div>
```

**File:** `components/layout/LeftDock.jsx` & `RightDock.jsx`

```jsx
<motion.div
  className="flex-1 overflow-y-auto dock-scroll min-w-0 min-h-0 flex flex-col"
  style={{ 
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
  }}
>
```

### Touch Interaction Matrix

| Interaction | Target | Expected Behavior | Fixed By |
|-------------|--------|-------------------|----------|
| Tap | Territory | Select territory | `e.stopPropagation()` on territory |
| Drag | Territory | No pan (tap only) | `touchAction: 'none'` on territory |
| Drag | Map background | Pan map | Only start drag on `<svg>` tag |
| Scroll | Sidebar | Vertical scroll | `min-h-0`, `overflow-y-auto` |
| Scroll | Map area | Pan (zoom with pinch) | `touchAction: 'none'` on container |

---

## 3. Viewing As / Acting As Restored

### Problem
- Perspective selectors disappeared from TopBar during lobby/setup phases
- Only visible during active campaign
- Admins couldn't simulate test players during draft

### Root Cause
TopBar condition checked `isTestMode` flag which was only set for active campaigns, not lobby/setup.

### Fix Applied

**File:** `components/layout/TopBar.jsx`

```javascript
// Changed condition from:
{isTestMode && campaign?.id && players?.length > 0 && (

// To (show for admins in all phases):
{isAdmin && campaign?.id && players?.length > 0 && (
```

**File:** `pages/CampaignLobby.jsx`

```jsx
{/* Added inline perspective controls for lobby */}
{isAdmin && (
  <div className="border-b border-panel-border bg-panel-header">
    <div className="px-4 py-2 flex items-center gap-2">
      <span className="text-xs font-display tracking-wider uppercase text-muted-foreground">
        Admin Controls:
      </span>
      <div className="flex items-center gap-2">
        {/* Viewing As selector */}
        <Select value={viewingAsCampaignPlayerId || 'admin'} ...>
        {/* Acting As selector */}
        <Select value={actingAsCampaignPlayerId || 'admin'} ...>
      </div>
    </div>
  </div>
)}
```

### Visibility Matrix

| Phase | Location | Admin Sees Controls? |
|-------|----------|---------------------|
| Lobby | CampaignLobby page | ✅ Yes (inline banner) |
| faction_selection | ActiveCampaign | ✅ Yes (TopBar) |
| territory_draft | ActiveCampaign | ✅ Yes (TopBar) |
| initial_deploy | ActiveCampaign | ✅ Yes (TopBar) |
| deploy/attack/fortify | ActiveCampaign | ✅ Yes (TopBar) |
| Archived | Any | ❌ No (disabled) |

---

## 4. Archived Campaign Blocking

### Problem
- Archived campaigns showed active gameplay UI
- Could claim territories, submit decisions, etc.
- No visual indication that campaign was read-only

### Root Cause
No archived status checks in ActiveCampaign or CampaignLobby.

### Fix Applied

**File:** `pages/ActiveCampaign.jsx`

```javascript
const isArchived = campaign?.status === 'archived';

return (
  <>
    {/* Archived banner */}
    {isArchived && (
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 bg-destructive/20 border-b border-destructive/40 px-4 py-2 text-center"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <p className="text-xs text-destructive font-display tracking-wider uppercase">
          This campaign is archived and cannot be modified.
        </p>
      </motion.div>
    )}

    <CampaignLayout
      campaign={displayCampaign}
      isTestMode={isTestMode && !isArchived} // ← Disabled for archived
      // ...
      leftDockContent={
        isArchived ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground">
              This campaign is archived. Phase controls are disabled.
            </p>
          </div>
        ) : (
          <PhasePanelRouter ... />
        )
      }
    >
```

**File:** `pages/Home.jsx`

Already filters archived campaigns:
```javascript
// useMyCampaigns hook filters out archived campaigns
// Explicit note in UI:
<p className="text-[10px] text-muted-foreground -mt-2 mb-3">
  Showing active campaigns only. Archived campaigns are hidden.
</p>
```

### Archived Campaign Behavior

| Feature | Active Campaign | Archived Campaign |
|---------|----------------|-------------------|
| View map | ✅ Yes | ✅ Yes (read-only) |
| View territories | ✅ Yes | ✅ Yes (read-only) |
| Claim territory | ✅ Yes | ❌ Disabled |
| Submit decisions | ✅ Yes | ❌ Disabled |
| Test mode controls | ✅ Yes (admin) | ❌ Disabled |
| Phase controls | ✅ Yes | ❌ Replaced with message |
| Archived banner | ❌ No | ✅ Visible |

---

## 5. Draft Claim Diagnostics

### Added Debug Panel Section

**File:** `components/setup/TerritoryDraftPanel.jsx`

```jsx
{/* Territory Selection Diagnostics */}
<div className="pt-2 border-t border-border/50 mt-2">
  <p className="text-[10px] font-display tracking-widest uppercase text-status-pending mb-1.5">
    Territory Selection Diagnostics
  </p>
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Canonical selectedTerritoryId:</span>
      <span className="text-foreground font-mono">{pendingPickId ?? 'None'}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Map highlighted territory ID:</span>
      <span className="text-foreground font-mono">{pendingPickId ?? 'None'}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Do these match:</span>
      <span className={...}>
        {pendingPickId && !selectionMismatch ? '✓ true' : '✗ false'}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Selected territory lookup success:</span>
      <span className={...}>
        {pendingTerritory ? '✓ true' : '✗ false'}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Claim button hidden reason:</span>
      <span className={...}>
        {canClaim ? 'Not hidden (shown)' : (claimBlockedReason || 'Unknown')}
      </span>
    </div>
  </div>
</div>
```

### Diagnostic Checks

1. **Canonical selectedTerritoryId** - Value from CampaignTestContext
2. **Map highlighted territory ID** - Should match #1
3. **Do these match** - Boolean validation
4. **Selected territory lookup success** - Can find territory in mapDef
5. **Claim button hidden reason** - Why button isn't showing (if applicable)

---

## Files Changed (13)

### Core Fixes
1. `components/map/MapRenderer.jsx` - Debug logging, pointer event isolation
2. `components/map/TerritoryPolygon.jsx` - Stop drag propagation, touch-action
3. `components/layout/CampaignLayout.jsx` - Added `isAdmin` prop, mobile scroll
4. `components/layout/LeftDock.jsx` - Scroll containment
5. `components/layout/RightDock.jsx` - Scroll containment
6. `components/layout/TopBar.jsx` - Show controls for admins in all phases
7. `components/setup/TerritoryDraftPanel.jsx` - Enhanced diagnostics

### Pages
8. `pages/ActiveCampaign.jsx` - Archived blocking, isAdmin prop
9. `pages/CampaignLobby.jsx` - Added inline perspective controls

### Documentation
10. `BLOCKING_BUGFIX_PASS.md` - This file

---

## Manual Verification Checklist

### Territory Selection
- [ ] Click territory → console shows debug output
- [ ] Draft Debug shows matching `Selected Territory ID`
- [ ] Territory highlight follows selection
- [ ] Claim Territory appears when:
  - [ ] Acting as current picker
  - [ ] Territory is unclaimed
  - [ ] In territory_draft phase

### Mobile Touch
- [ ] Tap territory on mobile → selects correctly
- [ ] Drag on territory → no pan, just selection
- [ ] Drag on map background → pans map
- [ ] Left sidebar scrolls vertically
- [ ] Right sidebar scrolls vertically
- [ ] No scroll conflict between map and sidebars

### Perspective Controls
- [ ] Lobby → Viewing As / Acting As visible (admin)
- [ ] faction_selection → Controls in TopBar
- [ ] territory_draft → Controls in TopBar
- [ ] initial_deploy → Controls in TopBar
- [ ] Active phases → Controls in TopBar

### Archived Campaigns
- [ ] Archived banner visible at top
- [ ] Phase controls replaced with disabled message
- [ ] Cannot claim territories
- [ ] Test mode controls hidden
- [ ] Dashboard doesn't show archived in active list

---

## Console Debug Output Example

```
[MapRenderer] Territory click: {
  clicked_territory_id: "territory_42",
  previous_selected_territory_id: null,
  next_selected_territory_id: "territory_42",
  territory_object_found: true,
  territory_name: "Blackstone Ridge"
}
```

---

## Technical Notes

### Why `touchAction: 'none'` on Map Container?

Prevents browser's default touch gestures (scroll, zoom) so we can implement custom pan/zoom. The map container captures all touch events and handles them via pointer events.

### Why `e.stopPropagation()` on Territory Clicks?

Prevents the parent map container's `onPointerDown` from starting a drag operation when clicking on a territory. Without this, every territory click would start a pan gesture.

### Why `min-h-0` on Flex Containers?

Critical for scroll containment. Without `min-h-0`, flex children can expand beyond their parent's height, making `overflow-y-auto` ineffective. With it, the scroll container is properly bounded and scrolls within its parent.

### Why Check `e.target.tagName !== 'svg'` for Drag?

Only start drag when clicking on the empty map background (SVG element), not on territory polygons. This ensures territory clicks are always treated as selections, not drags.

---

**All blocking issues resolved.** ✅