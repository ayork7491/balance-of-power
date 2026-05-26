# Setup Phase Architecture Notes

## Overview

The Setup Phase consists of three sequential sub-phases that run before Round 1 begins:

1. **`faction_selection`** — players choose army factions in randomized order
2. **`territory_draft`** — players claim territories via snake draft
3. **`initial_deploy`** — players privately stage starting troops (simultaneous reveal)

All setup state lives on the `Campaign` entity (current_phase, setup_order, setup_current_index, etc.).

---

## Phase 1: Faction Selection

**Flow:**
1. Admin starts campaign → `startCampaign()` → Campaign status `lobby→active`, phase set to `faction_selection`
2. `setupPhase { action: initSetup }` is invoked → Fisher-Yates shuffle (seeded by campaign.id) sets `Campaign.setup_order`
3. Players pick factions in order defined by `setup_order` / `setup_current_index`
4. Each pick: `setupPhase { action: selectFaction, faction_name }` — validates turn, uniqueness, logs event
5. Skip available: `setupPhase { action: skipFaction }` — logs auto_submitted, advances turn
6. Last player picks → phase auto-advances to `territory_draft`

**Public data:** All faction selections are public (visible in SetupInfoPanel log).  
**Private data:** None in this phase.

---

## Phase 2: Territory Draft

**Flow:**
1. Campaign enters `territory_draft` — `draft_picks_remaining` set to `floor(totalTerritories × draftPct) × playerCount`
2. Snake draft: direction alternates forward/backward when reaching list ends
3. Active player clicks territory on map → `TerritoryDraftPanel` confirms → `setupPhase { action: pickTerritory, territory_id }`
4. Server validates: unclaimed, caller's turn
5. `TerritoryState` created with `owner_player_id`
6. When `draft_picks_remaining` reaches 0: phase auto-advances to `initial_deploy`
   - `PhaseDecision` stubs created for all active players (one per player, `is_locked: false`)

**Draft percentage:** `campaign.settings.draft_percentage ?? 0.6` (from gameplay config, not hardcoded)  
**Territory count:** Derived from `TerritoryState` records for the campaign's map; falls back to 36 for V1 Standard Map  
**Public data:** All territory picks are public (logged to SetupLog with `is_public: true`)  
**Private data:** None in this phase.

---

## Phase 3: Initial Deployment

**Flow:**
1. Campaign enters `initial_deploy` — each player has a `PhaseDecision` stub
2. Players privately stage troop placement: `initialDeploy { action: stageTroops, placements: { territory_id: count } }`
   - Stored in `PhaseDecision.data.placements` — NEVER sent to other clients
3. Players lock when all troops placed: `initialDeploy { action: lockDeploy }`
   - If troops remain, server auto-distributes randomly (seeded by campaign+player id)
   - Writes `player_locked` event to SetupLog (`is_public: true`)
4. Admin triggers reveal: `initialDeploy { action: processPhaseEnd }`
   - Auto-submits any unlocked players (seeded random)
   - Applies all placements to `TerritoryState.troop_count`
   - Advances campaign to `current_phase: deploy`, `current_round: 1`

---

## Privacy Model

### What is PUBLIC (visible to all players)

| Data | Entity | Notes |
|------|--------|-------|
| Faction choices | `CampaignPlayer.faction_name` | Set on pick |
| Territory ownership | `TerritoryState.owner_player_id` | Created on draft pick |
| Draft order | `Campaign.setup_order` | Randomized, not hidden |
| Who has locked | `SetupLog: player_locked` | is_public=true |
| Phase transitions | `SetupLog: phase_advanced` | is_public=true |
| Draft picks | `SetupLog: territory_picked` | is_public=true |

### What is PRIVATE (never sent to other clients)

| Data | Entity | Protected by |
|------|--------|--------------|
| Troop placements | `PhaseDecision.data.placements` | Not fetched client-side |
| Staging events | `SetupLog: troop_staged` | is_public=false; query filters server-side |
| Auto-submit placements | `SetupLog: auto_submitted` | is_public=false |

---

## How Lock Status is Safely Exposed

The key challenge: players must see WHO has locked, but must NOT see WHERE troops are placed.

**Solution: `getDeployLockStatus` backend function**

- Called by `useDeployLockStatus` hook in `InitialDeployPanel`
- Server fetches all `PhaseDecision` records with `asServiceRole`
- Returns ONLY `{ player_id, is_locked }` — the `data` field (placements) is stripped before response
- Authenticated: caller must be a player in the campaign
- No client-side filtering: the server never sends placement data in this path

**Why not use client-side filtering?**
The old approach fetched all `PhaseDecision` records and then filtered. Even if the UI filtered the `data` field, it would still arrive in the network response. The `getDeployLockStatus` function ensures placement data never leaves the server.

---

## Setup Log Privacy

`SetupLog` records are created with `is_public: true` or `is_public: false`:
- `useSetupLogs` hook queries `{ campaign_id, is_public: true }` — private logs are never fetched
- Real-time subscription also guards: only `is_public=true` events are appended

**Base44 limitation:** The entity query filter `{ is_public: true }` is applied server-side, but Base44 does not enforce row-level access control on entity IDs. A client that somehow obtained a private SetupLog ID could fetch it directly. For V1, this is acceptable because:
- Log IDs are non-guessable UUIDs
- Private logs (troop_staged) contain no secrets beyond what processPhaseEnd reveals anyway
- True RLS would require a backend function for all log reads (not worth the complexity in V1)

---

## Feature Module Structure

```
features/campaigns/setup/
  index.js               — public exports
  useInitialDeploy.js    — own PhaseDecision data + stageTroops/lockDeploy actions
  useDeployLockStatus.js — lock status only (no placements), via getDeployLockStatus fn
  useSetupLogs.js        — public-only SetupLog query + real-time subscription

functions/
  setupPhase.js          — faction_selection + territory_draft phase transitions
  initialDeploy.js       — initial_deploy staging, locking, and processPhaseEnd
  getDeployLockStatus.js — safe lock-status endpoint (strips placement data)
```

---

## Intentionally Not Implemented Yet

- **Deploy phase (Round 1+):** Troop reinforcement logic for regular rounds
- **Attack phase:** Battle card creation, adjacency validation, attack rules
- **Battle resolution:** Tabletop scaling, result entry, troop loss application
- **Fortify phase:** Connected-territory movement with distance limits
- **Building/structures:** Castle, barracks, stables — resource economy not designed yet
- **Random territory assignment:** The 40% of territories NOT claimed in draft remain unclaimed for now; assignment logic not implemented
- **Turn timers / phase_deadline:** The `Campaign.phase_deadline` field exists but is not enforced
- **Player elimination during setup:** `is_eliminated` guards exist but elimination during setup is not triggered