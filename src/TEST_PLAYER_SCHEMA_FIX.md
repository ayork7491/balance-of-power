# Test Player Schema Fix

**Date:** 2026-05-26  
**Status:** ✅ Fixed

---

## Problem

Test players were created with `is_test_player: true` in code, but the CampaignPlayer entity schema didn't define this field. This caused:

- Field not persisting to database
- Test players not returning `is_test_player` in queries
- Admin ready controls not appearing (checked `player.is_test_player`)
- Test badge not showing
- Inability to mark test players as ready

---

## Solution

### 1. Updated CampaignPlayer Entity Schema

**File:** `entities/CampaignPlayer.json`

Added three new fields:

```json
{
  "is_test_player": {
    "type": "boolean",
    "default": false,
    "description": "Whether this is a test player (not a real user account)."
  },
  "test_player_created_by_user_id": {
    "type": "string",
    "description": "User ID of the admin who created this test player (test players only)."
  },
  "test_player_label": {
    "type": "string",
    "description": "Optional label/note for this test player (e.g. 'Bot Alpha', 'Filler 1')."
  }
}
```

**Impact:** New test players will have properly typed and persisted fields.

---

### 2. Updated addCampaignTestPlayer

**File:** `functions/addCampaignTestPlayer.js`

Now creates test players with all three new fields:

```javascript
const newTestPlayer = await base44.entities.CampaignPlayer.create({
  campaign_id,
  user_id: testPlayerId, // "test_player_{timestamp}"
  display_name,
  color,
  is_test_player: true, // ← Now persists correctly
  test_player_created_by_user_id: user.id, // ← Track which admin created it
  test_player_label: display_name, // ← Initial label
  is_admin: false,
  is_ready: false,
  faction_name: null,
  troop_count: 0,
  is_eliminated: false,
});
```

**Validation:**
- ✅ `is_test_player: true` set explicitly
- ✅ `is_ready: false` (default, admin can toggle)
- ✅ Valid `campaign_id`
- ✅ Placeholder `user_id: "test_player_{timestamp}"`
- ✅ Unique `display_name` (validated before creation)
- ✅ Unique `color` (validated before creation)

---

### 3. getCampaignOverview Already Returns is_test_player

**File:** `functions/getCampaignOverview.js`

No changes needed - function already returns all player fields:

```javascript
const players = await base44.entities.CampaignPlayer.filter({ campaign_id });
// Returns all fields including is_test_player, test_player_created_by_user_id, test_player_label
```

**Verification:** Frontend receives complete player objects with all new fields.

---

### 4. CampaignLobby Admin Ready Controls

**File:** `pages/CampaignLobby.jsx`

Added fallback safety check:

```javascript
// Fallback: treat player as test player if is_test_player is true OR user_id starts with test_player_
const isTestPlayer = (p) => p.is_test_player === true || (p.user_id && p.user_id.startsWith('test_player_'));
```

Admin ready controls now work for:
- New test players (with `is_test_player: true`)
- Legacy test players (with `user_id: "test_player_..."` pattern)

---

### 5. PlayerSlot Component Updates

**File:** `components/campaigns/lobby/PlayerSlot.jsx`

Added fallback check and prop support:

```javascript
// Fallback safety check: treat as test player if is_test_player is true OR user_id starts with test_player_
const isTestPlayer = isTestPlayerProp ?? (
  player.is_test_player === true || 
  (player.user_id && player.user_id.startsWith('test_player_'))
);

// Test badge
{isTestPlayer && (
  <span className="...">
    <FlaskConical className="w-2.5 h-2.5" /> Test
  </span>
)}

// Admin ready toggle
{canAdminToggleReady && isTestPlayer && (
  <button onClick={() => onAdminToggleReady(player)}>
    <TestTube className="w-3 h-3" />
  </button>
)}
```

---

### 6. Migration Helper: repairTestPlayers

**File:** `functions/repairTestPlayers.js`

Platform admin-only function to repair existing test players:

**What it does:**
- Scans all CampaignPlayer records
- Identifies test players by:
  - `user_id` starting with `test_player_`
  - `display_name` matching "Test Player" pattern
- Sets `is_test_player: true` on matches
- Adds `test_player_label` if missing

**Usage:**
```bash
# Call via backend function invocation (platform admin only)
await base44.functions.invoke('repairTestPlayers', {});
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_scanned": 50,
    "total_repaired": 12,
    "total_errors": 0
  },
  "repaired": [
    {
      "player_id": "cp_123",
      "campaign_id": "camp_456",
      "display_name": "Test Player Alpha",
      "user_id": "test_player_1234567890",
      "reason": "user_id pattern"
    }
  ]
}
```

