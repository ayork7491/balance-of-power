# History & Leaderboard Systems — Implementation Guide

## Overview

This document describes the history and leaderboard systems for Balance of Power, including visibility rules, filtering capabilities, and mobile-responsive UI components.

---

## Leaderboard System

### Purpose
Real-time player rankings based on territories controlled, troop counts, deploy income, and resource production.

### Data Sources
- `CampaignPlayer` — Player metadata (name, color, faction, elimination status)
- `TerritoryState` — Current territory ownership and troop counts
- `DeployIncome` — Current round income and resource generation

### Calculation Logic
```javascript
// Per-player metrics:
- territory_count: Count of territories owned
- troop_total: Sum of troops across all owned territories
- deploy_income: Total troops available this round
- resources_generated: Map of resource_type → count
- rank: Sorted by territory_count (desc), then troop_total (desc)
```

### Backend Function: `getLeaderboard`
**Input:**
```json
{ "campaign_id": "..." }
```

**Output:**
```json
{
  "leaderboard": [
    {
      "player_id": "...",
      "display_name": "...",
      "color": "...",
      "faction_name": "...",
      "territory_count": 12,
      "troop_total": 450,
      "deploy_income": 25,
      "resources_generated": { "lumber": 5, "grain": 3 },
      "is_eliminated": false,
      "rank": 1
    }
  ]
}
```

