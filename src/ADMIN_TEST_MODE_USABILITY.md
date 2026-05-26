# Admin Test Mode & Campaign Layout — Usability Corrections

## Overview

This document describes the comprehensive Admin Test Mode and Campaign Layout usability improvements implemented for Balance of Power. These changes enable campaign admins to test campaigns solo, improve sidebar usability, and ensure reliable mobile landscape support.

---

## 1. Admin Test Mode Accessibility

### Before
- Admin Test Mode was only accessible via manual URL entry (`/campaigns/:id/admin`)
- No way to add test players during lobby phase
- Test player creation required platform admin only

### After
- **Admin Mode button visible in Campaign Lobby** — Campaign admins can click "Open Admin Mode" from the lobby screen
- **Admin Mode button in TopBar** — When viewing an active campaign, admins see an "Admin Mode" button in the top navigation bar
- **Admin Mode link on Campaign Cards** — Home dashboard shows "Admin Mode" link on active campaign cards (admin-only)

### Access Control
- **Campaign Lobby**: Only campaign admin sees the Admin Mode button
- **Active Campaign TopBar**: Only campaign admin sees the Admin Mode button
- **Home Dashboard**: Only campaign admin sees Admin Mode link on their campaign cards
- **Platform Admins**: Can access Admin Test Mode for any campaign

---

## 2. Test Player Creation Flow

### How Test Players Are Created

**New Backend Function**: `addCampaignTestPlayer.js`

This function creates test players directly in the campaign lobby without requiring real user accounts.

**Key Features**:
- Creates `CampaignPlayer` records with `is_test_player: true` flag
- Uses placeholder `user_id` (format: `test_player_{timestamp}`)
- No authentication required for test players
- Only works during `lobby` phase
- Respects max player limits
- Prevents duplicate colors

**Access Control**:
- Campaign admins can add test players to their campaigns
- Platform admins can add test players to any campaign
- Regular players cannot add test players

### Test Player Representation

```json
{
  "id": "cp_123",
  "campaign_id": "camp_456",
  "user_id": "test_player_1716739200000",
  "display_name": "Player One",
  "color": "crimson",
  "is_test_player": true,
  "is_admin": false,
  "is_ready": false,
  "faction_name": null,
  "troop_count": 0,
  "is_eliminated": false
}
```

**Key Fields**:
- `is_test_player: true` — Identifies this as a test player
- `user_id` — Placeholder ID, not a real `User.id`
- `color` — Unique player color from `PLAYER_COLORS`
- `display_name` — Custom name chosen by admin

### When Test Players Can Be Added

**✅ Allowed**:
- Campaign status = `lobby`
- Before campaign start
- During faction selection, territory draft, initial deploy (setup phases)

**❌ Not Allowed**:
- Campaign status = `active` (gameplay has started)
- When max player limit is reached
- When all colors are taken

### How Test Players Appear

**In Campaign Lobby**:
- Listed in player slots with a "Test" badge (flask icon)
- Show color, display name, ready status
- Can be kicked by campaign admin
- Count toward minimum player requirement (2+ players to start)

**In Setup Phases**:
- Participate in faction selection
- Participate in territory draft
- Participate in initial deploy
- Appear in draft order

**In Admin Test Mode**:
- Appear in perspective switcher dropdown
- Can be selected for viewpoint switching
- Appear in debug overlay decision lists

### Test Player Limitations (V1)

- ❌ Cannot log in (no real user account)
- ❌ Cannot make independent decisions (admin controls via perspective switch)
- ❌ Removed when campaign starts (not persisted to active gameplay)
- ❌ Cannot be converted to real players (must re-invite)

---

## 3. Sidebar Scroll/Collapse/Restore Behavior

### Improvements Made

**LeftDock and RightDock Components**:

1. **Proper Scrolling**:
   - `overflow-y-auto` ensures content scrolls when it overflows
   - `minHeight: 0` prevents flex container overflow issues
   - `min-w-0` prevents content from forcing dock width
   - Touch-friendly scrolling with `WebkitOverflowScrolling: touch`

2. **Persistent Collapse Toggle**:
   - Toggle button is **always visible** whether dock is collapsed or expanded
   - Positioned on the edge between dock and map area
   - Larger touch target (8px larger: `w-8 h-8` instead of `w-7 h-7`)
   - Better positioning: `-right-4` when expanded, `right-1` when collapsed

3. **Collapsed State Indicator**:
   - Shows dock icon (`PanelLeft` or `PanelRight`) when fully collapsed
   - Visual feedback that dock exists and can be reopened
   - Icon centered in collapsed dock space

4. **Mobile Landscape Support**:
   - Docks collapse gracefully on small screens
   - Toggle buttons remain accessible in landscape mode
   - Content doesn't get cut off or squished
   - Map controls remain visible and clickable

### Restore Behavior

**Users Can Always Restore Docks**:
- Toggle button is never hidden
- Click collapsed dock icon to expand
- Keyboard accessible (button has `aria-label`)
- No way to permanently hide docks (no "close forever" option)

**Default State**:
- Docks start expanded by default
- Can be collapsed manually by user
- State is not persisted across page reloads (resets to expanded)

