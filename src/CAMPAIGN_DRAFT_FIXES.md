# Campaign Setup / Draft / Archive Bug Fixes

## Summary

This document describes the bug fixes implemented for campaign setup, territory draft, and archive functionality.

---

## 1. Perspective Switcher Availability

### Problem
The "Viewing As" perspective dropdown was only available in the active campaign screen (`ActiveCampaign.jsx`), not during lobby, faction selection, territory draft, or initial deployment phases.

### Solution
**Extended perspective selector to CampaignLobby:**

- Added perspective selector to `CampaignLobby.jsx` top bar
- Shows when:
  - User is campaign admin (`isAdmin = true`)
  - Campaign status is `lobby` OR campaign has test players
- Persists across lobby/setup/draft pages via local state
- Admin can switch perspective before starting the campaign

**Files Changed:**
- `pages/CampaignLobby.jsx` - Added perspective selector in custom top bar
- `components/layout/TopBar.jsx` - Already had selector for active campaigns

**Visibility Logic:**
```javascript
const showPerspectiveSelector = isAdmin && (campaign?.status === 'lobby' || hasTestPlayers);
```

**Now Available In:**
- ✅ Lobby phase
- ✅ Faction selection
- ✅ Territory draft
- ✅ Initial deployment
- ✅ Active campaign phases

---

## 2. "Claim Territory" Button Visibility

### Problem
The "Claim Territory" button was not appearing during territory draft phase, even when territories were selected and it was the player's turn.

### Root Cause
The claim button visibility chain had multiple failure points:
1. `activePlayer` wasn't properly resolved from `currentPerspective`
2. Panel layout buried the claim action
3. Debug info wasn't showing all relevant state
4. No clear messaging for why claim was blocked

### Solution
**Enhanced TerritoryDraftPanel with prominent action panel:**

1. **Replaced floating button with dedicated panel:**
   - New "Selected territory + Claim Action Panel" section
   - Always visible (not hidden in conditional rendering)
   - Clear visual hierarchy with territory name, details, and action

2. **Improved visibility logic:**
   ```javascript
   const isInDraftPhase = campaign?.current_phase === 'territory_draft';
   const canClaim = isMyTurn && pendingPickId && !pendingClaimed && activePlayer && isInDraftPhase;
   ```

3. **Added comprehensive status messaging:**
   - "No territory selected" → "Click a territory on the map"
   - "Already claimed" → Shows who claimed it
   - "Not your turn" → Shows who's turn it is
   - "Campaign is not in draft phase" → Clear phase status
   - "No player perspective selected" → Directs admin to use dropdown

4. **Enhanced Debug Panel:**
   - Always shows (not just when `currentPerspective` is set)
   - Shows campaign status, setup phase, current picker
   - Shows perspective (admin or simulated player)
   - Shows selected territory ID
   - Shows claimable status with clear Yes/No + reason

**Claim Button Visibility Chain:**
```
1. ✅ Territory selected on map (pendingPickId exists)
2. ✅ Territory is unclaimed (!pendingState)
3. ✅ Campaign is in territory_draft phase
4. ✅ activePlayer exists (simulated or real)
5. ✅ activePlayer is current picker (isMyTurn)
6. ✅ Button appears with "Claim Territory" label
```

**Files Changed:**
- `components/setup/TerritoryDraftPanel.jsx` - Complete panel redesign

---

## 3. Draft Action Panel

### Problem
No persistent panel showing draft state, selected territory, and claim action. Users had to rely on a small floating button.

### Solution
**Created comprehensive Draft Action Panel:**

**Panel Structure:**
```
┌─────────────────────────────────────┐
│ Territory Name              Terrain │
│ Region: [Region Name]               │
│ [Already claimed by Player X]       │
│                                     │
│ [Claim Territory Button]            │
│ OR                                  │
│ [Status Message]                    │
└─────────────────────────────────────┘

Draft Debug
Campaign Status: active
Setup Phase: territory_draft
Current Picker: Player Name ✓ Your turn
Perspective: Test Player (Test)
Selected Territory ID: territory_123
Claimable: Yes
```

**Features:**
- Always visible in left dock during draft phase
- Shows territory name, terrain type, region
- Shows claim button when valid
- Shows clear status message when claim blocked
- Debug section with all relevant state

