/**
 * territoryDevelopment — Sprint QA1 Territory Development System
 *
 * Manages territory development levels, capital designation, and food investment.
 *
 * Actions:
 *   initDevelopment    — admin: create TerritoryDevelopment records for all owned territories (idempotent)
 *   getPlayerDevelopment — returns all dev records + capital for acting player
 *   investFood         — player: invest food from ledger into a territory to increase dev progress
 *   setCapital         — player: designate a territory as capital (one per player)
 *   applyLevelUps      — admin: auto-level-up territories that have met their food threshold
 *
 * Development Levels:
 *   Level 1: Primary resource, 1 omni slot
 *   Level 2: Secondary resource unlocked (if defined on map)
 *   Level 3: First map-defined slot unlocked
 *   Level 4: Tertiary resource unlocked (if defined)
 *   Level 5+: Additional map slots unlocked
 *
 * Food thresholds: level 1→2: 3 food, 2→3: 5 food, 3→4: 8 food, 4→5+: 12 food each
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── SC Map Data (inline — no local imports in Deno) ──────────────────────────
const SC_PRIMARY_RESOURCE = {
  I1:'iron',  I2:'iron',  I3:'stone', I4:'iron',  I5:'stone',
  I6:'timber',I7:'timber',I8:'iron',
  W1:'timber',W2:'stone', W3:'timber',W4:'timber',W5:'timber',
  W6:'timber',W7:'gold',  W8:'gold',  W9:'iron',
  B1:'stone', B2:'stone', B3:'stone', B4:'stone', B5:'iron',
  B6:'stone', B7:'stone', B8:'stone', B9:'iron',  B10:'gold',
  S1:'timber',S2:'gold',  S3:'iron',  S4:'gold',  S5:'gold',
  S6:'stone', S7:'timber',S8:'gold',  S9:'iron',
  C1:'iron',  C2:'gold',  C3:'iron',  C4:'gold',  C5:'gold',
  C6:'gold',  C7:'stone', C8:'gold',
};

const SC_SECONDARY_RESOURCE = {
  I8:'iron',  I4:'gold',  I6:'stone', I7:'gold',
  I1:'iron',  I2:'stone', I3:'stone', I5:'iron',
  W1:'timber',W2:'timber',W3:'timber',W4:'stone', W5:'timber',
  W6:'stone', W7:'timber',W8:'timber',W9:'timber',
  B1:'iron',  B3:'gold',  B4:'gold',  B5:'stone',
  B7:'iron',  B8:'gold',  B9:'gold',  B10:'gold',
  S1:'gold',  S2:'stone', S3:'iron',  S4:'timber',S5:'gold',
  S6:'gold',  S7:'gold',  S8:'gold',  S9:'iron',
  C1:'gold',  C2:'stone', C3:'iron',  C4:'gold',  C5:'timber',
  C6:'gold',  C7:'gold',  C8:'timber',
};

const SC_TERTIARY_RESOURCE = {
  I8:'iron',  I1:'stone',
  W3:'gold',  W5:'timber',
  B10:'stone',
  S5:'gold',
  C4:'timber',C6:'gold',
};

// ─── Adjacency data (inline — no local imports in Deno) ───────────────────────
// All edges are bidirectional.
const SC_ADJACENCY_EDGES = [
  // Outer Passes / High Crown
  {from:'I1',to:'I2'},{from:'I1',to:'I3'},{from:'I2',to:'I3'},{from:'I2',to:'I4'},
  {from:'I3',to:'I5'},{from:'I4',to:'I5'},{from:'I4',to:'I6'},{from:'I5',to:'I7'},
  {from:'I6',to:'I7'},{from:'I6',to:'I8'},{from:'I7',to:'I8'},
  // Wilds / Deepwoods
  {from:'W1',to:'W2'},{from:'W1',to:'W4'},{from:'W2',to:'W3'},{from:'W2',to:'W5'},
  {from:'W3',to:'W6'},{from:'W4',to:'W5'},{from:'W5',to:'W6'},{from:'W5',to:'W7'},
  {from:'W6',to:'W7'},{from:'W6',to:'W8'},{from:'W7',to:'W8'},{from:'W7',to:'W9'},
  {from:'W8',to:'W9'},
  // Cross-region (I→W)
  {from:'I1',to:'W1'},{from:'I2',to:'W1'},{from:'I4',to:'W4'},{from:'I6',to:'W3'},
  {from:'I8',to:'W6'},{from:'I7',to:'W8'},{from:'I5',to:'W2'},
  // Borderlands (B)
  {from:'B1',to:'B2'},{from:'B1',to:'B3'},{from:'B2',to:'B3'},{from:'B2',to:'B4'},
  {from:'B3',to:'B5'},{from:'B4',to:'B5'},{from:'B4',to:'B6'},{from:'B5',to:'B6'},
  {from:'B5',to:'B7'},{from:'B6',to:'B7'},{from:'B7',to:'B8'},{from:'B7',to:'B9'},
  {from:'B8',to:'B9'},{from:'B8',to:'B10'},{from:'B9',to:'B10'},
  // Cross-region (W→B)
  {from:'W3',to:'B1'},{from:'W5',to:'B2'},{from:'W6',to:'B4'},{from:'W8',to:'B6'},
  {from:'W9',to:'B8'},
  // Steppes (S)
  {from:'S1',to:'S2'},{from:'S1',to:'S4'},{from:'S2',to:'S3'},{from:'S2',to:'S5'},
  {from:'S3',to:'S6'},{from:'S4',to:'S5'},{from:'S4',to:'S7'},{from:'S5',to:'S6'},
  {from:'S5',to:'S8'},{from:'S6',to:'S9'},{from:'S7',to:'S8'},{from:'S8',to:'S9'},
  // Cross-region (B→S)
  {from:'B1',to:'S1'},{from:'B3',to:'S2'},{from:'B5',to:'S4'},{from:'B7',to:'S7'},
  {from:'B9',to:'S8'},{from:'B10',to:'S9'},
  // Coast (C)
  {from:'C1',to:'C2'},{from:'C1',to:'C3'},{from:'C2',to:'C3'},{from:'C2',to:'C4'},
  {from:'C3',to:'C5'},{from:'C4',to:'C5'},{from:'C4',to:'C6'},{from:'C5',to:'C6'},
  {from:'C5',to:'C7'},{from:'C6',to:'C7'},{from:'C6',to:'C8'},{from:'C7',to:'C8'},
  // Cross-region (S→C)
  {from:'S1',to:'C1'},{from:'S3',to:'C3'},{from:'S6',to:'C5'},{from:'S9',to:'C8'},
];

function buildAdjacency() {
  const adj = {};
  for (const {from, to} of SC_ADJACENCY_EDGES) {
    if (!adj[from]) adj[from] = new Set();
    if (!adj[to])   adj[to]   = new Set();
    adj[from].add(to);
    adj[to].add(from);
  }
  return adj;
}
const SC_ADJ = buildAdjacency();

function getNeighbors(tid) {
  return [...(SC_ADJ[tid] ?? [])];
}

// BFS distance up to maxDist
function distanceTo(from, to, maxDist) {
  if (from === to) return 0;
  const visited = new Set([from]);
  const queue = [[from, 0]];
  while (queue.length) {
    const [cur, dist] = queue.shift();
    if (dist >= maxDist) continue;
    for (const nb of getNeighbors(cur)) {
      if (nb === to) return dist + 1;
      if (!visited.has(nb)) { visited.add(nb); queue.push([nb, dist + 1]); }
    }
  }
  return Infinity;
}

// ─── Adjacency-based level-up rules ───────────────────────────────────────────
// Returns null if allowed, or an error string if blocked.
function checkLevelUpAllowed(territoryId, targetLevel, allDevRecords) {
  const devMap = {};
  for (const d of allDevRecords) devMap[d.territory_id] = d.development_level ?? 1;

  if (targetLevel >= 4) {
    // All adjacent territories must be at least level 2
    for (const nb of getNeighbors(territoryId)) {
      if ((devMap[nb] ?? 1) < 2) {
        return `Level 4 requires all adjacent territories to be at least Level 2. ${nb} is only Level ${devMap[nb] ?? 1}.`;
      }
    }
    // No other level 4+ territory within 2 hops
    for (const [tid, lvl] of Object.entries(devMap)) {
      if (tid === territoryId) continue;
      if (lvl >= 4 && distanceTo(territoryId, tid, 2) <= 2) {
        return `Level 4 territories cannot exist within 2 territories of each other. Conflicts with ${tid}.`;
      }
    }
  }

  if (targetLevel >= 5) {
    // All adjacent territories must be at least level 3
    for (const nb of getNeighbors(territoryId)) {
      if ((devMap[nb] ?? 1) < 3) {
        return `Level 5 requires all adjacent territories to be at least Level 3. ${nb} is only Level ${devMap[nb] ?? 1}.`;
      }
    }
    // No other level 5+ territory within 4 hops
    for (const [tid, lvl] of Object.entries(devMap)) {
      if (tid === territoryId) continue;
      if (lvl >= 5 && distanceTo(territoryId, tid, 4) <= 4) {
        return `Level 5 territories cannot exist within 4 territories of each other. Conflicts with ${tid}.`;
      }
    }
  }

  return null;
}

// Map-defined structure slots per territory
const SC_STRUCTURE_SLOTS = {
  I8:['military'], I4:['military','economic'], I6:['economic','military'], I7:['military','diplomatic'],
  I1:['military'], I2:['military','omni'], I3:['diplomatic','diplomatic'], I5:['diplomatic','military'],
  W1:['military','military'], W2:['diplomatic','economic'], W3:['economic'], W4:['military','diplomatic'],
  W5:['omni'], W6:['economic','economic'], W7:['economic','omni'], W8:['military','diplomatic'], W9:['military','economic'],
  B1:['military','diplomatic'], B3:['diplomatic','omni'], B2:['diplomatic','diplomatic','omni'], B4:['military','diplomatic'],
  B5:['military','military'], B6:['diplomatic','diplomatic','omni'], B7:['military','economic'],
  B8:['diplomatic','military'], B9:['military','economic'], B10:['omni'],
  S1:['military','diplomatic'], S4:['economic','economic'], S7:['economic','diplomatic'], S2:['diplomatic','omni'],
  S5:['omni'], S8:['economic','economic'], S3:['military','economic'], S6:['diplomatic','diplomatic'], S9:['military','omni'],
  C1:['military','diplomatic'], C2:['military','economic'], C3:['military','omni'], C4:['omni'],
  C5:['economic','diplomatic'], C6:['omni'], C7:['diplomatic','diplomatic'], C8:['military','diplomatic'],
};

// Food cost to advance from level N to N+1
function foodToNextLevel(currentLevel) {
  if (currentLevel <= 1) return 3;
  if (currentLevel === 2) return 5;
  if (currentLevel === 3) return 8;
  return 12; // level 4+
}

// Compute unlocked resources for a given development level
function unlockedResources(territoryId, level) {
  const result = ['primary'];
  if (level >= 2 && SC_SECONDARY_RESOURCE[territoryId]) result.push('secondary');
  if (level >= 4 && SC_TERTIARY_RESOURCE[territoryId]) result.push('tertiary');
  return result;
}

// Compute total unlocked slot count: 1 (omni) base + map slots unlocked at levels 3, 5+
function unlockedSlotCount(territoryId, level) {
  let slots = 1; // base omni slot always available
  const mapSlots = SC_STRUCTURE_SLOTS[territoryId] ?? [];
  if (level >= 3 && mapSlots.length >= 1) slots += 1;
  if (level >= 5 && mapSlots.length >= 2) slots += 1;
  if (level >= 7 && mapSlots.length >= 3) slots += 1;
  return slots;
}

// Build a new development record with correct defaults
function buildDevRecord(campaignId, territoryId, ownerPlayerId, round, isCapital = false) {
  return {
    campaign_id: campaignId,
    territory_id: territoryId,
    owner_player_id: ownerPlayerId,
    development_level: 1,
    development_progress: 0,
    food_to_next_level: foodToNextLevel(1),
    total_food_invested: 0,
    is_capital: isCapital,
    capital_set_round: isCapital ? round : null,
    unlocked_resources: ['primary'],
    unlocked_slot_count: 1,
    last_updated_round: round,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, campaign_id } = body;
    if (!campaign_id || !action) {
      return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
    }

    const [campaigns, players] = await Promise.all([
      base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
      base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
    ]);
    const campaign = campaigns[0];
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const myPlayer = players.find(p => p.user_id === user.id);
    if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

    const isAdmin = campaign.admin_user_id === user.id || user.role === 'admin';
    const round = campaign.current_round ?? 1;

    // Resolve acting player
    const { acting_as_player_id } = body;
    let actingPlayer = myPlayer;
    if (acting_as_player_id) {
      const target = players.find(p => p.id === acting_as_player_id);
      if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
      if (!isAdmin && target.id !== myPlayer.id) {
        return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
      }
      actingPlayer = target;
    }

    // ── ACTION: initDevelopment ─────────────────────────────────────────────
    // Admin: create TerritoryDevelopment records for all owned territories.
    // Idempotent — skips territories that already have records.
    if (action === 'initDevelopment') {
      if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

      const [allStates, existingDev] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
      ]);

      const existingIds = new Set(existingDev.map(d => d.territory_id));
      const ownedStates = allStates.filter(s => s.owner_player_id != null);

      let created = 0, skipped = 0;
      for (const ts of ownedStates) {
        if (existingIds.has(ts.territory_id)) { skipped++; continue; }
        await base44.asServiceRole.entities.TerritoryDevelopment.create(
          buildDevRecord(campaign_id, ts.territory_id, ts.owner_player_id, round)
        );
        created++;
      }

      await base44.asServiceRole.entities.SetupLog.create({
        campaign_id, phase: campaign.current_phase ?? 'deploy', round,
        event_type: 'territory_development_initialized',
        player_id: null,
        payload: { created, skipped },
        is_public: true,
      });

      return Response.json({ success: true, created, skipped });
    }

    // ── ACTION: getPlayerDevelopment ────────────────────────────────────────
    if (action === 'getPlayerDevelopment') {
      const [devRecords, allStates, ledgers] = await Promise.all([
        base44.asServiceRole.entities.TerritoryDevelopment.filter({
          campaign_id, owner_player_id: actingPlayer.id,
        }),
        base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, owner_player_id: actingPlayer.id,
        }),
        base44.asServiceRole.entities.PlayerResourceLedger.filter({
          campaign_id, player_id: actingPlayer.id,
        }),
      ]);

      const ledger = ledgers[0] ?? { food: 0, gold: 0, iron: 0, timber: 0, stone: 0 };
      const devMap = {};
      for (const d of devRecords) devMap[d.territory_id] = d;

      const capital = devRecords.find(d => d.is_capital) ?? null;

      const territories = allStates.map(ts => {
        const dev = devMap[ts.territory_id] ?? buildDevRecord(campaign_id, ts.territory_id, actingPlayer.id, round);
        const mapSlots = SC_STRUCTURE_SLOTS[ts.territory_id] ?? [];
        return {
          territory_id: ts.territory_id,
          development_level: dev.development_level ?? 1,
          development_progress: dev.development_progress ?? 0,
          food_to_next_level: dev.food_to_next_level ?? foodToNextLevel(dev.development_level ?? 1),
          total_food_invested: dev.total_food_invested ?? 0,
          is_capital: dev.is_capital ?? false,
          capital_set_round: dev.capital_set_round ?? null,
          unlocked_resources: dev.unlocked_resources ?? ['primary'],
          unlocked_slot_count: dev.unlocked_slot_count ?? 1,
          primary_resource: SC_PRIMARY_RESOURCE[ts.territory_id] ?? ts.resource_type ?? 'food',
          secondary_resource: SC_SECONDARY_RESOURCE[ts.territory_id] ?? null,
          tertiary_resource: SC_TERTIARY_RESOURCE[ts.territory_id] ?? null,
          map_defined_slots: mapSlots,
          dev_record_id: devMap[ts.territory_id]?.id ?? null,
        };
      });

      return Response.json({
        success: true,
        territories,
        capital_territory_id: capital?.territory_id ?? null,
        capital_set_round: capital?.capital_set_round ?? null,
        food_available: ledger.food ?? 0,
      });
    }

    // ── ACTION: setCapital ─────────────────────────────────────────────────
    if (action === 'setCapital') {
      const { territory_id } = body;
      if (!territory_id) return Response.json({ error: 'territory_id required' }, { status: 400 });

      // Validate ownership
      const [states, devRecords] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id, territory_id }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id, owner_player_id: actingPlayer.id }),
      ]);
      const ts = states[0];
      if (!ts || ts.owner_player_id !== actingPlayer.id) {
        return Response.json({ error: 'You do not own this territory' }, { status: 403 });
      }

      // Clear existing capital
      for (const d of devRecords.filter(d => d.is_capital)) {
        await base44.asServiceRole.entities.TerritoryDevelopment.update(d.id, { is_capital: false, capital_set_round: null });
      }

      // Set or create dev record as capital
      const existing = devRecords.find(d => d.territory_id === territory_id);
      if (existing) {
        await base44.asServiceRole.entities.TerritoryDevelopment.update(existing.id, {
          is_capital: true, capital_set_round: round,
        });
      } else {
        await base44.asServiceRole.entities.TerritoryDevelopment.create({
          ...buildDevRecord(campaign_id, territory_id, actingPlayer.id, round, true),
        });
      }

      await base44.asServiceRole.entities.SetupLog.create({
        campaign_id, phase: campaign.current_phase ?? 'deploy', round,
        event_type: 'capital_designated',
        player_id: actingPlayer.id,
        payload: { territory_id, display_name: actingPlayer.display_name },
        is_public: true,
      });

      return Response.json({ success: true, capital_territory_id: territory_id });
    }

    // ── ACTION: investFood ─────────────────────────────────────────────────
    if (action === 'investFood') {
      const { territory_id, food_amount } = body;
      if (!territory_id || !food_amount || food_amount <= 0) {
        return Response.json({ error: 'territory_id and food_amount > 0 required' }, { status: 400 });
      }

      // Check ownership
      const states = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id, territory_id });
      const ts = states[0];
      if (!ts || ts.owner_player_id !== actingPlayer.id) {
        return Response.json({ error: 'You do not own this territory' }, { status: 403 });
      }

      // Check food balance
      const ledgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({
        campaign_id, player_id: actingPlayer.id,
      });
      const ledger = ledgers[0];
      const currentFood = ledger?.food ?? 0;
      if (currentFood < food_amount) {
        return Response.json({ error: `Insufficient food. You have ${currentFood}, need ${food_amount}.` }, { status: 400 });
      }

      // Get or create dev record; also load all campaign dev records for adjacency checks
      const [devRecords, allCampaignDev] = await Promise.all([
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id, territory_id }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
      ]);
      let dev = devRecords[0];
      if (!dev) {
        dev = await base44.asServiceRole.entities.TerritoryDevelopment.create(
          buildDevRecord(campaign_id, territory_id, actingPlayer.id, round)
        );
        allCampaignDev.push(dev);
      }

      // Apply food investment — level up loop with adjacency checks
      let currentLevel = dev.development_level ?? 1;
      let progress = (dev.development_progress ?? 0) + food_amount;
      let totalInvested = (dev.total_food_invested ?? 0) + food_amount;
      const levelUps = [];
      let blockedAt = null;

      // Build a mutable dev map reflecting current levels so adjacency checks are accurate
      const devMap = {};
      for (const d of allCampaignDev) devMap[d.territory_id] = d.development_level ?? 1;

      while (progress >= foodToNextLevel(currentLevel)) {
        const nextLevel = currentLevel + 1;
        // Build snapshot with this territory at nextLevel for adjacency check
        const snapshot = { ...devMap };
        snapshot[territory_id] = nextLevel;

        // Inline adjacency check against the snapshot
        const snapshotRecords = Object.entries(snapshot).map(([tid, lvl]) => ({ territory_id: tid, development_level: lvl }));
        const blocked = checkLevelUpAllowed(territory_id, nextLevel, snapshotRecords);
        if (blocked) {
          blockedAt = nextLevel;
          break;
        }

        progress -= foodToNextLevel(currentLevel);
        currentLevel = nextLevel;
        devMap[territory_id] = currentLevel;
        levelUps.push(currentLevel);
      }

      const newUnlockedResources = unlockedResources(territory_id, currentLevel);
      const newSlotCount = unlockedSlotCount(territory_id, currentLevel);

      await base44.asServiceRole.entities.TerritoryDevelopment.update(dev.id, {
        development_level: currentLevel,
        development_progress: Math.max(0, progress),
        food_to_next_level: foodToNextLevel(currentLevel),
        total_food_invested: totalInvested,
        unlocked_resources: newUnlockedResources,
        unlocked_slot_count: newSlotCount,
        last_updated_round: round,
      });

      // Deduct food from ledger
      const newFood = currentFood - food_amount;
      if (ledger) {
        await base44.asServiceRole.entities.PlayerResourceLedger.update(ledger.id, {
          food: newFood, updated_at_round: round, updated_at_phase: campaign.current_phase,
        });
      }

      await base44.asServiceRole.entities.SetupLog.create({
        campaign_id, phase: campaign.current_phase ?? 'deploy', round,
        event_type: 'food_invested_in_territory',
        player_id: actingPlayer.id,
        payload: {
          territory_id, food_invested: food_amount, new_level: currentLevel,
          level_ups: levelUps.length, unlocked_resources: newUnlockedResources,
          unlocked_slot_count: newSlotCount, blocked_at: blockedAt,
        },
        is_public: false,
      });

      return Response.json({
        success: true,
        territory_id,
        food_invested: food_amount,
        food_remaining: newFood,
        previous_level: dev.development_level ?? 1,
        new_level: currentLevel,
        level_ups: levelUps.length,
        blocked_at: blockedAt,
        blocked_reason: blockedAt ? `Cannot advance to Level ${blockedAt} due to adjacency rules.` : null,
        development_progress: Math.max(0, progress),
        food_to_next_level: foodToNextLevel(currentLevel),
        unlocked_resources: newUnlockedResources,
        unlocked_slot_count: newSlotCount,
      });
    }

    // ── ACTION: autoInvestFoodToCapital ────────────────────────────────────
    // Called at end of resource generation. For each active player, takes food
    // generated this round and invests it into their capital. If the capital
    // would be blocked by adjacency rules, it spills into adjacent owned
    // territories until all food is placed or no valid target remains.
    if (action === 'autoInvestFoodToCapital') {
      if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

      const [allStates, allDev, allLedgers] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
        base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id }),
      ]);

      const activePlayers = players.filter(p => !p.is_eliminated);
      const results = [];

      for (const player of activePlayers) {
        const ledger = allLedgers.find(l => l.player_id === player.id);
        const foodAvailable = ledger?.food ?? 0;
        if (foodAvailable <= 0) { results.push({ player_id: player.id, food_invested: 0, reason: 'no food' }); continue; }

        const ownedTerritories = allStates.filter(s => s.owner_player_id === player.id).map(s => s.territory_id);
        if (!ownedTerritories.length) { results.push({ player_id: player.id, food_invested: 0, reason: 'no territories' }); continue; }

        const capitalDev = allDev.find(d => d.owner_player_id === player.id && d.is_capital);
        const capitalId = capitalDev?.territory_id ?? null;

        // Build ordered list of targets: capital first, then adjacent owned, then all owned
        const visited = new Set();
        const targets = [];
        if (capitalId) {
          targets.push(capitalId);
          visited.add(capitalId);
          for (const nb of getNeighbors(capitalId)) {
            if (ownedTerritories.includes(nb) && !visited.has(nb)) { targets.push(nb); visited.add(nb); }
          }
        }
        for (const tid of ownedTerritories) {
          if (!visited.has(tid)) { targets.push(tid); visited.add(tid); }
        }

        // Build mutable dev map for this campaign
        const devMap = {};
        for (const d of allDev) devMap[d.territory_id] = d.development_level ?? 1;

        let remaining = foodAvailable;
        const invested = {};

        for (const tid of targets) {
          if (remaining <= 0) break;
          let dev = allDev.find(d => d.territory_id === tid && d.owner_player_id === player.id);
          if (!dev) continue;

          let level = dev.development_level ?? 1;
          let prog = dev.development_progress ?? 0;
          let toInvest = 0;

          // Invest 1 food at a time to check adjacency at each potential level-up
          while (remaining > 0) {
            prog += 1;
            toInvest += 1;
            remaining -= 1;

            while (prog >= foodToNextLevel(level)) {
              const nextLevel = level + 1;
              const snapshot = { ...devMap };
              snapshot[tid] = nextLevel;
              const snapshotRecords = Object.entries(snapshot).map(([t, l]) => ({ territory_id: t, development_level: l }));
              const blocked = checkLevelUpAllowed(tid, nextLevel, snapshotRecords);
              if (blocked) {
                // Can't level up — keep progress, stop investing here
                prog = foodToNextLevel(level) - 1; // leave just below threshold
                remaining += 1; toInvest -= 1; // refund this food unit
                remaining = 0; // force skip to next target
                break;
              }
              prog -= foodToNextLevel(level);
              level += 1;
              devMap[tid] = level;
            }

            if (remaining === 0) break;
          }

          if (toInvest > 0) {
            invested[tid] = toInvest;
            const newResources = unlockedResources(tid, level);
            const newSlots = unlockedSlotCount(tid, level);
            await base44.asServiceRole.entities.TerritoryDevelopment.update(dev.id, {
              development_level: level,
              development_progress: Math.max(0, prog),
              food_to_next_level: foodToNextLevel(level),
              total_food_invested: (dev.total_food_invested ?? 0) + toInvest,
              unlocked_resources: newResources,
              unlocked_slot_count: newSlots,
              last_updated_round: round,
            });
            // Update the allDev cache for subsequent players' adjacency checks
            const idx = allDev.findIndex(d => d.id === dev.id);
            if (idx >= 0) { allDev[idx] = { ...allDev[idx], development_level: level, development_progress: Math.max(0, prog) }; }
          }
        }

        // Deduct invested food from ledger; unspendable food (blocked everywhere) is kept
        const totalInvested = Object.values(invested).reduce((s, v) => s + v, 0);
        const newFood = foodAvailable - totalInvested;
        if (ledger && totalInvested > 0) {
          await base44.asServiceRole.entities.PlayerResourceLedger.update(ledger.id, {
            food: Math.max(0, newFood), updated_at_round: round, updated_at_phase: campaign.current_phase,
          });
        }

        results.push({ player_id: player.id, capital_id: capitalId, food_invested: totalInvested, food_retained: Math.max(0, newFood), invested_breakdown: invested });
      }

      return Response.json({ success: true, results });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});