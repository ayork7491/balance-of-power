# Campaign System Notes

## Overview

Campaigns are the top-level game sessions in Balance of Power. Each campaign runs a complete territorial strategy game between 2–8 players using a configured TabletopGameProfile.

---

## Base44 Entity Approach

The campaign system uses three Base44 entities:

| Entity | Purpose |
|---|---|
| `Campaign` | Top-level campaign record — name, status, settings, invite code |
| `CampaignPlayer` | One record per player per campaign — color, name, faction, ready state |
| `CampaignInvite` | Tracks both admin-sent invites and player join requests |

All mutations go through `features/campaigns/useCampaigns.js`. Pages and components never call `base44.entities` directly.

---

## Campaign Lifecycle Statuses

```
lobby → active → paused → complete → archived
```

| Status | Description |
|---|---|
| `lobby` | Pre-game. Players join, set up, and ready up. New players can join. |
| `active` | Game is running. Phases advance. No new players can join. |
| `paused` | Admin has paused the campaign. No phase advancement. |
| `complete` | A victory condition has been met. Game is over. Read-only. |
| `archived` | Admin has archived the campaign. Hidden from dashboards. |

---

## Lobby Status vs Active Status

**Lobby (`status: "lobby"`):**
- Campaign exists but has not started.
- Players can join via invite code or email invite.
- Players configure their display name, color, and faction.
- Players toggle their ready state.
- Admin can kick players and send invites.
- Admin can start the campaign once all players are ready (minimum 2).

**Active (`status: "active"`):**
- Campaign has started. `current_round` is 1+, `current_phase` is set.
- No new players may join.
- Existing players interact with phase logic (deploy, attack, etc.).
- Phase advancement is TBD in V2 (manual admin trigger for now).

---

## Invite Flow (Admin → Player)

1. Admin opens the lobby's **Invites** tab and enters a player's email.
2. A `CampaignInvite` record is created: `type: "invite"`, `status: "pending"`.
3. The invited player opens `/campaigns/join` and sees the invite in their inbox.
   - Matching is by `invitee_email` (before account creation) or `invitee_user_id`.
4. Player clicks **Accept** → enters their display name + picks a color.
5. `acceptInviteAndJoin()` creates a `CampaignPlayer` record and marks the invite `accepted`.
6. Guards enforced at accept time:
   - Invite must still be `pending`.
   - Campaign must still be in `lobby`.
   - Player must not already be in the campaign.

---

## Join Request Flow (Player → Admin)

1. Player opens `/campaigns/join` and enters the campaign's invite code.
2. `requestToJoinByCode()` creates a `CampaignInvite`: `type: "join_request"`, `status: "pending"`.
   - `invitee_user_id` is populated with the current user's ID immediately.
3. Admin sees the request in the **Invites** tab of the lobby.
4. Admin clicks **Approve** → `approveJoinRequest()` is called.
5. Guards enforced at approval time:
   - `invitee_user_id` must be present (non-null).
   - Campaign must still be in `lobby`.
   - Player must not already be in the campaign.
   - Invite must still be `pending`.
6. On approval: a `CampaignPlayer` record is created; invite is marked `accepted`.

---

## Start Campaign Validation

`startCampaign(campaignId, adminUserId, players)` enforces these guards server-side before writing:

1. **Admin check** — `campaign.admin_user_id` must match the calling user's ID.
2. **Lobby check** — `campaign.status` must be `"lobby"`.
3. **Minimum players** — at least 2 `CampaignPlayer` records must exist.
4. **All ready** — every player must have `is_ready: true`.

If any guard fails, a descriptive `Error` is thrown and the UI surfaces the message directly.

---

## Campaign Settings Field Names (Canonical)

These are stored under `Campaign.settings` in the entity and defined in `features/campaigns/types.ts`:

| Field | Type | Default | Constraint |
|---|---|---|---|
| `max_players` | number | 6 | 2–8 |
| `starting_troops` | number | 30 | > 0 |
| `max_attacks_per_phase` | number | 3 | > 0 |
| `max_fortifications_per_phase` | number | 3 | > 0 |
| `max_fortification_distance` | number | 4 | > 0 |
| `phase_schedule` | `weekly\|monthly\|manual` | `weekly` | — |
| `battle_day` | string (day name) | `saturday` | — |
| `allow_faction_duplicates` | boolean | `false` | — |
| `victory_condition` | `domination\|score` | `domination` | — |

> **Do not use camelCase variants** (`maxPlayers`, `defaultStartingTroops`, etc.). Those are engine-internal constants in `config/gameplay.ts` and are never stored on entities.

---

## Player Uniqueness Constraints (Lobby)

Within a single campaign:
- **Display names** must be unique (case-insensitive).
- **Colors** must be unique.
- These are enforced in `PlayerSetupPanel` before calling `updatePlayerSetup`.

---

## Known Platform Limitations

- **No server-side RLS on CampaignPlayer**: Any authenticated user can technically call `CampaignPlayer.filter`. Guards are client-enforced in `useCampaigns.js`. Future: add backend functions for sensitive mutations.
- **Real-time subscriptions are for CampaignPlayer only**: `Campaign` and `CampaignInvite` changes require a manual `reload()` call. Future: subscribe to all three entities in the lobby hook.
- **Invite code uniqueness**: Codes are generated randomly client-side (`Math.random().toString(36)`). Collision probability is low for V1 but not zero. Future: use a backend function to guarantee uniqueness.
- **Email matching for invites**: Invites sent before a user registers are matched by `invitee_email` string. If the user registers with a different email, they won't see the invite.

---

## What Is Intentionally Not Implemented Yet

- **Map system** — `map_id` is stored as a placeholder string (`map_v1_standard`). Territory, region, and adjacency data are not yet built.
- **Draft phase** — territory assignment logic (both player-choice and random) is deferred to V2.
- **Phase advancement** — no scheduler or automation advances phases yet. Manual admin trigger planned.
- **Battle cards** — attack declarations, tabletop battle scheduling, and result entry are not built.
- **Troop generation** — per-territory troop income calculation is deferred to V2.
- **Resource/economy system** — the brick/lumber/wool/grain/ore system is intentionally omitted from V1.
- **Elimination logic** — `is_eliminated` and `eliminated_at` fields exist but no elimination trigger is implemented.
- **Notifications** — no email or push notifications for invite/ready events.