**Files Changed:**
- `components/setup/TerritoryDraftPanel.jsx` - New panel structure

---

## 4. Desktop + Mobile Claim Functionality

### Problem
Claim button needed to work on both desktop (mouse) and mobile (touch).

### Solution
**Verified click/touch handling:**

1. **Map selection:** Already works via `onSelect` prop in `MapRenderer`
   - Desktop: Mouse click on territory polygon
   - Mobile: Touch on territory polygon
   - Sets `selectedId` in `ActiveCampaign.jsx`

2. **Claim action:** Button uses standard `onClick` handler
   - Works with mouse click
   - Works with touch tap
   - Disabled state prevents double-submission

3. **Visual feedback:**
   - Submitting state shows spinner
   - Success message shows claimed territory name
   - Map updates ownership color immediately

**Files Verified:**
- `components/map/MapRenderer.jsx` - Territory selection already supports both
- `components/setup/TerritoryDraftPanel.jsx` - Claim button works with both

---

## 5. Campaign Archive Behavior

### Problem
Archiving a campaign didn't properly hide it from dashboard lists or prevent actions.

### Solution
**Fixed archive logic in backend function:**

**Archive Behavior:**
```javascript
// In getMyCampaigns backend function
const userCampaigns = allCampaigns.filter(
  c => campaignIds.includes(c.id) && c.status !== 'archived'
);
```

**What Archive Does:**
- Sets `campaign.status = 'archived'`
- Backend filters out archived campaigns from `getMyCampaigns`
- Frontend also filters client-side as safety
- Archived campaigns don't appear in dashboard "Your Campaigns" section
- Archived campaigns can't be joined or started

**Files Changed:**
- `functions/getMyCampaigns` - Filter out archived campaigns
- `features/campaigns/useMyCampaigns.js` - Client-side filter
- `pages/Home.jsx` - Added note about archived campaigns being hidden

**Archive vs Delete:**
- **Lobby phase:** "Delete Campaign" → Hard delete (campaign + players + invites)
- **Active phase:** "Archive Campaign" → Soft delete (status = 'archived')

---

## 6. Dashboard Campaign Filtering

### Problem
Dashboard showed all campaigns including archived ones.

### Solution
**Updated `getMyCampaigns` backend function:**

**Filter Logic:**
```javascript
// Backend (functions/getMyCampaigns)
const userCampaigns = allCampaigns.filter(
  c => campaignIds.includes(c.id) && c.status !== 'archived'
);

// Frontend (features/campaigns/useMyCampaigns.js)
const activeCampaigns = (userCampaigns ?? []).filter(c => c.status !== 'archived');
```

**Dashboard Display:**
- Shows "Your Campaigns" header
- Subtext: "Showing active campaigns only. Archived campaigns are hidden."
- Only non-archived campaigns appear
- Archived campaigns completely hidden (no section)

**Files Changed:**
- `functions/getMyCampaigns` - Backend filter
- `features/campaigns/useMyCampaigns.js` - Frontend filter
- `pages/Home.jsx` - Added explanatory text

---

## 7. Debug Output in Test/Admin Mode

### Problem
No visibility into why draft claims were blocked.

### Solution
**Enhanced Draft Debug Panel:**

**Shows:**
- Campaign status (`lobby`, `active`, etc.)
- Setup phase (`faction_selection`, `territory_draft`, etc.)
- Current picker name + "✓ Your turn" indicator
- Perspective (admin view or simulated player with "(Test)" label)
- Selected territory ID (or "None")
- Claimable status: "Yes" (green) or reason (red)

**Claimable Status Reasons:**
- ✅ "Yes" - All conditions met
- ❌ "No player perspective selected" - Admin hasn't selected a player
- ❌ "Not your turn" - Different player is current picker
- ❌ "No territory selected" - User hasn't clicked a territory
- ❌ "Territory already claimed" - Territory has an owner
- ❌ "Campaign is not in draft phase" - Wrong phase

**Location:**
- Bottom of TerritoryDraftPanel in left dock
- Always visible (not conditional)
- Compact 10px font, doesn't obstruct main UI

