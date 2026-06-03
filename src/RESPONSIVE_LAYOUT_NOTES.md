# Responsive Layout Notes — Balance of Power

> The app supports **both portrait and landscape** on mobile and desktop.
> Portrait mode is fully functional — there is no orientation enforcement gate.

---

## Layout Modes

Detected by `hooks/useLayoutMode.js` via ResizeObserver + orientationchange:

| Mode | Condition | Layout Component |
|---|---|---|
| `portrait` | width < 600px OR orientation = portrait | `PortraitCampaignLayout` |
| `compactLandscape` | 600–900px landscape | `LandscapeCampaignLayout` (compact=true) |
| `landscape` | width ≥ 900px landscape | `LandscapeCampaignLayout` |

`CampaignLayout` is a pure router — it reads `useLayoutMode()` and delegates to the correct layout component.

---

## Portrait Campaign Layout

File: `components/layout/PortraitCampaignLayout.jsx`

Uses a **tab bar + bottom sheet** system. No permanent sidebars.

### Tab Bar Tabs

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

## Portrait Top Bar

File: `components/layout/PortraitTopBar.jsx`

Height: **40px** (10 Tailwind units)

### Always present
- **BoP Shield + "BoP" text** → `<Link to="/">` — navigates to Home Dashboard in ALL layout modes.

### Campaign info (when campaign prop is set)
- Campaign name (truncated)
- Phase tag (compact variant)
- Countdown timer (compact variant, hidden if no deadline)
- Round number (R1, R2, …)

### Admin controls (when `isAdmin = true`)
- **Perspective selector** (compact variant) — only shown when test players exist
- **Admin Mode link** (TestTube icon) — always visible to campaign admins, links to `/campaigns/:id/admin`

---

## Landscape Campaign Layout

File: `components/layout/LandscapeCampaignLayout.jsx`

Uses a **fixed docked panel** system:
- `TopBar` — branding, phase info, countdown
- `LeftDock` — phase action panel (`PhasePanelRouter`)
- `RightDock` — info panels (battle info, leaderboard, history)
- `BottomRail` — optional supplemental controls
- Central area — `MapRenderer`

---

## Single Perspective Selector

File: `components/layout/PerspectiveSelector.jsx`

Replaces the old separate "View As" and "Act As" dropdowns with one unified "Perspective" selector.

### Behavior
- **Normal players**: selector never rendered. They always act/view as themselves.
- **Campaign admins in test mode**: dropdown shows `Self` + all test players in the campaign.
- **Selecting a perspective**: sets BOTH `actingAsCampaignPlayerId` AND `viewingAsCampaignPlayerId` to the same player.
- **Selecting "Self"**: resets both to `null`.
- Admins can **never** select other real human players — only test players.

### Compact variant (portrait)
- Minimal width, no label text, TestTube icon prefix
- Fits in 40px portrait top bar

### Full variant (landscape)
- "Perspective" label, wider select trigger

---

## Phase Panel Architecture

`PhasePanelRouter` switches on `campaign.current_phase` to render the appropriate panel:

| Phase | Left Dock Panel | Right Dock Panel |
|---|---|---|
| `faction_selection` | `FactionSelectionPanel` | `SetupInfoPanel` |
| `territory_draft` | `TerritoryDraftPanel` | `SetupInfoPanel` |
| `initial_deploy` | `InitialDeployPanel` | `SetupInfoPanel` |
| `deploy` | `DeployPanel` | `DeployInfoPanel` |
| `attack` | `AttackPanel` | `AttackInfoPanel` |
| `battle` | `BattlePanel` | `BattleInfoPanel` |
| `fortify` | `FortifyPanel` | `FortifyInfoPanel` |

---

## Battle Panel (Portrait + Landscape)

`BattlePanel` is the left-dock/Phase-tab content during the battle phase.

### Sections
1. **Summary stats** — card count, resolved count
2. **Tally All button** (admin only) — closes voting on all open cards at once
3. **Your Battles** — cards where the current player is a participant; inline preference dropdowns
4. **Other Battles** — read-only view of battles the player isn't in
5. **Resolved This Phase** — carried-over cards resolved during the current battle phase
6. **Phase advance controls** (admin) — advance or force-advance to fortify

### Carryover Display Rule
- `active_carryover` / `pending_approval` cards from prior rounds → shown in Your/Other Battles
- Resolved carryover cards → shown only if `resolved_in_battle_round === currentRound` (in "Resolved This Phase")
- All older resolved carryovers → History only

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

### Acting-as permission model (backend)
- `acting_as_player_id: null` → acts as the authenticated user's own CampaignPlayer
- `acting_as_player_id: <testPlayerId>` → allowed only if requester is campaign admin AND target is a test player
- Other real human players: **blocked**

---

## Admin Phase Advance Button

Component: `AdminAdvancePhase`
Location: Bottom of left-dock phase panel (Phase tab in portrait, LeftDock in landscape).

### Visibility conditions
- Current user is campaign admin (`myPlayer.is_admin === true`)
- Campaign is not archived
- All active (non-eliminated) players are locked for current phase

### Phase → Processor mapping

| Phase | Backend Processor |
|---|---|
| `faction_selection` | `setupPhase` |
| `territory_draft` | `setupPhase` |
| `initial_deploy` | `initialDeploy` |
| `deploy` | `deployPhase` |
| `attack` | `attackPhase` |
| `battle` | `battlePhase` (action: processPhaseEnd) |
| `fortify` | `fortifyPhase` (action: processPhaseEnd) |

---

## Mobile Testing Checklist

- [ ] BoP logo navigates to `/` in portrait
- [ ] BoP logo navigates to `/` in landscape
- [ ] Portrait tab bar switches between Map / Phase / Battles / Standings / Zones / History
- [ ] Phase bottom sheet scrollable for long panel content
- [ ] Map occupies full viewport when sheet is closed
- [ ] Perspective selector visible in portrait top bar when test players exist
- [ ] Perspective selector syncs View As and Act As to same player
- [ ] Admin Mode link (TestTube icon) visible in portrait top bar for admins
- [ ] Fortification staging does not 404 when acting as test player
- [ ] Construction staging does not 404 when acting as test player
- [ ] Admin advance button appears in Phase tab when all players locked
- [ ] Battle panel: "Your Battles" shows inline preference dropdowns
- [ ] Battle panel: "Resolved This Phase" shows only current-phase resolved carryovers