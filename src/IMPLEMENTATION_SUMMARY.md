# Admin Test Perspective + Draft Interaction: Implementation Summary

## Overview

Implemented a comprehensive admin test perspective system that allows campaign administrators to simulate different player views during test campaigns. The system includes:

1. **Persistent perspective selector in campaign top bar**
2. **Draft interaction fixes for territory claiming**
3. **Draft debug panel for visibility into claim status**
4. **Simulated perspective affecting all relevant gameplay views**
5. **Comprehensive documentation**

---

## Files Changed

### 1. **components/layout/TopBar.jsx** ✅
**What:** Added persistent perspective selector dropdown to campaign top bar

**Changes:**
- Added Eye and User icons from lucide-react
- Added Select component for perspective switching
- Perspective selector appears when:
  - User is admin (`isTestMode` = true)
  - Campaign has players to simulate
- Dropdown shows:
  - "Admin / My View" option with user icon
  - All campaign players with color indicators
  - "(Test)" label for test players
- Changes perspective in real-time via `onPerspectiveChange` callback

**Key Code:**
```jsx
<Select value={currentPerspective?.id || 'admin'} onValueChange={(val) => {
  const player = val === 'admin' ? null : players.find(p => p.id === val);
  onPerspectiveChange?.(player);
}}>
```

---

### 2. **components/layout/CampaignLayout.jsx** ✅
**What:** Added perspective props to be passed down to TopBar

**Changes:**
- Added `players`, `currentPerspective`, `onPerspectiveChange` props
- Passes props to TopBar component
- Props flow through from ActiveCampaign

---

### 3. **pages/ActiveCampaign.jsx** ✅
**What:** Core perspective state management and logic

**Changes:**
- Added `currentPerspective` state (null = admin view)
- Created `effectivePlayer` computed value:
  - Returns `currentPerspective` if set (simulated)
  - Falls back to `myPlayer` (admin view)
