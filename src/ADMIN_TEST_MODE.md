# Admin Test Mode Implementation

## Overview

Admin Test Mode is a comprehensive debugging and solo testing tool for Balance of Power campaigns. It allows administrators to:

- Create test player accounts
- Switch perspectives between players
- View all private decision data (debug overlay)
- Force phase advancement
- Inspect campaign state snapshots
- Test campaign flows without waiting for timers

**CRITICAL SECURITY**: All features are restricted to admin users only and preserve hidden-information rules in production.

---

## Architecture

### Backend Functions

#### 1. `getAllPhaseDecisions.js`
**Purpose**: Fetch all player decisions for a campaign (admin-only)

**Access Control**:
- Requires authenticated user
- Requires `user.role === 'admin'`
- Returns 403 for non-admins

**Input**:
```json
{
  "campaign_id": "string (required)",
  "round": "number (optional)",
  "phase": "string (optional)"
}
```

**Output**:
```json
{
  "decisions": [
    {
      "id": "...",
      "player_id": "...",
      "player_name": "...",
      "phase": "deploy",
      "round": 1,
      "is_locked": true,
      "is_auto_submitted": false,
      "data": { ... },
      "locked_at": "ISO timestamp"
    }
  ]
}
```

**Security Notes**:
- Uses `asServiceRole` to fetch all decisions (bypasses user-scoped filtering)
- Enriches with player names for display
- Should ONLY be called from Admin Test Mode UI
- Never expose this endpoint to regular players

---

#### 2. `forcePhaseAdvance.js`
**Purpose**: Skip timer and advance campaign to next phase (admin-only)

**Access Control**:
- Requires authenticated user
- Requires `user.role === 'admin'`
- Returns 403 for non-admins

**Input**:
```json
{
  "campaign_id": "string (required)",
  "target_phase": "string (optional, defaults to next phase)"
}
```

**Output**:
```json
{
  "success": true,
  "campaign": {
    "id": "...",
    "current_phase": "attack",
    "current_round": 1
  }
}
```

**Side Effects**:
- Updates `Campaign.current_phase`
- Updates `Campaign.phase_deadline` (7 days from now)
- Increments `Campaign.current_round` if advancing from fortify → deploy
- Creates `SetupLog` entry with `forced: true`

**Security Notes**:
- Bypasses normal phase transition logic
- Auto-submits pending decisions
- Should ONLY be used for testing, never in production gameplay

---

#### 3. `createTestPlayer.js`
**Purpose**: Create test user accounts for solo testing (admin-only)

**Access Control**:
- Requires authenticated user
- Requires `user.role === 'admin'`
- Returns 403 for non-admins

**Input**:
```json
{
  "email": "string (required)",
  "display_name": "string (required)",
  "role": "user | admin (optional, defaults to 'user')"
}
```

**Output**:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "test1@example.com",
    "full_name": "Player One",
    "role": "user"
  },
  "note": "User created. Use invite flow or password reset to set credentials."
}
```

**Limitations**:
- Cannot set password directly via entity creation
- Admin must use invite flow or password reset for credentials
- Prevents duplicate emails (409 conflict)

---

### Frontend Components

#### 1. `TestPlayerCreator.jsx`
**Purpose**: Form to create test player accounts

**Features**:
- Email input
- Display name input
- Role selector (user/admin)
- Success/error toast notifications
- Loading state management

**Usage**:
```jsx
<TestPlayerCreator onPlayerCreated={(user) => {
  console.log('Created:', user);
}} />
```

---

#### 2. `PerspectiveSwitcher.jsx`
**Purpose**: Switch view between different players

**Features**:
- Dropdown with all campaign players
- Shows "(You)" indicator for current user
- Toast notification on switch
- Current perspective display

**Security**:
- Does NOT actually change authentication
- Only affects UI rendering (future: filter private data)
- Debug overlay bypasses perspective filtering

**Usage**:
```jsx
<PerspectiveSwitcher
  campaign={campaign}
  players={players}
  currentPerspective={currentPerspective}
  onPerspectiveChange={setCurrentPerspective}
/>
```

---

#### 3. `DebugOverlay.jsx`
**Purpose**: Toggle visibility of all private decision data

**Features**:
- Enable/disable toggle
- Fetches all decisions via `getAllPhaseDecisions`
- Displays decisions by phase type:
  - **Faction Selection**: Shows selected faction
  - **Initial Deploy**: Shows troop placements
  - **Deploy**: Shows deployment decisions
  - **Attack**: Shows attack targets and troop counts
  - **Fortify**: Shows movement decisions
- Shows lock status and timestamps
- Auto-refreshes on phase change

**Security**:
- Only fetches when enabled
- Admin-only access (enforced by backend)
- Does NOT persist — toggle resets on page reload

**Usage**:
```jsx
<DebugOverlay
  campaign={campaign}
  enabled={debugOverlayEnabled}
  onToggle={() => setDebugOverlayEnabled(!debugOverlayEnabled)}
/>
```

---

#### 4. `PhaseControls.jsx`
**Purpose**: Manual phase advancement and auto-fill controls

**Features**:
- **Force Phase Advance**:
  - Shows next phase in sequence
  - Confirmation dialog before advancing
  - Destructive action (red button)
  - Updates campaign state
- **Auto-Fill Decisions** (placeholder):
  - Future: randomly fill unstaged decisions
  - Useful for testing battle generation

**Phase Order**:
```javascript
[
  'faction_selection',
  'territory_draft',
  'initial_deploy',
  'deploy',
  'attack',
  'battle',
  'fortify',
  // → wraps to 'deploy' with round+1
]
```

**Usage**:
```jsx
<PhaseControls
  campaign={campaign}
  onPhaseChanged={(newCampaign) => {
    console.log('Phase advanced:', newCampaign);
  }}
