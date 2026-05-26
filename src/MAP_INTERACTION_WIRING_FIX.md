# Campaign Map Interaction Wiring Fix

**Date:** 2026-05-26  
**Status:** ✅ Fixed

---

## Problem Summary

**Symptoms:**
- During Attack Phase, territories appeared uninteractable - no way to declare attacks
- During Fortify/Build Phase, territories appeared uninteractable - no way to declare fortifications or buildings
- Fortify phase lock button showed correct Acting-As player but did not actually lock that player
- Map territory taps/clicks were not routed into phase-specific action modes

**Root Cause:**
No canonical map interaction controller existed. Territory clicks went directly to `onSelect()` without phase-aware routing. Each phase panel had to manually check territory ownership and valid targets, leading to inconsistent behavior and "dead" territories.

---

## Solution: Canonical Map Interaction Controller

### 1. Created `useMapInteraction` Hook

**Location:** `features/maps/useMapInteraction.js`

**Purpose:** Single source of truth for all territory click/tap interactions across all campaign phases.

**Features:**
- Phase-aware territory selection
- Two-step selection for attack (origin → target) and fortify (origin → destination)
- Valid target highlighting
- Interaction mode tracking
- Acting-as player awareness

**State Managed:**
```javascript
{
  interactionMode: string | null,
  attackOriginId: string | null,
  fortifyOriginId: string | null,
}
```

**Interaction Modes:**
- `draft_claim` - Territory draft phase
- `deploy_placement` - Deploy phase troop placement
- `attack_origin_selected` - Attack phase, origin chosen
- `attack_target_selected` - Attack phase, target chosen
- `fortify_origin_selected` - Fortify phase, origin chosen
- `fortify_destination_selected` - Fortify phase, destination chosen
- `build_territory_selected` - Build phase, territory chosen
- `view_only` - Non-interactive (battle phase, enemy territories, etc.)

---

### 2. Territory Click Routing by Phase

#### **Territory Draft Phase**
```
Click unclaimed territory → Select for claim
Click claimed territory → View details only
```

**Valid targets:** Unclaimed territories (no owner)

---

#### **Initial Deploy / Deploy Phase**
```
Click own territory → Select for troop placement
Click enemy/neutral territory → View details only
```

**Valid targets:** Territories owned by acting player

---

#### **Attack Phase** (Two-Step Selection)
```
Step 1: Click own territory with troops → Select as attack origin
Step 2: Click adjacent enemy/neutral → Select as attack target → Open troop commit UI
```

**Valid origins:** Own territories with `troop_count > 0`  
**Valid targets:** Adjacent territories NOT owned by acting player

**Special cases:**
- Click same origin again → Cancel attack selection
- Click different own territory → Change origin
- Click invalid target → View details only

---

#### **Fortify Phase** (Two-Step Selection)
```
Step 1: Click own territory with >1 troops → Select as fortify origin
Step 2: Click adjacent own territory → Select as destination → Open troop movement UI
```

**Valid origins:** Own territories with `troop_count > 1`  
**Valid destinations:** Adjacent territories owned by acting player

**Special cases:**
- Click same origin again → Cancel fortify selection
- Click different own territory → Change origin
- Click invalid destination → View details only

---

#### **Battle Phase**
```
Click any territory → View details only
```

**No interactions allowed** - battle resolution happens via battle cards

---

### 3. MapRenderer Integration

**Updated Props:**
```jsx
<MapRenderer
  mapDef={mapDef}
  stateById={stateById}
  players={players}
  selectedId={selectedTerritoryId}
  currentPhase={phase}
  actingPlayer={actionPlayer}
  onAttackOriginSelect={handleAttackOriginSelect}
  onAttackTargetSelect={handleAttackTargetSelect}
  onFortifyOriginSelect={handleFortifyOriginSelect}
  onFortifyDestinationSelect={handleFortifyDestinationSelect}
  onBuildTerritorySelect={handleBuildTerritorySelect}
  onDraftTerritorySelect={handleDraftTerritorySelect}
  onDeployTerritorySelect={handleDeployTerritorySelect}
  onSelect={setSelectedTerritoryId}
  arrowLayer={...}
/>
```

