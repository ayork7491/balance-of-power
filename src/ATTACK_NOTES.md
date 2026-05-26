# Attack Phase — Architecture & Privacy Notes

## Privacy Model

### Why clients must NEVER subscribe to PhaseDecision for lock status

The Base44 real-time subscription API does not support server-side field masking.
If a client subscribes to `PhaseDecision` changes, the event payload includes the full
record including `data.attacks` — which contains every player's staged targets and troop
counts before the reveal.

**The only safe cross-player visibility channel during the attack phase is:**

```
getAttackLockStatus (backend function)
  → reads PhaseDecision as service role
  → returns ONLY { player_id, is_locked, is_auto_submitted }
  → data.attacks is NEVER included
```

`useAttackLockStatus` polls this function every 15 seconds.
It does NOT subscribe to `PhaseDecision` events.

`useAttackPhase` DOES subscribe to `PhaseDecision` events, but:
1. It uses a user-scoped SDK call — the query filters on `player_id: myPlayer.id`.
2. The subscription has a triple-guard (`campaign_id`, `player_id`, `phase`) before triggering reload.
3. The reload itself uses the user-scoped SDK — even a false-positive trigger would return only own data.

### What is safe to subscribe to

| Entity            | Safe to subscribe? | Why                                          |
|-------------------|--------------------|----------------------------------------------|
| PhaseDecision     | Own player only    | user-scoped SDK filters by player_id server-side |
| AttackReveal      | Yes (after reveal) | public records, created only at processPhaseEnd |
| Campaign          | Yes                | no attack data                               |
| TerritoryState    | Yes                | no attack data                               |
| SetupLog          | Only public rows   | private logs must be filtered client-side    |

---

## Bloodbath Deduplication

A **bloodbath** occurs when territory A attacks territory B AND territory B also attacks
territory A in the same round.

### Problem
Without deduplication, the naive per-target loop would generate:
- A BattleCard for target B (the attack from A)
- A BattleCard for target A (the attack from B)

This creates two separate cards for what should be one battle.

### Solution
A `consumedTargets: Set<string>` is maintained during `processPhaseEnd`.

For each target territory, we check if any attacker's origin is also being attacked
back from that territory. If yes, this is a bloodbath pair.

**ONE BattleCard is created** with:
- `battle_type: 'bloodbath'`
- `target_territory_id`: lexicographically first of the two territory IDs
- `attackers`: combined list from BOTH directions
- `is_mutual: true`
- `defender_player_id: null` (no single defender)

Both territory IDs are added to `consumedTargets` so neither is processed again.

If a territory is involved in multiple mutual pairs (e.g., A→B, A→C, B→A, C→A),
each pair gets its own bloodbath card. The `bloodbathKey(a, b)` function
(sorted join) ensures each pair is processed exactly once.

---

## Abandoned Territory Handling

### Spec
If a player commits **all** troops from a territory (i.e., `committed_troops === troop_count`),
the origin territory becomes **vacated** after the deduction step.

### Implementation
After deducting all committed troops (Step 1):

```
if (state.owner_player_id && state.troop_count === 0) {
  state.owner_player_id = null;  // vacated
  vacatedIds.add(tid);
}
```

Vacated territories are persisted to the DB immediately (Step 3), before battle cards are generated.

Incoming attacks against a vacated territory see `owner_player_id: null` in `postCommitStateById`
and are classified as if the territory were neutral:
- 1 attacker → `skirmish` → auto-resolved
- 2+ attackers → `capture_objectives` → battle card

This means a player who "vacates" a territory by committing all troops **loses it by default**
if anyone attacks it, even if they win their own attack elsewhere.

---

## Canonical BattleCard Types & Statuses

### Types (battle_type)
| Value                | Description                                          | Card Generated? |
|----------------------|------------------------------------------------------|----------------|
| `skirmish`           | 1 attacker vs neutral/vacated territory              | No — auto-resolved |
| `siege`              | 1 attacker vs live defender                          | Yes |
| `double_siege`       | 2+ attackers vs live defender                        | Yes |
| `capture_objectives` | 2+ attackers vs neutral/vacated territory            | Yes |
| `bloodbath`          | Mutual attacks between same two territories          | Yes — ONE card |

### Statuses (status)
| Value               | Meaning                                              |
|---------------------|------------------------------------------------------|
| `pending`           | Generated, not yet played                            |
| `awaiting_result`   | Players notified, no result entered                  |
| `result_submitted`  | Winner submitted result; awaiting approval           |
| `awaiting_approval` | Opponent notified, hasn't responded                  |
| `resolved`          | Approved, territory state updated                    |
| `auto_resolved`     | System resolved (timeout / no response)              |
| `delayed`           | Admin marked as delayed (real-life scheduling issue) |
| `forfeited`         | One participant forfeited                            |

---

## Backend Adjacency Duplication

### Why it is duplicated

Base44 backend functions are deployed as isolated Deno processes.
**Local imports between files in `functions/` are prohibited** — each function file
is a self-contained module.

The canonical adjacency data lives in:
```
features/maps/mapData.ts  (V1_ADJACENCY_PAIRS array + buildAdjacencyMap)
```

The backend functions that need adjacency validation (`attackPhase.js`) must
**inline a copy** of the adjacency pairs:
```
functions/attackPhase.js  (V1_ADJACENCY_PAIRS array + buildAdjacency + areAdjacent)
```

### How to keep them in sync

Whenever a territory connection is added, removed, or changed in `mapData.ts`:

1. Edit the `adjacency` array in `features/maps/mapData.ts` (source of truth for frontend).
2. Update the **identical** `V1_ADJACENCY_PAIRS` array in `functions/attackPhase.js`.
3. If a second map is added, create a new backend adjacency constant following the same pattern.

**Do not generate adjacency dynamically at runtime in the backend.** The inline constant
is intentional — it keeps boot time fast and avoids the need for a DB round-trip.

---

## Own Staged Attack Arrows

During the attack phase, the map renders **only the current player's own staged attacks**
as dashed arrows. Other players' attacks are not fetched and are never shown.

After `processPhaseEnd`, the phase advances to `battle`. At that point,
`useAttackReveals` loads the public `AttackReveal` records (written by the backend
during reveal) and the arrows switch to solid lines showing all attacks.

Implementation is in `pages/ActiveCampaign.jsx`:
```js
const arrowAttacks = phase === 'attack'
  ? myStagedAttacks.map(a => ({ ...a, player_id: myPlayer.id }))  // own only, dashed
  : attackReveals;  // all revealed, solid
```

The `AttackArrowLayer` component uses `revealed` prop and `myPlayerId` to decide
solid vs dashed styling per arrow.