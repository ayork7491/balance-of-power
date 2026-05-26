# Admin Test Mode: Perspective & Draft Interaction

## Overview

Admin Test Mode now includes a **persistent perspective selector** in the campaign top bar, allowing administrators to simulate different player views during test campaigns. This is essential for testing draft interactions, hidden information rules, and gameplay flows from multiple player perspectives.

---

## Top-Bar Perspective Selector

### Location & Visibility

The perspective selector appears in the **top bar** of the campaign screen when:
- The current user is a **campaign admin** or **platform admin**
- The campaign has **test players** (created via Admin Test Mode)
- The campaign is in **test mode** (admin viewing)

### How It Works

1. **Dropdown Options:**
   - **Admin / My View** - Returns to the admin's default perspective
   - **Test Players** - Each test player appears with their display name and "(Test)" label
   - **Campaign Players** - All real players in the campaign (for testing)

2. **Persistence:**
   - The selected perspective persists while navigating within the campaign
   - The perspective is **visually indicated** in the top bar with an "Eye" icon and "Viewing As" label
   - Changing perspective immediately updates all campaign views

3. **Visual Indicators:**
   - Current perspective is shown with a colored dot matching the player's color
   - Test players are marked with "(Test)" suffix
   - Admin view shows "Admin / My View" with a user icon

---

## Simulated Perspective: What It Affects

When viewing as a test player, the following components behave as if you ARE that player:

### Territory Draft Phase
- **"Your Turn" Indicator** - Shows when the simulated player is the current picker
- **Territory Highlights** - Unclaimed territories are highlighted for the simulated player
- **Claim Territory Button** - Appears when:
  - The simulated player is the current picker
  - A territory is selected on the map
  - The territory is unclaimed
  - Campaign is in `territory_draft` phase

### Attack Phase
- **Attackable Territories** - Highlighted when clicking owned territories
- **Attack Arrows** - Show staged attacks for the simulated player

### General UI
- **Phase Panels** - Display information relevant to the simulated player
- **Lock Status** - Shows whether the simulated player has locked their decisions
- **Staged Decisions** - Shows what the simulated player has staged

---

## Simulated Perspective: Limitations

**CRITICAL: This is a SIMULATION, not true authentication switching.**

### What Works
- UI state changes to reflect the simulated player's view
- Highlighting and visibility logic uses the simulated player
- Debug panels show simulated player's perspective

### What Does NOT Work
- **Does NOT authenticate as that player** - Backend calls still use the admin's credentials
- **Does NOT enforce true hidden-information rules** - Admin can still see all data via Debug Overlay
- **Does NOT restrict API access** - All data is fetched with admin privileges
- **Does NOT change user context** - Base44 auth remains as the admin user

### Labeling
When in simulated perspective, a banner or label should indicate:
> **Simulated Perspective Preview** - This changes UI state only. Does NOT authenticate as that player.

---

## Draft Claim Territory: Visibility Logic

The "Claim Territory" button appears in the Territory Draft Panel when ALL of the following are true:

### Required Conditions
1. ✅ **Campaign Phase** = `territory_draft`
2. ✅ **Simulated Player Selected** - A test player or campaign player is selected in the perspective dropdown (OR admin is viewing as themselves)
3. ✅ **Current Picker** - The simulated player's ID matches `campaign.setup_order[campaign.setup_current_index]`
4. ✅ **Territory Selected** - User has clicked a territory on the map (pendingPickId exists)
5. ✅ **Territory Unclaimed** - The selected territory has NO `TerritoryState` record (owner_player_id is null)

### Button Visibility States

| Condition | Button State | Message |
|-----------|-------------|---------|
| All conditions met | ✅ Visible & Enabled | "Claim Territory" |
| Not current picker | ❌ Hidden | "Waiting for [player name]..." |
| No territory selected | ❌ Hidden | (no message) |
| Territory already claimed | ❌ Hidden | "Already claimed — pick another." |
| Wrong phase | ❌ Hidden | (panel shows phase info) |
| No simulated player | ❌ Hidden | (admin view, not their turn) |

### Debug Panel (Test Mode Only)

