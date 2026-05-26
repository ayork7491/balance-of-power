# Battle Card System — Design Notes

## Overview

Battle cards represent conflicts requiring tabletop resolution. Generated at the end of the attack phase, they encode the battle type, participants, troop counts, and scaling factors needed for players to resolve battles on the tabletop.

---

## Battle Card Lifecycle

### Status Transitions

```
pending
  → awaiting_result  (admin sets, or auto on phase start)
  → result_submitted (participant submits result)
  → awaiting_approval (system sets, waiting for other participants)
  → resolved         (all participants approve)
  
pending → auto_resolved (admin force-resolve or timeout)
pending → forfeited     (admin sets)
```

### Canonical Statuses

| Status | Description |
|--------|-------------|
| `pending` | Battle card generated, waiting for players to play on tabletop |
| `awaiting_result` | Players should submit result (V1: same as pending) |
| `result_submitted` | Result submitted, awaiting approval from other participants |
| `awaiting_approval` | Disputed or waiting on approvals |
| `resolved` | All participants approved — ready for phase end |
| `auto_resolved` | System auto-resolved (timeout or admin force) |
| `delayed` | Admin paused this battle |
| `forfeited` | Admin marked as forfeit |

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

**Important fields:**
- `result_source`: Distinguishes manual player submission from auto-resolution
- `applied_at`: Set when `processPhaseEnd` applies territory updates
- `result_applied` (boolean on BattleCard): Prevents double-application

---

## Bloodbath V1 Rule

**Scenario:** Two players mutually attack each other's territories in the same phase (A↔B).

**Resolution:**
1. One battle card is generated with `is_mutual: true`
2. `target_territory_id` = lexicographically first of the pair
3. Winner captures **BOTH** contested territories
4. **Surviving troops are placed in `target_territory_id` ONLY**
5. Winner's origin territory remains **empty/unclaimed** (already vacated during attack phase)

