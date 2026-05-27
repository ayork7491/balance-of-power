# Admin Test Mode — Permission Model

## Permission Matrix

| User Type | Acts As | Views As | Selectors Shown |
|-----------|---------|----------|-----------------|
| Normal player | Own CampaignPlayer (always) | Own CampaignPlayer (always) | None |
| Campaign admin | Self OR test players only | Self OR test players only | Only when test players exist |
| Platform admin | Same as campaign admin | Same as campaign admin | Same as campaign admin |

## Core Rules

### A. Normal Player
- **No Acting As / Viewing As selectors** shown in TopBar.
- `effectiveActingPlayer = myPlayer` always (resolved in context).
- `effectiveViewingPlayer = myPlayer` always.
- All action buttons (claim, lock, stage, etc.) work automatically.
- `acting_as_player_id` is **not sent** in API calls (or sent as `null`).
- Backend resolves null → authenticated user's own CampaignPlayer.

### B. Campaign Admin
- By default: acts as and views as **own CampaignPlayer**.
- May delegate to **test players** (is_test_player === true) only.
- **Must NOT act as other real human players.**
- **Must NOT view other real human players' private perspective.**
- Selectors only appear when `isTestMode === true` (campaign has test players).
- Selector lists show: own player + test players only. Real human players are excluded.

### C. Platform Admin
- Same rules as Campaign Admin for acting-as/viewing-as.
- Platform debug override (acting as any player) is a backend-only capability.
- No frontend override. Must use backend service role directly.

---

## Implementation Details

### Context: `CampaignTestModeProvider`
**File:** `features/adminTestMode/CampaignTestContext.jsx`

Key resolved values:
```javascript
effectiveActingPlayer  = actingAsPlayer ?? myPlayer  // NEVER null for campaign members
effectiveViewingPlayer = viewingAsPlayer ?? myPlayer  // NEVER null for campaign members
```

`canDelegateToPlayer(playerId)`:
- Returns true only if: `playerId === myPlayer.id` OR `player.is_test_player === true`
- Returns false for all other real human players

`availableActingAsPlayers` / `availableViewingAsPlayers`:
- Filtered to own player + test players only
- Empty for non-admin users

Safe setters (`safeSetActingAs`, `safeSetViewingAs`):
- Silently reject invalid player IDs (other real humans)

### Hook: `useActingAsPayload`
**File:** `features/adminTestMode/useActingAsPayload.js`

```javascript
const { actingPlayer } = useActingAsPayload(myPlayer);
// actingPlayer = effectiveActingPlayer (always a real player, never null)

getPayload() => { acting_as_player_id: actingAsCampaignPlayerId ?? null }
// For normal players: acting_as_player_id = null → backend uses authenticated user
// For admin acting as test player: acting_as_player_id = testPlayer.id
```

### TopBar Selectors
**File:** `components/layout/TopBar.jsx`

- Only rendered when `isAdmin && isTestMode && availableActingAsPlayers.length > 0`
- Viewing As list: own player + test players only
- Acting As list: own player + test players only
- Hidden entirely for normal players

### Territory Draft
**File:** `components/setup/TerritoryDraftPanel.jsx`

Fixed: `isMyTurn = currentPickerId === resolvedActingPlayer?.id`
where `resolvedActingPlayer = effectiveActingPlayer ?? myPlayer`

Normal players: `effectiveActingPlayer = myPlayer` → turn detection works correctly.
Admin acting as test player: `effectiveActingPlayer = testPlayer` → delegates correctly.

---

## Backend: Acting-As Resolution
**File:** `services/permissions/actingAsPermissions.js`

```
resolveActingCampaignPlayer({ user, acting_as_player_id, campaignPlayers })
```

| Scenario | Result |
|----------|--------|
| `acting_as_player_id = null` | Resolve to authenticated user's own CampaignPlayer |
| `acting_as_player_id = own player id` | Allow (acting as self) |
| `acting_as_player_id = test player id`, user is campaign admin | Allow |
| `acting_as_player_id = real human player id`, user is campaign admin | **REJECT** (CANNOT_ACT_AS_REAL_PLAYER) |
| `acting_as_player_id = any player id`, user is platform admin | Allow (PLATFORM_ADMIN_OVERRIDE) |

---

## isTestMode Flag

`isTestMode = isAdmin && (players.some(p => p.is_test_player) || campaign.name includes 'test')`

- Controls whether TopBar selectors are shown
- Controls whether PhaseControls debug section is shown
- Does NOT affect normal player behavior

---

## Debug Display (Admin Test Mode Page)

The Admin Test Mode page (`/campaigns/:id/admin`) shows:
- Authenticated user identity
- Own CampaignPlayer record
- effectiveActingPlayer (resolved)
- effectiveViewingPlayer (resolved)
- Is campaign admin / platform admin
- Available acting/viewing options
- Rejection reason if delegation was blocked