When viewing as a test player, a **Draft Debug** panel appears showing:
- **Perspective:** Current simulated player name + "(Test)" label
- **Current Picker:** Who's turn it is + "✓ Your turn" if matches
- **Selected Territory:** Name of clicked territory or "None"
- **Claimable:** "Yes" (green) or reason why hidden (red)

Example reasons:
- "Not your turn"
- "No simulated player selected"
- "Territory already claimed"
- "Campaign not in draft phase"

---

## Returning to Admin View

To return to your admin perspective:

1. **Quick Method:** Click the perspective dropdown in the top bar
2. **Select:** "Admin / My View" (first option, with user icon)
3. **Result:** Immediately returns to admin view with full privileges

**Note:** You do NOT need to reopen Admin Mode panel to change perspective. The dropdown is always accessible during test mode.

---

## Hidden Information Rules

### Test Campaigns
- Debug Overlay and Snapshot Inspector are available
- All player decisions visible to admin regardless of perspective
- Simulated perspective is for UI testing only

### Production Campaigns (Non-Test)
- Perspective selector is **hidden** unless campaign has test players
- Admin view respects hidden-information rules
- **Never expose** private player decisions in live campaigns

### Security Model
- Perspective switching is **client-side only**
- Backend functions enforce true access control
- Base44 row-level security still applies
- Admin privileges required to enter test mode

---

## How to Use: Quick Start

### 1. Add Test Players (Lobby Phase Only)
- Open Admin Mode panel
- Use "Add Test Player to Lobby"
- Enter display name and select color
- Test players appear in the campaign

### 2. Start Campaign
- Ready up all players (real + test)
- Admin clicks "Start Campaign"
- Campaign enters `faction_selection` phase

### 3. Test Draft Interactions
- Wait for `territory_draft` phase
- Open perspective dropdown in top bar
- Select a test player
- Watch for "Your turn" indicator
- Click territories on map to claim
- Use Debug Panel to verify state

### 4. Debug Issues
- Check Draft Debug panel for claim status
- Verify current picker matches selected perspective
- Ensure territory is unclaimed before clicking
- Use Debug Overlay to see all player decisions

---

## Files Changed

1. **components/layout/TopBar.jsx**
   - Added perspective selector dropdown
   - Shows "Viewing As" with Eye icon
   - Displays all players + Admin option

2. **components/layout/CampaignLayout.jsx**
   - Added perspective props passthrough

3. **pages/ActiveCampaign.jsx**
   - Added `currentPerspective` state
   - Created `effectivePlayer` computed value
   - Passes perspective to all child components
   - Uses effective player for highlights/attackable logic

4. **components/setup/TerritoryDraftPanel.jsx**
   - Added `currentPerspective` prop
   - Uses `activePlayer` for turn logic
   - Added comprehensive debug panel
   - Improved button visibility logic

5. **components/campaigns/PhasePanelRouter.jsx**
   - Added `currentPerspective` prop
   - Passes to TerritoryDraftPanel

6. **ADMIN_TEST_MODE_PERSPECTIVE.md** (this file)
   - Documentation for perspective system

---

## Troubleshooting

### "Claim Territory" Button Not Showing

Check the Draft Debug panel for the reason:

1. **"Not your turn"** - Wait for the simulated player's turn in the snake draft
2. **"No simulated player selected"** - Select a test player from the dropdown
3. **"Territory already claimed"** - Click a different, unclaimed territory
4. **"Campaign not in draft phase"** - Wait for territory_draft phase
5. **"No territory selected"** - Click a highlighted territory on the map

### Perspective Not Persisting

- Ensure you're in **test mode** (admin or has test players)
- Check that the dropdown shows your selected player
- Navigate within the campaign (don't leave the page)

### Debug Panel Not Showing

- Debug panel only shows when **currentPerspective is set** (not admin view)
- Only visible in **test campaigns** or campaigns with test players
- Requires campaign admin or platform admin access

---

## Future Enhancements (Not Implemented)

- True authentication switching (would require backend changes)
- Multiple simultaneous perspectives (split-screen testing)
- Perspective history (quick-switch between recent views)
- Export perspective state for debugging

---

**Last Updated:** 2026-05-26  
**Version:** 1.0