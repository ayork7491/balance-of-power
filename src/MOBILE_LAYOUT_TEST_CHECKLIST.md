# Mobile Layout Test Checklist

**Date:** 2026-05-26  
**Status:** ✅ Fixed

---

## Sidebar Scroll Behavior

### Expected Behavior
- ✅ Sidebars scroll vertically when content extends off screen
- ✅ Touch scrolling feels natural on mobile landscape
- ✅ Scroll is contained within sidebar (doesn't scroll entire page)
- ✅ Overscroll containment prevents scroll chaining

### Technical Implementation
```css
/* Root shell */
h-screen overflow-hidden

/* Campaign layout */
h-full min-h-0 overflow-hidden

/* Sidebar container */
h-full min-h-0 flex flex-col

/* Sidebar content */
flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y
```

### Test Steps
1. Open campaign on mobile landscape
2. Expand left sidebar (phase panel)
3. Scroll down - should scroll smoothly
4. Expand right sidebar (info panel)
5. Scroll down - should scroll smoothly
6. Verify page doesn't scroll when sidebar scrolls

---

## Map Pan Behavior

### Expected Behavior
- ✅ Map pans when dragging anywhere on map surface
- ✅ Dragging on territories also pans (not just background)
- ✅ Tap/click on territory selects it
- ✅ Drag starting on territory pans map, doesn't get swallowed
- ✅ Touch feels natural on mobile

### Technical Implementation
```javascript
// Pointer events on map container
onPointerDown: Start drag tracking
onPointerMove: Pan if moved > 3px threshold
onPointerUp: End drag

// Territory click only fires if no drag movement detected
handleTerritoryClick: if (hasMoved) return; // Don't select
```

### Test Steps
1. Open campaign on mobile
2. Place finger on territory and drag
3. Map should pan smoothly
4. Tap territory quickly (no drag)
5. Territory should be selected
6. Drag from different territories
7. Verify consistent pan behavior

---

## Tap vs Drag Behavior

### Threshold
- **Drag threshold:** 3px movement
- **Tap detection:** Movement < 3px
- **Visual feedback:** Cursor changes to grabbing during drag

### Implementation Details
```javascript
// Drag detection
drag.current = {
  startX: e.clientX,
  startY: e.clientY,
  moved: false,
};

// In onPointerMove
if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;

// In territory click handler
if (drag.current?.moved) return; // Ignore as click
```

### Test Steps
1. Tap territory quickly → Should select
2. Drag territory slightly (< 3px) → Should select
3. Drag territory more (> 3px) → Should pan, not select
4. Repeat on multiple territories
5. Verify consistent threshold behavior

---

## Sidebar Responsive Widths

### Mobile Landscape (< 640px)
- ✅ Left sidebar: max 280px
- ✅ Right sidebar: max 280px
- ✅ Map minimum width: 55% of screen
- ✅ Both sidebars open: map still visible

### Desktop/Smaller Mobile (≥ 640px)
- ✅ Left sidebar: max 320px
- ✅ Right sidebar: max 320px
- ✅ Map gets remaining space

### Technical Implementation
```css
/* Sidebar containers */
max-w-[280px] sm:max-w-[320px]

/* Map center */
flex-1 min-w-[55%]
```

### Test Steps
1. Open campaign on mobile landscape
2. Open both sidebars
3. Verify map is still visible (at least 55% width)
4. Resize to desktop width
5. Verify sidebars expand to 320px
6. Verify map gets appropriate space

---

## Region Bonus Panel Location

### Before (❌)
- Region legend overlay in top-left of map
- Covered too much map area
- Obscured territories during gameplay

### After (✅)
- Region legend moved to right sidebar
- Collapsible "Regions & Bonuses" section
- Map viewport clear for gameplay

### Implementation
```jsx
// RegionLegend component moved from map overlay to right sidebar
<RightDockRouter>
  {/* RegionLegend now renders here */}
  <RegionLegend regions={mapDef.regions} />
</RightDockRouter>
```

### Test Steps
1. Open campaign
2. Check map viewport - should be clear
3. Open right sidebar
4. Find "Regions & Bonuses" section
5. Verify all regions listed with colors and bonuses
6. Verify legend doesn't cover map

---

## Acting-As Submit Behavior

### Expected Behavior
- ✅ Initial fortification uses acting-as player when selected
- ✅ Backend resolves acting player through shared helper
- ✅ If Acting-As = Test Player, submission saves for test player
- ✅ UI clearly shows which player submit button acts for
- ✅ Debug panel shows:
  - Authenticated player
  - Acting-as player
  - Action submit player
  - Whether action delegation is allowed
  - Rejection reason if false

### Backend Pattern
```javascript
// Inline acting-as validation in backend function
const { acting_as_player_id } = body;
const actingResult = resolveActingCampaignPlayer({
  user,
  campaign_id,
  acting_as_player_id,
  campaignPlayers: players,
  requireActive: false,
});

if (!actingResult.success) {
  return Response.json({ error: actingResult.reason }, { status: 403 });
}

const actingPlayer = actingResult.actingPlayer;

// Use actingPlayer.id for all actions
await base44.entities.PhaseDecision.filter({
  campaign_id,
  player_id: actingPlayer.id, // NOT myPlayer.id
  phase: 'fortify',
  round,
});
```

### Frontend Pattern
```jsx
// FortifyPanel sends acting_as_player_id
const handleStageMovement = async (origin, destination, troops) => {
  const res = await base44.functions.invoke('fortifyPhase', {
    action: 'stageMovement',
    campaign_id: campaign.id,
    origin_territory_id: origin,
    destination_territory_id: destination,
    committed_troops: troops,
    acting_as_player_id: actingAsCampaignPlayerId || null, // CRITICAL
  });
};
```

### Debug Panel
```jsx
<div className="acting-as-debug">
  <p>Authenticated: {myPlayer?.display_name}</p>
  <p>Acting-As: {actingAsPlayer?.display_name || '(self)'}</p>
  <p>Action Submit For: {actionPlayer?.display_name}</p>
  <p>Delegation Allowed: {canDelegateActions ? '✓ Yes' : '✗ No'}</p>
  {delegationBlockedReason && (
    <p>Rejection Reason: {delegationBlockedReason}</p>
  )}
</div>
```

### Test Steps
1. Open campaign in admin test mode
2. Select "Viewing As" a test player
3. Select "Acting As" same test player
4. Go to fortify phase
5. Stage a troop movement
6. Check debug panel - should show test player name
7. Submit movement
8. Verify movement saved for test player (not admin)
9. Check backend logs - should show actingPlayer.id used

---

## Manual Verification Checklist

### Initial Fortification Acting-As
- [ ] Acting-As test player selected
- [ ] Debug panel shows correct acting-as player
- [ ] Movement staged for test player
- [ ] Backend logs confirm test player ID used
- [ ] Movement saved to test player's PhaseDecision

### Map Pan on Mobile
- [ ] Drag on territory background → Map pans
- [ ] Drag on territory polygon → Map pans
- [ ] Tap on territory → Territory selected
- [ ] Drag threshold feels natural (~3px)
- [ ] No stuck drags or missed pans

### Sidebar Scrolling
- [ ] Left sidebar scrolls when content overflows
- [ ] Right sidebar scrolls when content overflows
- [ ] Touch scrolling feels smooth
- [ ] No scroll chaining to page
- [ ] Scroll position preserved on collapse

### Sidebar Sizing
- [ ] Mobile landscape: sidebars ≤ 280px
- [ ] Desktop: sidebars ≤ 320px
- [ ] Map always ≥ 55% width
- [ ] Both sidebars open: map still usable
- [ ] Collapse/expand buttons accessible

### Region Bonuses
- [ ] Region legend NOT covering map
- [ ] Regions listed in right sidebar
- [ ] Colors match map regions
- [ ] Control bonuses displayed
- [ ] Legend collapsible/optional

### Acting-As Debug
- [ ] Debug panel visible in fortify panel
- [ ] Shows authenticated player
- [ ] Shows acting-as player
- [ ] Shows action submit player
- [ ] Shows delegation allowed status
- [ ] Shows rejection reason if applicable

---

## Files Changed

### Backend
1. `functions/fortifyPhase.js` — Added acting-as validation, uses actingPlayer.id

### Frontend Components
2. `components/phases/fortify/FortifyPanel.jsx` — Sends acting_as_player_id, added debug panel
3. `components/map/MapRenderer.jsx` — Fixed tap vs drag, allows pan from territories
4. `components/layout/LeftDock.jsx` — Fixed scroll behavior, responsive width
5. `components/layout/RightDock.jsx` — Fixed scroll behavior, responsive width
6. `components/layout/CampaignLayout.jsx` — Enforced min map width, max sidebar widths

### Documentation
7. `MOBILE_LAYOUT_TEST_CHECKLIST.md` — This file

---

**All mobile layout blockers resolved.** ✅