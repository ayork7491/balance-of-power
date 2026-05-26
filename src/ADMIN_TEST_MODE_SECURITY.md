# Admin Test Mode — Security & Permissions Model

## Overview

Admin Test Mode provides debugging and solo testing tools for Balance of Power campaigns. Access is controlled through a **two-tier permission model** that separates platform admins from campaign admins.

---

## Permission Model

### Platform Admin (Global Admin)
- **Definition**: `user.role === 'admin'`
- **Scope**: Workspace-wide access
- **Capabilities**:
  - ✅ Access all campaigns (test and competitive)
  - ✅ Create test player accounts (role='user' only)
  - ✅ View debug overlay in any campaign
  - ✅ Force phase advance in any campaign
  - ✅ Override test campaign restrictions

### Campaign Admin
- **Definition**: `campaign.admin_user_id === user.id`
- **Scope**: Campaign-specific access
- **Capabilities**:
  - ✅ Access campaign management tools
  - ✅ Invite players to campaign
  - ⚠️ **Test campaigns only**: Debug overlay, force phase advance
  - ❌ Cannot create global test users (use invite flow)
  - ❌ Cannot access debug tools in competitive campaigns

### Test Campaign Flag
- **Field**: `Campaign.is_test_campaign` (boolean)
- **Purpose**: Marks campaigns safe for debugging
- **Rules**:
  - Campaign admins can only use debug tools in test campaigns
  - Platform admins can override this restriction
  - Competitive campaigns (is_test_campaign=false) protect hidden information

---

## Tool Access Matrix

| Tool | Platform Admin | Campaign Admin (Test) | Campaign Admin (Competitive) |
|------|----------------|----------------------|-----------------------------|
| Create Test Player | ✅ Yes | ❌ No (use invite flow) | ❌ No |
| Perspective Switcher | ✅ Yes | ✅ Yes | ✅ Yes |
| Debug Overlay | ✅ Yes | ✅ Yes | ❌ No (403 error) |
| Force Phase Advance | ✅ Yes | ✅ Yes (unsafe) | ❌ No (403 error) |
| Snapshot Inspector | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Security Rules

### 1. Debug Overlay Access

**Backend Check** (`getAllPhaseDecisions.js`):
```javascript
const isPlatformAdmin = user.role === 'admin';
const isCampaignAdmin = campaign.admin_user_id === user.id;
const isTestCampaign = campaign.is_test_campaign === true;

if (!isPlatformAdmin && !isCampaignAdmin) {
  return Response.json({ error: 'Admin access required' }, { status: 403 });
}

// Campaign admins can only access debug data for test campaigns
if (isCampaignAdmin && !isPlatformAdmin && !isTestCampaign) {
  return Response.json({ 
    error: 'Debug overlay restricted to test campaigns. This is a competitive campaign.', 
    requires: 'platform_admin_override' 
  }, { status: 403 });
}
```

**Frontend Warning**: Debug overlay shows a warning badge indicating platform admin requirement.

---

### 2. Force Phase Advance Behavior

**WARNING**: This is a **debug-only unsafe phase switch**. It does NOT run the full phase-end processing pipeline.

**What it does NOT do**:
- ❌ Auto-submit missing decisions
- ❌ Apply deploy placements/resources
- ❌ Reveal attacks
- ❌ Generate/apply battle state
- ❌ Apply fortify/build results
- ❌ Generate proper phase snapshots

**Access Control**:
```javascript
if (isCampaignAdmin && !isPlatformAdmin && !isTestCampaign) {
  return Response.json({ 
    error: 'Force advance restricted to test campaigns. This is a competitive campaign.', 
    requires: 'platform_admin_override' 
  }, { status: 403 });
}
```

**UI Warning**: Confirmation dialog shows detailed warnings about skipped processing steps.

---

### 3. Test Player Creation Rules

**Platform Admin Only**:
- Only `user.role === 'admin'` can create test players
- Test players ALWAYS created with `role='user'` (never admin)
- Campaign admins must use the invite flow to add players

**Rationale**:
- Prevents privilege escalation
- Keeps test account creation centralized
- Campaign admins should use proper invite flow for their campaigns

**Backend**:
```javascript
// Platform admin only - campaign admins cannot create global users
if (user.role !== 'admin') {
  return Response.json({ error: 'Platform admin access required' }, { status: 403 });
}

// Create user account - ALWAYS role='user' (never admin)
const newUser = await base44.asServiceRole.entities.User.create({
  email,
  full_name: display_name,
  role: 'user', // Hardcoded
});
```

**Frontend**: Role selector removed, shows "Player (test account)" only with explanation.

---

### 4. Perspective Switching

**Current Implementation**: **Simulated preview only**

**What it does**:
- Changes UI state to show different player's view
- Displays that player's name in the UI

**What it does NOT do**:
- ❌ Authenticate as that player
- ❌ Enforce true hidden-information rules
- ❌ Filter private data based on perspective
- ❌ Change the authenticated user context

