# Admin Test Mode — Correction Pass Summary

## ✅ Completed Fixes

### 1. Platform Admin vs Campaign Admin Separation

**Backend Changes**:
- `getAllPhaseDecisions.js`: Checks `user.role === 'admin'` (platform) OR `campaign.admin_user_id === user.id` (campaign)
- `forcePhaseAdvance.js`: Same two-tier check
- `createTestPlayer.js`: Platform admin only (user.role === 'admin')

**Frontend Changes**:
- `AdminTestMode.jsx`: Detects both platform and campaign admin status
- Shows access level in banner (Platform Admin vs Campaign Admin)
- Test Player Creator hidden for campaign admins with explanation

**Result**: Campaign admins can access their campaigns, but with restrictions.

---

### 2. Debug Overlay Access Restriction

**Backend**:
```javascript
if (isCampaignAdmin && !isPlatformAdmin && !isTestCampaign) {
  return Response.json({ 
    error: 'Debug overlay restricted to test campaigns', 
    requires: 'platform_admin_override' 
  }, { status: 403 });
}
```

**Frontend**:
- Added warning badge: "⚠️ Platform Admin Only"
- Explains campaign admins can only access in test campaigns

**Result**: Competitive campaigns protect hidden information from campaign admins.

---

### 3. Test Player Creation Model Fixed

**Backend**:
- Platform admin check: `if (user.role !== 'admin') return 403`
- Hardcoded `role: 'user'` (no admin option)
- Response note explains campaign admins should use invite flow

**Frontend**:
- Removed role selector (only shows "Player (test account)")
- Added explanation: "Test players are always created as regular users"
- Campaign admins see message to use invite flow instead

**Result**: No privilege escalation, campaign admins use proper invite flow.

---

### 4. Perspective Switching Honesty

**Frontend**:
- Added prominent warning box:
  ```
  ⚠️ Simulated Perspective Preview
  This changes UI state only. Does NOT authenticate as that player or enforce 
  true hidden-information rules. For actual player view, log in as that user.
  ```

**Result**: Users understand this is a preview, not true impersonation.

---

### 5. Force Phase Advance Behavior Fixed

**Backend**:
- Added comprehensive warning in response:
  ```json
  {
    "success": true,
    "warning": "Debug-only unsafe phase switch. Phase-end processing not executed."
  }
  ```
- Logs `debug_only_unsafe: true` and `warning: 'Skipped phase-end processing pipeline'` in SetupLog

**Frontend**:
- Enhanced confirmation dialog with detailed warnings:
  - ❌ Does NOT auto-submit missing decisions
  - ❌ Does NOT apply deploy placements/resources
  - ❌ Does NOT reveal attacks or generate battles
  - ❌ Does NOT apply fortify/build results
  - ❌ Does NOT generate proper phase snapshots
- "Debug-Only Unsafe Switch" badge in red
- "Only use in test campaigns" guidance

**Result**: Users understand this is a debug tool, not a proper phase transition.

---

### 6. Campaign Test Mode Flag

**Documented**: `Campaign.is_test_campaign` field usage

**Access Control**:
- Campaign admins can only use debug tools if `campaign.is_test_campaign === true`
- Platform admins can override this restriction
- Competitive campaigns (is_test_campaign=false) block debug access

**Future Enhancement**: Add UI toggle in campaign settings to mark as test campaign.

---

### 7. Documentation Updated

**New File**: `ADMIN_TEST_MODE_SECURITY.md` (10KB)
- Complete security model documentation
- Permission matrix (platform vs campaign admin)
- Backend function access control details
- Tool-by-tool restrictions
- Base44 limitations documented

**Updated**: `ADMIN_TEST_MODE.md`
- References new security model
- Updated usage guidelines

---

## Final Permission Model

### Platform Admin (user.role === 'admin')
✅ All campaigns (test + competitive)  
✅ Create test players (role='user' only)  
✅ Debug overlay in any campaign  
✅ Force phase advance in any campaign  

### Campaign Admin (campaign.admin_user_id === user.id)
✅ Campaign management tools  
✅ Invite players (via invite flow)  
⚠️ Test campaigns ONLY: Debug overlay, force phase advance  
❌ Competitive campaigns: No debug tools  
❌ Cannot create test players (use invite flow)  

---

## Final Debug Overlay Permission Model