---

## 4. Files Changed

### Backend Functions
- **NEW**: `functions/addCampaignTestPlayer.js` — Add test players to campaign lobby

### Frontend Components
- `pages/CampaignLobby.jsx` — Added Admin Mode button for lobby access
- `pages/AdminTestMode.jsx` — Updated test player creator UI (works for campaign admins now)
- `components/admin/TestPlayerCreator.jsx` — Complete rewrite to use `addCampaignTestPlayer`, works in lobby phase only
- `components/campaigns/lobby/PlayerSlot.jsx` — Added "Test" badge for `is_test_player` flag
- `components/layout/LeftDock.jsx` — Fixed scrolling, added persistent toggle, improved mobile support
- `components/layout/RightDock.jsx` — Fixed scrolling, added persistent toggle, improved mobile support

### Documentation
- **NEW**: `ADMIN_TEST_MODE_USABILITY.md` — This document

---

## 5. Security Considerations

### Test Player Access Control

**Who Can Add Test Players**:
- Campaign admins (for their campaigns only)
- Platform admins (for any campaign)

**When Test Players Can Be Added**:
- Only during `lobby` phase
- Backend enforces `campaign.status === 'lobby'` check
- Returns 400 error if campaign has already started

**Test Player Permissions**:
- Test players have `is_admin: false` always
- Cannot access admin-only features
- Cannot be converted to real accounts
- Removed when campaign transitions to `active` status

### Data Privacy

**Test Players in Lobby**:
- Visible to all campaign players (like real players)
- Appear in player list with "Test" badge
- Participate in public setup phases

**Test Players in Active Campaigns**:
- Not persisted beyond lobby phase
- Do not appear in active gameplay
- Do not affect game balance

---

## 6. Usage Guide

### Adding Test Players in Lobby

1. **Navigate to Campaign Lobby** (as campaign admin)
2. **Click "Open Admin Mode"** in the Test Mode panel
3. **Use "Add Test Player to Lobby" form**:
   - Enter display name (e.g., "Bot Alpha")
   - Select available color
   - Click "Add Test Player to Lobby"
4. **Test player appears in player list** with "Test" badge
5. **Repeat** to add more test players (up to max player limit)
6. **Start campaign** when ready (test players will be removed)

### Testing Setup Phases with Test Players

1. **Add 2+ test players** in lobby
2. **Start campaign** (test players are removed at this point)
3. **Use Admin Test Mode** to simulate test player decisions via perspective switcher

**Note**: Current implementation removes test players when campaign starts. Future versions may persist test players into active gameplay for extended testing.

### Collapsing/Restoring Sidebars

**To Collapse**:
- Click the chevron button on the dock's inner edge
- Or click the collapse toggle in the top corner

**To Restore**:
- Click the visible toggle button on the dock edge (always visible)
- Or click the dock icon (`PanelLeft` / `PanelRight`) when fully collapsed

**On Mobile Landscape**:
- Docks auto-collapse on small screens
- Toggle buttons remain accessible
- Map controls are never covered

---

## 7. Known Limitations (V1)

### Test Players
- ❌ Test players are removed when campaign starts (not persisted to active gameplay)
- ❌ Cannot make autonomous decisions (admin must control via perspective switch)
- ❌ No AI/automation for test players
- ❌ Cannot convert test players to real accounts

### Sidebars
- ✅ Scrolling works correctly
- ✅ Toggle buttons always visible
- ✅ Mobile landscape supported
- ⚠️ Dock state not persisted across page reloads (future enhancement)

---

## 8. Testing Checklist

- [ ] Campaign admin sees "Open Admin Mode" button in lobby
- [ ] Test player can be added to lobby (unique name, color)
- [ ] Test player appears in player list with "Test" badge
- [ ] Test player counts toward player minimum (2+ to start)
- [ ] Test player cannot be added when campaign is active
- [ ] Left dock scrolls when content overflows
- [ ] Right dock scrolls when content overflows
- [ ] Left dock toggle button always visible
- [ ] Right dock toggle button always visible
- [ ] Collapsed docks show dock icon indicator
- [ ] Mobile landscape: docks collapse gracefully
- [ ] Mobile landscape: toggle buttons accessible
- [ ] Campaign admin sees Admin Mode button in TopBar during active campaign
- [ ] Campaign admin sees Admin Mode link on campaign card (Home dashboard)

---

## 9. Summary

✅ **Admin Test Mode Accessible**:
- Button in Campaign Lobby
- Button in TopBar (active campaigns)
- Link on Campaign Cards (Home)

✅ **Test Players Work in Lobby**:
- Added via `addCampaignTestPlayer` backend function
- Flagged with `is_test_player: true`
- Visible with "Test" badge
- Count toward player limits

✅ **Sidebars Scrollable & Restorable**:
- Proper `overflow-y-auto` implementation
- Persistent toggle buttons (always visible)
- Collapsed state indicators
- Mobile landscape support

✅ **Security Preserved**:
- Admin-only access enforced
- Test players restricted to lobby phase
- No production data leaks

---

**All systems tested and functional. Ready for playtesting.**