# Deploy Phase Lock In Acting-As Bug Fix

**Date:** 2026-05-26  
**Status:** ✅ Fixed

---

## Bug Summary

**Symptom:** When "Acting As: Test Player" is selected, clicking "Lock In" still locks/submits the authenticated user's deployment instead of the selected Acting-As test player.

**Root Cause:** The `useDeployPhase` hook's `reload()` function was fetching PhaseDecision records for `myPlayer.id` instead of `actingPlayer.id`, and the lock status subscription was also listening to the wrong player.

---

## Files Changed

### 1. `features/campaigns/deploy/useDeployPhase.js`

**Bug 1 - reload() fetching wrong player:**
```diff
- const [decisionRows, incomeRows] = await Promise.all([
-   base44.entities.PhaseDecision.filter({
-     campaign_id: campaign.id,
-     player_id:   myPlayer.id,  // ❌ WRONG
-     phase:       'deploy',
-     round,
-   }),
-   base44.entities.DeployIncome.filter({
-     campaign_id: campaign.id,
-     player_id:   myPlayer.id,  // ❌ WRONG
-     round,
-   }),
- ]);

+ const [decisionRows, incomeRows] = await Promise.all([
+   base44.entities.PhaseDecision.filter({
+     campaign_id: campaign.id,
+     player_id:   actingPlayer.id,  // ✅ CORRECT
+     phase:       'deploy',
+     round,
+   }),
+   base44.entities.DeployIncome.filter({
+     campaign_id: campaign.id,
+     player_id:   actingPlayer.id,  // ✅ CORRECT
+     round,
+   }),
+ ]);
```

**Bug 2 - Subscription listening to wrong player:**
```diff
- useEffect(() => {
-   if (!campaign?.id || !myPlayer?.id) return;
-   const unsub = base44.entities.PhaseDecision.subscribe((event) => {
-     if (event.data?.campaign_id !== campaign.id) return;
-     if (event.data?.player_id   !== myPlayer.id) return;  // ❌ WRONG
-     if (event.data?.phase       !== 'deploy') return;
-     reload();
-   });
-   return unsub;
- }, [campaign?.id, myPlayer?.id, reload]);

+ useEffect(() => {
+   if (!campaign?.id || !actingPlayer?.id) return;
+   const unsub = base44.entities.PhaseDecision.subscribe((event) => {
+     if (event.data?.campaign_id !== campaign.id) return;
+     if (event.data?.player_id   !== actingPlayer.id) return;  // ✅ CORRECT
+     if (event.data?.phase       !== 'deploy') return;
+     reload();
+   });
+   return unsub;
+ }, [campaign?.id, actingPlayer?.id, reload]);
```

**Dependency fix:**
```diff
- }, [campaign?.id, myPlayer?.id, round, myTerritories]);
+ }, [campaign?.id, myPlayer?.id, actingPlayer?.id, round, myTerritories]);
```

---

### 2. `components/phases/deploy/DeployPanel.jsx`

**Added debug output:**
- Imported `useActingAsPayload` hook
- Added debug state capture before lock
- Shows: authenticated user/player, acting-as player, payload, decision player
- Button label now explicit: "Lock as [Player Name]"
- Added acting-as indicator badge

**Debug info captured:**
```javascript
const payload = getPayload();
setDebugInfo({
  authenticatedUserId: myPlayer?.user_id,
  authenticatedPlayerId: myPlayer?.id,
  authenticatedPlayerName: myPlayer?.display_name,
  actingAsPlayerId: actingAsId,
  actingAsPlayerName: actingPlayer?.display_name,
  payloadActingAsPlayerId: payload.acting_as_player_id,
  decisionPlayerId: decision?.player_id,
  timestamp: new Date().toISOString(),
});
```

**Button label updated:**
```diff
- Lock In
+ Lock as {actingPlayer?.display_name || 'Player'}
```

**Lock call passes acting-as explicitly:**
```diff
- await handleLock(onPhaseChanged);

+ const payload = getPayload();
+ setDebugInfo({...});
+ await handleLock(onPhaseChanged, actingAsId);
```

---

## Backend Status

The backend (`functions/deployPhase.js`) already had correct acting-as support:

✅ `resolveActingCampaignPlayer()` validates acting-as delegation  
✅ All actions use `actingPlayer.id` for queries/updates  
✅ Logs use `actingPlayer.id`  

**No backend changes needed.**

---

## Before/After Examples

### Before Fix

**User selects:** "Acting As: Test Player 1"  
**Clicks:** "Lock In"  
**Payload sent:**
```json
{
  "action": "lockDeploy",
  "campaign_id": "camp_123",
  "acting_as_player_id": "player_test1"
}
```

**Backend resolves:** `actingPlayer = Test Player 1` ✅  
**Backend queries:**
```javascript
// ❌ Hook loaded decision for WRONG player
decision = PhaseDecision.filter({ player_id: "myPlayer_id" })
```

**Result:** Authenticated user's decision locked, not Test Player 1's.

---

### After Fix

**User selects:** "Acting As: Test Player 1"  
**Clicks:** "Lock as Test Player 1"  
**Payload sent:**
```json
{
  "action": "lockDeploy",
  "campaign_id": "camp_123",
  "acting_as_player_id": "player_test1"
}
```

**Backend resolves:** `actingPlayer = Test Player 1` ✅  
**Backend queries:**
```javascript
// ✅ Hook loads decision for CORRECT player
decision = PhaseDecision.filter({ player_id: "player_test1" })
```

**Result:** Test Player 1's decision locked correctly. ✅

---

## Debug Output Example

After clicking "Lock as Test Player 1", debug panel shows:

```
Lock Debug Info
Auth User:      user_abc123
Auth Player:    Admin User (player_admin)
Acting-As:      Test Player 1 (player_test1)
Payload:        player_test1
Decision Player: player_test1
Submit For:     Test Player 1
```

---

## Testing Checklist

- [x] Acting as self → reloads own decision, locks own deployment
- [x] Acting as Test Player 1 → reloads TP1's decision, locks TP1's deployment
- [x] Switch acting-as → button label updates, debug shows correct player
- [x] Lock status list shows acting player as locked
- [x] Debug panel shows matching Acting-As and Submit For
- [x] Backend logs show actingPlayer.id

---

## Exact Bug Root Cause

**The `useDeployPhase` hook's `reload()` function was hardcoded to fetch PhaseDecision records for `myPlayer.id` (the authenticated user), completely ignoring the `actingPlayer` from `useActingAsPayload`.**

This meant:
1. UI showed placements for authenticated user, not acting-as player
2. Lock action submitted for authenticated user's decision record
3. Lock status showed authenticated user as locked, not acting-as player

The backend was correct — it properly resolved `acting_as_player_id` and used `actingPlayer.id` for all operations. The bug was entirely in the frontend hook loading the wrong player's data.

---

## Confirmation

**Acting As Test Player now locks Test Player's deployment, NOT authenticated user.** ✅

**Files changed:** 2  
- `features/campaigns/deploy/useDeployPhase.js` (hook logic fix)
- `components/phases/deploy/DeployPanel.jsx` (debug output + button label)