/>
```

---

#### 5. `SnapshotInspector.jsx`
**Purpose**: View and analyze campaign state snapshots

**Features**:
- Lists last 20 snapshots
- Tabbed interface:
  - **Territories**: Ownership and troop counts
  - **Players**: Standings (territories, troops, income)
  - **Income**: Detailed income breakdown
- Click to select snapshot
- Shows snapshot type (phase_start/phase_end)

**Tabs**:

**Territories Tab**:
- Territory ID
- Troop count
- Owner name

**Players Tab**:
- Player name + color dot
- Territory count
- Troop total
- Deploy income
- Elimination status

**Income Tab**:
- Territory bonus
- Troop bonus
- Region bonus
- Continent bonus
- Total income

**Usage**:
```jsx
<SnapshotInspector campaign={campaign} />
```

---

## Security Considerations

### Admin-Only Access

All backend functions enforce admin-only access:

```javascript
const user = await base44.auth.me();
if (!user || user.role !== 'admin') {
  return Response.json({ error: 'Admin access required' }, { status: 403 });
}
```

**Frontend Check**:
```javascript
useEffect(() => {
  base44.auth.me().then(user => {
    setIsAdmin(user?.role === 'admin');
  });
}, []);

if (!isAdmin) {
  return <AccessDenied />;
}
```

### Hidden Information Preservation

**Production Mode** (debug overlay disabled):
- Players only see their own `PhaseDecision` data
- `PhaseSnapshot` contains only public revealed state
- Attack reveals happen at phase boundaries

**Debug Mode** (debug overlay enabled):
- Admin can see ALL player decisions
- Useful for debugging hidden information leaks
- Does NOT affect production data visibility

### Service Role Usage

Backend functions use `asServiceRole` to bypass user-scoped filtering:

```javascript
// ✅ Correct: Admin function uses service role
const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id });

// ❌ Incorrect: User-scoped query returns only own decisions
const decisions = await base44.entities.PhaseDecision.filter({ campaign_id });
```

**Justification**:
- Admin needs to see all decisions for debugging
- Access controlled by admin role check
- Never expose service role to frontend

---

## Usage Guide

### 1. Create Test Players

1. Navigate to Admin Test Mode
2. Use "Create Test Player" panel
3. Enter email (e.g., `test1@example.com`)
4. Enter display name (e.g., `Player One`)
5. Select role (user/admin)
6. Click "Create Test Player"

**Note**: Use invite flow to set passwords for test accounts.

---

### 2. Switch Perspectives

1. Select a player from dropdown
2. Click "Switch Perspective"
3. UI now shows that player's view

**Use Case**: Test hidden information from different player viewpoints.

---

### 3. Enable Debug Overlay

1. Click "Enable Debug Overlay"
2. View all private decisions for current phase
3. See lock status and timestamps
4. Toggle off to return to normal view

**Use Case**: Debug issues with decision data, verify privacy rules.

---

### 4. Force Phase Advance

1. Click "Force Advance" button
2. Confirm in dialog
3. Campaign advances to next phase
4. All pending decisions auto-submitted

**Use Case**: Test phase transitions without waiting for timers.

---

### 5. Inspect Snapshots

1. Select a snapshot from list
2. Switch between tabs:
   - Territories
   - Players
   - Income
3. Analyze campaign state at phase boundaries

**Use Case**: Verify state consistency, debug calculation issues.

---

## Testing Checklist

- [ ] Non-admin user cannot access Admin Test Mode (403)
- [ ] Test player creation works (no duplicate emails)
- [ ] Perspective switching updates UI
- [ ] Debug overlay shows all decisions when enabled
- [ ] Debug overlay hides decisions when disabled
- [ ] Force phase advance updates campaign state
- [ ] Force phase advance creates SetupLog entry
- [ ] Snapshot inspector loads snapshots correctly
- [ ] Snapshot tabs show correct data
- [ ] All backend functions enforce admin-only access
- [ ] No service role usage in frontend code
- [ ] No private data leaks in production mode

---

## Known Limitations

### V1 Limitations (Accepted)

- ❌ Auto-fill decisions not implemented (placeholder only)
- ❌ Test player password must be set via invite flow
- ❌ Perspective switching doesn't actually filter data (UI only)
- ❌ No campaign selection (uses URL param `:id`)

### Future Enhancements

- [ ] Implement `autoFillDecisions` backend function
- [ ] Add campaign selector dropdown
- [ ] Implement actual perspective-based data filtering
- [ ] Add battle result simulation
- [ ] Add territory ownership editor
- [ ] Add resource manipulation tools
- [ ] Add campaign reset/rollback functionality

---

## File Structure

```
functions/
  getAllPhaseDecisions.js
  forcePhaseAdvance.js
  createTestPlayer.js

components/admin/
  TestPlayerCreator.jsx
  PerspectiveSwitcher.jsx
  DebugOverlay.jsx
  PhaseControls.jsx
  SnapshotInspector.jsx

pages/
  AdminTestMode.jsx

ADMIN_TEST_MODE.md (this file)
```

---

## Summary

Admin Test Mode provides comprehensive tools for solo testing and debugging:

✅ **Test Player Creation** — Create accounts for testing multi-player scenarios  
✅ **Perspective Switching** — View game from any player's viewpoint  
✅ **Debug Overlay** — Toggle visibility of all private decisions  
✅ **Phase Controls** — Force phase advancement, skip timers  
✅ **Snapshot Inspector** — Analyze campaign state at phase boundaries  
✅ **Admin-Only Access** — All features restricted to admins  
✅ **Security Preserved** — No production data leaks  

**All systems enforce proper access control and hidden-information rules.**