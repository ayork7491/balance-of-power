# Battle Card System — Design Notes

> **Authoritative engine:** `functions/battlePhase` (Deno backend)
> **Shared constants:** `config/battleConstants.js`
> **Deprecated frontend copy:** `services/rules-engine/battle/battleResolution.js` — do not use

---

## Overview

Battle cards represent conflicts requiring tabletop resolution. Generated at the end of the attack phase, they encode the battle type, participants, troop counts, and scaling factors needed for players to resolve battles on the tabletop.

---

## Battle Card Lifecycle

### Status Transitions

```
[pending / awaiting_result]
  │
  ├─ unanimous auto_resolve  ──→ auto_resolved ──→ result_applied
  ├─ unanimous delay         ──→ delayed
  ├─ forfeit(s) tallied      ──→ forfeited ──→ result_applied
  │
  ├─ admin submits result    ──→ result_submitted
  │     └─ participants approve ──→ resolved ──→ result_applied
  │     └─ participant flags ──→ awaiting_approval
  │           └─ admin override ──→ resolved ──→ result_applied
  │
  └─ processPhaseEnd (force) ──→ auto_resolved ──→ result_applied

[delayed] ──→ processPhaseEnd ──→ active_carryover (next round)

[active_carryover]
  ├─ result submitted        ──→ pending_approval
  │     └─ approved          ──→ resolved ──→ result_applied (resolved_in_battle_round = N)
  └─ processPhaseEnd         ──→ auto_resolved ──→ result_applied
```

### Canonical Statuses

| Status | Description |
|--------|-------------|
| `pending` | Battle card generated, waiting for players to play on tabletop |
| `awaiting_result` | Players should submit result |
| `result_submitted` | Result submitted, awaiting approval from other participants |
| `awaiting_approval` | Disputed or waiting on approvals |
| `resolved` | All participants approved — territories updated |
| `auto_resolved` | System auto-resolved (timeout or admin force) |
| `delayed` | Card paused this round — carried to next round as `active_carryover` |
| `active_carryover` | Carried-over card, active in the new round |
| `pending_approval` | Carryover card: result submitted, awaiting sign-off |
| `forfeited` | Resolved by forfeit preference tally |

### `resolved_in_battle_round`

When a carryover card is finally resolved, `resolved_in_battle_round` is stamped with the **current round** number. This is used by `getBattleCards` to surface resolved carryover cards only during the phase they were resolved — preventing stale cards from cluttering the battle panel in future rounds.

---

## Battle Result Schema

```json
{
  "winner_player_id": "string (CampaignPlayer.id)",
  "surviving_tabletop_troops": "number (0–tabletop_size)",
  "notes": "string (optional)",
  "submitted_by": "string (CampaignPlayer.id)",
  "submitted_at": "ISO timestamp",
  "result_source": "manual | auto | forfeit",
  "applied_at": "ISO timestamp (when territory updates applied)"
}
```

**Key fields:**
- `result_source`: Distinguishes manual player submission from auto-resolution or forfeit
- `applied_at`: Set when territory updates are applied
- `result_applied` (boolean on BattleCard): Idempotency guard — prevents double-application

---

## Battle Types

| Type | Attackers | Defender | Notes |
|------|-----------|----------|-------|
| `skirmish` | 1 | 0 (neutral/vacated) | Auto-resolved, no card generated |
| `siege` | 1 | 1 (live) | Standard 1v1 battle card |
| `double_siege` | 2+ | 1 (live) | Multi-attacker vs defender |
| `capture_objectives` | 2+ | 0 (neutral/vacated) | Multi-attacker vs empty territory |
| `bloodbath` | 2 (mutual) | none | Mutual attack — special resolution |

---

## Battle Preference System

Each participant submits one preference per card before voting closes:

| Preference | Meaning |
|---|---|
| `play_tabletop` | Default — play the battle on the tabletop |
| `auto_resolve` | Vote to skip tabletop, resolve automatically |
| `delay` | Vote to delay the battle to next round |
| `forfeit` | Concede — lose all committed troops |

### Tally Rules (closeBattleVoting / tallyAllCards)

- Forfeiting players are **excluded** from unanimity checks.
- Remaining players: if ALL vote `auto_resolve` → auto-resolved immediately.
- Remaining players: if ALL vote `delay` → card status set to `delayed`.
- Any forfeit(s) with one remaining active player → forfeit resolved, winner takes territory.
- `double_siege` partial forfeit (1 attacker forfeits): card **converted in-place** to a standard `siege` between the remaining attacker and defender. Converted card preserves remaining participants' preferences.
- Otherwise: card stays open for tabletop play.

---

## Bloodbath Resolution

**Scenario:** Two players mutually attack each other's territories in the same phase (A↔B).

### Standard Resolution

1. One battle card is generated with `is_mutual: true`
2. Winner's survivors placed in the captured loser origin territory (split if winner origin still held)
3. If winner still owns their origin AND loser vacated: split survivors (half to loser's origin, half to winner's origin)
4. If loser held their garrison: all winner survivors return to winner's origin

### Edge Cases (Sprint 2)

**Winner's origin captured by third party:**
- Winner's origin was taken during the same attack phase
- All survivors go entirely to the loser's territory (no split)
- No troops are placed in the captured origin

**Recovery Siege (homeless survivors):**
- Winner's origin captured AND loser held their territory → survivors have nowhere to go
- A new `siege` BattleCard is automatically generated:
  - `round: current_round + 1`
  - `status: active_carryover`
  - `result.recovery_siege: true`
  - Winner's surviving troops attack their own former origin
- Ensures no survivors are silently lost

---

## Double Siege

### Defender Forfeits
Territory becomes unclaimed. Both attackers retain their committed troops (return to origin).

