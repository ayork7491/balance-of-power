# Admin Test Mode — Quick Reference

## Access Control

### Platform Admin
- **Check**: `user.role === 'admin'`
- **Access**: All campaigns, all tools
- **Can**: Create test players, view debug overlay anywhere, force advance anywhere

### Campaign Admin
- **Check**: `campaign.admin_user_id === user.id`
- **Access**: Own campaign only
- **Can**: Use debug tools ONLY in test campaigns (`is_test_campaign === true`)
- **Cannot**: Create test players (use invite flow), access debug in competitive campaigns

---

## Tool Permissions

| Tool | Platform Admin | Campaign Admin (Test) | Campaign Admin (Competitive) |
|------|----------------|----------------------|-----------------------------|
| Create Test Player | ✅ | ❌ | ❌ |
| Debug Overlay | ✅ | ✅ | ❌ |
| Force Phase Advance | ✅ | ✅ (unsafe) | ❌ |
| Perspective Switch | ✅ | ✅ | ✅ |
| Snapshot Inspector | ✅ | ✅ | ✅ |

---

## Backend Functions

### getAllPhaseDecisions
```
Access: Platform admin OR campaign admin (test campaigns only)
403 if: Campaign admin in competitive campaign
```

### forcePhaseAdvance
```
Access: Platform admin OR campaign admin (test campaigns only)
Warning: Debug-only unsafe switch (skips phase-end processing)
403 if: Campaign admin in competitive campaign
```

### createTestPlayer
```
Access: Platform admin only
Role: Always 'user' (hardcoded)
403 if: Campaign admin tries to use
```

---

## Test Campaign Flag

**Field**: `Campaign.is_test_campaign` (boolean)

**Purpose**: Enable debug tools for campaign admins

**Rules**:
- `true`: Campaign admins can use debug tools
- `false`: Campaign admins blocked from debug tools
- Platform admins can override

---

## Warnings

### Debug Overlay
```
⚠️ Platform Admin Only
Debug overlay showing all private decisions. Campaign admins 
can only access this in test campaigns.
```

### Perspective Switcher
```
⚠️ Simulated Perspective Preview
This changes UI state only. Does NOT authenticate as that 
player or enforce true hidden-information rules.
```

### Force Phase Advance
```
⚠️ Debug-Only Unsafe Switch
- Does NOT auto-submit missing decisions
- Does NOT apply deploy placements/resources
- Does NOT reveal attacks or generate battles
- Does NOT apply fortify/build results
- Does NOT generate proper phase snapshots
Only use in test campaigns.
```

### Test Player Creator
```
Test players are always created as regular users.
Campaign admins should use the invite flow.
```

---

## Base44 Limitations

1. **No campaign-level roles** — Campaign admin is just a user_id field
2. **No true impersonation** — Perspective switching is simulated only
3. **No phase pipeline** — Force advance skips phase-end processing
4. **No test campaign UI** — Must set is_test_campaign via database
5. **No audit log** — Debug actions logged to SetupLog (hidden)

---

## Files

**Backend**:
- `functions/getAllPhaseDecisions.js`
- `functions/forcePhaseAdvance.js`
- `functions/createTestPlayer.js`

**Frontend**:
- `components/admin/TestPlayerCreator.jsx`
- `components/admin/DebugOverlay.jsx`
- `components/admin/PerspectiveSwitcher.jsx`
- `components/admin/PhaseControls.jsx`
- `pages/AdminTestMode.jsx`

**Docs**:
- `ADMIN_TEST_MODE_SECURITY.md` — Full security model
- `ADMIN_TEST_MODE_CORRECTION_SUMMARY.md` — What was fixed
- `ADMIN_TEST_MODE.md` — Usage guide

---

## Quick Start

1. **Platform Admin**: Access `/campaigns/:id/admin` — all tools available
2. **Campaign Admin**: Access your campaign — debug tools work if test campaign
3. **Test Campaign**: Set `is_test_campaign: true` to enable debug tools
4. **Competitive Campaign**: Debug tools blocked for campaign admins

---

**Last Updated**: 2026-05-26  
**Status**: Production-ready with documented limitations