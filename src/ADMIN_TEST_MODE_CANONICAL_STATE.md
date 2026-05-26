/**
 * Admin Test Mode: Centralized Acting-As State
 * 
 * This document describes the canonical acting-as state management system.
 */

## Overview

Admin Test Mode now uses a **single canonical context** (`CampaignTestContext`) to manage viewing-as and acting-as state across all campaign components.

**Problem Solved:**
- Before: Acting As state was duplicated in TopBar, ActiveCampaign, and TerritoryDraftPanel
- Result: Top bar showed "Test Player 1" but draft panel showed "Balphor" (authenticated user)
- Now: One source of truth, all components read from same context

---

## 1. Canonical State Location

**File:** `features/adminTestMode/CampaignTestContext.jsx`

**Provider:** `CampaignTestModeProvider`
- Wraps campaign screens (ActiveCampaign, CampaignLobby)
- Manages state for viewing-as and acting-as
- Provides setters and computed values

**State Variables:**
```javascript
{
  viewingAsCampaignPlayerId: string | null,  // Visual perspective
  actingAsCampaignPlayerId: string | null,   // Action delegation
  viewingAsPlayer: PlayerRecord | null,      // Computed from ID
  actingAsPlayer: PlayerRecord | null,       // Computed from ID
  isTestMode: boolean,                       // Admin or has test players
  isSimulatedPerspective: boolean,           // viewingAs !== null
  availableActingAsPlayers: PlayerRecord[],  // Eligible players
  setViewingAsCampaignPlayerId: function,
  setActingAsCampaignPlayerId: function,
}
```

**Available Through:**
- `useCampaignTestContext()` — Full context
- `useActingPlayer()` — Acting-as only (convenience)

---

## 2. Which Systems Consume It

### Top Bar (components/layout/TopBar.jsx)
```javascript
const { 
  viewingAsCampaignPlayerId,
  actingAsCampaignPlayerId,
  setViewingAsCampaignPlayerId,
  setActingAsCampaignPlayerId,
  availableActingAsPlayers,
} = useCampaignTestContext();
```

**Usage:**
- Acting As dropdown updates `setActingAsCampaignPlayerId`
- Viewing As dropdown updates `setViewingAsCampaignPlayerId`
- Dropdown options from `availableActingAsPlayers`

### Territory Draft Panel (components/setup/TerritoryDraftPanel.jsx)
```javascript
const { 
  actingAsPlayer,
  actingAsCampaignPlayerId,
} = useCampaignTestContext();

// Claim eligibility uses actingAsPlayer
const isMyTurn = currentPickerId === actingAsPlayer?.id;
const canClaim = isMyTurn && pendingPickId && !pendingClaimed;
```

**Usage:**
- Claim button visibility checks `actingAsPlayer`
- Claim submission uses `actingAsCampaignPlayerId`
- Debug panel displays `actingAsCampaignPlayerId`

### Active Campaign (pages/ActiveCampaign.jsx)
```javascript
<CampaignTestModeProvider campaign={campaign} players={players} isAdmin={isAdmin}>
  <CampaignLayout>...</CampaignLayout>
</CampaignTestModeProvider>
```

**Usage:**
- Wraps entire campaign screen
- Provides context to all child components

### Campaign Lobby (pages/CampaignLobby.jsx)
```javascript
<CampaignTestModeProvider campaign={campaign} players={players} isAdmin={isAdmin}>
  {/* Lobby content with top bar */}
</CampaignTestModeProvider>
```

**Usage:**
- Same wrapping pattern as ActiveCampaign
- Ensures consistency across lobby → active transition

---

## 3. Fallback Behavior

### When actingAsCampaignPlayerId is null

**Fallback Logic:**
```javascript
// In TerritoryDraftPanel
const actionPlayer = actingAsPlayer ?? myPlayer; // Fallback to authenticated user

// Debug panel shows:
Acting As: {actionPlayer ? actionPlayer.display_name : 'My Player'}
```

**Debug Display:**
```
Acting As: My Player (fallback to authenticated user)
```

**When Fallback Occurs:**
- Admin hasn't selected an acting-as player
- Acting-as selector set to "My Player"
- First load of campaign screen

**Why:**
- Prevents undefined/null reference errors
- Maintains backward compatibility
- Clear visual indication in debug panel

---

## 4. Draft Claim Logic

### Eligibility Check (uses canonical state)

```javascript
const { actingAsPlayer } = useCampaignTestContext();

const currentPickerId = campaign.setup_order[campaign.setup_current_index];
const isMyTurn = currentPickerId === actingAsPlayer?.id;

const canClaim = 
  isMyTurn &&                    // Acting-as player's turn
  pendingPickId &&               // Territory selected
  !pendingClaimed &&             // Territory unclaimed
  campaign.current_phase === 'territory_draft'; // Correct phase
```

### Claim Submission (uses canonical state)

