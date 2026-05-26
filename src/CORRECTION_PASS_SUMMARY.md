# Correction Pass Summary — Leaderboard, History & Snapshots

## Files Changed

### Backend Functions (Membership Validation Added)
1. **functions/getLeaderboard.js**
   - Added membership validation (campaign player or admin)
   - Fixed duplicate variable declaration
   - Clarified region_count limitation in comments

2. **functions/getHistoryLogs.js**
   - Added membership validation
   - Maintains server-side visibility filtering

3. **functions/getPhaseSnapshots.js**
   - Added membership validation
   - Clarified snapshot contains only public state

4. **functions/getBattleHistory.js**
   - Added membership validation

5. **functions/getTerritoryHistory.js**
   - Added membership validation
   - Added territory_id required check

### Frontend Components (Safe Fetching)
6. **features/campaigns/leaderboard/useLeaderboard.js**
   - Fixed: Only fetch when `enabled=true` AND `campaignId` exists
   - Returns empty array when disabled or no campaignId

7. **components/phases/fortify/FortifyInfoPanel.jsx**
   - Removed direct `asServiceRole` usage
   - Shows empty state with explanation (V1 limitation)
   - TODO: Create `getConstructionProjects` backend function

### Documentation
8. **HISTORY_LEADERBOARD_IMPLEMENTATION.md**
   - Added Security & Access Control section
   - Documented membership validation pattern
   - Documented safe history fetching
   - Documented snapshot visibility rules
   - Documented leaderboard calculation rules
   - Documented Base44 platform limitations

---

## Membership Validation Explanation

### Pattern Applied to All Functions

```javascript
// 1. Fetch campaign
const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id);
if (!campaign) {
  return Response.json({ error: 'Campaign not found' }, { status: 404 });
}

// 2. Fetch all players in campaign
const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });

// 3. Check if user is a player or admin
const isMember = players.some(p => p.user_id === user.id);
const isAdmin = campaign.admin_user_id === user.id;

// 4. Deny access if not member or admin
if (!isMember && !isAdmin) {
  return Response.json({ error: 'Access denied: Campaign membership required' }, { status: 403 });
}
```

### Why Service Role is Required

**Problem:** User-scoped SDK (`base44.entities`) only returns records where `created_by_id` matches the current user.

**Consequence:** Regular players cannot fetch `CampaignPlayer` list because:
- CampaignPlayer records are created by campaign admin
- `created_by_id` ≠ player's `user_id`
- User-scoped query returns empty array

**Solution:** Use service role (`base44.asServiceRole`) to fetch all players, then validate membership in function code.

**Security:** This is safe because:
- Function authenticates user first (`base44.auth.me()`)
- Function validates membership before returning data
- Non-members receive 403 Forbidden
- Service role is scoped to this specific validation only

---

## Safe History Access

### Before (Unsafe)
```javascript
// ❌ Direct entity query in component
const logs = await base44.asServiceRole.entities.SetupLog.filter({ campaign_id });
// Problem: Component responsible for visibility filtering
// Risk: May accidentally expose private data
```

### After (Safe)
```javascript
// ✅ Backend function enforces all rules
const { logs } = await base44.functions.invoke('getHistoryLogs', { 
  campaign_id, 
  phase, 
  event_type 
});

// Backend function does:
// 1. Membership validation (403 if not member)
// 2. Visibility filtering (is_public OR visibility_revealed_at <= now)
// 3. Sorting and limiting
```

### Benefits
- **Centralized security** — All rules in one place
- **Consistent enforcement** — All clients use same logic
- **Reduced risk** — Components can't accidentally bypass rules
- **Easier auditing** — Security logic in backend functions only

---

## Snapshot Visibility

### What PhaseSnapshot Contains (Safe)

```javascript
{
  campaign_id: string,
  round: number,
  phase: string,
  snapshot_type: "phase_start" | "phase_end",
  
  // ✅ Public revealed state
  territory_states: [
    { territory_id, owner_player_id, troop_count }
  ],
  player_standings: [
    { player_id, display_name, territory_count, troop_total, deploy_income, is_eliminated }
  ],
  deploy_incomes: {
    player_id: { territory_bonus, troop_bonus, region_bonus, continent_bonus, total }
  }
}
```