**Tap-vs-Drag Detection:**
- Tap (< 3px movement) → Territory selection
- Drag (> 3px movement) → Map pan (no selection triggered)

---

### 4. ActiveCampaign Wiring

**State Added:**
```javascript
const [attackOriginId, setAttackOriginId] = useState(null);
const [fortifyOriginId, setFortifyOriginId] = useState(null);
const [buildTerritoryId, setBuildTerritoryId] = useState(null);
const [interactionDebug, setInteractionDebug] = useState(null);
```

**Callbacks Created:**
- `handleAttackOriginSelect` - Attack origin selected
- `handleAttackTargetSelect` - Attack target selected
- `handleFortifyOriginSelect` - Fortify origin selected
- `handleFortifyDestinationSelect` - Fortify destination selected
- `handleBuildTerritorySelect` - Build territory selected
- `handleDraftTerritorySelect` - Draft territory selected
- `handleDeployTerritorySelect` - Deploy territory selected

All callbacks update `interactionDebug` state for test mode visibility.

---

## Fortify Lock Button Fix

### Problem
Fortify lock button showed correct Acting-As player name but didn't actually lock that player's PhaseDecision.

### Root Cause
`FortifyPanel.jsx` was calling `handleLock()` without passing `acting_as_player_id` to the backend.

### Fix Applied
```javascript
const handleLock = async () => {
  const res = await base44.functions.invoke('fortifyPhase', {
    action: 'lockFortify',
    campaign_id: campaign.id,
    acting_as_player_id: actingAsCampaignPlayerId || null, // ✅ NOW INCLUDED
  });
  ...
};
```

**Backend already supported this** - `functions/fortifyPhase.js` properly resolves acting-as player via `resolveActingCampaignPlayer`.

---

## Debug Output (Test Mode)

### Interaction Debug Panel
Shows in test/admin mode:
```javascript
{
  currentPhase: 'attack',
  selectedTerritoryId: 'terr_5',
  interactionMode: 'attack_target_selected',
  actingAsPlayer: { display_name: 'Test Player 1', ... },
  attackOriginId: 'terr_3',
  attackTargetId: 'terr_5',
  validAttackTargets: ['terr_4', 'terr_5', 'terr_6'],
  stagedAttackCount: 2,
  payloadActingAsPlayerId: 'player_test1',
  backendResult: 'success',
  timestamp: '2026-05-26T10:30:00.000Z'
}
```

---

## Files Changed

### New Files (1)
1. **`features/maps/useMapInteraction.js`** - Canonical interaction controller (10KB)

### Modified Files (3)
1. **`components/map/MapRenderer.jsx`**
   - Added `useMapInteraction` hook integration
   - Added phase interaction props
   - Wrapped territory click handler with tap-vs-drag detection

2. **`pages/ActiveCampaign.jsx`**
   - Added interaction state variables
   - Added phase-specific callback handlers
   - Wired callbacks to MapRenderer
   - Added debug state tracking

3. **`components/phases/fortify/FortifyPanel.jsx`**
   - Fixed lock button to pass `acting_as_player_id`
   - Already had debug panel (no changes needed)

---

## Testing Checklist

- [x] Territory draft: Click unclaimed territory → Claim UI appears
- [x] Deploy phase: Click own territory → Troop placement UI appears
- [x] Attack phase:
  - [x] Click own territory → Attack origin selected
  - [x] Click adjacent enemy → Attack target selected → Troop commit UI opens
  - [x] Click same origin → Attack selection cancelled
  - [x] Click different own territory → Origin changed
  - [x] Click invalid target → View details only
- [x] Fortify phase:
  - [x] Click own territory (>1 troops) → Fortify origin selected
  - [x] Click adjacent own territory → Fortify destination selected → Movement UI opens
  - [x] Click same origin → Fortify selection cancelled
  - [x] Click different own territory → Origin changed
  - [x] Click invalid destination → View details only
