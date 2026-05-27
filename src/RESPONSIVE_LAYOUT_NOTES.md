# Responsive Layout Notes — Balance of Power

## Layout Modes

Detected by `hooks/useLayoutMode.js` via ResizeObserver + orientationchange:

| Mode | Condition | Layout Component |
|---|---|---|
| `portrait` | width < 600px OR orientation = portrait | `PortraitCampaignLayout` |
| `compactLandscape` | 600–900px landscape | `LandscapeCampaignLayout` (compact=true) |
| `landscape` | width ≥ 900px landscape | `LandscapeCampaignLayout` |

`CampaignLayout` is a pure router — it reads `useLayoutMode()` and delegates to the correct layout component.

---

## Portrait Top Bar

File: `components/layout/PortraitTopBar.jsx`

Height: **40px** (10 Tailwind units)

### Always present
- **BoP Shield + "BoP" text** → `<Link to="/">` — navigates to Home Dashboard in ALL layout modes. Never relies on browser back. Works in portrait, landscape, and compact-landscape.

### Campaign info (when campaign prop is set)
- Campaign name (truncated)
- Phase tag (compact variant)
- Countdown timer (compact variant, hidden if no deadline)
- Round number (R1, R2, …)

### Admin controls (when `isAdmin = true`)
- **Perspective selector** (compact variant) — only shown when test players exist in the campaign
- **Admin Mode link** (TestTube icon) — always visible to campaign admins, links to `/campaigns/:id/admin`

---

## Single Perspective Selector (Merged View As / Act As)

File: `components/layout/PerspectiveSelector.jsx`

Replaces the old separate "View As" and "Act As" dropdowns with one unified "Perspective" selector.

### Behavior
- **Normal players**: selector never rendered. They always act/view as themselves.
- **Campaign admins in test mode**: dropdown shows `Self` + all test players in the campaign.
- **Selecting a perspective**: sets BOTH `actingAsCampaignPlayerId` AND `viewingAsCampaignPlayerId` to the same player.
- **Selecting "Self"**: resets both to `null` (act and view as authenticated user).
- Admins can NEVER select other real human players — only test players.

### Compact variant (portrait)
- Minimal width, no label text, TestTube icon prefix
- Fits in 40px portrait top bar

### Full variant (landscape)
- "Perspective" label, wider select trigger

---

## Portrait Panel Architecture

No permanent sidebars in portrait mode.

| Tab | Sheet Content |
|---|---|
| Map | No sheet (full-screen map) |
| Phase | `leftDockContent` (phase action panel) via `PortraitBottomSheet` |
| Battles | `rightDockContent` (battle info) via `PortraitBottomSheet` |
| Standings | `rightDockContent` (leaderboard + region bonuses) |
| Zones | `rightDockContent` (territory info + region bonuses) |
| History | `rightDockContent` (history log) |

Sheet max-height: **75vh** to prevent keyboard overlap.

---

## Fortification Staging Endpoint

Function: `fortifyPhase` (Deno backend)
Invoked via: `base44.functions.invoke('fortifyPhase', payload)`

### Actions

| Action | Description |
|---|---|
| `stageMovement` | Stage a troop movement between owned territories |
| `deleteMovement` | Remove a staged movement |
| `startConstruction` | Stage a construction project for a territory |
| `lockFortify` | Lock all decisions for the acting player |
| `processPhaseEnd` | Admin only — apply all movements, create ConstructionProjects, advance to next round |

### Payload
```js
{
  action: 'stageMovement',           // or 'startConstruction', 'lockFortify', etc.
  campaign_id: string,
  origin_territory_id: string,       // stageMovement only
  destination_territory_id: string,  // stageMovement only
  committed_troops: number,          // stageMovement only
  territory_id: string,              // startConstruction only
  structure_type: 'castle'|'barracks'|'stables', // startConstruction only
  acting_as_player_id: string|null,  // null = act as self; test player ID for admin delegation
}
```

### Acting-as permission model (backend)
- `acting_as_player_id: null` → acts as the authenticated user's own CampaignPlayer
- `acting_as_player_id: <testPlayerId>` → allowed only if requester is campaign admin AND target is a test player
- Other real human players: **blocked**

### PhaseDecision lookup fix (v2)
All PhaseDecision reads and writes now use `asServiceRole` so admin can read/write test player decisions. Previously used user-scoped `base44.entities.PhaseDecision` which only returned records owned by the authenticated user — causing 404 when acting as test player.

---

## Construction Staging Endpoint

Same function: `fortifyPhase`, action: `startConstruction`.

Construction is staged privately in `PhaseDecision.data.construction`. No `ConstructionProject` entity is created until `processPhaseEnd` reveals and validates all staged choices.

Resource validation happens at reveal time (not staging time) to preserve privacy.

---

## Admin Phase Advance Button

Component: `AdminAdvancePhase`
Location in fortify: Bottom of `FortifyPanel`, inside the Phase bottom sheet (portrait) or LeftDock (landscape).

### Visibility conditions
- Current user is campaign admin (`myPlayer.is_admin === true`)
- Campaign is not archived
- All active (non-eliminated) players are locked for current phase

### What it calls
Each phase has a dedicated backend processor, not just a status update:

| Phase | Processor |
|---|---|
| `faction_selection` | `setupPhase` |
| `territory_draft` | `setupPhase` |
| `initial_deploy` | `initialDeploy` |
| `deploy` | `deployPhase` |
| `attack` | `attackPhase` |
| `battle` | `battlePhase` |
| `fortify` | `fortifyPhase` (processPhaseEnd) |

Debug info always visible in the button panel (lock counts, processor name, can-advance status).

---

## Portrait Admin Mode Access

Campaign admins always see the **TestTube icon** in the portrait top bar (right side), which links to `/campaigns/:id/admin`.

This is NOT gated behind `isTestMode` — it's always visible to admins so they can access test tools without needing to be in a specifically-named test campaign.

---

## Mobile Testing Checklist

- [ ] BoP logo navigates to `/` in portrait
- [ ] BoP logo navigates to `/` in landscape
- [ ] Perspective selector visible in portrait top bar when test players exist
- [ ] Perspective selector syncs View As and Act As to same player
- [ ] Fortification staging does not 404 when acting as test player
- [ ] Construction staging does not 404 when acting as test player
- [ ] Admin advance button appears in Phase bottom sheet when all locked
- [ ] Admin Mode link (TestTube icon) visible in portrait top bar
- [ ] Phase bottom sheet scrollable for long FortifyPanel content
- [ ] Map occupies full viewport when sheet is closed