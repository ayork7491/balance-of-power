# Admin Test Mode: Viewing As vs Acting As

## Overview

Admin Test Mode now separates two distinct concepts:

1. **Viewing As** — Controls what data/UI perspective is shown
2. **Acting As** — Controls which CampaignPlayer the admin is submitting actions for

This separation allows campaign admins to:
- Preview what different players see (Viewing As)
- Submit actions on behalf of test players (Acting As)
- Test campaign flows without requiring multiple real accounts

---

## 1. Viewing As

### Purpose
Controls the **visual perspective** — what data and UI elements are displayed to the admin.

### Behavior
- **Simulated perspective**: Due to Base44 auth limitations, this is a UI-level simulation
- **Data filtering**: Shows territories, battles, and decisions from the selected player's viewpoint
- **No action delegation**: Does NOT change which player record actions are submitted for

### Available When
- Campaign admin is viewing the campaign
- Campaign has test players, OR
- Campaign is marked as test/debug campaign

### UI Location
- Top bar dropdown with **Eye icon**
- Label: "Viewing As"
- Options: "Admin / My View" + all campaign players

### Example Use Cases
- Preview what a test player sees in the UI
- Verify territory ownership colors from different perspectives
- Check which battles are visible to specific players

---

## 2. Acting As

### Purpose
Controls **action delegation** — which CampaignPlayer record actions are submitted for during test mode.

### Behavior
- **Action submission**: When admin clicks "Claim Territory", "Select Faction", etc., actions are submitted for the selected Acting As player
- **Eligibility checks**: Draft claims, faction selections, and other actions validate against the Acting As player's eligibility
- **Test-mode only**: Only available for test players or in test campaigns

### Available When
- Campaign admin is viewing the campaign, AND
- One of the following:
  - Target player is a **test player** (is_test_player = true), OR
  - Campaign is marked as **test campaign** (name contains "test" or has test players), OR
  - Platform admin override applies

### UI Location
- Top bar dropdown with **Test Tube icon**
- Label: "Acting As"
- Options: "My Player" + eligible test players

### Safety Restrictions
**Acting As is NOT available for:**
- Real human players in live campaigns (unless test/debug enabled)
- Non-admin users
- Campaigns without test players or test designation

**Example:**
```
Admin cannot act as:
❌ Real player in active campaign
❌ Player in non-test campaign

Admin can act as:
✅ Own player (always)
✅ Test players (if admin)
✅ Any player in test campaign (if admin)
```

---

## 3. How Claim Territory Works

### Before (Broken)
```javascript
// Used authenticated user's player record
const canClaim = isMyTurn && pendingPickId && !pendingClaimed;
// Submitted as authenticated user
await setupPhase({ territory_id: selectedId });
```

**Problem**: Claim button didn't appear because `isMyTurn` checked authenticated user, not simulated player.

### After (Fixed)
```javascript
// Uses Acting As player for eligibility
const actionPlayer = actingAsPlayer ?? myPlayer;
const isMyTurn = actionPlayer.id === currentPickerId;
const canClaim = isMyTurn && pendingPickId && !pendingClaimed;

// Submits for Acting As player
await setupPhase({
  territory_id: selectedId,
  acting_as_player_id: actionPlayer.id, // Backend uses this player record
});
```

**Solution**: Claim button appears when Acting As player is eligible, submits claim for that player.

### Claim Eligibility Chain

```
1. ✅ Campaign is in territory_draft phase
2. ✅ Territory selected on map (pendingPickId exists)
3. ✅ Territory is unclaimed (!pendingState)
4. ✅ Acting As player exists
5. ✅ Acting As player is current picker (isMyTurn)
6. ✅ Acting As player has remaining picks
7. ✅ Button appears → Click submits for Acting As player
```

### Debug Panel Shows
- **Authenticated User**: Real admin account
- **Viewing As**: Visual perspective (simulated)
- **Acting As**: Action delegation target
- **Current Picker**: Who's turn it is in draft
- **Claimable**: Yes/No with reason