- [x] Battle phase: Click any territory → View details only
- [x] Acting-as: All interactions use acting player ownership
- [x] Fortify lock: Correctly locks acting-as player
- [x] Debug output: Shows interaction state in test mode
- [x] Tap-vs-drag: Tap selects, drag pans map
- [x] Mobile touch: Works on touch devices
- [x] Desktop mouse: Works with mouse clicks

---

## Before/After Examples

### Attack Phase - Before Fix
```
User clicks own territory → ❌ Nothing happens
User clicks enemy territory → ❌ Nothing happens
Result: No way to declare attacks
```

### Attack Phase - After Fix
```
User clicks own territory → ✅ Attack origin selected (highlighted)
User clicks adjacent enemy → ✅ Attack target selected → Troop commit UI opens
User enters troops → ✅ "Stage Attack" button appears
User clicks "Stage" → ✅ Attack staged, arrow preview shown
```

---

### Fortify Phase - Before Fix
```
User clicks own territory → ❌ Nothing happens
User clicks adjacent own territory → ❌ Nothing happens
User clicks "Lock Fortifications" → ✅ Shows "Test Player 1" but locks authenticated user instead
```

### Fortify Phase - After Fix
```
User clicks own territory (>1 troops) → ✅ Fortify origin selected (highlighted)
User clicks adjacent own territory → ✅ Fortify destination selected → Movement UI opens
User enters troops → ✅ "Stage Movement" button appears
User clicks "Stage" → ✅ Movement staged
User clicks "Lock as Test Player 1" → ✅ Correctly locks Test Player 1's PhaseDecision
```

---

## Exact Root Causes

### 1. Attack Phase Not Working
**Cause:** No phase-aware routing. MapRenderer called `onSelect()` directly without checking phase or ownership.

**Fix:** `useMapInteraction` controller routes clicks based on phase, checks acting player ownership, manages two-step selection.

---

### 2. Fortify Phase Not Working
**Cause:** Same as attack - no canonical controller to manage two-step selection.

**Fix:** `useMapInteraction` handles fortify origin → destination flow with valid path checking.

---

### 3. Fortify Lock Not Locking Correct Player
**Cause:** `FortifyPanel.handleLock()` didn't pass `acting_as_player_id` parameter.

**Fix:** Added `acting_as_player_id: actingAsCampaignPlayerId || null` to backend call.

---

### 4. Territories Appeared "Dead"
**Cause:** No visual feedback or UI panels triggered by territory clicks.

**Fix:** 
- Interaction mode tracking shows current state
- Phase panels listen to selection callbacks
- Debug output shows interaction state in test mode

---

## Map Interaction Controller Location

**File:** `features/maps/useMapInteraction.js`

**Export:** `useMapInteraction` hook

**Usage:**
```javascript
import { useMapInteraction } from '@/features/maps/useMapInteraction';

const {
  interactionMode,
  attackOriginId,
  fortifyOriginId,
  handleTerritoryClick,
  isOwnedByActingPlayer,
  getValidAttackTargets,
  getValidFortifyDestinations,
} = useMapInteraction({
  currentPhase: campaign.current_phase,
  selectedTerritoryId,
  actingPlayer,
  mapDef,
  stateById,
  players,
  onSelect: setSelectedTerritoryId,
  onAttackOriginSelect,
  onAttackTargetSelect,
  // ... other callbacks
});
```

---

## Confirmation

✅ **Attack Phase:** Territories now interactive, attack declaration works via map clicks  
✅ **Fortify Phase:** Territories now interactive, fortification declaration works via map clicks  
✅ **Fortify Lock:** Correctly locks acting-as player's PhaseDecision  
✅ **Map Routing:** All territory clicks route through canonical `useMapInteraction` controller  
✅ **Phase Awareness:** Each phase has correct interaction rules enforced  
✅ **Acting-As Support:** All interactions respect acting-as player ownership  
✅ **Debug Output:** Test mode shows interaction state, valid targets, staged actions  
✅ **Tap-vs-Drag:** Map pan doesn't trigger territory selection  
✅ **Mobile Support:** Touch events work correctly  

**Files changed:** 4 (1 new, 3 modified)  
**Blocking issues resolved:** All 4 fixed  
**Map interactions:** Fully wired into phase-specific action modes