| User Type | Test Campaign | Competitive Campaign |
|-----------|---------------|---------------------|
| Platform Admin | ✅ Allowed | ✅ Allowed |
| Campaign Admin | ✅ Allowed | ❌ Blocked (403) |
| Regular Player | ❌ Blocked | ❌ Blocked |

---

## Final Force Phase Advance Behavior

**Status**: Debug-only unsafe switch

**What it does**:
- ✅ Updates `Campaign.current_phase`
- ✅ Updates `Campaign.phase_deadline` (7 days)
- ✅ Increments round if fortify → deploy
- ✅ Creates hidden SetupLog entry

**What it does NOT do**:
- ❌ Auto-submit missing decisions
- ❌ Apply deploy placements/resources
- ❌ Reveal attacks
- ❌ Generate/apply battle state
- ❌ Apply fortify/build results
- ❌ Generate proper phase snapshots

**Access**:
- Platform admins: Any campaign
- Campaign admins: Test campaigns only

**UI**: Detailed warnings in confirmation dialog listing all skipped steps.

---

## Final Test Player Creation Rules

**Who can create**: Platform admins only (user.role === 'admin')

**Role**: Always `role='user'` (hardcoded, no admin option)

**Campaign admins**: Must use invite flow to add players to campaigns

**Rationale**:
- Prevents privilege escalation
- Centralizes test account creation
- Encourages proper invite flow usage

---

## Remaining Base44 Limitations

### 1. No Campaign-Level Role System
**Current**: Campaign admin is just a `user_id` field  
**Limitation**: No granular permissions (all-or-nothing)  
**Future**: Could add `CampaignPlayer.role` with values like 'admin', 'player', 'observer'

### 2. No True Perspective Switching
**Current**: Simulated UI preview only  
**Limitation**: Cannot enforce hidden information rules  
**Future**: Would need actual auth token switching (impersonation)

### 3. No Phase Transition Pipeline
**Current**: Direct state change (unsafe)  
**Limitation**: Skips phase-end processing  
**Future**: Integrate with phase engine (`deployPhase`, `attackPhase`, etc.)

### 4. No Test Campaign UI Toggle
**Current**: Must set `is_test_campaign` via database  
**Limitation**: Not user-accessible  
**Future**: Add checkbox in campaign settings

### 5. No Dedicated Audit Log
**Current**: SetupLog entries (hidden from players)  
**Limitation**: No separate admin audit trail  
**Future**: Create `AdminAuditLog` entity for debug actions

---

## Files Changed

### Backend (3 files)
- `functions/getAllPhaseDecisions.js` — Two-tier admin check, test campaign guard
- `functions/forcePhaseAdvance.js` — Two-tier admin check, unsafe warnings
- `functions/createTestPlayer.js` — Platform admin only, hardcoded role='user'

### Frontend (5 files)
- `components/admin/TestPlayerCreator.jsx` — Removed role selector, added explanation
- `components/admin/DebugOverlay.jsx` — Platform admin warning badge
- `components/admin/PerspectiveSwitcher.jsx` — Simulated preview warning
- `components/admin/PhaseControls.jsx` — Unsafe switch warnings in dialog
- `pages/AdminTestMode.jsx` — Two-tier admin detection, conditional rendering

### Documentation (2 files)
- `ADMIN_TEST_MODE_SECURITY.md` — New comprehensive security documentation
- `ADMIN_TEST_MODE.md` — Updated references

---

## Testing Checklist

- [ ] Platform admin can access all tools in any campaign
- [ ] Campaign admin can access test campaign debug tools
- [ ] Campaign admin blocked from competitive campaign debug tools (403)
- [ ] Test player creation only works for platform admins
- [ ] Test players created with role='user' only
- [ ] Perspective switcher shows simulated preview warning
- [ ] Force phase advance shows detailed unsafe warnings
- [ ] Debug overlay shows platform admin warning
- [ ] AdminTestMode page shows correct access level in banner

---

## Summary

**All 7 correction items completed**:

1. ✅ Platform vs campaign admin separation
2. ✅ Debug overlay access restricted by test campaign flag
3. ✅ Test player creation locked to platform admins (role='user' only)
4. ✅ Perspective switching clearly labeled as simulated
5. ✅ Force phase advance marked as unsafe debug-only tool
6. ✅ Test campaign flag documented and enforced
7. ✅ Comprehensive security documentation

**Result**: Admin Test Mode now has proper security boundaries, clear warnings, and documented limitations.