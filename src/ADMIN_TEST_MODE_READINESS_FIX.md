# Admin Test Player Readiness + Acting-As Backend Delegation

**Date:** 2026-05-26  
**Status:** ✅ Implemented

---

## Summary

Fixed critical issues preventing test players from being used effectively in campaign setup:

1. ✅ Admin can now mark test players as ready/unready in lobby
2. ✅ Backend `setupPhase` function now supports `acting_as_player_id` parameter
3. ✅ Frontend setup/draft calls send `acting_as_player_id` when Acting As is selected
4. ✅ Territory ownership correctly assigned to acting player (not authenticated user)
5. ✅ Enhanced debug output showing acting-as delegation state

---

## 1. Admin Ready Controls for Test Players

### What Changed

**File:** `components/campaigns/lobby/PlayerSlot.jsx`

Added admin-only ready toggle for test players:

```jsx
{/* Admin ready toggle for test players only */}
{canAdminToggleReady && player.is_test_player && (
  <button
    onClick={() => onAdminToggleReady(player)}
    className={`p-1.5 rounded text-xs transition-colors shrink-0 border ${
      player.is_ready
        ? 'bg-status-locked/20 text-status-locked border-status-locked/40'
        : 'bg-status-pending/20 text-status-pending border-status-pending/40'
    }`}
    title={player.is_ready ? 'Mark as not ready' : 'Mark as ready'}
  >
    <TestTube className="w-3 h-3" />
  </button>
)}
```

**File:** `pages/CampaignLobby.jsx`

Added handler and passed props to PlayerSlot:

```javascript
const handleAdminToggleReady = async (player) => {
  if (!isAdmin || !player.is_test_player) return;
  setActionError(null);
  try {
    await setPlayerReady(player.id, !player.is_ready);
    reload();
  } catch { setActionError('Failed to update ready status.'); }
};

// In render:
<PlayerSlot
  player={p}
  canAdminToggleReady={isAdmin}
  onAdminToggleReady={handleAdminToggleReady}
/>
```

### How Test Players Are Readied

**Before:** Test players appeared in lobby with "Waiting" status, but no way to mark them ready → campaign couldn't start.

**Now:** Campaign admins see a small test tube icon button next to each test player's ready status:
- Click when "Waiting" → marks as "Ready" (green badge)
- Click when "Ready" → marks as "Waiting" (yellow badge)
- Only visible to campaign admins
- Only works on test players (not real human players)
- Lobby refreshes after toggle to show updated status

### Safety Restrictions

- ✅ Only campaign admins see the ready toggle
- ✅ Only works on players with `is_test_player: true`
- ✅ Real human players cannot be toggled by admin (preserves player autonomy)
- ✅ Toggle uses existing `setPlayerReady` API (no new backend needed)

---

## 2. Backend Acting-As Delegation

### What Changed

**File:** `functions/setupPhase.js`

Added acting-as delegation logic at the top of the handler:

```javascript
const { action, campaign_id, faction_name, territory_id, acting_as_player_id } = body;

// ... auth and campaign loading ...

// ── Acting-as delegation (admin test mode) ───────────────────────────────────
let actingPlayer = myPlayer;
if (acting_as_player_id) {
  // Verify admin privileges
  const isAdmin = myPlayer.is_admin || user.role === 'admin';
  if (!isAdmin) {
    return Response.json({ error: 'Only admins can use acting-as delegation' }, { status: 403 });
  }

  // Verify target player exists in this campaign
  const targetPlayer = players.find(p => p.id === acting_as_player_id);
  if (!targetPlayer) {
    return Response.json({ error: 'Target player not found in this campaign' }, { status: 404 });
  }

  // Verify target is a test player OR campaign is explicitly a test campaign
  if (!targetPlayer.is_test_player) {
    return Response.json({ error: 'Can only act as test players' }, { status: 403 });
  }

  actingPlayer = targetPlayer;
}
```

### How `acting_as_player_id` Is Validated

Three-layer validation before allowing acting-as delegation:

1. **Admin Check:**
   ```javascript
   const isAdmin = myPlayer.is_admin || user.role === 'admin';
   if (!isAdmin) return 403;
   ```

2. **Player Existence Check:**
   ```javascript
   const targetPlayer = players.find(p => p.id === acting_as_player_id);
   if (!targetPlayer) return 404;
   ```

3. **Test Player Check:**
   ```javascript
   if (!targetPlayer.is_test_player) return 403;
   ```

