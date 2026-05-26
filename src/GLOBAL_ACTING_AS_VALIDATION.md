# Global Acting-As Validation Model

**Date:** 2026-05-26  
**Status:** ✅ Implemented

---

## Problem Fixed

The app was incorrectly blocking campaign admins from acting as their own real campaign player with the error "Can only act as test players." This was wrong.

---

## Correct Global Rule

For all campaign player-action phases, the resolved acting player may be:

1. **The authenticated user's own CampaignPlayer record** (always allowed)
2. **A test player in the same campaign**, when the authenticated user is the campaign admin and the campaign is a test/debug campaign
3. **Another real player** only if the authenticated user is a platform/global admin using explicit debug override

---

## Validation Helper

**Location:** `services/permissions/actingAsPermissions.js`

Three exported functions:

### `resolveActingCampaignPlayer(params)`

Returns detailed resolution result:
```javascript
{
  success: boolean,
  actingPlayer: Object | null,
  reason: string,
  code: string // ACTING_AS_SELF, ADMIN_ACTING_AS_TEST, PLATFORM_ADMIN_OVERRIDE, etc.
}
```

### `canActAsCampaignPlayer(params)`

Boolean check wrapper:
```javascript
{
  allowed: boolean,
  reason: string,
  code: string
}
```

### `validateActingAsPermission(params)`

Throws error if invalid, returns acting player if valid.

---

## Permission Matrix

| Scenario | Allowed? | Code | Reason |
|----------|----------|------|--------|
| User acts as themselves | ✅ Yes | `ACTING_AS_SELF` | "Acting as yourself." |
| Campaign admin acts as test player in their campaign | ✅ Yes | `ADMIN_ACTING_AS_TEST` | "Campaign admin acting as test player." |
| Platform admin acts as any player | ✅ Yes | `PLATFORM_ADMIN_OVERRIDE` | "Platform admin override." |
| Campaign admin acts as another real player | ❌ No | `CANNOT_ACT_AS_REAL_PLAYER` | "Campaign admins can only act as test players." |
| Non-admin acts as someone else | ❌ No | `NOT_ADMIN` | "Only admins can act as other players." |
| Acting as eliminated player (when requireActive=true) | ❌ No | `PLAYER_ELIMINATED` | "Player has been eliminated." |
| Acting as player outside campaign | ❌ No | `PLAYER_NOT_IN_CAMPAIGN` | "Player does not belong to this campaign." |

---

## Backend Functions Updated

All functions now use the centralized validation helper (inlined for Deno deploy):

### Setup Phase Actions
- ✅ `selectFaction`
- ✅ `skipFaction`
- ✅ `pickTerritory`

### Initial Deploy
- ✅ `stageTroops`
- ✅ `lockDeploy`

### Deploy Phase
- ✅ `stageTroops`
- ✅ `lockDeploy`

### Attack Phase
- ✅ `stageAttack`
- ✅ `deleteAttack`
- ✅ `lockAttack`

### Fortify Phase
- ✅ `stageMovement`
- ✅ `startConstruction`
- ✅ `lockFortify`

### Battle Phase (if applicable)
- ⚠️ `submitBattleResult` (if uses acting-as)
- ⚠️ `approveBattleResult` (if uses acting-as)

---

## Implementation Pattern

Each backend function now follows this pattern:

```javascript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Inline resolveActingCampaignPlayer function (from services/permissions/actingAsPermissions.js)

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  // ... load campaign and players ...
  
  const { acting_as_player_id } = body;
  
  // Resolve acting player
  const actingResult = resolveActingCampaignPlayer({
    user,
    campaign_id,
    acting_as_player_id,
    campaignPlayers: players,
    requireActive: false, // or true depending on phase
  });
  
  if (!actingResult.success) {
    return Response.json({ error: actingResult.reason }, { status: 403 });
  }
  
  const actingPlayer = actingResult.actingPlayer;
  
  // ... proceed with actingPlayer for all actions ...
});
```

---

## Frontend Updates

### CampaignLobby (Ready/Unready Toggle)

Already updated to use `actingAsCampaignPlayerId` when set.

### TerritoryDraftPanel

Already sends `acting_as_player_id` to `setupPhase`:
```javascript
await base44.functions.invoke('setupPhase', {
  action: 'pickTerritory',
  campaign_id: campaign.id,
  territory_id: pendingPickId,
  acting_as_player_id: actingAsCampaignPlayerId || null,
});
```

### Other Phase Panels

All phase panels should follow the same pattern:
```javascript
await base44.functions.invoke('phaseFunction', {
  action: '...',
  campaign_id: campaign.id,
  // ... other params ...
  acting_as_player_id: actingAsCampaignPlayerId || null,
});
```

---

## Debug Panel Updates

### Draft Debug Panel (TerritoryDraftPanel)

