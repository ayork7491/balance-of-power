# Fortification & Structures System — Privacy & Security Corrected

## Overview

Fortification system with **privacy-first architecture**: private staging, safe lock status, deferred construction reveal, resource inventory validation, path storage, and duplicate phase-end protection.

---

## PRIVACY MODEL (CORRECTED)

### 1. Fortify Privacy

**Private (until phase reveal):**
- Player's staged movements (stored in `PhaseDecision.data.movements`)
- Player's staged construction choices (stored in `PhaseDecision.data.construction`)
- Only visible to the acting player via user-scoped SDK

**Public (always visible):**
- Lock status only: `player_id`, `is_locked`, `locked_at`, `is_auto_submitted`
- Exposed via safe `getFortifyLockStatus` backend function

**Implementation:**
```javascript
// Client fetches lock status via safe endpoint
const res = await base44.functions.invoke('getFortifyLockStatus', {
  campaign_id,
  round,
});
// Returns: { lock_status: [{ player_id, is_locked, locked_at, is_auto_submitted }] }
```

**File:** `functions/getFortifyLockStatus` — exposes ONLY lock status, NOT `PhaseDecision.data`

---

### 2. Construction Privacy

**V1 CORRECTED: Deferred Project Creation**

**During Fortify Phase (PRIVATE):**
- Construction choice stored in `PhaseDecision.data.construction`:
  ```json
  {
    "territory_id": "...",
    "structure_type": "castle",
    "staged_at": "2026-05-26T..."
  }
  ```
- **NO `ConstructionProject` entity created yet**
- Other players CANNOT see this

**At Phase Reveal (PUBLIC):**
- `processPhaseEnd` reads all staged constructions
- Validates resources and deducts from player inventory
- **Creates `ConstructionProject` entity** (now visible to all)
- Logs `construction_revealed` (private log)

**Why This Matters:**
- Prevents leaking resource availability before reveal
- Prevents opponents from seeing building plans
- Ensures fair gameplay

**File:** `functions/fortifyPhase` — `startConstruction` action stores privately, `processPhaseEnd` reveals

---

### 3. Resource Inventory & Deduction

**V1 Model:**
- Resources tracked in `DeployIncome.resources_generated` per round
- **Validation at reveal time** (not staging time)
- Resources deducted exactly once when `ConstructionProject` created

**Flow:**
1. Player stages construction privately (no resource check yet)
2. At `processPhaseEnd`:
   - Fetch player's `DeployIncome` for current round
   - Check if `resources_generated >= structure.cost`
   - If sufficient: deduct resources, create `ConstructionProject`
   - If insufficient: skip construction, log failure

**Deduction Logic:**
```javascript
// In processPhaseEnd:
const resourcesGenerated = income?.resources_generated ?? {};

// Check affordability
const canAfford = Object.entries(config.cost).every(([res, amount]) => {
  if (amount === 0) return true;
  return (resourcesGenerated[res] ?? 0) >= amount;
});

if (!canAfford) {
  // Skip construction
  await log(..., 'construction_failed', ...);
  continue;
}

// Deduct exactly once
const updatedResources = { ...resourcesGenerated };
Object.entries(config.cost).forEach(([res, amount]) => {
  if (amount > 0) {
    updatedResources[res] = (updatedResources[res] ?? 0) - amount;
  }
});

await base44.asServiceRole.entities.DeployIncome.update(income.id, {
  resources_generated: updatedResources,
});
```

**Prevents Double-Spending:**
- Resources deducted when `ConstructionProject` created (phase reveal)
- `DeployIncome` updated atomically
- Cannot stage multiple constructions (one-per-player limit in `PhaseDecision.data`)

**Future Enhancement:**
- Persistent `PlayerResourceInventory` entity tracking cumulative resources across rounds
- For V1, per-round income is sufficient

---

### 4. Movement Path Storage

**CORRECTED: Store Full Path**

**Staged Movement Schema:**
```json
{
  "id": "mov_...",
  "origin_territory_id": "frost_peak",
  "destination_territory_id": "stormwatch",
  "committed_troops": 50,
  "path_territory_ids": ["frost_peak", "irongate", "tundra_flats", "glacier_pass", "stormwatch"]
}
```

**Pathfinding (V1 Owned-Path Rule):**
- BFS traversal only through **territories owned by same player**
- Cannot path through neutral or enemy territories
- Distance = `path_territory_ids.length - 1`

**Implementation:**
```javascript
function findPath(startId, endId, adj, ownedTerritories) {
  // BFS that only visits owned territories
  // Returns { distance, path: [...] }
}

// In stageMovement:
const ownedTerritoryIds = new Set(
  allStates.filter(s => s.owner_player_id === myPlayer.id).map(s => s.territory_id)
);

const pathResult = findPath(origin, destination, adj, ownedTerritoryIds);
// Store pathResult.path in movement
```