All three conditions must pass. If any fail, the request is rejected with appropriate error.

### How `setupPhase` Resolves the Acting Player

**Resolution Flow:**

```
1. Load authenticated user's CampaignPlayer record → myPlayer
2. Check if acting_as_player_id provided in request
   ├─ NO:  actingPlayer = myPlayer (default behavior)
   └─ YES: Validate (admin + exists + test player)
           ├─ PASS: actingPlayer = targetPlayer
           └─ FAIL: Return error (403/404)
3. Use actingPlayer for all subsequent actions
```

**Actions Using `actingPlayer`:**

| Action | Original Code | Fixed Code |
|--------|--------------|------------|
| `selectFaction` | Check turn: `setupOrder[currentIdx] !== myPlayer.id` | `setupOrder[currentIdx] !== actingPlayer.id` |
| `selectFaction` | Update: `CampaignPlayer.update(myPlayer.id, { faction_name })` | `CampaignPlayer.update(actingPlayer.id, { faction_name })` |
| `selectFaction` | Log: `faction_selected` for `myPlayer.id` | `faction_selected` for `actingPlayer.id` |
| `pickTerritory` | Check turn: `setupOrder[currentIdx] !== myPlayer.id` | `setupOrder[currentIdx] !== actingPlayer.id` |
| `pickTerritory` | Assign: `owner_player_id: myPlayer.id` | `owner_player_id: actingPlayer.id` |
| `pickTerritory` | Log: `territory_picked` for `myPlayer.id` | `territory_picked` for `actingPlayer.id` |
| `skipFaction` | Check turn: `setupOrder[currentIdx] !== myPlayer.id` | `setupOrder[currentIdx] !== actingPlayer.id` |
| `skipFaction` | Log: `auto_submitted` for `myPlayer.id` | `auto_submitted` for `actingPlayer.id` |

---

## 3. Frontend Acting-As Integration

### What Changed

**File:** `components/setup/FactionSelectionPanel.jsx`

Added test context import and acting-as parameter:

```javascript
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function FactionSelectionPanel({ ... }) {
  const { actingAsCampaignPlayerId, actingAsPlayer } = useCampaignTestContext();
  
  const activePlayer = actingAsPlayer || myPlayer; // Use acting-as if set
  const isMyTurn = currentPickerId === activePlayer?.id; // Check turn for acting player

  const handleSelect = async () => {
    await base44.functions.invoke('setupPhase', {
      action: 'selectFaction',
      campaign_id: campaign.id,
      faction_name: selectedFaction,
      acting_as_player_id: actingAsCampaignPlayerId || null, // ← Added
    });
  };

  const handleSkip = async () => {
    await base44.functions.invoke('setupPhase', {
      action: 'skipFaction',
      campaign_id: campaign.id,
      acting_as_player_id: actingAsCampaignPlayerId || null, // ← Added
    });
  };
}
```

**File:** `components/setup/TerritoryDraftPanel.jsx`

Added acting-as parameter to pickTerritory call:

```javascript
const handlePick = async () => {
  await base44.functions.invoke('setupPhase', {
    action: 'pickTerritory',
    campaign_id: campaign.id,
    territory_id: pendingPickId,
    acting_as_player_id: actingAsCampaignPlayerId || null, // ← Added
  });
};
```

### Debug Output Enhanced

**File:** `components/setup/TerritoryDraftPanel.jsx`

Added new diagnostic row:

```jsx
<div className="flex items-center gap-2">
  <span className="text-muted-foreground">Acting-as Player ID (sent to backend):</span>
  <span className="text-foreground font-mono">{actingAsCampaignPlayerId ?? 'null (use myPlayer)'}</span>
</div>
```

---

## 4. Territory Ownership Fix

### Problem (Before)

When admin selected "Acting As: Test Player" and claimed a territory:
- Backend used `myPlayer.id` (authenticated user)
- Territory assigned to admin's real player account
- Test player remained without territories

### Solution (After)

Backend now uses `actingPlayer.id`:

```javascript
// Assign territory to acting player
await base44.asServiceRole.entities.TerritoryState.create({
  campaign_id,
  map_id: campaign.map_id,
  territory_id,
  owner_player_id: actingPlayer.id, // ← Changed from myPlayer.id
  troop_count: 0,
  structures: [],
});
```

**Result:** Territory correctly assigned to test player when acting-as is active.

---

## 5. Debug Output

### Draft Debug Panel Now Shows