**Rationale:**
- Prevents troop duplication (survivors don't appear in both territories)
- Winner gains strategic advantage (both territories) but must reinforce separately
- Simple, deterministic rule easy to implement and explain

**Example:**
```
Player A attacks from Territory_X → Territory_Y
Player B attacks from Territory_Y → Territory_X
→ Bloodbath card: target = Territory_X (lex-first)
→ A wins, 300 survivors (tabletop)
→ A captures both X and Y
→ 300 full-scale troops placed in Territory_X only
→ Territory_Y is empty (A can reinforce next round)
```

---

## Multi-Attacker Handling

### Battle Types

| Type | Attackers | Defender | Notes |
|------|-----------|----------|-------|
| `siege` | 1 | 1 (live) | Standard 1v1 |
| `double_siege` | 2+ | 1 (live) | Multiple attackers vs defender |
| `capture_objectives` | 2+ | 0 (neutral/vacated) | Multiple attackers vs empty territory |
| `bloodbath` | 2 (mutual) | none | Special case |

### Winner Selection

- **Any participant can win** (attacker or defender)
- Result submission validates `winner_player_id` is in participant list
- For multi-attacker battles, the winning attacker is **explicit** (not collapsed to first)
- Each attacker is a separate "side" in auto-resolution

### Example: Double Siege

```
Player A attacks from X → Z (100 troops)
Player B attacks from Y → Z (150 troops)
Player C defends Z (200 troops)

Battle card:
  battle_type: "double_siege"
  attackers: [
    { player_id: A, origin: X, committed: 100 },
    { player_id: B, origin: Y, committed: 150 }
  ]
  defender_player_id: C
  defender_troops: 200

Sides for auto-resolve:
  - A: 100 troops
  - B: 150 troops
  - C: 200 troops

If B wins:
  - B captures territory Z
  - B's surviving troops placed in Z
```

---

## Auto-Resolve Behavior

### When It Happens

1. Admin manually force-resolves a battle card
2. `processPhaseEnd` runs and battle is still `pending` or `result_submitted`
3. (Future) Timeout deadline expires

### Algorithm

```javascript
1. Build sides: each attacker + defender (if applicable)
2. Weighted random winner by troop contribution
3. Winner retains 60–90% of their tabletop troops (random)
4. Losers retain 0% (all committed troops lost)
```

### Determinism

Auto-resolve uses a seeded RNG:
```
seed = `${campaign_id}:${round}:${battle_card_id}`
```

Same inputs always produce same result.

---

## Result Application Timing

### Manual Resolution Flow

1. Players submit result (`result_submitted`)
2. Other participants approve/reject
3. When all approve → `resolved`
4. Admin clicks "Advance to Fortify"
5. `processPhaseEnd` runs:
   - Applies territory updates for all un-applied results
   - Sets `result_applied: true`
   - Sets `result.applied_at`

### Auto-Resolve Flow

1. Admin clicks "Force Advance" or timeout occurs
2. `processPhaseEnd` auto-resolves pending battles
3. Territory updates applied immediately
4. `result_applied: true` set

---

## Duplicate Result Application Prevention

### The Problem

Without safeguards, `processPhaseEnd` could apply the same battle result multiple times if:
- Run twice accidentally
- Battle card status already `resolved` but territory not updated

### The Solution

**`result_applied` flag on BattleCard:**

```json
{
  "result_applied": false  // default
}
```

**Logic in `processPhaseEnd`:**
```javascript
for (const card of allCards) {
  if (card.result_applied) {
    continue;  // Skip — already applied
  }
  // Apply result and set result_applied: true
}
```

**Guarantees:**
- Territory updates applied exactly once per battle
- Idempotent phase-end processing
- Safe to re-run if needed

---

## Known Base44 Limitations

### 1. No Local Imports in Backend Functions

Base44 deploys each backend function independently. Cannot import from `services/` or other files.

**Workaround:**
- Inline pure helper functions directly in `battlePhase.js`
- Keep matching versions in `services/rules-engine/battle/` for frontend use
- Document that they must stay in sync

### 2. Entity Field Size Limits

Cannot store large objects in entity fields.

**Handled by:**
- `result` object is small (winner ID, troop count, notes)
- No battle replays or detailed combat logs stored

### 3. No Server-Side Events

Cannot trigger real-time notifications.

**Workaround:**
- Frontend polls `getBattleCards` every 20s
- Manual refresh buttons

### 4. Limited Query Filtering

Cannot do complex queries (e.g., "all battles where I'm a participant").

**Workaround:**
- Fetch all battles for campaign/round
- Filter client-side

---

## Future Enhancements (Not in V1)

- [ ] Timeout deadlines per battle card
- [ ] Email/push notifications for result submissions
- [ ] Detailed combat logs (round-by-round)
- [ ] Battle replay system
- [ ] Custom scenarios / special rules
- [ ] Commander abilities affecting battles
- [ ] Terrain modifiers in auto-resolve
- [ ] Partial approval (majority rules)
- [ ] Battle card attachments (photos, rosters)

---

## Files Modified in This Pass

| File | Purpose |
|------|---------|
| `entities/BattleCard.json` | Added `result_applied` field, updated `result` schema |
| `functions/battlePhase.js` | Full lifecycle with bloodbath V1, multi-attacker, duplicate prevention |
| `pages/BattleCardDetail.jsx` | Battle detail view (created) |
| `pages/BattleResultEntry.jsx` | Result submission form (created) |
| `BATTLE_NOTES.md` | This documentation |

---

## Testing Checklist

- [ ] Bloodbath: winner captures both, survivors in one territory only
- [ ] Double siege: each attacker tracked separately, explicit winner
- [ ] Result submission: validates participant, winner is participant
- [ ] Approval flow: all non-submitter participants must approve
- [ ] Auto-resolve: deterministic, weighted random
- [ ] `processPhaseEnd`: skips `result_applied` cards
- [ ] Elimination: players with 0 territories eliminated
- [ ] Snapshot: phase-end state captured

---

## Quick Reference

### Bloodbath V1 Rule
> Winner captures BOTH territories, survivors placed in `target_territory_id` ONLY. Winner's origin remains empty.

### Multi-Attacker Rule
> Each attacker is a separate side. Winner is explicit (any participant). No collapse to first attacker.

### Result Schema
```json
{
  "winner_player_id": "...",
  "surviving_tabletop_troops": 450,
  "notes": "...",
  "submitted_by": "...",
  "submitted_at": "2026-05-26T...",
  "result_source": "manual",
  "applied_at": "2026-05-26T..."
}
```

### Duplicate Prevention
> `result_applied: true` prevents territory updates from being applied twice.