# Responsive Layout Architecture — Balance of Power

## Philosophy

**Portrait-supported / landscape-optimized.**

Balance of Power works on both portrait and landscape orientations. Landscape is the preferred "command center" experience with permanent side docks. Portrait is a first-class mode with a map-dominant view and on-demand slide-over panels.

---

## Layout Modes

Detected via `hooks/useLayoutMode.js` using `ResizeObserver` + `orientationchange`:

| Mode | Trigger | Layout |
|------|---------|--------|
| `landscape` | `w ≥ 1024` OR `w > h AND w ≥ 640` | Full command center with side docks |
| `compactLandscape` | `w > h AND h < 420` | Landscape layout, docks default-collapsed |
| `portrait` | `h ≥ w OR w < 640` | Map-dominant + bottom sheets |

---

## Component Architecture

```
CampaignLayout (router)
  ├── useLayoutMode()
  ├── → PortraitCampaignLayout    (portrait mode)
  └── → LandscapeCampaignLayout   (landscape / compactLandscape)
```

### Landscape Layout (`LandscapeCampaignLayout`)

```
┌─────────────────────────────────────────────────────┐
│                    TopBar (44px)                    │
├───────────────┬─────────────────────┬───────────────┤
│   LeftDock    │      Map (flex-1)   │   RightDock   │
│  (Phase Panel)│                     │  (Info Panels)│
│  collapsible  │                     │  collapsible  │
├───────────────┴─────────────────────┴───────────────┤
│                   BottomRail (48px)                 │
└─────────────────────────────────────────────────────┘
```

- LeftDock: Phase action panel (deploy sliders, attack staging, etc.)
- RightDock: Tab-driven info panels (leaderboard, history, region info)
- Both docks collapse to 40px icon strip
- BottomRail tabs control RightDock content
- Map always visible in center

### Portrait Layout (`PortraitCampaignLayout`)

```
┌─────────────────────┐
│  PortraitTopBar     │  ~40px compact
├─────────────────────┤
│                     │
│   Map (flex-1)      │  Takes all remaining space
│   full width        │
│                     │
├─────────────────────┤
│  PortraitBottomNav  │  ~52px + safe area
└─────────────────────┘
       ↕ (on-demand)
┌─────────────────────┐
│  PortraitBottomSheet│  Slides up from bottom (75vh max)
│  ─── Phase Actions  │  ← "Phase" tab
│  ─── Standings      │  ← "Standings" tab
│  ─── History        │  ← "History" tab
│  etc.               │
└─────────────────────┘
```

- Map tab: sheet closed, full-map view
- Any other tab: sheet opens with relevant content
- Sheet closes on backdrop tap or map tab selection
- Sheet max-height: 75vh (stays above keyboard)

---

## Panel Routing (shared components)

No panel components are duplicated. Both layouts use:

- `PhasePanelRouter` → `leftDockContent` (phase actions)
- `RightDockRouter` → `rightDockContent` (info panels)

In portrait, these are rendered inside `PortraitBottomSheet`.
In landscape, they're rendered inside `LeftDock` / `RightDock`.

---

## Region Bonuses

**Not on the map.** Region bonuses are surfaced in:
- **Standings** tab (landscape right dock + portrait sheet)
- **Territories** tab (landscape right dock + portrait sheet)

This keeps the map viewport unobstructed in both orientations.

---

## Mobile Input Fixes

In `index.css`:
```css
@media (max-width: 768px) {
  input[type="number"], input[type="text"], ... {
    font-size: 16px !important;
  }
}
```

- Prevents iOS Safari auto-zoom on input focus
- `PortraitBottomSheet` uses `max-h-[75vh]` so content stays above soft keyboard
- All troop inputs remain reachable when keyboard is open

---

## Portrait Bottom Tabs

| Tab | Content in Portrait Sheet |
|-----|--------------------------|
| Map | — (sheet closed, full map) |
| Phase | Phase action panel (deploy, attack, etc.) |
| Battles | Battle history |
| Standings | Leaderboard + Region bonuses |
| Zones | Territory list + Region bonuses |
| History | Campaign history log |

---

## Map Interaction (Portrait)

Map interaction is identical in both orientations:
- Tap territories → handled by `MapRenderer` pointer events
- Pan → pointer drag on `MapRenderer`
- Territory detail panel → `TerritoryDetailPanel` overlays map
- Action panel → opens via "Phase" tab bottom sheet

The map uses `useLayoutMode`-agnostic pointer events — no orientation assumptions.

---

## Mobile Testing Checklist

### Portrait (Phone)
- [ ] Map visible on load (no sidebars blocking)
- [ ] Phase tab → bottom sheet opens with phase actions
- [ ] Troop inputs reachable above keyboard (sheet stays at 75vh)
- [ ] Troop inputs don't trigger zoom (font-size ≥ 16px)
- [ ] Map pan works behind open sheet (backdrop closes sheet first)
- [ ] Territory tap works → detail panel shows over map
- [ ] All 6 bottom tabs navigate correctly
- [ ] Standings tab shows region bonuses
- [ ] Safe area padding on bottom nav (iOS home indicator)
- [ ] Back to map by tapping "Map" tab or backdrop

### Landscape (Phone landscape / Tablet)
- [ ] Side docks visible (landscape mode)
- [ ] compactLandscape: docks start collapsed
- [ ] Map center column fills at least 40% width
- [ ] Bottom rail tab labels visible
- [ ] Collapse/expand docks with chevron buttons

### Desktop
- [ ] Full landscape layout
- [ ] Both docks expanded by default
- [ ] All tabs in bottom rail work

---

## Files

| File | Role |
|------|------|
| `hooks/useLayoutMode.js` | Detects landscape / portrait / compactLandscape |
| `components/layout/CampaignLayout.jsx` | Responsive router |
| `components/layout/LandscapeCampaignLayout.jsx` | Landscape command center |
| `components/layout/PortraitCampaignLayout.jsx` | Portrait map-dominant layout |
| `components/layout/PortraitTopBar.jsx` | Compact portrait top bar |
| `components/layout/PortraitBottomNav.jsx` | Portrait bottom tab nav |
| `components/layout/PortraitBottomSheet.jsx` | Slide-up panel for portrait |
| `index.css` | Mobile input zoom fix, safe area utilities |