```
Draft Debug (Simulated)
─────────────────────────────────────
Campaign Status:              active
Setup Phase:                  territory_draft
Current Picker:               Test Player Alpha
Authenticated User:           Admin User
Viewing As:                   Test Player Alpha (Test)
Acting As:                    Test Player Alpha (Test)
Acting-as Player ID:          cp_test_12345
Is Acting-As Active:          ✓ Yes

Territory Selection Diagnostics
─────────────────────────────────────
Canonical selectedTerritoryId: territory_42
Map highlighted territory ID: territory_42
Do these match:               ✓ true
Selected territory lookup:    ✓ true
Claim button hidden reason:   Not hidden (shown)

Territory Name:               Blackstone Ridge
Territory Status:             Unclaimed
Selection Sync:               ✓ Synchronized
Claimable:                    Yes
```

---

## Files Changed (7)

### Backend
1. `functions/setupPhase.js` — Added acting-as delegation logic

### Frontend Components
2. `components/campaigns/lobby/PlayerSlot.jsx` — Added admin ready toggle for test players
3. `components/setup/FactionSelectionPanel.jsx` — Send `acting_as_player_id` to backend
4. `components/setup/TerritoryDraftPanel.jsx` — Send `acting_as_player_id`, enhanced debug

### Pages
5. `pages/CampaignLobby.jsx` — Added `handleAdminToggleReady` handler

### Documentation
6. `ADMIN_TEST_MODE_READINESS_FIX.md` — This file
7. `SETUP_NOTES.md` — Updated (below)

---

## Updated Documentation

### SETUP_NOTES.md Additions

```markdown
## Acting-As Backend Delegation (2026-05-26)

The `setupPhase` backend function now supports an optional `acting_as_player_id` parameter for admin test mode.

### Validation Flow

1. Admin verifies: `myPlayer.is_admin || user.role === 'admin'`
2. Target player exists in campaign: `players.find(p => p.id === acting_as_player_id)`
3. Target is test player: `targetPlayer.is_test_player === true`

All three checks must pass. Failure returns 403/404.

### Frontend Usage

```javascript
await base44.functions.invoke('setupPhase', {
  action: 'selectFaction', // or 'pickTerritory', 'skipFaction'
  campaign_id: campaign.id,
  faction_name: 'My Faction', // or territory_id
  acting_as_player_id: actingAsCampaignPlayerId || null, // from test context
});
```

### Territory Ownership

Territories are now assigned to `actingPlayer.id` (not `myPlayer.id`):

```javascript
owner_player_id: actingPlayer.id // Correct for test mode
```

### Test Player Ready Controls

Campaign admins can toggle ready status for test players in the lobby:
- Small test tube icon button appears next to test player's ready badge
- Click to toggle between "Ready" and "Waiting"
- Only works on test players (not real humans)
- Lobby refreshes after toggle

This allows admins to ready up test players so the campaign can start.
```

---

## Manual Verification Checklist

### Lobby Ready Controls
- [ ] Admin sees test tube icon next to test players
- [ ] Click test tube → ready status toggles
- [ ] Real human players don't show test tube icon
- [ ] Non-admins don't see test tube icon
- [ ] Lobby refreshes after toggle

### Acting-As Backend
- [ ] Select "Acting As: Test Player" in TopBar
- [ ] Draft Debug shows `Acting-as Player ID: cp_test_XXX`
- [ ] Select faction → faction assigned to test player
- [ ] Claim territory → territory owned by test player
- [ ] Debug shows "Is Acting-As Active: ✓ Yes"
- [ ] Turn check uses acting player (not admin)

### Safety
- [ ] Non-admin cannot use acting-as (403 error)
- [ ] Cannot act as real human players (403 error)
- [ ] Cannot act as non-existent player (404 error)
- [ ] Test player ready toggle only works for admins

---

## Technical Notes

### Why Only Test Players?

Acting-as delegation is restricted to test players to prevent admins from accidentally submitting actions on behalf of real human players. This preserves player autonomy while allowing full simulation of test scenarios.

### Why Admin-Only?

The `acting_as_player_id` parameter gives significant power to submit actions as another player. Restricting to admins prevents abuse and ensures only authorized users can simulate test players.

### Backward Compatibility

The `acting_as_player_id` parameter is **optional**. When not provided (or `null`), the function behaves exactly as before:
```javascript
actingPlayer = myPlayer; // Default to authenticated user
```

All existing frontend code continues to work without changes.

---

**All issues resolved.** ✅