---

## 4. Test Campaign Restrictions

### What Makes a Campaign a "Test Campaign"

**Automatic Detection:**
- Campaign name contains "test" (case-insensitive)
- Campaign has test players (is_test_player = true)

**Manual Override:**
- Platform admin can designate any campaign as test

### Restrictions in Test Campaigns

**Allowed:**
- ✅ Add test players via admin panel
- ✅ Act as any player in campaign
- ✅ Force phase advances
- ✅ Auto-fill decisions
- ✅ Reset campaign state

**Not Allowed:**
- ❌ Invite real players (unless converting to test)
- ❌ Start real gameplay without test designation
- ❌ Mix test and real players without clear separation

### Safety Checks

**Backend validation in `setupPhase` function:**
```javascript
// Check if admin can act as this player
const canActAs = isAdmin && (
  player.is_test_player ||
  campaign.is_test_campaign ||
  player.user_id === authenticatedUserId
);

if (!canActAs) {
  return Response.json({ 
    error: 'Cannot act as this player in live campaign' 
  }, { status: 403 });
}
```

---

## 5. Implementation Details

### Files Changed

**New Files:**
- `features/adminTestMode/types.ts` — Type definitions
- `features/adminTestMode/useActingAs.ts` — Hook for acting-as state

**Modified Files:**
- `components/layout/TopBar.jsx` — Added Acting As dropdown
- `components/layout/CampaignLayout.jsx` — Pass acting-as props
- `pages/ActiveCampaign.jsx` — Manage acting-as state
- `pages/CampaignLobby.jsx` — Add acting-as controls in lobby
- `components/setup/TerritoryDraftPanel.jsx` — Use actionPlayer for eligibility
- `components/campaigns/PhasePanelRouter.jsx` — Pass actionPlayer to panels

### State Management

```javascript
// ActiveCampaign.jsx
const [currentPerspective, setCurrentPerspective] = useState(null); // Viewing As
const [actingAsPlayerId, setActingAsPlayerId] = useState(null); // Acting As

// Hook manages eligibility
const { 
  actingAsPlayer, 
  availableActingAsPlayers,
  isTestCampaign 
} = useActingAs(id, players);

// Derived players
const effectivePlayer = currentPerspective ?? myPlayer; // For viewing
const actionPlayer = actingAsPlayer ?? myPlayer; // For actions
```

### Backend Function Changes

**`functions/setupPhase`** (territory draft claims):
```javascript
// Accept optional acting_as_player_id
const { territory_id, acting_as_player_id } = payload;

// Use acting-as player if provided and valid
const targetPlayer = acting_as_player_id 
  ? players.find(p => p.id === acting_as_player_id)
  : myPlayer;

// Validate eligibility
if (!canActAs(targetPlayer)) {
  throw new Error('Cannot act as this player');
}

// Process claim for targetPlayer
```

---

## 6. Usage Examples

### Example 1: Test Territory Draft as Test Player

**Setup:**
1. Create campaign with "Test" in name
2. Add test players: "Test Player A", "Test Player B"
3. Start campaign → enters faction selection