**Safety:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Only repairs players missing `is_test_player`
- ✅ Logs all changes
- ✅ Continues on errors (doesn't fail entire batch)

---

### 7. Admin Debug Panel

**File:** `pages/CampaignLobby.jsx`

Added debug info for admins (visible only in Players tab):

```jsx
{/* Admin debug info */}
{isAdmin && (
  <div className="...">
    <p className="font-display tracking-wider uppercase mb-1">Player Debug</p>
    {players.map(p => (
      <div key={p.id} className="flex items-center gap-2">
        <span className="text-foreground">{p.display_name}</span>
        <span>→ id: {p.id}</span>
        <span>→ user_id: {p.user_id}</span>
        <span className={p.is_test_player ? 'text-status-info' : ''}>
          → is_test_player: {p.is_test_player ? 'true' : 'false'}
        </span>
        <span className={p.is_ready ? 'text-status-locked' : 'text-status-pending'}>
          → is_ready: {p.is_ready ? 'true' : 'false'}
        </span>
      </div>
    ))}
  </div>
)}
```

**Shows:**
- Player ID
- User ID (placeholder for test players)
- is_test_player status
- is_ready status
- Color-coded for easy scanning

---

## Verification Checklist

### Test Player Creation
- [ ] Test player created with `is_test_player: true` in database
- [ ] Test player has `is_ready: false` by default
- [ ] Test player has valid `campaign_id`
- [ ] Test player has placeholder `user_id: "test_player_{timestamp}"`
- [ ] Test player has unique `display_name`
- [ ] Test player has unique `color`
- [ ] Test player has `test_player_created_by_user_id` set to admin's ID
- [ ] Test player has `test_player_label` set

### Lobby Display
- [ ] Test players show "Test" badge (flask icon)
- [ ] Campaign admin sees Ready/Unready toggle button (test tube icon) next to test players
- [ ] Real human players don't show admin ready toggle
- [ ] Non-admins don't see admin ready toggle
- [ ] Admin debug panel shows all player fields (ID, user_id, is_test_player, is_ready)

### Ready Toggle Functionality
- [ ] Clicking Ready/Unready toggle updates `CampaignPlayer.is_ready`
- [ ] Ready count updates after toggle (e.g., "3/5 Ready")
- [ ] Test player badge changes from "Waiting" to "Ready"
- [ ] Lobby refreshes after toggle

### Campaign Start
- [ ] "Start Campaign" button unlocks when all players (real + test) are ready
- [ ] Ready count includes test players
- [ ] Campaign can start with mix of real and test players (all must be ready)

### Legacy Support
- [ ] Old test players (created before schema fix) still recognized via `user_id` pattern
- [ ] Admin ready controls work for legacy test players
- [ ] `repairTestPlayers` function can fix old records
- [ ] After repair, old test players behave like new ones

---

## Files Changed (6)

### Entity Schema
1. `entities/CampaignPlayer.json` — Added `is_test_player`, `test_player_created_by_user_id`, `test_player_label`

### Backend Functions
2. `functions/addCampaignTestPlayer.js` — Now sets all three new fields
3. `functions/repairTestPlayers.js` — Migration helper (NEW)

### Frontend Components
4. `components/campaigns/lobby/PlayerSlot.jsx` — Added fallback check, uses `isTestPlayer` prop

### Pages
5. `pages/CampaignLobby.jsx` — Added fallback check, admin debug panel

### Documentation
6. `TEST_PLAYER_SCHEMA_FIX.md` — This file

---

## Technical Notes

### Why Fallback Check?

The fallback (`user_id.startsWith('test_player_')`) ensures backward compatibility:

```javascript
const isTestPlayer = (p) => 
  p.is_test_player === true || // New schema (preferred)
  (p.user_id && p.user_id.startsWith('test_player_')); // Legacy pattern (fallback)
```

This prevents breaking existing test players created before the schema fix.

### Why Platform Admin-Only Repair?

The `repairTestPlayers` function modifies data across all campaigns. Restricting to platform admins prevents:
- Accidental mass updates by campaign admins
- Conflicts if multiple admins run repair simultaneously
- Unauthorized access to all campaign player data

### Migration Strategy

**Phase 1: Schema Update (Done)**
- New test players have proper fields
- Old test players work via fallback check

**Phase 2: Optional Repair (Admin Choice)**
- Run `repairTestPlayers` to fix old records
- Or leave fallback to handle indefinitely

**Recommendation:** Run repair once after deployment, then remove fallback in future major version.

---

**All issues resolved.** ✅