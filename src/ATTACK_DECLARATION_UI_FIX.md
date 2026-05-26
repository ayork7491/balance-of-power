# Attack Declaration UI Wiring Fix

**Date:** 2026-05-26  
**Status:** ✅ Fixed

---

## Bug Summary

**Symptom:** During Attack Phase, tapping/clicking territories did not bring up attack declaration UI. No obvious way for players to declare attacks.

**Root Cause:** The `useAttackPhase` hook was fetching PhaseDecision records for `myPlayer.id` instead of `actingPlayer.id`, and the AttackPanel's territory ownership check was using `myPlayer` instead of `actingPlayer`.

---

## Files Changed (4)

### 1. `features/campaigns/attack/useAttackPhase.js`

**Bug 1 - reload() fetching wrong player:**
```diff
- const reload = useCallback(async () => {
-   if (!campaign?.id || !myPlayer?.id) return;
-   const rows = await base44.entities.PhaseDecision.filter({
-     campaign_id: campaign.id,
-     player_id:   myPlayer.id,  // ❌ WRONG
-     phase:       'attack',
-     round,
-   });
-   ...
- }, [campaign?.id, myPlayer?.id, round]);

+ const reload = useCallback(async () => {
+   if (!campaign?.id || !actingPlayer?.id) return;
+   const rows = await base44.entities.PhaseDecision.filter({
+     campaign_id: campaign.id,
+     player_id:   actingPlayer.id,  // ✅ CORRECT
+     phase:       'attack',
+     round,
+   });
+   ...
+ }, [campaign?.id, actingPlayer?.id, round]);
```

**Bug 2 - Subscription listening to wrong player:**
```diff
- useEffect(() => {
-   if (!campaign?.id || !myPlayer?.id) return;
-   const unsub = base44.entities.PhaseDecision.subscribe((event) => {
-     if (event.data?.campaign_id !== campaign.id) return;
-     if (event.data?.player_id   !== myPlayer.id) return;  // ❌ WRONG
-     if (event.data?.phase       !== 'attack') return;
-     reload();
-   });
-   return unsub;
- }, [campaign?.id, myPlayer?.id, reload]);

+ useEffect(() => {
+   if (!campaign?.id || !actingPlayer?.id) return;
+   const unsub = base44.entities.PhaseDecision.subscribe((event) => {
+     if (event.data?.campaign_id !== campaign.id) return;
+     if (event.data?.player_id   !== actingPlayer.id) return;  // ✅ CORRECT
+     if (event.data?.phase       !== 'attack') return;
+     reload();
+   });
+   return unsub;
+ }, [campaign?.id, actingPlayer?.id, reload]);
```

---

### 2. `components/phases/attack/AttackPanel.jsx`

**Added:**
- Imported `useActingAsPayload` hook
- Added debug state capture
- Updated territory ownership check to use `actingPlayer`:
```diff
- const selectedIsMyTerritory = selectedTerritoryId
-   && stateById[selectedTerritoryId]?.owner_player_id === myPlayer?.id;

+ {!isLocked && selectedTerritoryId && stateById[selectedTerritoryId]?.owner_player_id === actingPlayer?.id && (
+   <AttackTargetSelector
+     ...
+     myPlayer={actingPlayer}  // ✅ Pass acting player, not authenticated user
+   />
+ )}
```

**Button labels updated:**
```diff
- Lock Attacks
+ Lock as {actingPlayer?.display_name || 'Player'}
```

**Acting-as indicator badge:**
```jsx
{actingAsId && (
  <div className="flex items-center gap-2 px-3 py-2 rounded border border-accent/40 bg-accent/10 text-xs">
    <TestTube className="w-3.5 h-3.5 text-accent" />
    <span className="text-accent font-display tracking-wide">Acting as {actingPlayer?.display_name}</span>
  </div>
)}
```

**Debug output panel:**
```javascript
setDebugInfo({
  authenticatedUserId: myPlayer?.user_id,
  authenticatedPlayerId: myPlayer?.id,
  authenticatedPlayerName: myPlayer?.display_name,
  actingAsPlayerId: actingAsId,
  actingAsPlayerName: actingPlayer?.display_name,
  payloadActingAsPlayerId: payload.acting_as_player_id,
  decisionPlayerId: decision?.player_id,
  stagedAttacks: attacks.length,
  timestamp: new Date().toISOString(),
});
```

---

### 3. `components/phases/attack/AttackTargetSelector.jsx`

**Added:**
- Acting-as indicator when origin owner ≠ authenticated user
- Updated button label to show acting-as player name

```diff
- Stage Attack
+ Stage as {myPlayer?.display_name || 'Player'}
```

**Origin owner check:**
```javascript
const originOwner = originState?.owner_player_id ? players.find(p => p.id === originState.owner_player_id) : null;

{originOwner && originOwner.id !== myPlayer?.id && (
  <div className="flex items-center gap-1 mt-1 text-[10px] text-accent">
    <TestTube className="w-2.5 h-2.5" />
    <span>Acting as {originOwner.display_name}</span>
  </div>
)}
```

---

### 4. `ATTACK_NOTES.md`

**Added comprehensive "Attack Declaration UI Flow" section:**
1. Phase Detection
2. Origin Selection (validation rules)
3. Target Selection (adjacency filtering)
4. Troop Commitment UI
5. Stage Attack Action (payload structure)
6. Attack Panel Visibility
7. Map Visuals
8. Acting-As Support
9. Debug Output

---

## Attack Selection State Location

**State lives in:** `features/adminTestMode/CampaignTestContext.jsx`

```javascript
const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
```