**UI Warning**:
```
⚠️ Simulated Perspective Preview
This changes UI state only. Does NOT authenticate as that player or enforce 
true hidden-information rules. For actual player view, log in as that user.
```

**Future Enhancement**: Wire perspective into data-fetching hooks to filter public/player-visible data according to that perspective.

---

## Backend Function Security

### getAllPhaseDecisions.js

**Access**: Platform admin OR campaign admin (test campaigns only)

**Error Responses**:
- `401 Unauthorized` — No authenticated user
- `403 Admin access required` — Not a campaign admin
- `403 Debug overlay restricted to test campaigns` — Campaign admin in competitive campaign
- `404 Campaign not found` — Invalid campaign_id

---

### forcePhaseAdvance.js

**Access**: Platform admin OR campaign admin (test campaigns only)

**Warning**: Debug-only unsafe switch

**Error Responses**:
- `401 Unauthorized` — No authenticated user
- `403 Admin access required` — Not a campaign admin
- `403 Force advance restricted to test campaigns` — Campaign admin in competitive campaign
- `404 Campaign not found` — Invalid campaign_id

**Response includes warning**:
```json
{
  "success": true,
  "campaign": { ... },
  "warning": "Debug-only unsafe phase switch. Phase-end processing not executed."
}
```

---

### createTestPlayer.js

**Access**: Platform admin only

**Rules**:
- Test players ALWAYS created with role='user'
- Campaign admins cannot use this endpoint (use invite flow)

**Error Responses**:
- `401 Unauthorized` — No authenticated user
- `403 Platform admin access required` — Not a platform admin
- `409 User with this email already exists` — Duplicate email

**Response note**:
```json
{
  "success": true,
  "user": { ... },
  "note": "Test user created with role=\"user\". Use invite flow or password reset to set credentials. Campaign admins should use invite flow instead of this endpoint."
}
```

---

## Campaign Test Mode Flag

### Implementation

**Entity Field**: `Campaign.is_test_campaign` (boolean, default: false)

**Usage**:
- Set to `true` when creating a campaign for testing
- Enables debug tools for campaign admins
- Should be `false` for competitive campaigns

**Future Enhancement**: Add UI toggle in campaign settings to mark as test campaign.

---

## Hidden Information Safety Rules

### Production Campaigns (is_test_campaign = false)

**Protected Data**:
- PhaseDecision records (private per player)
- Staged attacks (hidden until reveal)
- Private decision data (hidden until phase end)

**Access**:
- Players only see their own decisions
- Debug overlay blocked for campaign admins
- Platform admins can still access (audit/debug purposes)

### Test Campaigns (is_test_campaign = true)

**Relaxed Rules**:
- Campaign admins can view all decisions via debug overlay
- Force phase advance allowed
- Full debugging capabilities enabled

---

## Base44 Limitations

### Current Limitations

1. **No Campaign-Level Role System**
   - Campaign admin is just a user_id field
   - No granular campaign permissions
   - All-or-nothing admin access

2. **No True Perspective Switching**
   - Cannot impersonate users
   - Simulated view only
   - Would need actual auth token switching

3. **No Phase Transition Pipeline**
   - Force advance is a direct state change
   - No automatic phase-end processing
   - Future: integrate with phase engine

4. **No Test Campaign UI Toggle**
   - Must set `is_test_campaign` via database/admin tools
   - Future: add to campaign settings

5. **No Audit Log for Debug Actions**
   - SetupLog entries are hidden from players
   - No separate audit trail for admin debug actions
   - Future: dedicated audit log entity

---

## Files Changed

### Backend Functions
- `functions/getAllPhaseDecisions.js` — Added test campaign check, platform vs campaign admin
- `functions/forcePhaseAdvance.js` — Added test campaign check, unsafe switch warnings
- `functions/createTestPlayer.js` — Platform admin only, hardcoded role='user'

### Frontend Components
- `components/admin/TestPlayerCreator.jsx` — Removed role selector, added explanation
- `components/admin/DebugOverlay.jsx` — Added platform admin warning badge
- `components/admin/PerspectiveSwitcher.jsx` — Added simulated preview warning
- `components/admin/PhaseControls.jsx` — Added unsafe switch warnings to dialog
- `pages/AdminTestMode.jsx` — Two-tier admin check, test campaign detection, conditional rendering

### Documentation
- `ADMIN_TEST_MODE.md` — Updated with security model, permissions, limitations

---

## Summary

**Permission Model**:
- Platform admins: Full access to all campaigns
- Campaign admins: Limited to test campaigns for debug tools
- Test campaign flag: Required for campaign admin debug access

**Security**:
- Debug overlay restricted to platform admins or test campaigns
- Force advance marked as unsafe, restricted to test campaigns
- Test player creation limited to platform admins, role='user' only
- Perspective switching clearly labeled as simulated

**Documentation**:
- All tools have clear warnings about limitations
- Backend enforces access control with descriptive errors
- Frontend shows appropriate warnings and restrictions

**Base44 Limitations**:
- No campaign-level role system
- No true user impersonation
- No phase transition pipeline (yet)
- No test campaign UI toggle
- No dedicated audit log