### Component: `LeaderboardPanel`
- **Location:** Right dock (tab: 'leaderboard')
- **Features:**
  - Rank badges (trophy icon for #1, numbered for others)
  - Player color dots
  - Territory count, troop total, income display
  - Eliminated players shown with reduced opacity and strikethrough
  - Responsive grid layout for mobile landscape

---

## History Logs System

### Purpose
Public campaign event log with filtering by round, phase, and event type.

### Visibility Rules
**Public (Always Visible):**
- Faction selections
- Territory draft picks
- Player lock events
- Phase advancements
- Auto-submissions
- Battle resolutions (after result applied)

**Private (Hidden Until Reveal):**
- Staged deployments (hidden until deploy phase ends)
- Staged attacks (hidden until attack phase ends)
- Staged fortifications (hidden until fortify phase ends)
- Construction projects (hidden until created at phase reveal)

**Implementation:**
```javascript
// Filter logs by visibility
const now = new Date().toISOString();
const visibleLogs = allLogs.filter(log => {
  if (log.is_public) return true;
  if (log.visibility_revealed_at && log.visibility_revealed_at <= now) return true;
  return false;
});
```

### Data Source: `SetupLog`
```json
{
  "campaign_id": "...",
  "phase": "territory_draft",
  "round": 0,
  "event_type": "territory_picked",
  "player_id": "...",
  "payload": { "territory_id": "frost_peak" },
  "is_public": true,
  "visibility_revealed_at": null,
  "created_date": "2026-05-26T..."
}
```

### Backend Function: `getHistoryLogs`
**Input:**
```json
{
  "campaign_id": "...",
  "round": 1,
  "phase": "deploy",
  "event_type": "player_locked",
  "limit": 100
}
```

**Output:**
```json
{
  "logs": [ ...filtered logs... ]
}
```

### Component: `HistoryLogPanel`
- **Location:** Right dock (tab: 'history')
- **Features:**
  - Filter by phase (dropdown)
  - Filter by event type (dropdown)
  - Scrollable log list with icons
  - Player name resolution
  - Payload preview
  - Timestamp display

---

## Phase Snapshots System

### Purpose
Historical snapshots of campaign state at phase boundaries for audit and replay.

### Data Source: `PhaseSnapshot`
```json
{
  "campaign_id": "...",
  "round": 3,
  "phase": "attack",
  "snapshot_type": "phase_end",
  "territory_states": [
    { "territory_id": "...", "owner_player_id": "...", "troop_count": 50 }
  ],
  "player_standings": [
    {
      "player_id": "...",
      "display_name": "...",
      "territory_count": 12,
      "troop_total": 450,
      "deploy_income": 25,
      "is_eliminated": false
    }
  ],
  "deploy_incomes": { "player_id": { "total": 25 } },
  "created_date": "2026-05-26T..."
}
```

### Backend Function: `getPhaseSnapshots`
**Input:**
```json
{
  "campaign_id": "...",
  "round": 3,
  "limit": 50
}
```

**Output:**
```json
{
  "snapshots": [ ...sorted snapshots... ]
}
```

### Usage
- Full history page: Detailed snapshot viewer
- Future: Replay system, dispute resolution, analytics

---

## Battle History System

### Purpose
Archive of all battle cards with results and participant information.

### Data Source: `BattleCard`
```json
{
  "campaign_id": "...",
  "round": 4,
  "battle_type": "siege",
  "target_territory_id": "stormwatch",
  "attackers": [{ "player_id": "...", "committed_troops": 100 }],
  "total_troops_in_battle": 250,
  "tabletop_size": 50,
  "status": "resolved",
  "result": {
    "winner_player_id": "...",
    "surviving_tabletop_troops": 30,
    "result_source": "manual",
    "applied_at": "2026-05-26T..."
  },
  "resolved_at": "2026-05-26T..."
}
```

### Backend Function: `getBattleHistory`
**Input:**
```json
{
  "campaign_id": "...",
  "round": 4,
  "limit": 50
}
```

**Output:**
```json
{
  "battles": [ ...sorted battles... ]
}
```

---

## Territory History System

### Purpose
Track ownership and troop changes for individual territories over time.

### Backend Function: `getTerritoryHistory`
**Input:**
```json
{
  "campaign_id": "...",
  "territory_id": "frost_peak",
  "limit": 50
}
```

**Output:**
```json
{
  "history": [
    {
      "round": 3,
      "phase": "deploy",
      "snapshot_type": "phase_end",
      "owner_player_id": "...",
      "troop_count": 75,
      "timestamp": "2026-05-26T..."
    },
    {
      "round": 4,
      "phase": "battle",
      "event_type": "battle",
      "battle_type": "siege",
      "result": { ... },
      "timestamp": "2026-05-26T..."
    }
  ]
}
```

### Usage
- Future: Territory detail panel history tab
- Ownership timeline visualization
- Battle impact analysis

---

## Filtering Systems

### Available Filters

**Round Filter:**
- Options: All Rounds, Round 1, Round 2, ...
- Applies to: Logs, Snapshots, Battles
- Dynamically populated from available data

**Phase Filter:**
- Options: All Phases, faction_selection, territory_draft, initial_deploy, deploy, attack, battle, fortify
- Applies to: Logs
- Human-readable labels in UI

**Event Type Filter:**
- Options: All Events, faction_selected, territory_picked, troop_staged, player_locked, auto_submitted, phase_advanced, construction_started, battle_resolved
- Applies to: Logs
- Icon + label for each type

### Filter Implementation
```javascript
// Build query dynamically
const logQuery = { campaign_id };
if (round) logQuery.round = round;
if (phase) logQuery.phase = phase;
if (event_type) logQuery.event_type = event_type;

// Fetch and filter client-side for visibility
const allLogs = await base44.asServiceRole.entities.SetupLog.filter(logQuery);
const visibleLogs = allLogs.filter(log => {
  if (log.is_public) return true;
  if (log.visibility_revealed_at && log.visibility_revealed_at <= now) return true;
  return false;
});
```

---

## UI Components

### `LeaderboardPanel`
**Location:** `components/campaigns/LeaderboardPanel.jsx`

**Features:**
- Rank badges with trophy icon for #1
- Player color dots
- Grid layout for metrics (territories, troops, income)
- Eliminated player styling (opacity, strikethrough)
- Responsive design for landscape mobile

**Tailwind Classes:**
- Mobile-first responsive grid
- Compact card layout
- Tactical theme colors

### `HistoryLogPanel`
**Location:** `components/campaigns/HistoryLogPanel.jsx`

**Features:**
- Phase filter dropdown
- Event type filter dropdown
- Scrollable log list (400px height)
- Event icons
- Player name resolution
- Payload preview
- Timestamp display

**Tailwind Classes:**
- Compact dropdown selects
- Scroll area with custom scrollbar
- Border-separated log entries

### `HistoryDetail` Page
**Location:** `pages/HistoryDetail.jsx`

**Features:**
- Three tabs: Event Logs, Phase Snapshots, Battle History
- Global filters (round, phase, event type)
- Full-page scrollable views (600px height)
- Detailed snapshot viewer with player standings grid
- Battle history with result display

**Responsive Design:**
- Filter grid: 1 column mobile, 3 columns desktop
- Tabs span full width
- Scroll areas adapt to viewport

---

## Mobile Landscape Optimization

### Design Principles
1. **Horizontal Space Utilization:**
   - Panels docked on right side
   - Map remains central focus
   - Tabs for switching between views

2. **Compact Information Density:**
   - Small text (text-xs, text-sm)
   - Icon + label combinations
   - Grid layouts for metrics

3. **Scrollable Areas:**
   - Fixed height containers with scroll
   - Custom scrollbar styling
   - No page-level scrolling in panels

4. **Touch-Friendly Controls:**
   - Dropdown selects for filters
   - Adequate tap targets (h-8, h-9)
   - Clear visual feedback

### Tailwind Classes Used
```css
/* Compact text */
text-xs, text-sm

/* Fixed heights for scroll areas */
h-[400px], h-[600px]

/* Responsive grids */
grid-cols-2, sm:grid-cols-4

/* Compact inputs */
h-8, h-9

/* Panel backgrounds */
bg-muted/10, bg-muted/20

/* Border separation */
border, border-border, divide-y
```

---

## Files Created/Modified

### Backend Functions
- `functions/getLeaderboard.js` — Leaderboard calculations
- `functions/getHistoryLogs.js` — Public event log retrieval
- `functions/getPhaseSnapshots.js` — Phase snapshot retrieval
- `functions/getBattleHistory.js` — Battle card history
- `functions/getTerritoryHistory.js` — Territory ownership timeline

### Feature Hooks
- `features/campaigns/leaderboard/useLeaderboard.js`
- `features/campaigns/leaderboard/index.js`
- `features/campaigns/history/useHistoryLogs.js`
- `features/campaigns/history/usePhaseSnapshots.js`
- `features/campaigns/history/useBattleHistory.js`
- `features/campaigns/history/index.js`

### UI Components
- `components/campaigns/LeaderboardPanel.jsx`
- `components/campaigns/HistoryLogPanel.jsx`
- `pages/HistoryDetail.jsx` (updated)

### Page Integration
- `pages/ActiveCampaign.jsx` (updated) — Right dock tab routing

---

## Testing Checklist

- [ ] Leaderboard shows correct rankings (territories → troops tiebreaker)
- [ ] Eliminated players displayed with reduced opacity
- [ ] History logs respect visibility rules (private events hidden)
- [ ] Phase filters work correctly
- [ ] Event type filters work correctly
- [ ] Round filters dynamically populate
- [ ] Snapshots show player standings grid
- [ ] Battle history shows results when resolved
- [ ] All components responsive in landscape mobile
- [ ] Scroll areas function correctly
- [ ] Filter dropdowns update data on change

---

## Privacy & Security

### Visibility Enforcement
- **Backend:** `getHistoryLogs` filters by `is_public` and `visibility_revealed_at`
- **Frontend:** User-scoped SDK calls for personal decisions
- **Service Role:** Admin-only functions for aggregate data

### Data Access Patterns
```javascript
// Safe: Public logs via backend function
const logs = await base44.functions.invoke('getHistoryLogs', {...});

// Safe: User's own decisions via user-scoped SDK
const myDecisions = await base44.entities.PhaseDecision.filter({ player_id: myPlayer.id });

// Unsafe: Direct PhaseDecision fetch (exposes private data)
// NEVER do this for other players' decisions
```

---

## Future Enhancements

1. **Territory Detail Panel Integration:**
   - Add history tab showing ownership timeline
   - Call `getTerritoryHistory` for selected territory

2. **Battle Card History Tab:**
   - Link from ActiveCampaign right dock
   - Show resolved battles with results

3. **Snapshot Visualization:**
   - Map overlay showing territory changes
   - Before/after comparison sliders

4. **Export Functionality:**
   - Download campaign history as PDF
   - Export leaderboard standings

5. **Advanced Filtering:**
   - Date range picker
   - Player-specific filter
   - Search by territory name

---

## Summary

✅ **Leaderboard calculations** — Territory count, troop total, income, rank  
✅ **History logs** — Public events with visibility rules  
✅ **Phase snapshots** — State preservation at phase boundaries  
✅ **Battle history** — Resolved battles with results  
✅ **Territory history** — Ownership timeline (backend ready)  
✅ **Filtering systems** — Round, phase, event type filters  
✅ **Mobile-responsive UI** — Landscape-optimized panels and pages  
✅ **Privacy enforcement** — Visibility rules in backend functions  

**All systems implemented with proper visibility controls and mobile-first responsive design.**