```javascript
const { actingAsCampaignPlayerId } = useCampaignTestContext();

await base44.functions.invoke('setupPhase', {
  action: 'pickTerritory',
  campaign_id: campaign.id,
  territory_id: pendingPickId,
  acting_as_player_id: actingAsCampaignPlayerId, // Backend uses this
});
```

### Backend Validation (functions/setupPhase)

```javascript
// Use acting-as player if provided
const targetPlayer = acting_as_player_id 
  ? players.find(p => p.id === acting_as_player_id)
  : myPlayer;

// Validate eligibility
if (!canActAs(targetPlayer, isAdmin, isTestCampaign)) {
  throw new Error('Cannot act as this player in live campaign');
}

// Process claim for targetPlayer
```

---

## 5. Debug Consistency Checks

### Draft Debug Panel Shows

```javascript
const { 
  actingAsCampaignPlayerId,
  actingAsPlayer,
  viewingAsCampaignPlayerId,
  viewingAsPlayer,
} = useCampaignTestContext();

const currentPickerId = campaign.setup_order[campaign.setup_current_index];
const isActingAsActiveDraftPlayer = actingAsPlayer?.id === currentPickerId;
```

**Display:**
```
Draft Debug (Simulated)

Authenticated User: Balphor
Viewing As: Test Player 1 (Test)
Acting As: Test Player 1 (Test)
Active Draft Player: Test Player 1
Is Acting-As Active: ✓ Yes

Selected Territory ID: territory_123
Claimable: Yes
```

**Consistency Checks:**
- ✅ Top bar "Acting As" = Debug panel "Acting As"
- ✅ Acting-as player = Active draft player (when claimable)
- ✅ Claim button appears only when acting-as is active draft player

---

## 6. State Persistence

### While Navigating Within Campaign

**State persists because:**
- `CampaignTestModeProvider` wraps entire campaign route
- State lives in provider, not individual components
- Navigation between lobby → active keeps provider mounted

**Example Flow:**
1. Lobby: Set Acting As = "Test Player 1"
2. Start campaign → Navigate to ActiveCampaign
3. Acting As still = "Test Player 1" (preserved)
4. Territory draft: Can immediately claim as Test Player 1

### When Leaving Campaign

**State resets because:**
- Provider unmounts when navigating away
- New campaign loads fresh provider instance
- No cross-campaign state pollution

**Example:**
1. Campaign A: Acting As = "Test Player 1"
2. Navigate to Dashboard → Provider unmounts
3. Open Campaign B → Fresh provider, Acting As = null
4. Must re-select acting-as for Campaign B

---

## 7. Why Top Bar and Debug Panel Now Match

### Before (Broken)

```javascript
// TopBar.jsx
const [actingAsPlayerId, setActingAsPlayerId] = useState(null);

// TerritoryDraftPanel.jsx
const [actingAsPlayerId, setActingAsPlayerId] = useState(null); // Separate state!

// Result: Top bar updates its state, draft panel has different state
```

**Problem:**
- Two independent `useState` calls
- No synchronization between components
- Top bar showed "Test Player 1", draft panel showed "Balphor"

### After (Fixed)

```javascript
// CampaignTestContext.jsx
const [actingAsCampaignPlayerId, setActingAsCampaignPlayerId] = useState(null);

// TopBar.jsx
const { actingAsCampaignPlayerId, setActingAsCampaignPlayerId } = useCampaignTestContext();

// TerritoryDraftPanel.jsx
const { actingAsCampaignPlayerId } = useCampaignTestContext();

// Result: Both read from same source, always in sync
```

**Solution:**
- Single `useState` in provider
- All components read from same context
- Top bar updates → context updates → all components re-render with new value

---

## 8. Files Changed

### New Files (1)
- `features/adminTestMode/CampaignTestContext.jsx` — Centralized context provider

### Modified Files (4)
- `pages/ActiveCampaign.jsx` — Wrap with provider, remove local state
- `pages/CampaignLobby.jsx` — Wrap with provider, remove local state
- `components/layout/TopBar.jsx` — Use context instead of local state
- `components/setup/TerritoryDraftPanel.jsx` — Use context for claim logic

---

## 9. Usage Pattern

### In Campaign Screens

```javascript
import { CampaignTestModeProvider, useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

// Wrap campaign screen
<CampaignTestModeProvider campaign={campaign} players={players} isAdmin={isAdmin}>
  {/* All child components can access context */}
  <TopBar />
  <TerritoryDraftPanel />
  <BattlePanel />
  {/* etc. */}
</CampaignTestModeProvider>
```

### In Child Components

```javascript
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function MyPanel() {
  const { 
    actingAsPlayer,
    actingAsCampaignPlayerId,
    setActingAsCampaignPlayerId,
  } = useCampaignTestContext();
  
  // Use actingAsPlayer for eligibility checks
  // Use setActingAsCampaignPlayerId to update (if needed)
}
```

---

**Last Updated:** 2026-05-26  
**Status:** ✅ Implemented