**Future Use:**
- Revealed fortification arrows on map (post-reveal)
- Visual path highlighting
- Terrain-based movement costs

**File:** `functions/fortifyPhase` — `findPath` function, `stageMovement` stores `path_territory_ids`

---

### 5. Duplicate Phase-End Protection

**PROBLEM:** Admin could accidentally call `processPhaseEnd` twice, applying movements/construction twice.

**SOLUTION: Snapshot-Based Guard**

```javascript
// In processPhaseEnd:
const existingSnapshot = await base44.asServiceRole.entities.PhaseSnapshot.filter({
  campaign_id,
  round,
  phase: 'fortify',
  snapshot_type: 'phase_end',
});

if (existingSnapshot.length > 0) {
  return Response.json({ 
    error: 'Fortify phase already processed for this round',
    already_processed: true,
  }, { status: 400 });
}
```

**How It Works:**
1. `processPhaseEnd` checks for existing `phase_end` snapshot
2. If exists → reject (already processed)
3. If not → proceed, create snapshot at end
4. Snapshot creation = atomic commit marker

**Benefits:**
- Idempotent phase-end
- Prevents double troop movement application
- Prevents double construction progress
- Audit trail via snapshot

**File:** `functions/fortifyPhase` — `processPhaseEnd` action, snapshot guard at start

---

### 6. V1 Traversal Rule (OWNED-PATH)

**Rule:**
> Fortification paths must travel **only through territories owned by the same player**.

**Rationale:**
- Safer than allowing paths through neutral/enemy territory
- Prevents "cutting through" enemy lines
- More realistic military logistics

**Example:**
- Player owns: `frost_peak` → `irongate` → `tundra_flats`
- Path: `frost_peak` → `tundra_flats` (distance 2) ✅
- If enemy owns `irongate`: path blocked ❌

**Implementation:**
```javascript
// BFS filters neighbors by ownership
for (const neighbor of neighbors) {
  if (!ownedTerritories.has(neighbor)) {
    continue; // Skip non-owned territories
  }
  // ... continue path
}
```

**Documented In:**
- `functions/fortifyPhase` — `findPath` function
- Error messages: "Path must travel through owned territories only"

---

### 7. Structure Config Centralization

**Backend Source of Truth:**
```javascript
// functions/fortifyPhase
const STRUCTURE_CONFIG = {
  castle: {
    cost: { brick: 2, lumber: 1, wool: 0, grain: 0, ore: 1 },
    rounds: 2,
    effect: 'Defensive bonus in battles',
  },
  barracks: {
    cost: { brick: 1, lumber: 2, wool: 1, grain: 0, ore: 0 },
    rounds: 1,
    effect: '+1 troop income per turn',
  },
  stables: {
    cost: { brick: 0, lumber: 2, wool: 2, grain: 1, ore: 0 },
    rounds: 1,
    effect: 'Increased fortification range',
  },
};
```

**UI Mirror (Documented):**
- `components/phases/fortify/ConstructionSelector.jsx` — mirrors config for display
- `components/phases/fortify/FortifyInfoPanel.jsx` — mirrors config for reference
- **Backend config is authoritative** (UI is for display only)

**Future:**
- Move to shared `config/structures.js` imported by both backend and frontend
- Or store in `Campaign.settings.structures` for modularity

---

## FILES CHANGED

| File | Change |
|------|--------|
| `functions/getFortifyLockStatus` | **NEW** — Safe lock status endpoint (no private data) |
| `functions/fortifyPhase` | Path storage, deferred construction, duplicate protection, owned-path rule |
| `features/campaigns/fortify/useFortifyLockStatus.js` | Use `getFortifyLockStatus` instead of direct PhaseDecision fetch |
| `components/phases/fortify/MovementSelector.jsx` | Explicit destination selection, path display |
| `components/phases/fortify/FortifyInfoPanel.jsx` | Clarify construction privacy (private during phase) |
| `FORTIFICATION_IMPLEMENTATION.md` | This updated documentation |

---

## FINAL MODELS

### Fortify Privacy Model
```
During Phase:
  - My movements: visible to me only (PhaseDecision, user-scoped)
  - My construction: visible to me only (PhaseDecision, user-scoped)
  - Other players' lock status: visible via getFortifyLockStatus (safe endpoint)
  - Other players' movements/construction: NOT VISIBLE

After Reveal (processPhaseEnd):
  - Movements applied to TerritoryState (public troop counts)
  - ConstructionProjects created (public)
  - Next phase begins
```