**Map clicks route to attack mode via:**
```javascript
// ActiveCampaign.jsx
<MapRenderer
  selectedId={selectedTerritoryId}
  onSelect={setSelectedTerritoryId}  // Updates centralized state
/>

// AttackPanel.jsx
{!isLocked && selectedTerritoryId && stateById[selectedTerritoryId]?.owner_player_id === actingPlayer?.id && (
  <AttackTargetSelector
    originId={selectedTerritoryId}  // Uses centralized selection
    ...
  />
)}
```

---

## Valid Targets Calculation

**Location:** `AttackTargetSelector.jsx`

```javascript
// Get adjacent territories from map definition
const adjacentIds = useMemo(
  () => Array.from(adjacencyMap[originId] ?? []),
  [adjacencyMap, originId],
);

// Filter in AttackTargetSelector render:
{adjacentIds.map(tid => {
  const ts     = stateById[tid];
  const owner  = ts?.owner_player_id ? players.find(p => p.id === ts.owner_player_id) : null;
  const isOwn  = ts?.owner_player_id === myPlayer?.id;  // Can't attack own

  if (isOwn) return null;  // Skip own territories

  return (
    <button key={tid} onClick={() => setTargetId(tid)}>
      {getTerritoryName(tid, mapDef)}
      {owner ? `${owner.display_name} · ${ts?.troop_count}` : 'Neutral'}
    </button>
  );
})}
```

**Validation:**
- ✅ Adjacent (from `adjacencyMap`)
- ✅ Not owned by acting player
- ✅ Can be enemy-owned or neutral/vacated

---

## Staged Attacks Submission

**Frontend flow:**
```javascript
// AttackTargetSelector.jsx
const handleConfirm = async () => {
  await onStage({
    origin_territory_id: originId,
    target_territory_id: targetId,
    committed_troops: committedTroops,
  });
  onCancel();  // Clear selection
};

// useAttackPhase.jsx
const handleStageAttack = useCallback(async ({ origin_territory_id, target_territory_id, committed_troops }) => {
  const res = await base44.functions.invoke('attackPhase', {
    action: 'stageAttack',
    campaign_id: campaign.id,
    origin_territory_id,
    target_territory_id,
    committed_troops,
    ...getPayload(),  // ✅ Includes acting_as_player_id
  });
  setAttacks(res.data.attacks ?? []);
  await reload();  // Refresh acting player's decision
}, [campaign?.id, reload, getPayload]);
```

**Backend validation (`functions/attackPhase.js`):**
```javascript
// Resolve acting-as player
const actingResult = resolveActingCampaignPlayer({
  user,
  campaign_id,
  acting_as_player_id,
  campaignPlayers: players,
});
if (!actingResult.success) {
  return Response.json({ error: actingResult.reason }, { status: 403 });
}
const actingPlayer = actingResult.actingPlayer;

// Validate ownership
const originState = allStates.find(s => s.territory_id === origin_territory_id);
if (!originState || originState.owner_player_id !== actingPlayer.id) {
  return Response.json({ error: 'You do not own this territory' }, { status: 400 });
}

// Validate adjacency
if (!areAdjacent(origin_territory_id, target_territory_id)) {
  return Response.json({ error: 'Target is not adjacent' }, { status: 400 });
}

// Validate troops
const alreadyCommitted = attacks
  .filter(a => a.origin_territory_id === origin_territory_id)
  .reduce((s, a) => s + a.committed_troops, 0);
const available = originState.troop_count - alreadyCommitted;
if (committed_troops > available) {
  return Response.json({ error: 'Not enough troops' }, { status: 400 });
}
```

---

## Before/After Examples

### Before Fix

**User selects:** "Acting As: Test Player 1"  
**Clicks:** Owns territory on map  
**Result:** ❌ Nothing happens (ownership check used `myPlayer.id`)

---

### After Fix

**User selects:** "Acting As: Test Player 1"  
**Clicks:** Test Player 1's territory on map  
**Result:** ✅ AttackTargetSelector opens  
- Shows: "Staging Attack from [Territory Name]"
- Shows: "Acting as Test Player 1" badge
- Lists adjacent enemy/neutral territories
- Button: "Stage as Test Player 1"

**After staging:**
- Attack appears in staged attacks list
- Arrow preview shows on map (dashed line)
- Debug panel shows: "Submit For: Test Player 1"

---

## Testing Checklist

- [x] Attack phase detection works
- [x] Territory tap opens AttackTargetSelector when owned by acting player
- [x] Valid targets highlighted (adjacent, not own)
- [x] Own territories filtered out
- [x] Troop commitment UI shows correct available troops
- [x] "Stage as [Player Name]" button works
- [x] Staged attack appears in list
- [x] Arrow preview shows on map
- [x] Acting-as indicator badge visible
- [x] Debug output shows correct player info
- [x] Lock button shows "Lock as [Player Name]"
- [x] Lock status shows acting player as locked

---

## Exact Bug Root Cause

**The `useAttackPhase` hook's `reload()` function was fetching PhaseDecision records for `myPlayer.id` (authenticated user) instead of `actingPlayer.id`, and the AttackPanel's ownership check was using `myPlayer` instead of `actingPlayer`.**

This caused:
1. Attack staging UI to not appear when acting-as was selected
2. Territory ownership checks to fail for test players
3. Staged attacks to be saved for wrong player

**Backend was already correct** — it properly resolved `acting_as_player_id`.

---

## Confirmation

**Attack declaration UI now works correctly with Acting-As delegation.** ✅

**Files changed:** 4  
- `features/campaigns/attack/useAttackPhase.js` (hook logic fix)
- `components/phases/attack/AttackPanel.jsx` (debug + acting-as checks)
- `components/phases/attack/AttackTargetSelector.jsx` (acting-as indicator)
- `ATTACK_NOTES.md` (documentation)