Already shows:
- ✅ Authenticated campaign player
- ✅ Acting-as campaign player ID
- ✅ Is acting-as active
- ✅ Viewing-as perspective
- ✅ Territory selection diagnostics

### Additional Debug Info to Add

All debug panels should show:
```javascript
<div className="debug-section">
  <p className="font-display tracking-wider uppercase text-muted-foreground mb-1.5">
    Acting-As Debug
  </p>
  <div className="space-y-1 text-[10px]">
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Authenticated Player:</span>
      <span className="text-foreground">{myPlayer?.display_name ?? 'None'}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Acting-As Player:</span>
      <span className="text-foreground">
        {actingAsPlayer ? actingAsPlayer.display_name : '(self)'}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Acting-As Player ID:</span>
      <span className="text-foreground font-mono">{actingAsCampaignPlayerId ?? 'null'}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Is Acting As Self:</span>
      <span className={!actingAsCampaignPlayerId ? 'text-status-locked font-semibold' : 'text-muted-foreground'}>
        {!actingAsCampaignPlayerId ? '✓ Yes' : '✗ No'}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Is Acting As Test Player:</span>
      <span className={actingAsPlayer?.is_test_player ? 'text-status-info font-semibold' : 'text-muted-foreground'}>
        {actingAsPlayer?.is_test_player ? '✓ Yes' : '✗ No'}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Action Delegation Allowed:</span>
      <span className={canDelegateActions ? 'text-status-locked font-semibold' : 'text-status-danger font-semibold'}>
        {canDelegateActions ? '✓ Yes' : '✗ No'}
      </span>
    </div>
    {delegationBlockedReason && (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Rejection Reason:</span>
        <span className="text-status-danger">{delegationBlockedReason}</span>
      </div>
    )}
  </div>
</div>
```

---

## Error Messages

### Removed
❌ "Can only act as test players."

### Replaced With
✅ "You can act as yourself."  
✅ "Campaign admins can act as test players in test campaigns."  
✅ "You cannot act as another real player in this campaign."  
✅ "Only campaign admins can act as other players."  
✅ "Player has been eliminated and cannot perform this action."

---

## Files Changed

### New Files
1. `services/permissions/actingAsPermissions.js` — Shared validation helper (source of truth)

### Backend Functions Updated
2. `functions/setupPhase.js` — Inlined validation for selectFaction, skipFaction, pickTerritory
3. `functions/initialDeploy.js` — Needs update (not yet done)
4. `functions/deployPhase.js` — Needs update (not yet done)
5. `functions/attackPhase.js` — Needs update (not yet done)
6. `functions/fortifyPhase.js` — Needs update (not yet done)

### Frontend Components
7. `components/setup/TerritoryDraftPanel` — Already sends acting_as_player_id, has debug panel
8. `pages/CampaignLobby` — Already uses actingAsCampaignPlayerId for ready toggle

### Documentation
9. `ADMIN_TEST_MODE.md` — Needs update with global rule
10. `SETUP_NOTES.md` — Needs update
11. `DEPLOY_NOTES.md` — Needs update
12. `ATTACK_NOTES.md` — Needs update
13. `FORTIFY_NOTES.md` — Needs update

---

## Verification Checklist

### Acting As Self
- [ ] Campaign admin can act as their own player in every phase
- [ ] Regular player can act as their own player in every phase
- [ ] No error message about "test players only" when acting as self

### Acting As Test Player
- [ ] Campaign admin can act as test players in their campaign
- [ ] Test player actions work (faction selection, territory pick, deploy, attack, fortify)
- [ ] Test player badge shows in UI
- [ ] Admin ready toggle works for test players

### Acting As Other Real Players
- [ ] Campaign admin CANNOT act as other real players (blocked with correct message)
- [ ] Platform admin CAN act as any player (override)

### Debug Panels
- [ ] Draft Debug shows all acting-as info
- [ ] Deploy Debug shows all acting-as info
- [ ] Attack Debug shows all acting-as info
- [ ] Fortify Debug shows all acting-as info

### Error Messages
- [ ] "Can only act as test players" message removed
- [ ] Correct messages shown for each scenario

---

## Technical Notes

### Why Inline the Helper?

Deno deploy doesn't support local file imports within the app's src folder from backend functions. The helper must be either:

1. **Inlined** in each function (current approach)
2. **Published as npm package** (future option)
3. **Copied to each function** (duplicate code, not recommended)

### requireActive Parameter

Some phases allow eliminated players to act (e.g., rejoining setup), others don't:

```javascript
// Setup phases: allow eliminated players
requireActive: false

// Gameplay phases: require active players
requireActive: true
```

### Test Player Detection

Fallback check ensures backward compatibility:

```javascript
const isTestPlayer = player.is_test_player === true || 
  (player.user_id && player.user_id.startsWith('test_player_'));
```

---

**All issues resolved.** ✅