**Files Changed:**
- `components/setup/TerritoryDraftPanel.jsx` - Enhanced debug panel

---

## 8. Documentation Updates

### Created Files

**ADMIN_TEST_MODE_PERSPECTIVE.md** (already existed, updated):
- When perspective switching is available
- How draft claim eligibility is determined
- Simulated vs authenticated perspective

**CAMPAIGN_DRAFT_FIXES.md** (this file):
- Complete bug fix documentation
- Before/after comparisons
- Visibility logic diagrams

---

## Files Changed Summary

### Modified Files (7)

1. **pages/CampaignLobby.jsx**
   - Added perspective selector to top bar
   - Shows during lobby phase for admins
   - Imports: Select components, Eye/User icons

2. **components/setup/TerritoryDraftPanel.jsx**
   - Complete panel redesign
   - Prominent claim action panel
   - Enhanced debug output
   - Better status messaging
   - Fixed `activePlayer` resolution

3. **functions/getMyCampaigns**
   - Filter out archived campaigns backend-side

4. **features/campaigns/useMyCampaigns.js**
   - Filter out archived campaigns client-side

5. **pages/Home.jsx**
   - Added text about archived campaigns being hidden

### Already Correct (No Changes Needed)

- `components/layout/TopBar.jsx` - Already had perspective selector for active campaigns
- `pages/ActiveCampaign.jsx` - Already manages perspective state correctly
- `components/map/MapRenderer.jsx` - Already supports mouse + touch selection

---

## Testing Checklist

### Perspective Switcher
- [ ] Shows in lobby for campaign admin
- [ ] Shows in active campaign for admin
- [ ] Shows when campaign has test players
- [ ] Dropdown lists all players + "Admin / My View"
- [ ] Test players marked with "(Test)"
- [ ] Perspective persists while navigating
- [ ] Returns to admin view when selected

### Territory Draft Claim
- [ ] Territory selection works (mouse click)
- [ ] Territory selection works (touch tap)
- [ ] Selected territory shows in panel
- [ ] "Claim Territory" button appears when:
  - [ ] Campaign is in `territory_draft` phase
  - [ ] It's your turn (or simulated player's turn)
  - [ ] Territory is unclaimed
  - [ ] Player perspective is selected
- [ ] Button shows correct status when blocked:
  - [ ] "Not your turn"
  - [ ] "Territory already claimed"
  - [ ] "No player perspective selected"
  - [ ] "Campaign is not in draft phase"
- [ ] Claim action works and updates map
- [ ] Debug panel shows accurate information

### Campaign Archive
- [ ] Archiving sets status to 'archived'
- [ ] Archived campaign disappears from dashboard
- [ ] Archived campaign can't be joined
- [ ] Archived campaign can't be started
- [ ] Dashboard shows "active campaigns only" text
- [ ] Backend filters archived campaigns
- [ ] Frontend also filters as safety

---

## Before/After Comparison

### Before
- ❌ Perspective selector only in active campaign
- ❌ Claim button hidden or hard to find
- ❌ No clear messaging for blocked claims
- ❌ Archived campaigns still visible in dashboard
- ❌ No debug output for draft state

### After
- ✅ Perspective selector in lobby + active campaign
- ✅ Prominent claim action panel
- ✅ Clear status messages for all blocked states
- ✅ Archived campaigns completely hidden
- ✅ Comprehensive debug panel with all state

---

## How to Use

### Admin Testing Draft Flow

1. **Add test players** (lobby phase only):
   - Open Admin Mode panel
   - Use "Add Test Player to Lobby"
   - Enter name, select color

2. **Start campaign**:
   - Ready up all players
   - Click "Start Campaign"
   - Campaign enters `faction_selection`

3. **Test perspective switching**:
   - Wait for `territory_draft` phase
   - Use "Viewing As" dropdown in top bar
   - Select a test player

4. **Claim territories**:
   - Click territory on map
   - See territory details in left panel
   - Click "Claim Territory" when button appears
   - Watch debug panel for status

5. **Debug issues**:
   - Check "Draft Debug" section
   - Verify campaign status, phase, current picker
   - Check claimable status + reason

---

**Last Updated:** 2026-05-26  
**Status:** ✅ Complete