### All Attackers Forfeit
Defender holds the territory with their full committed troop count.

### One Attacker Forfeits (Partial Forfeit)
The forfeiting attacker loses their committed troops. The card is **converted in-place** to a normal `siege` between the remaining attacker and the defender. The conversion history is recorded in `result.conversion_history`.

---

## Auto-Resolve

### When It Happens

1. Unanimous `auto_resolve` preference tally
2. Admin manually calls `autoResolve` action
3. `processPhaseEnd` runs and battle is still `pending` / `awaiting_result` (force-advance path)

### Algorithm

```
1. Build sides: each participant with their BOP troop count
2. Weighted random winner by troop contribution
3. Winner retains 60–90% of their committed tabletop troops (random)
4. seed = `${campaign_id}:${round}:${card.id}` — deterministic
```

Special case — double siege: defender win probability = defender_troops / total_troops.

---

## Troop Scaling

```
scale_factor = max(totalTroopsInBattle / avgBattleSize, 1.0)
tabletop_size = round(totalTroopsInBattle / scale_factor)

After tabletop battle:
bop_survivors = round(tabletop_survivors / tabletop_size × totalTroopsInBattle)
bop_survivors = min(bop_survivors, committed_bop_troops)  ← never exceeds committed
```

Scaling helper functions live in both:
- `services/rules-engine/battle/battleClassification.js` (frontend, used by attack phase)
- `functions/battlePhase` (backend, inlined — no local imports allowed in Deno)

---

## Carryover System

### Round N → Round N+1

1. Round N battle phase: card created, players vote, tabletop played
2. Admin clicks "Advance to Fortify": `processPhaseEnd` runs
3. Cards with `status: delayed` are promoted → `status: active_carryover` with preferences/votes reset
4. Campaign `locked_territory_ids` updated to include all carryover card territories
5. Round N+1 battle phase: `getBattleCards` returns both new-round cards AND active carryover cards

### Blocking Rule

Admin cannot advance past the battle phase if ANY `active_carryover` or `pending_approval` cards exist (unless `force: true` is passed).

### getBattleCards Filter

- **Unresolved carryover**: always returned (actionable)
- **Resolved carryover**: returned **only** if `resolved_in_battle_round === currentRound` (show once, then history)

---

## Duplicate Result Prevention

`result_applied: true` is set immediately after territory updates are written. All resolution paths check this flag before applying updates, ensuring idempotent phase-end processing.

---

## Known Base44 Constraints

### No Local Imports in Backend Functions

Base44 deploys each backend function independently. Cannot import from `services/` or `config/`.

**Pattern:**
- Frontend constants → `config/battleConstants.js`
- Backend inlines the same logic/values directly in `functions/battlePhase`
- `services/rules-engine/battle/battleClassification.js` still used by `attackPhase` (frontend-safe import)
- `services/rules-engine/battle/battleResolution.js` — **DEPRECATED**, see header

### No Server-Side Events

Frontend polls `getBattleCards` (manual reload on action, no auto-poll).

---

## Files — Battle System

| File | Status | Purpose |
|------|--------|---------|
| `functions/battlePhase` | ✅ Active (authoritative) | Full battle lifecycle backend |
| `config/battleConstants.js` | ✅ Active | Shared enums: types, statuses, preferences |
| `services/rules-engine/battle/battleClassification.js` | ✅ Active | Classification + scaling helpers (used by attackPhase) |
| `services/rules-engine/battle/battleResolution.js` | ⚠️ Deprecated | Old frontend prototype — do not use |
| `components/phases/battle/BattlePanel` | ✅ Active | Battle phase left-dock panel |
| `components/phases/battle/BattleCardRow` | ✅ Active | Compact battle card list row |
| `components/phases/battle/BattleCardDetail` → `pages/BattleCardDetail` | ✅ Active | Full detail view |
| `components/phases/battle/BattlePreferencePanel` | ✅ Active | Preference voting UI |
| `components/phases/battle/BattleTypeTag` | ✅ Active | Badge component |
| `components/phases/battle/BattleStatusTag` | ✅ Active | Badge component |
| `features/campaigns/battle/useBattleCards.js` | ✅ Active | Data hook |
| `pages/BattleResultEntry` | ✅ Active | Result submission form |
| `pages/AdminBattleResultEntry` | ✅ Active | Admin result management |

---

## Testing Checklist (Sprint 2 Scenarios)

- [ ] Siege: attacker wins, troops placed in target territory
- [ ] Siege: defender wins, troops stay in target territory
- [ ] Double siege: explicit winner among 3 participants
- [ ] Double siege: defender forfeit → territory unclaimed, attackers return
- [ ] Double siege: all attackers forfeit → defender holds
- [ ] Double siege: one attacker forfeits → converts to siege, plays out
- [ ] Bloodbath: winner captures loser's territory + split back to origin
- [ ] Bloodbath: winner's origin captured by 3rd party → all survivors to loser territory
- [ ] Bloodbath: homeless survivors → Recovery Siege created for next phase
- [ ] Capture objectives: multiple attackers vs empty territory
- [ ] Delay: unanimous delay → active_carryover next round
- [ ] Delay: forfeit + unanimous delay among remaining → card delayed correctly
- [ ] Auto-resolve: unanimous preference → deterministic result
- [ ] Carryover: resolved_in_battle_round stamped correctly
- [ ] Carryover: old resolved cards do NOT appear in current battle panel
- [ ] Forfeit: 1v1 forfeit → winner takes territory with committed troops
- [ ] processPhaseEnd: skips result_applied cards (idempotent)
- [ ] Recovery Siege: auto-resolves or plays out in next battle phase