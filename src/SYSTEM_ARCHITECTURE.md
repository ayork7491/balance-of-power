# Balance of Power — System Architecture
> **Sprint 3 pre-flight reference. Read before building any new feature.**
> For platform constraints and layout strategy see `ARCHITECTURE_NOTES.md`.
> For battle-specific deep dives see `BATTLE_NOTES.md`.

---

## Table of Contents

1. [Campaign Lifecycle](#1-campaign-lifecycle)
2. [Backend Functions](#2-backend-functions)
3. [Core Data Models](#3-core-data-models)
4. [Battle System](#4-battle-system)
5. [Future Systems (Reserved)](#5-future-systems-reserved)

---

## 1. Campaign Lifecycle

```
Campaign Creation  ──→  Lobby  ──→  Faction Selection  ──→  Territory Draft
                                                                    │
                                                           Initial Deployment
                                                                    │
                              ┌─────────────────────────────────────┘
                              │
                              ▼
                           Deploy  ◄────────────────────────────────────┐
                              │                                          │
                              ▼                                          │
                           Attack                                        │
                              │                                          │
                              ▼                                          │
                           Battle                                        │
                              │                                          │
                              ▼                                          │
                           Fortify + Construction ──→ Victory Check ─────┤
                                                            │             │
                                                       (winner found)    (no winner)
                                                            │             │
                                                            ▼             └── Next Round
                                                       Campaign Complete
```

### Phase Descriptions

| Phase | Who Acts | Visibility | Advances When |
|---|---|---|---|
| **Lobby** | All players | Public | Admin starts campaign |
| **Faction Selection** | All players | Private until locked | All players locked |
| **Territory Draft** | Players in draft order | Private pick until revealed | All territories distributed |
| **Initial Deployment** | All players | Private until reveal | All players locked → admin reveals |
| **Deploy** | All players | Private until reveal | All players locked → admin reveals |
| **Attack** | All players | Private until reveal | All players locked → admin reveals |
| **Battle** | All participants + admin | Public (battle cards) | All battles resolved → admin advances |
| **Fortify** | All players | Private until reveal | All players locked → admin advances |
| **Victory Check** | System (auto) | Public | N/A — embedded in `battlePhase.processPhaseEnd` |

### Phase Transition Ownership

- **Setup phases** (faction, draft, initial deploy): `functions/setupPhase`
- **Gameplay phases** (deploy, attack, fortify): each phase has its own backend function
- **Battle phase**: `functions/battlePhase`
- **Phase deadline automation**: `functions/autoStartPhase` (scheduled)
- **Emergency override**: `functions/forcePhaseAdvance` (admin only)

---

## 2. Backend Functions

> All functions are self-contained Deno deploy handlers in `functions/`. No cross-file imports.

### `setupPhase`

**Purpose:** Manages all three setup phases — faction selection, territory draft, and initial deployment.

**Actions:**
- `selectFaction` — player picks a faction; private until phase ends
- `draftTerritory` — player picks a territory in snake-draft order
- `stageInitialDeploy` — player stages troop placements; private
- `lockInitialDeploy` — player locks their deployment
- `revealInitialDeploy` — admin triggers reveal; applies all placements simultaneously

**Inputs:** `campaign_id`, `action`, per-action params (faction name, territory_id, placements, etc.)

**Outputs:** Success/error; entity mutations listed below

**Models touched:**
- `Campaign` — `current_phase`, `setup_order`, `setup_current_index`, `draft_picks_remaining`
- `CampaignPlayer` — `faction_name`, `color`
- `TerritoryState` — `owner_player_id`, `troop_count`
- `PhaseDecision` — draft/deploy staging data
- `SetupLog` — full audit trail
- `PhaseSnapshot` — phase-end snapshots

---

### `deployPhase`

**Purpose:** Calculates and distributes troop income at the start of each round, then manages private troop placement until reveal.

**Actions:**
- `startDeploy` — admin: creates `DeployIncome` records, creates `PhaseDecision` stubs
- `stageTroops` — player stages troop placements privately
- `lockDeploy` — player locks; once all locked, admin reveals
- `processPhaseEnd` — admin: applies all placements simultaneously, advances to `attack`

**Inputs:** `campaign_id`, `action`, territory placements map

**Outputs:** Income totals, applied troop changes, next phase

**Models touched:**
- `Campaign` — `current_phase`, `deploy_reveal_applied_at`
- `DeployIncome` — `territory_bonus`, `region_bonus`, `continent_bonus`, `total`, `resources_generated`
- `PhaseDecision` — deploy staging data (`{ placements, troops_remaining }`)
- `TerritoryState` — `troop_count`
- `PhaseSnapshot` — phase-start and phase-end snapshots
- `SetupLog` — audit trail

**Income formula:**
```
territory_bonus  = floor(owned_territories / 3) (min 3)
region_bonus     = sum of MapDefinition.regions[].control_bonus for fully controlled regions
continent_bonus  = additional bonus for full continent control
total            = territory_bonus + region_bonus + continent_bonus
```

---

### `attackPhase`

**Purpose:** Manages private attack staging during the attack window, then reveals all attacks simultaneously and generates BattleCards.

**Actions:**
- `stageAttack` — player privately commits troops from one territory to attack another
- `deleteAttack` — player removes a staged attack
- `lockAttack` — player locks; signals they are done
- `processPhaseEnd` — admin: reveals all attacks, deducts troops, generates BattleCards, advances to `battle`

**Inputs:** `campaign_id`, `action`, `origin_territory_id`, `target_territory_id`, `committed_troops`

**Outputs:** Revealed attacks, generated BattleCards, next phase

**Models touched:**
- `Campaign` — `current_phase`, `locked_territory_ids`
- `PhaseDecision` — attack staging data (`{ attacks: [...], locked }`)
- `TerritoryState` — `troop_count` (troops deducted at reveal)
- `BattleCard` — created at reveal (one per unique contested territory)
- `AttackReveal` — public record of each revealed attack
- `PhaseSnapshot` — phase-end snapshot
- `SetupLog` — audit trail

**Battle card generation rules** (from `services/rules-engine/battle/battleClassification.js`):
- Single attacker → neutral/vacated territory: `skirmish` (auto-resolved, no card)
- Single attacker → defended territory: `siege`
- Two attackers → same defended territory: `double_siege`
- Two+ attackers → neutral/vacated: `capture_objectives`
- Player A attacks B AND B attacks A: `bloodbath` (one `is_mutual: true` card)

---

### `battlePhase`

**Purpose:** Full battle lifecycle — preference voting, result submission, approval, territory application, carryover management, and Victory Check.

> **Authoritative engine.** See §4 Battle System and `BATTLE_NOTES.md` for full documentation.

**Actions:**
- `getBattleCards` — list current + carryover cards
- `setPreference` — participant sets resolution preference (play_tabletop / auto_resolve / delay / forfeit)
- `closeBattleVoting` — admin: tally preferences for one card, apply unanimous outcomes
- `tallyAllCards` — admin: tally all open cards at once
- `submitResult` — admin: submit tabletop battle result
- `approveResult` — participant approves or flags a result
- `adminOverride` — admin: force-resolve a disputed result
- `autoResolve` — admin: force auto-resolve a specific card
- `setDelayed` — admin: manually delay/resume a card
- `setForfeited` — admin: mark a winner by forfeit
- `processPhaseEnd` — admin: finalize all battles, promote delayed cards, check victory, advance to `fortify`

**Inputs:** `campaign_id`, `action`, per-action params

**Outputs:** Updated BattleCard status, territory mutations, player elimination, next phase

**Models touched:**
- `BattleCard` — all fields (see §3)
- `TerritoryState` — `owner_player_id`, `troop_count`
- `CampaignPlayer` — `is_eliminated`, `eliminated_at`
- `Campaign` — `current_phase`, `locked_territory_ids`, `status`
- `PhaseSnapshot` — battle phase-end snapshot
- `SetupLog` — audit trail

---

### `fortifyPhase`

**Purpose:** Manages private troop movement and construction staging, then reveals all simultaneously and advances to the next round's deploy phase.

**Actions:**
- `startFortify` — admin: creates `PhaseDecision` stubs for all active players
- `stageMovement` — player privately stages troop movement (BFS path-validated through owned territories)
- `deleteMovement` — player removes staged movement
- `startConstruction` — player privately stages a construction project
- `lockFortify` — player locks; signals they are done
- `processPhaseEnd` — admin: applies all movements, processes construction, advances to next round's `deploy`

**Inputs:** `campaign_id`, `action`, movement params, construction params

**Outputs:** Applied movements, construction status, next round number

**Models touched:**
- `Campaign` — `current_phase`, `current_round`
- `PhaseDecision` — fortify data (`{ movements: [...], construction: {...} }`)
- `TerritoryState` — `troop_count`, `structures`
- `ConstructionProject` — created at reveal, progressed each round
- `DeployIncome` — resources deducted at construction reveal
- `PhaseSnapshot` — phase-end snapshot
- `SetupLog` — audit trail

**Fortification validation:**
- Origin and destination must be owned by acting player
- Path must travel only through player-owned territories (BFS)
- Distance ≤ `campaign.settings.max_fortification_distance` (default 4)
- `committed_troops` ≥ 1
- Total movements ≤ `campaign.settings.max_fortifications_per_phase` (default 3)

---

### `initialDeploy`

**Purpose:** Handles the Initial Deployment phase specifically (separate from `setupPhase` for clarity). Manages reveal sequencing with a timed reveal flow.

**Models touched:** `TerritoryState`, `CampaignPlayer`, `Campaign`, `PhaseSnapshot`, `SetupLog`

---

### `autoStartPhase`

**Purpose:** Scheduled automation that auto-advances phases when their deadlines pass. Prevents campaigns from stalling if players are inactive.

**Models touched:** `Campaign` (current_phase, phase_deadline), `PhaseDecision` (auto-submits missing)

---

### `forcePhaseAdvance`

**Purpose:** Admin-only emergency override to force a phase transition regardless of player lock status.

**Models touched:** `Campaign`, `PhaseDecision` (auto-submits any unlocked), all phase-relevant entities

---

### Supporting / Query Functions

| Function | Purpose |
|---|---|
| `getCampaignOverview` | Returns campaign + players + territory states in one call |
| `getMyCampaigns` | Returns campaigns the current user is a member of |
| `getMyInvites` | Returns pending invites/join requests for the current user |
| `getLeaderboard` | Returns player standings for a campaign |
| `getDeployLockStatus` | Returns which players have locked deploy |
| `getAttackLockStatus` | Returns which players have locked attacks |
| `getFortifyLockStatus` | Returns which players have locked fortify |
| `getAllPhaseDecisions` | Returns all phase decisions for a round (admin only) |
| `getBattleHistory` | Returns resolved battle cards for history view |
| `getHistoryLogs` | Returns SetupLog entries filtered by phase/round |
| `getPhaseSnapshots` | Returns PhaseSnapshot records for history view |
| `getTerritoryHistory` | Returns ownership history for a single territory |
| `addCampaignTestPlayer` | Admin: adds a test player to a campaign |
| `createTestPlayer` | Admin: creates a test CampaignPlayer record |
| `repairTestPlayers` | Admin: repairs broken test player state |
| `repairInitialDeploy` | Admin: repairs stuck initial deploy state |
| `extractMapPackage` | Parses and imports a map definition package |

---

## 3. Core Data Models

### `Campaign`

**Ownership:** Created by admin user. `admin_user_id` is immutable after creation.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated PK |
| `name` | string | Display name |
| `admin_user_id` | string | FK → User.id — campaign owner |
| `status` | enum | `lobby \| active \| paused \| complete \| archived \| deleted` |
| `game_profile_id` | string | FK → TabletopGameProfile.id |
| `map_id` | string | FK → MapDefinition.id |
| `current_round` | number | Increments at end of each fortify phase (starts 0, gameplay starts round 1) |
| `current_phase` | enum | `faction_selection \| territory_draft \| initial_deploy \| deploy \| attack \| battle \| fortify \| complete` |
| `phase_deadline` | ISO string | When the current phase auto-advances |
| `locked_territory_ids` | string[] | Territories blocked by delayed battles (set by battlePhase) |
| `settings` | object | `max_players`, `starting_troops`, `max_attacks_per_phase`, `max_fortifications_per_phase`, `max_fortification_distance`, `battle_voting_cutoff_time`, `phase_schedule`, `victory_condition` |
| `invite_code` | string | Used for join-by-code flow |

**Lifecycle:** `lobby` → `active` (when campaign starts) → `complete` (when victory condition met). `paused`, `archived`, `deleted` are admin-only states.

---

### `CampaignPlayer`

**Ownership:** One record per user per campaign. Created at join/invite acceptance.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `campaign_id` | string | FK → Campaign.id |
| `user_id` | string | FK → User.id |
| `display_name` | string | Player name within this campaign |
| `color` | string | PlayerColorId (e.g. `crimson`, `cobalt`) — used for map rendering |
| `faction_name` | string | Selected faction from game profile |
| `is_admin` | boolean | Campaign admin privileges |
| `is_test_player` | boolean | Simulated player (admin-created) |
| `troop_count` | number | Denormalized total troops (updated at phase boundaries) |
| `is_eliminated` | boolean | Set when player owns zero territories after a battle phase |
| `eliminated_at` | ISO string | Timestamp of elimination |

**Lifecycle:** Created at lobby join → `is_eliminated = true` when all territories lost → record persists (for history).

**Acting-as system:** Admins can act as test players (`is_test_player: true`). Platform admins (`user.role = 'admin'`) can act as any player. Logic lives in `services/permissions/actingAsPermissions.js` (inlined into each backend function).

---

### `TerritoryState`

**Ownership:** One record per territory per campaign. Created at campaign start from map definition.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `campaign_id` | string | FK → Campaign.id |
| `map_id` | string | FK → MapDefinition.id |
| `territory_id` | string | Canonical territory identifier (from MapDefinition) |
| `owner_player_id` | string \| null | FK → CampaignPlayer.id. `null` = unoccupied |
| `troop_count` | number | Current troops. Always 0 when unoccupied |
| `structures` | string[] | Built structures: `castle \| barracks \| stables` |

**Lifecycle:** Created at territory draft, mutated by every game phase. Never deleted. `owner_player_id = null` means neutral/unclaimed (after defender forfeit or unclaimed capture).

**Important:** `territory_id` is the ONLY identifier — never use `key` or `territory_key`. All queries must scope by `campaign_id`.

---

### `BattleCard`

**Ownership:** Created by `attackPhase.processPhaseEnd`. One card per contested territory per round (except bloodbath: one card for the mutual pair).

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `campaign_id` | string | FK → Campaign.id |
| `round` | number | Round card was generated in |
| `battle_type` | enum | `skirmish \| siege \| double_siege \| capture_objectives \| bloodbath` |
| `target_territory_id` | string | Primary contested territory |
| `defender_player_id` | string \| null | Null for neutral/bloodbath |
| `defender_troops` | number | Troops committed by defender |
| `attackers` | array | `[{ player_id, origin_territory_id, committed_troops }]` |
| `total_attacking_troops` | number | Sum of attacker committed troops |
| `total_troops_in_battle` | number | attacker total + defender troops |
| `scale_factor` | number | `totalTroops / avgBattleSize` (min 1.0) |
| `tabletop_size` | number | `totalTroops / scale_factor` — points for the tabletop game |
| `status` | enum | See §4 |
| `is_mutual` | boolean | True for bloodbath cards |
| `result` | object | `{ winner_player_id, surviving_tabletop_troops, notes, submitted_by, submitted_at, result_source, applied_at }` |
| `result_applied` | boolean | Idempotency guard — territories already updated |
| `battle_preferences` | object | `{ [CampaignPlayer.id]: 'play_tabletop' \| 'auto_resolve' \| 'delay' \| 'forfeit' }` |
| `voting_closed` | boolean | Preferences locked; tally applied |
| `tally_result` | object | `{ outcome, tallied_at, pref_counts }` |
| `approvals` | array | `[{ player_id, approved, flagged, at }]` |
| `resolved_at` | ISO string | When battle was resolved |
| `resolved_in_battle_round` | number | Round in which a carryover card was finally resolved |

**Lifecycle:** See §4 Battle System → Status State Machine.

---

### `PhaseDecision`

**Ownership:** One record per player per phase per round. Created at phase start.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `campaign_id` | string | FK → Campaign.id |
| `player_id` | string | FK → CampaignPlayer.id |
| `phase` | string | `faction_selection \| territory_draft \| initial_deploy \| deploy \| attack \| fortify` |
| `round` | number | Round this decision belongs to |
| `is_locked` | boolean | Player has submitted — decision is final |
| `is_auto_submitted` | boolean | System submitted on behalf of player (timeout) |
| `data` | object | Phase-specific payload (see below) |
| `locked_at` | ISO string | When player locked |

**Phase-specific `data` payloads:**

| Phase | `data` shape |
|---|---|
| `deploy` | `{ placements: { [territory_id]: number }, troops_remaining: number }` |
| `attack` | `{ attacks: [{ origin_territory_id, target_territory_id, committed_troops }] }` |
| `fortify` | `{ movements: [{ id, origin, destination, committed_troops, path_territory_ids }], construction: { territory_id, structure_type } \| null }` |

**Privacy model:** Records with `is_locked = false` are **private to the owning player**. Backend functions enforce this by filtering `player_id = currentUser.id`. Phase-end reveal applies all decisions simultaneously, then marks them public via `is_locked = true`.

---

### `ConstructionProject`

**Ownership:** Created by `fortifyPhase.processPhaseEnd` when construction is revealed. One active project per player at a time.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `campaign_id` | string | FK → Campaign.id |
| `player_id` | string | FK → CampaignPlayer.id |
| `territory_id` | string | Territory where structure is being built |
| `structure_type` | enum | `castle \| barracks \| stables` |
| `round_started` | number | Round construction began |
| `rounds_required` | number | Rounds until complete (castle=2, barracks=1, stables=1) |
| `rounds_completed` | number | Progressed by `fortifyPhase.processPhaseEnd` each round |
| `total_cost` | object | `{ brick, lumber, wool, grain, ore }` |
| `resources_paid` | object | Same shape — resources already spent |
| `status` | enum | `in_progress \| completed` |
| `completed_at` | ISO string | Set when structure is added to TerritoryState |

**Lifecycle:** Staged privately in `PhaseDecision.data.construction` → created publicly at fortify reveal → completed when `rounds_completed >= rounds_required` → `TerritoryState.structures` updated.

**Structure effects (V1):**

| Structure | Cost | Rounds | Effect |
|---|---|---|---|
| `castle` | brick×2, lumber×1, ore×1 | 2 | Defensive bonus in battles |
| `barracks` | brick×1, lumber×2, wool×1 | 1 | +1 troop income per turn |
| `stables` | lumber×2, wool×2, grain×1 | 1 | Increased fortification range |

---

### `DeployIncome` _(serves as ResourceLedger for V1)_

**Ownership:** One record per player per round. Created at the start of each deploy phase.

**Key fields:**

| Field | Type | Description |
|---|---|---|
| `campaign_id` | string | FK → Campaign.id |
| `round` | number | Round number |
| `player_id` | string | FK → CampaignPlayer.id |
| `territory_bonus` | number | Troops from territory count |
| `region_bonus` | number | Troops from fully controlled regions |
| `continent_bonus` | number | Troops from fully controlled continents |
| `total` | number | Total troops available to deploy |
| `resources_generated` | object | `{ brick, lumber, wool, grain, ore }` — generated this round, deducted when construction is revealed |

**Note:** In V1, `DeployIncome.resources_generated` doubles as the player's spendable resource pool for that round. A persistent cumulative `ResourceLedger` entity is reserved for Sprint 3+ (see §5).

---

### VictoryTracker _(implicit — not a standalone entity in V1)_

Victory is checked inline in `battlePhase.processPhaseEnd`:

```
after all battles resolved:
  for each active player:
    if owns zero territories → is_eliminated = true
  if remaining_active_players <= 1:
    Campaign.current_phase = 'complete'
    Campaign.status = 'complete'
    SetupLog event: 'campaign_victory'
```

**Victory condition:** Currently only `domination` (last player standing). `score` condition is reserved (see §5).

---

## 4. Battle System

> Full documentation: `BATTLE_NOTES.md` | Constants: `config/battleConstants.js`

### Battle Types

| Type | Trigger | Tabletop Card? | Notes |
|---|---|---|---|
| `skirmish` | 1 attacker → 0-troop/neutral territory | ❌ Auto-resolved | Attacker always wins; no card needed |
| `siege` | 1 attacker → defended territory | ✅ | Standard 1v1 |
| `double_siege` | 2+ attackers → same defended territory | ✅ | Multi-attacker vs single defender |
| `capture_objectives` | 2+ attackers → neutral/vacated | ✅ | Multi-attacker race; loser survivors return |
| `bloodbath` | Player A attacks B and B attacks A simultaneously | ✅ (`is_mutual: true`) | Special territory resolution |

---

### Status State Machine

```
[pending / awaiting_result]
  │
  ├─ unanimous auto_resolve  ──→ auto_resolved ──→ result_applied = true
  ├─ unanimous delay         ──→ delayed
  ├─ forfeit(s) tallied      ──→ forfeited ──→ result_applied = true
  │
  ├─ admin submits result    ──→ result_submitted
  │     └─ participants approve ──→ resolved ──→ result_applied = true
  │     └─ participant flags ──→ awaiting_approval
  │           └─ admin override ──→ resolved ──→ result_applied = true
  │
  └─ processPhaseEnd (force) ──→ auto_resolved ──→ result_applied = true

[delayed] ──→ processPhaseEnd ──→ active_carryover (next round, preferences reset)

[active_carryover]
  ├─ result submitted        ──→ pending_approval
  │     └─ approved          ──→ resolved ──→ result_applied = true (resolved_in_battle_round = N)
  └─ processPhaseEnd         ──→ auto_resolved ──→ result_applied = true
```

---

### Preference Voting Flow

1. Each participant calls `setPreference` with one of: `play_tabletop | auto_resolve | delay | forfeit`
2. Preferences are **blind** — other players see only "Preference set", not which preference
3. Admin calls `closeBattleVoting` (one card) or `tallyAllCards` (all open cards)
4. Tally rules:
   - Forfeiting players excluded from unanimity
   - Remaining ALL `auto_resolve` → auto-resolved immediately
   - Remaining ALL `delay` → status set to `delayed`
   - Any forfeit + one remaining player → forfeit applied, winner takes territory
   - `double_siege` + one attacker forfeits → card converted in-place to `siege`
   - Otherwise → card stays open for tabletop play

---

### Carryover Flow

```
Round N:
  Card created → players vote → admin tallies
  Admin clicks "Advance to Fortify" → processPhaseEnd:
    delayed cards → status: active_carryover
    Preferences/votes reset (fresh start in new round)
    Campaign.locked_territory_ids refreshed

Round N+1:
  getBattleCards returns: current-round cards + all active_carryover cards
  Phase advance BLOCKED if any active_carryover or pending_approval cards exist
  (Admin can force with force: true)
  
  On resolution: resolved_in_battle_round = N+1
  getBattleCards filter: resolved carryover shown ONLY in the round it was resolved
```

---

### Recovery Siege Flow

Triggered when a bloodbath winner has no valid destination for their survivors:

```
Condition: winner_origin captured by 3rd party
       AND loser held their own territory (garrison present)
       
Result: survivors have NO territory to occupy

Action (buildTerritoryUpdatesWithRecovery):
  1. No territory updates applied for the original bloodbath
  2. New BattleCard created:
     - battle_type: 'siege'
     - round: current_round + 1
     - status: 'active_carryover'
     - attacker: winner_player_id with surviving troops
     - target: winner's former origin territory
     - result.recovery_siege: true
  3. SetupLog event: 'recovery_siege_created'
```

---

### Approval Flow

```
Admin submits result → status: result_submitted
  │
  ├─ Carryover card? → status: pending_approval (instead of result_submitted)
  │
  ▼
Participants call approveResult(approved: true/false, flagged: true/false)
  │
  ├─ Any participant flags → status: awaiting_approval
  │     └─ Admin calls adminOverride(force_resolve: false) → clears flags → result_submitted
  │     └─ Admin calls adminOverride(force_resolve: true) → resolves immediately
  │
  └─ All non-submitter participants approve → status: resolved → territories updated
```

---

### Troop Scaling

```
scale_factor  = max(totalTroopsInBattle / avgBattleSize, 1.0)
tabletop_size = round(totalTroopsInBattle / scale_factor)

After tabletop:
  bop_survivors = round(tabletop_survivors / tabletop_size × totalTroopsInBattle)
  bop_survivors = min(bop_survivors, committed_bop_troops)   ← safety cap
```

`avgBattleSize` comes from `TabletopGameProfile.average_battle_size` (per campaign game profile).

---

## 5. Future Systems (Reserved)

> These sections are placeholders. No implementation exists yet. Do not build without a design document.

---

### 5.1 Fortification Enhancements

**Current state:** V1 fortification is implemented (troop movement via BFS path through owned territories, distance limit, max movements per phase).

**Reserved for Sprint 3+:**
- Structure effects on fortification range (stables: extended range)
- Visual path display on map during fortify phase
- Multi-hop movement visualization

---

### 5.2 Construction (Extended)

**Current state:** Construction entity and fortifyPhase logic exist. Castle, barracks, stables are implemented. Resource deduction uses per-round `DeployIncome.resources_generated`.

**Reserved for Sprint 3+:**
- Structure gameplay effects applied during deploy/battle/fortify phases:
  - `barracks`: +1 troop income applied in `deployPhase` income calculation
  - `castle`: defensive bonus applied in `battlePhase` auto-resolve and result scaling
  - `stables`: extended fortification distance applied in `fortifyPhase` distance check
- Structure destruction when territory is captured (or not — design decision needed)
- Structure display on map renderer

---

### 5.3 Resource System

**Current state:** Resources (`brick`, `lumber`, `wool`, `grain`, `ore`) are generated per round in `DeployIncome.resources_generated` and deducted at construction reveal. No persistent cumulative ledger.

**Reserved for Sprint 3+:**
- `ResourceLedger` entity (cumulative per-player per-campaign balance)
- Resource carry-over between rounds
- Resource trading between players
- Map-territory resource assignment (which territories produce which resources)
- Resource display in deploy income panel

**Canonical types:** `types/Resources.ts` — `ResourceType`, `StructureType`

---

### 5.4 Victory Conditions

**Current state:** Only `domination` is implemented — last player with territories wins. Checked inline in `battlePhase.processPhaseEnd`.

**Reserved for Sprint 3+:**
- `score` victory condition: players accumulate points from territories/regions/objectives over rounds; winner at round limit or first to threshold
- Per-campaign configurable `victory_condition` in `Campaign.settings` (field exists, only `domination` is wired)
- Victory screen (`components/campaigns/VictoryScreen`) exists but only handles domination
- Score tracking entity (design needed)
- Leaderboard integration with score display

---

### 5.5 Scheduled Phase Automation

**Current state:** `autoStartPhase` function exists. `Campaign.phase_deadline` field exists.

**Reserved for Sprint 3+:**
- Full scheduling UI (admin sets deadlines per phase)
- Automated phase advance at deadline (cron automation wired to `autoStartPhase`)
- Player notification system (email/in-app) when phase deadline approaches
- Deadline display in campaign UI

---

*Last updated: Sprint 2 completion — 2026-06-03*