### What PhaseSnapshot Does NOT Contain (Private)

- ❌ PhaseDecision data (staged deployments, attacks, fortifications)
- ❌ Unrevealed private decisions
- ❌ Construction project details (until completed)
- ❌ Attack reveal data (separate AttackReveal entity)

### Why Snapshots Are Safe

1. **Creation timing:** Snapshots taken at phase boundaries (phase_end)
2. **Public state only:** Only territory ownership, troop counts, public metrics
3. **No decision data:** PhaseDecision entity is separate and private
4. **Membership validation:** Only campaign members can fetch snapshots

---

## Leaderboard Metric Rules

### Included Metrics (V1)

| Metric | Source | Description |
|--------|--------|-------------|
| `territory_count` | TerritoryState | Number of territories owned |
| `troop_total` | TerritoryState | Sum of troops across owned territories |
| `deploy_income` | DeployIncome | Total troops available this round |
| `resources_generated` | DeployIncome | Map of resource_type → count |
| `is_eliminated` | CampaignPlayer | Elimination status |
| `rank` | Calculated | 1-based ranking |

### Ranking Algorithm

```javascript
// Primary: territory_count (descending)
// Secondary: troop_total (descending)
// Tertiary: None (stable sort preserves order)
```

### Excluded Metrics (V1)

| Metric | Reason | Future |
|--------|--------|--------|
| `region_count` | Requires MapDefinition data | V2 enhancement |
| `continent_count` | Requires MapDefinition data | V2 enhancement |
| `structure_count` | Construction not fully implemented | Future |

### Why region_count Is Not Faked

**Incorrect approach:**
```javascript
// ❌ Don't do this - counting territories ≠ controlling regions
const regionCount = new Set(ownedTerritories.map(t => t.region_id)).size;
```

**Correct approach (future V2):**
```javascript
// ✅ Load map definition, check full control
const mapDef = await base44.entities.MapDefinition.get(campaign.map_id);
const controlledRegions = mapDef.regions.filter(region => {
  const regionTerritories = mapDef.territories.filter(t => t.region_id === region.id);
  return regionTerritories.every(t => ownedTerritoryIds.has(t.territory_id));
});
const regionCount = controlledRegions.length;
```

**V1 decision:** Use verified metrics only (territory_count, troop_total)

---

## Testing Checklist

- [ ] Non-member user receives 403 from `getLeaderboard`
- [ ] Non-member user receives 403 from `getHistoryLogs`
- [ ] Non-member user receives 403 from `getPhaseSnapshots`
- [ ] Non-member user receives 403 from `getBattleHistory`
- [ ] Non-member user receives 403 from `getTerritoryHistory`
- [ ] Campaign member receives data successfully
- [ ] Campaign admin receives data successfully
- [ ] useLeaderboard does NOT fetch when `enabled=false`
- [ ] useLeaderboard does NOT fetch when `campaignId` missing
- [ ] FortifyInfoPanel shows empty state (no asServiceRole error)
- [ ] HistoryLogPanel uses backend function (not direct query)
- [ ] Leaderboard rankings correct (territories → troops tiebreaker)

---

## Known Issues & TODOs

### V1 Limitations (Accepted)
- ❌ No region_count or continent_count in leaderboard
- ❌ Construction projects not exposed via backend function
- ❌ No real-time subscription endpoint for history

### TODO (Future)
- [ ] Create `getConstructionProjects` backend function with membership validation
- [ ] Add region_count and continent_count to leaderboard (requires MapDefinition loading)
- [ ] Create subscription endpoint for real-time history updates
- [ ] Add territory history tab to TerritoryDetailPanel

---

## Summary

✅ **Membership validation** applied to all 5 history/leaderboard functions  
✅ **Safe history fetching** — Components use backend functions, not direct queries  
✅ **Snapshot visibility** — Only public state, no private decisions  
✅ **Leaderboard metrics** — Accurate territory_count, troop_total, deploy_income  
✅ **Documentation** — Updated with security rules and limitations  
✅ **Frontend fixes** — useLeaderboard conditional fetching, FortifyInfoPanel safe access  

**All systems now enforce proper access control and privacy rules.**