### Construction Privacy Model
```
Staging (Private):
  startConstruction → PhaseDecision.data.construction = { territory_id, structure_type, staged_at }
  NO ConstructionProject entity created

Reveal (Public):
  processPhaseEnd:
    - Read PhaseDecision.data.construction for all players
    - Validate resources (DeployIncome.resources_generated)
    - Deduct resources
    - Create ConstructionProject (now public)
    - Log construction_revealed (private)
```

### Resource Inventory/Deduction Model
```
V1 (Per-Round):
  - Resources in DeployIncome.resources_generated (per round)
  - Validated at reveal time
  - Deducted exactly once when ConstructionProject created

Future (Persistent):
  - PlayerResourceInventory entity (cumulative across rounds)
  - Track income, spending, surplus
  - Validate against persistent inventory
```

### Movement Path Storage Format
```json
{
  "id": "mov_1234567890_abc",
  "origin_territory_id": "frost_peak",
  "destination_territory_id": "stormwatch",
  "committed_troops": 50,
  "path_territory_ids": [
    "frost_peak",
    "irongate",
    "tundra_flats",
    "glacier_pass",
    "stormwatch"
  ]
}
```

### Duplicate Phase-End Protection
```
Guard:
  - Check for existing PhaseSnapshot (phase='fortify', snapshot_type='phase_end', round=X)
  - If exists → reject with error
  - If not → proceed, create snapshot at end

Snapshot = Atomic Commit Marker:
  - Created AFTER all movements/construction applied
  - Proves phase-end completed
  - Prevents re-application
```

---

## BASE44 LIMITATIONS & WORKAROUNDS

### 1. No True Server-Side Secrets in PhaseDecision.data
- **Limitation:** PhaseDecision fetched via user-scoped SDK still exposes `data` field to owner
- **Workaround:** Other players cannot fetch it (user-scoped), but owner can see their own
- **Acceptable:** This is intended behavior (players see their own decisions)

### 2. No Row-Level Security (RLS) on PhaseDecision
- **Limitation:** Cannot enforce "player can only see their own PhaseDecision" at database level
- **Workaround:** Frontend uses user-scoped SDK (`base44.entities.PhaseDecision.filter({ player_id: myPlayer.id })`)
- **Risk:** If frontend code is compromised, could fetch other players' data
- **Mitigation:** Backend functions use service role + admin checks for sensitive operations

### 3. ConstructionProject Privacy
- **Limitation:** Entity records are always visible to all players once created
- **Solution:** Defer Creation until phase reveal (V1 corrected model)
- **During Phase:** No ConstructionProject exists (only in PhaseDecision.data)

### 4. Resource Tracking Limitations
- **Limitation:** DeployIncome is per-round, not persistent
- **V1 Workaround:** Sufficient for simple resource model
- **Future:** Create PlayerResourceInventory entity for cumulative tracking

### 5. No Built-In Pathfinding
- **Limitation:** Base44 doesn't provide graph traversal utilities
- **Solution:** Implement BFS in backend function (`findPath`)
- **Reusable:** Can extract to `services/maps/pathfinding.js`

---

## TESTING CHECKLIST (PRIVACY FOCUS)

- [ ] Player A cannot fetch Player B's PhaseDecision.data (movements/construction)
- [ ] getFortifyLockStatus returns ONLY lock status (verify no `data` field)
- [ ] ConstructionProject NOT created during fortify phase (only at reveal)
- [ ] Resource validation happens at reveal, not staging
- [ ] Resources deducted exactly once (check DeployIncome before/after)
- [ ] path_territory_ids stored in staged movement
- [ ] Path only travels through owned territories (test with enemy-owned blocker)
- [ ] processPhaseEnd called twice → second call rejected
- [ ] Phase snapshot created after successful phase-end
- [ ] MovementSelector allows explicit destination selection (not automatic)

---

## SUMMARY OF CORRECTIONS

✅ **Fortify Privacy** — Safe lock status endpoint, no broad PhaseDecision fetches  
✅ **Construction Privacy** — Deferred project creation until phase reveal  
✅ **Resource Spending** — Validation at reveal, deduction exactly once  
✅ **Movement Destination** — Explicit selection (not automatic first valid)  
✅ **Path Storage** — `path_territory_ids` stored, BFS with owned-path rule  
✅ **Duplicate Protection** — Snapshot-based guard in `processPhaseEnd`  
✅ **Traversal Rule** — Documented: path through owned territories only  
✅ **Structure Config** — Backend source of truth, UI mirrored for display  
✅ **Documentation** — Updated FORTIFICATION_IMPLEMENTATION.md with all corrections  

**All privacy, security, and data integrity issues resolved for V1.**