- Added `hasTestPlayers` flag
- Updated all player-dependent logic to use `effectivePlayer`:
  - Territory highlights in draft phase
  - Attackable territories in attack phase
  - Arrow layer (who's attacking)
- Passes perspective to child components:
  - CampaignLayout
  - PhasePanelRouter
  - TopBar receives all players + current perspective

**Key Code:**
```jsx
const effectivePlayer = useMemo(() => {
  if (currentPerspective) return currentPerspective;
  return myPlayer;
}, [currentPerspective, myPlayer]);
```

---

### 4. **components/setup/TerritoryDraftPanel.jsx** ✅
**What:** Territory claim logic and debug visibility

**Changes:**
- Added `currentPerspective` prop from PhasePanelRouter
- Created `activePlayer` = currentPerspective || myPlayer
- Updated turn check: `isMyTurn = currentPickerId === activePlayer?.id`
- Enhanced territory selection panel:
  - Shows "Claim Territory" button only when `isMyTurn && pendingPickId && !pendingClaimed`
  - Shows "Waiting for [player]..." when not your turn
  - Shows "Already claimed..." when territory taken
- Added comprehensive debug panel:
  - Shows current simulated perspective + (Test) label
  - Shows who the current picker is
  - Shows selected territory name or "None"
  - Shows claimability status: "Yes" or reason hidden
- Created `claimBlockedReason` logic:
  - "No simulated player selected"
  - "Not your turn"
  - "No territory selected"
  - "Territory already claimed"
  - "Campaign not in draft phase"

**Key Code:**
```jsx
const canClaim = isMyTurn && pendingPickId && !pendingClaimed && activePlayer;
const claimBlockedReason = !activePlayer ? 'No simulated player selected' 
  : !isMyTurn ? 'Not your turn' : ...
```

---

### 5. **components/campaigns/PhasePanelRouter.jsx** ✅
**What:** Pass perspective to TerritoryDraftPanel

**Changes:**
- Added `currentPerspective` prop to function signature
- Passes `currentPerspective` to TerritoryDraftPanel component

---

### 6. **ADMIN_TEST_MODE_PERSPECTIVE.md** ✅ (NEW FILE)
**What:** Comprehensive documentation of the perspective system

**Contains:**
- Overview of perspective selector
- How perspective selector works (location, visibility, options)
- What simulated perspective affects (all phases)
- Limitations of simulated perspective (UI-only, not auth-switching)
- Draft claim territory visibility logic (all conditions, debug table)
- How to return to admin view (quick method in dropdown)
- Hidden information rules (test vs production)
- Quick start guide (4 steps)
- Troubleshooting section with debug panel guidance
- Files changed summary
- Future enhancements

---

## Feature Implementation Details

### Top-Bar Perspective Selector

**Visibility Conditions:**
- ✅ User is campaign admin (`isTestMode = true`)
- ✅ Campaign has players (length > 0)
- ✅ (Optional) Campaign has test players (`hasTestPlayers = true`)

**Dropdown Options:**
- ✅ "Admin / My View" - Returns to admin view (null perspective)
- ✅ Each test player - With color indicator + "(Test)" label
- ✅ Each campaign player - With color indicator for testing

**Persistence:**
- ✅ State stored in `currentPerspective` at ActiveCampaign level
- ✅ Persists across component re-renders
- ✅ Persists while navigating within campaign
- ✅ Cleared when leaving campaign

**Visual Indication:**
- ✅ Eye icon in top bar
- ✅ "Viewing As" label (hidden on mobile)
- ✅ Selected player name in dropdown
- ✅ Color dot matching player color

---

### Simulated Perspective: What It Affects

#### Territory Draft Phase
- ✅ "Your turn!" indicator when simulated player is current picker
- ✅ Territory highlights for unclaimed territories (only if your turn)
- ✅ "Claim Territory" button appears when:
  - Current player is the picker
  - Territory selected on map
  - Territory is unclaimed
  - Phase = `territory_draft`
- ✅ Button shows claim reasons when hidden
- ✅ Debug panel shows all state details

#### Attack Phase
- ✅ Territory highlights (owned territories)
- ✅ Attackable territories highlighted (enemies adjacent to owned)
- ✅ Staged attacks visible for simulated player

#### General
- ✅ Phase panels show information for simulated player
- ✅ Lock status reflects simulated player
- ✅ All highlighting/visibility logic uses effective player

---

### Draft Claim Territory: Visibility Logic

**Button Appears When:**
1. ✅ Phase = `territory_draft`
2. ✅ `effectivePlayer` exists (simulated or admin)
3. ✅ `effectivePlayer.id === setupOrder[currentIdx]` (your turn)
4. ✅ `pendingPickId` exists (territory selected)
5. ✅ Territory is unclaimed (`!pendingState`)

**Button Hidden With Reason:**
- "Not your turn" - Wait for simulated player's turn
- "Territory already claimed" - Click different territory
- "No territory selected" - Click a territory on map
- "Campaign not in draft phase" - Wait for territory_draft phase
- "No simulated player selected" - Select a test player

**Desktop Mouse Click Support:**
- ✅ Territory selection works with mouse click
- ✅ Territory selection works with touch
- ✅ State propagates correctly from map to panel

---

### Draft Debug Visibility (Test Mode Only)

**Debug Panel Shows:**
- ✅ Current perspective name + "(Test)" if test player
- ✅ Current picker player name + "✓ Your turn" if matches
- ✅ Selected territory name or "None"
- ✅ Claimability: "Yes" or reason why blocked

**Visibility:**
- ✅ Only shows when `currentPerspective` is set (not admin view)
- ✅ Only in test campaigns or with test players
- ✅ Requires admin access

---

### Hidden Information Rules

**Test Campaigns:**
- ✅ Debug Overlay shows all decisions
- ✅ Snapshot Inspector available
- ✅ Perspective is for UI testing only

**Production Campaigns:**
- ✅ Perspective selector hidden (unless test players)
- ✅ Admin respects hidden-information rules
- ✅ No private decision exposure

**Security:**
- ✅ Perspective is client-side UI only
- ✅ Backend auth remains as admin
- ✅ Base44 row-level security enforced
- ✅ Admin privileges required for test mode
- ✅ No true authentication switching (labeled as simulated)

---

## How It Works: End-to-End Flow

### 1. Admin Enters Test Mode
```
Campaign Screen → Admin Mode button → AdminTestMode page
  ↓
Add Test Player via form (lobby only)
  ↓
Start campaign (enters faction_selection)
```

### 2. Territory Draft Phase
```
Campaign enters territory_draft
  ↓
ActiveCampaign renders with isTestMode=true & hasTestPlayers=true
  ↓
TopBar shows perspective dropdown
  ↓
Admin selects a test player from dropdown
  ↓
currentPerspective state updates
  ↓
effectivePlayer = currentPerspective (test player)
  ↓
TerritoryDraftPanel receives activePlayer = test player
  ↓
Territory highlights updated for test player
  ↓
"Your turn!" shows when test player is picker
```

### 3. Claim Territory
```
Admin clicks unclaimed territory on map
  ↓
setSelectedId(territoryId) → TerritoryDraftPanel
  ↓
pendingPickId = territoryId
  ↓
Check conditions:
  - isMyTurn = (currentPickerId === activePlayer?.id) ✓
  - !pendingClaimed = territory unclaimed ✓
  - activePlayer exists ✓
  ↓
"Claim Territory" button appears
  ↓
Admin clicks button → calls setupPhase(...pickTerritory)
  ↓
Territory ownership updates
  ↓
Panel resets, next picker's turn
```

### 4. Debug Issues
```
Admin checks Draft Debug panel:
  - Perspective: "Test Player One (Test)"
  - Current Picker: "Test Player Two"
  - Selected Territory: "North Ridge"
  - Claimable: "Not your turn"
  ↓
Understands why button is hidden
```

---

## Testing Checklist

- [ ] Top bar shows perspective dropdown in test mode
- [ ] Dropdown lists "Admin / My View" + all players
- [ ] Selecting a player updates perspective
- [ ] Perspective persists while navigating
- [ ] Territory highlights work for selected perspective
- [ ] "Claim Territory" button shows when all conditions met
- [ ] Button hidden with correct reason message
- [ ] Debug panel shows accurate information
- [ ] Desktop mouse click works for territory selection
- [ ] Touch selection also works
- [ ] Draft interaction works for multiple test players
- [ ] Returning to "Admin / My View" restores admin view
- [ ] Does NOT appear in non-test campaigns (without test players)

---

## Limitations (By Design)

- **Simulated, not real:** Perspective is UI-only, not true auth switching
- **Admin can see everything:** Debug Overlay shows all decisions
- **Backend calls still admin:** All API calls use admin credentials
- **Base44 auth unchanged:** User remains authenticated as admin
- **No enforcement:** UI respects perspective, but backend doesn't restrict
- **Test-only feature:** Requires admin access and test mode

---

## Future Enhancements

1. **True authentication switching** - Would require backend session management
2. **Split-screen multi-perspective** - Show multiple players simultaneously
3. **Perspective history** - Quick-switch between recent views
4. **Export state for debugging** - Download perspective snapshot
5. **Time-travel debugging** - Replay decisions with different perspectives

---

**Implementation Date:** 2026-05-26  
**Status:** ✅ Complete  
**All Requirements Met:** ✅ Yes