# Admin Advance Phase Control

**Date:** 2026-05-26  
**Status:** ✅ Implemented

---

## Problem Summary

**Symptom:** All players were locked for Fortify/Build phase, but campaign admin had no visible way to end/advance the phase.

**Root Cause:** No dedicated "Advance Phase" button existed that called the proper phase processor backend functions. The existing `forcePhaseAdvance` function only updated `campaign.current_phase` without applying phase-specific logic (movements, construction, battle generation, etc.).

---

## Solution: AdminAdvancePhase Component

### 1. Created `AdminAdvancePhase` Component

**Location:** `components/admin/AdminAdvancePhase.jsx`

**Purpose:** Admin-only control to properly advance campaign phase by calling phase-specific backend processors.

---

### 2. Visibility Conditions

Button appears when ALL of the following are true:

```javascript
if (!isAdmin) return null;                    // Must be admin
if (isArchived) return null;                  // Campaign not archived
if (!allPlayersLocked) return null;           // All players locked
if (currentPhaseIndex < 0) return null;       // Valid phase
if (!processorFunction) return disabled;      // Processor exists
```

**Requirements:**
1. ✅ Current user is campaign admin (`campaign.admin_user_id === user.id`) OR platform admin (`user.role === 'admin'`)
2. ✅ Campaign is NOT archived (`campaign.status !== 'archived'`)
3. ✅ All active players are locked for current phase
4. ✅ Campaign is in a valid phase that can be advanced
5. ✅ Phase processor backend function exists

---

### 3. Button Location

**Primary Location:** Phase Controls panel in:
- Admin Test Mode page (`/campaigns/:id/admin`)
- Left dock of active campaign (via PhaseControls component)

**Future Enhancement:** Could be added to TopBar admin controls for quick access during active phases.

---

### 4. Phase-Specific Button Labels

| Phase | Button Label | Backend Processor |
|-------|--------------|-------------------|
| `faction_selection` | "Start Territory Draft" | `setupPhase.processPhaseEnd` |
| `territory_draft` | "Start Initial Deploy" | `setupPhase.processPhaseEnd` |
| `initial_deploy` | "Reveal Deployments" | `initialDeploy.processPhaseEnd` |
| `deploy` | "Reveal Deployments" | `deployPhase.processPhaseEnd` |
| `attack` | "Reveal Attacks" | `attackPhase.processPhaseEnd` |
| `battle` | "Resolve Battle Phase" | `battlePhase.processPhaseEnd` |
| `fortify` | "End Fortify Phase / Start Next Round" | `fortifyPhase.processPhaseEnd` |

---

### 5. Backend Phase Processors

**Function Call Pattern:**
```javascript
await base44.functions.invoke(processorFunction, {
  action: 'processPhaseEnd',
  campaign_id: campaign.id,
});
```

**What Each Processor Does:**

#### Fortify Phase (`fortifyPhase.processPhaseEnd`)
1. ✅ Validate all players locked (auto-submit missing)
2. ✅ Apply all troop movements (update TerritoryState)
3. ✅ Process staged construction choices
4. ✅ Validate and deduct resource costs
5. ✅ Create/update ConstructionProject records
6. ✅ Complete finished constructions (add structures to territories)
7. ✅ Generate phase snapshot (PhaseSnapshot entity)
8. ✅ Generate public movement/construction logs
9. ✅ Advance to next round's deploy phase
10. ✅ Update `campaign.current_round` and `campaign.current_phase`

#### Attack Phase (`attackPhase.processPhaseEnd`)
1. ✅ Validate all players locked
2. ✅ Create AttackReveal records (public)
3. ✅ Generate BattleCard entities
4. ✅ Handle bloodbath deduplication
5. ✅ Mark abandoned territories (vacated)
6. ✅ Advance to battle phase

#### Deploy Phase (`deployPhase.processPhaseEnd`)
1. ✅ Validate all players locked
2. ✅ Reveal troop placements
3. ✅ Apply resource generation
4. ✅ Update TerritoryState troop counts
5. ✅ Generate DeployIncome records
6. ✅ Advance to attack phase

---

### 6. Duplicate Processing Prevention

**Backend Check (Authoritative):**
```javascript
// fortifyPhase.js - processPhaseEnd action
const existingSnapshot = await base44.asServiceRole.entities.PhaseSnapshot.filter({
  campaign_id,
  round,
  phase: 'fortify',
  snapshot_type: 'phase_end',
});
if (existingSnapshot.length > 0) {
  return Response.json({ 
    error: 'Fortify phase already processed for this round',
    already_processed: true,
  }, { status: 400 });
}
```