**Testing:**
1. Open campaign, see top bar with "Viewing As" + "Acting As" dropdowns
2. Set **Viewing As**: "Test Player A"
3. Set **Acting As**: "Test Player A"
4. Wait for territory draft phase
5. Click territory on map → "Claim Territory" button appears (if Test Player A's turn)
6. Click "Claim Territory" → Claim submitted for Test Player A
7. Map updates with Test Player A's color

### Example 2: Preview Different Perspectives

**Scenario**: Admin wants to see what each player sees without taking actions

**Setup:**
1. Set **Viewing As**: "Test Player B"
2. Set **Acting As**: "My Player" (default)
3. UI shows Test Player B's territories, battles, decisions
4. Actions still submit for admin's own player
5. No test actions taken, just observing

### Example 3: Multi-Player Testing

**Scenario**: Admin testing full draft flow with 4 test players

**Process:**
1. Add 4 test players with different colors
2. Start campaign
3. For each pick in draft:
   - Set **Acting As**: Current picker (e.g., "Test Player C")
   - Click territory on map
   - Click "Claim Territory"
   - System validates it's Test Player C's turn
   - Claim submitted for Test Player C
4. Repeat for all picks until draft complete

---

## 7. Debug Panel

### Location
Bottom of left dock panel during territory draft phase

### Shows
```
Draft Debug (Simulated)

Campaign Status: active
Setup Phase: territory_draft
Current Picker: Test Player A ✓ Active

Authenticated User: admin@example.com
Viewing As: Test Player A (Test)
Acting As: Test Player A (Test)

Selected Territory ID: territory_123
Claimable: Yes
```

### Debug Fields

| Field | Description |
|-------|-------------|
| Campaign Status | `lobby`, `active`, `paused`, `complete`, `archived` |
| Setup Phase | `faction_selection`, `territory_draft`, `initial_deploy` |
| Current Picker | Who's turn it is in snake draft |
| Authenticated User | Real admin account |
| Viewing As | Visual perspective (simulated) |
| Acting As | Action delegation target |
| Selected Territory ID | Territory clicked on map |
| Claimable | Yes/No with reason if blocked |

---

## 8. Security Considerations

### What's Protected

**Live Campaigns:**
- Admins cannot act as real players
- Test players cannot be added to live campaigns
- Acting As only works for test players or test campaigns

**Test Campaigns:**
- Clearly marked as test/debug
- Cannot be joined by real players (unless converted)
- Actions logged as test-mode operations

### What's Not Protected

**UI Simulation:**
- Viewing As is purely visual
- No server-side validation of perspective
- Client-side only filtering

**Action Delegation:**
- Backend validates Acting As eligibility
- Prevents acting as real players in live campaigns
- Logs all test-mode actions

### Best Practices

**For Admins:**
1. Always use test campaigns for testing
2. Clearly mark test campaigns with "Test" prefix
3. Use test players, not real accounts
4. Review debug panel before taking actions
5. Document test scenarios for team

**For Development:**
1. Keep test campaigns separate from live
2. Use test player naming convention (e.g., "[TEST] Player Name")
3. Log all Acting As actions for audit
4. Validate eligibility server-side
5. Never bypass safety checks

---

## 9. Troubleshooting

### Claim Button Not Appearing

**Check:**
1. ✅ Campaign is in `territory_draft` phase
2. ✅ Territory selected on map (not already claimed)
3. ✅ Acting As player is set (not "My Player" if testing)
4. ✅ Acting As player is current picker
5. ✅ Debug panel shows "Claimable: Yes"

**Common Issues:**
- ❌ Acting As = "My Player" but it's test player's turn
- ❌ Viewing As ≠ Acting As (confusing which is which)
- ❌ Campaign not in draft phase yet
- ❌ Territory already claimed

### Acting As Dropdown Empty

**Check:**
1. ✅ User is campaign admin
2. ✅ Campaign has test players OR is test campaign
3. ✅ Players loaded in campaign

**Common Issues:**
- ❌ Not campaign admin
- ❌ No test players in campaign
- ❌ Campaign name doesn't include "test"

### Actions Submitting for Wrong Player

**Check:**
1. ✅ Acting As dropdown set correctly
2. ✅ Backend function accepts `acting_as_player_id`
3. ✅ Debug panel shows correct Acting As player

**Common Issues:**
- ❌ Acting As = "My Player" (default)
- ❌ Backend not using acting_as_player_id parameter
- ❌ Frontend not passing acting_as_player_id

---

**Last Updated:** 2026-05-26  
**Status:** ✅ Implemented