**Client-Side Check (UX Only):**
- Button disabled if processor returns `already_processed: true`
- Toast message: "Phase already processed."

**All Phase Processors Have This Guard:**
- `fortifyPhase` - checks PhaseSnapshot
- `attackPhase` - checks AttackReveal records
- `deployPhase` - checks DeployIncome records
- `battlePhase` - checks BattleCard resolved status

---

### 7. Error Handling

**Missing Processor:**
```javascript
if (!processorFunction) {
  toast.error('Phase processor missing: cannot safely advance.');
  return;
}
```

**Backend Error:**
```javascript
if (res.data.error) {
  if (res.data.already_processed) {
    toast.info('Phase already processed.');
  } else {
    toast.error(res.data.error);
  }
  return;
}
```

**Network Error:**
```javascript
catch (err) {
  const errorMsg = err.response?.data?.error || err.message || 'Failed to advance phase';
  toast.error(errorMsg);
}
```

---

### 8. Debug/Admin Info Panel

**Shows:**
```javascript
<div className="debug-info">
  Admin: ✓ Yes / ✗ No
  All Locked: ✓ Yes / ✗ No
  Can Advance: ✓ Yes / ✗ No
  Processor: fortifyPhase / MISSING
  
  Lock Status (per player):
  - Player 1: ✓ Locked / ⊙ Pending
  - Player 2: ✓ Locked / ⊙ Pending
  - ...
</div>
```

**Location:** Below advance button in PhaseControls panel

**Updates:** Real-time via `allLockStatus` prop

---

## All-Locked Status Calculation

**Location:** `AdminAdvancePhase.jsx`

```javascript
const allPlayersLocked = useMemo(() => {
  if (!players || players.length === 0) return false;
  
  const activePlayers = players.filter(p => !p.is_eliminated);
  if (activePlayers.length === 0) return false;
  
  // Check if all active players are locked
  const lockedCount = allLockStatus.filter(l => l.is_locked).length;
  return lockedCount >= activePlayers.length;
}, [players, allLockStatus]);
```

**Data Source:** `allLockStatus` prop from phase-specific lock status hook:
- Fortify: `useFortifyLockStatus` → `getFortifyLockStatus` backend
- Attack: `useAttackLockStatus` → `getAttackLockStatus` backend
- Deploy: `useDeployPhaseLockStatus` → `getDeployLockStatus` backend

**What It Checks:**
- Only active (non-eliminated) players count
- Each player must have `PhaseDecision.is_locked === true`
- Auto-submitted players count as locked

---

## Fortify/Build Phase Advance Flow

### Step-by-Step Process

**1. Admin Clicks "End Fortify Phase / Start Next Round"**

**2. Confirmation Dialog Shows:**
```
This will end the fortify phase and advance to deploy.

✓ Phase Processor Available
Calling backend function: fortifyPhase.processPhaseEnd

- Apply all troop movements
- Process construction projects
- Deduct resource costs
- Generate phase snapshot
- Advance to Round X+1 Deploy
```

**3. Backend Processing (`fortifyPhase.processPhaseEnd`):**

**Step A: Auto-Submit Missing Players**
```javascript
for (const p of activePlayers) {
  const dec = allDecisions.find(d => d.player_id === p.id);
  if (!dec || !dec.is_locked) {
    // Create/update locked decision
    await base44.asServiceRole.entities.PhaseDecision.update/create(...)
  }
}
```

**Step B: Apply Troop Movements**
```javascript
const troopChanges = {}; // territory_id -> net change

for (const dec of finalDecisions) {
  const movements = dec.data?.movements ?? [];
  for (const mov of movements) {
    troopChanges[mov.origin_territory_id] -= mov.committed_troops;
    troopChanges[mov.destination_territory_id] += mov.committed_troops;
  }
}

// Apply changes to TerritoryState
for (const [tid, change] of Object.entries(troopChanges)) {
  await base44.asServiceRole.entities.TerritoryState.update(tid, {
    troop_count: Math.max(0, existing + change),
  });
}
```

**Step C: Process Construction**
```javascript
for (const dec of finalDecisions) {
  const construction = dec.data?.construction;
  if (!construction) continue;
  
  // Validate resources
  const canAfford = checkResources(income, structure_cost);
  if (!canAfford) {
    log('construction_failed', 'insufficient_resources');
    continue;
  }
  
  // Deduct resources
  await updateDeployIncome(player_id, deducted_resources);
  
  // Create ConstructionProject
  await createConstructionProject({...});
}
```

**Step D: Complete Constructions**
```javascript
for (const project of allProjects) {
  const newRoundsCompleted = project.rounds_completed + 1;
  const isComplete = newRoundsCompleted >= project.rounds_required;
  
  if (isComplete) {
    // Add structure to territory
    await addStructureToTerritory(project.territory_id, project.structure_type);
    await updateProject(project.id, { status: 'completed' });
  } else {
    await updateProject(project.id, { rounds_completed: newRoundsCompleted });
  }
}
```

**Step E: Generate Snapshot**
```javascript
await base44.asServiceRole.entities.PhaseSnapshot.create({
  campaign_id,
  round,
  phase: 'fortify',
  snapshot_type: 'phase_end',
  territory_states: [...],
  player_standings: [...],
});
```

**Step F: Advance Phase**
```javascript
await base44.asServiceRole.entities.Campaign.update(campaign_id, {
  current_round: round + 1,
  current_phase: 'deploy',
});
```

**4. Success Response:**
```javascript
return Response.json({
  success: true,
  next_phase: 'deploy',
  next_round: round + 1,
  movements_applied: count,
});
```

**5. Frontend Updates:**
- Toast: "Phase advanced to deploy"
- Campaign reloads with new phase
- Lock status resets for new phase
- Phase panel switches to Deploy controls

---

## Files Changed

### New Files (1)
1. **`components/admin/AdminAdvancePhase.jsx`** — Admin advance phase control component (13KB)

### Modified Files (2)
1. **`components/admin/PhaseControls.jsx`**
   - Added `AdminAdvancePhase` component integration
   - Added `players`, `myPlayer`, `allLockStatus` props
   - Reorganized layout (admin controls above manual controls)

2. **`pages/AdminTestMode.jsx`**
   - Added `useFortifyLockStatus` hook
   - Added `myPlayer` state loading
   - Passed lock status and player props to PhaseControls

---

## Testing Checklist

- [x] Button appears for campaign admin
- [x] Button appears for platform admin
- [x] Button hidden for regular players
- [x] Button hidden when campaign archived
- [x] Button hidden when not all players locked
- [x] Button disabled when processor missing
- [x] Correct phase-specific label shown
- [x] Debug info shows correct admin status
- [x] Debug info shows correct lock status
- [x] Debug info shows all player lock states
- [x] Confirmation dialog shows correct next phase
- [x] Confirmation dialog lists phase actions
- [x] Backend processor called correctly
- [x] Duplicate processing prevented
- [x] Error handling works (missing processor, network errors)
- [x] Success toast shown
- [x] Campaign state updates after advance
- [x] Fortify phase applies movements correctly
- [x] Fortify phase processes construction correctly
- [x] Fortify phase advances to next round deploy

---

## Before/After Examples

### Before Fix
```
All players locked for Fortify Phase → ❌ No button visible
Admin manually updates campaign.current_phase → ❌ Movements not applied
Result: Campaign stuck, no way to advance properly
```

### After Fix
```
All players locked for Fortify Phase → ✅ "End Fortify Phase / Start Next Round" button appears
Admin clicks button → ✅ Confirmation dialog shows actions
Admin confirms → ✅ fortifyPhase.processPhaseEnd called
Backend applies movements, construction, advances round → ✅ Success toast
Campaign now in Round X+1 Deploy phase → ✅ Ready for next round
```

---

## Exact Root Cause

**Why Button Didn't Exist:**
- No frontend component called phase processors
- Only `forcePhaseAdvance` existed (unsafe, just updates phase)
- Lock status hooks existed but weren't connected to advance control
- Admin Test Mode had manual controls but not proper phase-end processing

**Why Fortify Lock Didn't Work:**
- Already fixed in previous commit (added `acting_as_player_id` to lock call)

---

## Confirmation

✅ **Admin Advance button appears** when all players locked  
✅ **Phase-specific labels** for each phase  
✅ **Backend processors called** (not just updating current_phase)  
✅ **Fortify phase advances correctly** (movements, construction, next round)  
✅ **Duplicate processing prevented** (backend guard + client-side check)  
✅ **Error handling** (missing processor, network errors, already processed)  
✅ **Debug info shows** admin status, lock status, processor name  
✅ **All-locked calculation** uses active players only  

**Files changed:** 3 (1 new, 2 modified)  
**Admin advance control:** Fully functional  
**Fortify phase advancement:** Properly wired to backend processor