/**
 * resourcePhase — backend handler for Sprint 3B resource generation.
 *
 * This operates as a sub-phase within the Deploy phase.
 * It does NOT replace or modify deployPhase troop income logic.
 *
 * Actions:
 *   initResourceTypes  — admin: stamp resource_type on all TerritoryState records
 *                        from map metadata. Idempotent — safe to call multiple times.
 *
 *   getResourceState   — any player: returns territory resource types + storage,
 *                        player-owned territories summary, player ledger totals.
 *
 *   activateTerritory  — player: activates a single owned territory for resource
 *                        generation this round. Resources generated = 1 of that
 *                        territory's resource_type, placed into territory storage.
 *                        Multiple territories can be activated per round.
 *
 *   generateAll        — admin: generates resources for ALL owned territories that
 *                        have not been individually activated this round.
 *                        Used if automatic generation is preferred over player choice.
 *
 *   collectResources   — player: moves resources from owned territory storage into
 *                        PlayerResourceLedger. Called at deploy phase end.
 *
 *   buildResourceHub   — player: places a Resource Hub in an owned territory.
 *                        Sets TerritoryState.has_resource_hub = true.
 *                        No cost enforced in Sprint 3B (Sprint 3C will add costs).
 *
 *   getDebugState      — admin: returns full debug snapshot — activated territories,
 *                        generated resources, territory storage, player ledger.
 *
 * ─── RESOURCE FLOW ────────────────────────────────────────────────────────────
 *
 *   1. At deploy phase start, admin calls initResourceTypes (once per campaign).
 *   2. During deploy phase, player calls activateTerritory for chosen territories.
 *   3. Admin (or automation) calls generateAll / collectResources at phase end.
 *   4. PlayerResourceLedger holds aggregated balance for spending.
 *
 * ─── STORAGE MODEL ────────────────────────────────────────────────────────────
 *
 *   Resources are generated INTO TerritoryState.resource_storage first.
 *   collectResources moves them from territory → PlayerResourceLedger.
 *   This allows future mechanics (raids, warehouses) to intercept storage.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Inline resource type map (no local imports in Deno) ──────────────────────

const V1_RESOURCE_TYPES = {
  frost_peak:'iron', irongate:'gold', tundra_flats:'food', glacier_pass:'stone',
  stormwatch:'timber', crow_harbor:'gold', pale_cliffs:'stone', veil_crossing:'food',
  ashwood:'timber', redstone_ridge:'iron', dustmarsh:'food', saltfen:'food',
  verdant_vale:'food', greywood:'timber',
  heartlands:'food', golden_citadel:'gold', iron_ridge:'iron', stonefield:'stone',
  the_crossing:'gold', ember_vale:'food', deepstone:'iron',
  ember_coast:'gold', blackstone:'iron', iron_coast:'iron', scalewood:'timber',
  the_bastion:'stone', ashfen_coast:'food', ridgeline:'stone',
  sunken_delta:'food', dustplains:'stone', amber_fields:'food', sunspire:'gold',
  verdant_basin:'food',
  sea_gate:'gold', crimson_shore:'gold', southern_reach:'food',
};

const SC_RESOURCE_TYPES = {
  I1:'iron', I2:'iron', I3:'stone', I4:'iron', I5:'iron', I6:'stone', I7:'iron', I8:'stone',
  W1:'timber', W2:'timber', W3:'timber', W4:'food', W5:'timber', W6:'timber',
  W7:'food', W8:'food', W9:'gold',
  B1:'stone', B2:'stone', B3:'gold', B4:'iron', B5:'iron', B6:'gold',
  B7:'stone', B8:'food', B9:'gold', B10:'gold',
  S1:'food', S2:'food', S3:'food', S4:'food', S5:'food',
  S6:'gold', S7:'food', S8:'gold', S9:'gold',
  C1:'stone', C2:'gold', C3:'gold', C4:'iron', C5:'gold',
  C6:'timber', C7:'food', C8:'stone',
};

function getResourceTypeForTerritory(mapId, territoryId) {
  if (mapId === 'shattered_crown_v1') return SC_RESOURCE_TYPES[territoryId] ?? 'food';
  return V1_RESOURCE_TYPES[territoryId] ?? 'food';
}

const VALID_RESOURCES = ['gold', 'iron', 'timber', 'stone', 'food'];

function emptyStorage() {
  return { gold: 0, iron: 0, timber: 0, stone: 0, food: 0 };
}

function addToStorage(storage, resourceType, amount = 1) {
  const s = { ...emptyStorage(), ...(storage ?? {}) };
  s[resourceType] = (s[resourceType] ?? 0) + amount;
  return s;
}

function sumStorage(storage) {
  if (!storage) return 0;
  return VALID_RESOURCES.reduce((sum, r) => sum + (storage[r] ?? 0), 0);
}

function mergeLedger(existing, incoming) {
  const result = { ...emptyStorage(), ...(existing ?? {}) };
  for (const r of VALID_RESOURCES) {
    result[r] = (result[r] ?? 0) + (incoming[r] ?? 0);
  }
  return result;
}

async function log(base44, campaignId, round, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId, phase: 'deploy', round,
    event_type: eventType, player_id: playerId ?? null, payload, is_public: isPublic,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
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

  const isAdmin = campaign.admin_user_id === user.id;
  const round = campaign.current_round ?? 1;
  const mapId = campaign.map_id ?? 'map_v1_standard';

  // ── ACTION: initResourceTypes ──────────────────────────────────────────────
  if (action === 'initResourceTypes') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    let stamped = 0, skipped = 0;

    for (const ts of allStates) {
      const resourceType = getResourceTypeForTerritory(mapId, ts.territory_id);
      if (ts.resource_type === resourceType) { skipped++; continue; }
      await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
        resource_type: resourceType,
        resource_storage: ts.resource_storage ?? emptyStorage(),
      });
      stamped++;
    }

    await log(base44, campaign_id, round, 'resource_types_initialized', null, {
      stamped, skipped, map_id: mapId,
    }, true);

    return Response.json({ success: true, stamped, skipped, map_id: mapId });
  }

  // ── ACTION: getResourceState ───────────────────────────────────────────────
  if (action === 'getResourceState') {
    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const myStates = allStates.filter(s => s.owner_player_id === myPlayer.id);

    // Ledger
    const ledgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({
      campaign_id, player_id: myPlayer.id,
    });
    const ledger = ledgers[0] ?? emptyStorage();

    const territories = myStates.map(ts => ({
      territory_id: ts.territory_id,
      resource_type: ts.resource_type ?? getResourceTypeForTerritory(mapId, ts.territory_id),
      resource_storage: ts.resource_storage ?? emptyStorage(),
      storage_total: sumStorage(ts.resource_storage),
      has_resource_hub: ts.has_resource_hub ?? false,
      troop_count: ts.troop_count ?? 0,
    }));

    // Aggregate ledger totals from all owned territory storages
    const aggregated = emptyStorage();
    for (const t of territories) {
      for (const r of VALID_RESOURCES) {
        aggregated[r] += (t.resource_storage[r] ?? 0);
      }
    }

    return Response.json({
      territories,
      ledger: {
        gold: ledger.gold ?? 0,
        iron: ledger.iron ?? 0,
        timber: ledger.timber ?? 0,
        stone: ledger.stone ?? 0,
        food: ledger.food ?? 0,
      },
      territory_storage_totals: aggregated,
      territories_count: territories.length,
    });
  }

  // ── ACTION: activateTerritory ──────────────────────────────────────────────
  if (action === 'activateTerritory') {
    const { territory_id, acting_as_player_id } = body;
    if (!territory_id) return Response.json({ error: 'territory_id required' }, { status: 400 });

    // Resolve acting player
    let actingPlayer = myPlayer;
    if (acting_as_player_id) {
      const target = players.find(p => p.id === acting_as_player_id);
      if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
      if (!isAdmin && target.id !== myPlayer.id) {
        return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
      }
      actingPlayer = target;
    }

    // Load territory state
    const states = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, territory_id,
    });
    const ts = states[0];
    if (!ts) return Response.json({ error: 'Territory not found' }, { status: 404 });
    if (ts.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: 'You do not own this territory' }, { status: 403 });
    }

    const resourceType = ts.resource_type ?? getResourceTypeForTerritory(mapId, territory_id);
    const storageBefore = { ...emptyStorage(), ...(ts.resource_storage ?? {}) };
    const storageAfter = addToStorage(storageBefore, resourceType, 1);

    await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
      resource_storage: storageAfter,
      resource_type: resourceType, // ensure stamped
    });

    await log(base44, campaign_id, round, 'resource_generated', actingPlayer.id, {
      territory_id, resource_type: resourceType, amount: 1,
      storage_before: storageBefore, storage_after: storageAfter,
    }, false);

    return Response.json({
      success: true,
      territory_id,
      resource_type: resourceType,
      amount_generated: 1,
      storage_before: storageBefore,
      storage_after: storageAfter,
    });
  }

  // ── ACTION: generateAll ────────────────────────────────────────────────────
  if (action === 'generateAll') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const ownedStates = allStates.filter(s => s.owner_player_id != null);

    const results = [];
    for (const ts of ownedStates) {
      const resourceType = ts.resource_type ?? getResourceTypeForTerritory(mapId, ts.territory_id);
      const storageBefore = { ...emptyStorage(), ...(ts.resource_storage ?? {}) };
      const storageAfter = addToStorage(storageBefore, resourceType, 1);

      await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
        resource_storage: storageAfter,
        resource_type: resourceType,
      });

      results.push({
        territory_id: ts.territory_id,
        owner_player_id: ts.owner_player_id,
        resource_type: resourceType,
        storage_before: storageBefore,
        storage_after: storageAfter,
      });
    }

    await log(base44, campaign_id, round, 'resource_generate_all', null, {
      territories_generated: results.length,
      results,
    }, true);

    return Response.json({
      success: true,
      territories_generated: results.length,
      results,
    });
  }

  // ── ACTION: collectResources ───────────────────────────────────────────────
  if (action === 'collectResources') {
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

    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const myStates = allStates.filter(s => s.owner_player_id === actingPlayer.id);

    // Sum all storage from owned territories
    const collected = emptyStorage();
    for (const ts of myStates) {
      const storage = ts.resource_storage ?? {};
      for (const r of VALID_RESOURCES) {
        collected[r] += storage[r] ?? 0;
      }
    }

    // Check if anything to collect
    const totalCollected = sumStorage(collected);
    if (totalCollected === 0) {
      return Response.json({ success: true, collected, total_collected: 0, message: 'No resources to collect' });
    }

    // Load or create ledger
    const ledgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({
      campaign_id, player_id: actingPlayer.id,
    });
    const existingLedger = ledgers[0];
    const newLedger = mergeLedger(existingLedger, collected);

    if (existingLedger) {
      await base44.asServiceRole.entities.PlayerResourceLedger.update(existingLedger.id, {
        ...newLedger,
        updated_at_round: round,
        updated_at_phase: 'deploy',
      });
    } else {
      await base44.asServiceRole.entities.PlayerResourceLedger.create({
        campaign_id, player_id: actingPlayer.id,
        ...newLedger,
        updated_at_round: round,
        updated_at_phase: 'deploy',
      });
    }

    // Clear territory storage after collection
    for (const ts of myStates) {
      if (sumStorage(ts.resource_storage) > 0) {
        await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
          resource_storage: emptyStorage(),
        });
      }
    }

    await log(base44, campaign_id, round, 'resources_collected', actingPlayer.id, {
      collected, total_collected: totalCollected,
      ledger_before: existingLedger ?? null,
      ledger_after: newLedger,
    }, false);

    return Response.json({
      success: true,
      collected,
      total_collected: totalCollected,
      ledger_after: newLedger,
    });
  }

  // ── ACTION: buildResourceHub ───────────────────────────────────────────────
  if (action === 'buildResourceHub') {
    const { territory_id, acting_as_player_id } = body;
    if (!territory_id) return Response.json({ error: 'territory_id required' }, { status: 400 });

    let actingPlayer = myPlayer;
    if (acting_as_player_id) {
      const target = players.find(p => p.id === acting_as_player_id);
      if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
      if (!isAdmin && target.id !== myPlayer.id) {
        return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
      }
      actingPlayer = target;
    }

    const states = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, territory_id,
    });
    const ts = states[0];
    if (!ts) return Response.json({ error: 'Territory not found' }, { status: 404 });
    if (ts.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: 'You do not own this territory' }, { status: 403 });
    }
    if (ts.has_resource_hub) {
      return Response.json({ error: 'Territory already has a Resource Hub' }, { status: 400 });
    }

    await base44.asServiceRole.entities.TerritoryState.update(ts.id, { has_resource_hub: true });

    // Also create a TerritoryBuilding record for future supply route linking
    await base44.asServiceRole.entities.TerritoryBuilding.create({
      campaign_id,
      territory_id,
      player_id: actingPlayer.id,
      building_type: 'resource_hub',
      pillar_type: 'economic',
      status: 'active',
      started_round: round,
      completed_round: round,
      construction_progress: 1,
      metadata_json: { route_slots: 3, routes_used: 0 },
    });

    await log(base44, campaign_id, round, 'resource_hub_built', actingPlayer.id, {
      territory_id,
    }, true);

    return Response.json({ success: true, territory_id, has_resource_hub: true });
  }

  // ── ACTION: getDebugState ──────────────────────────────────────────────────
  if (action === 'getDebugState') {
    if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });

    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const allLedgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id });

    const ownedTerritories = allStates.filter(s => s.owner_player_id != null);

    const byPlayer = {};
    for (const ts of ownedTerritories) {
      if (!byPlayer[ts.owner_player_id]) byPlayer[ts.owner_player_id] = [];
      byPlayer[ts.owner_player_id].push({
        territory_id: ts.territory_id,
        resource_type: ts.resource_type ?? getResourceTypeForTerritory(mapId, ts.territory_id),
        resource_storage: ts.resource_storage ?? emptyStorage(),
        storage_total: sumStorage(ts.resource_storage),
        has_resource_hub: ts.has_resource_hub ?? false,
      });
    }

    const playerSummaries = players.map(p => {
      const ledger = allLedgers.find(l => l.player_id === p.id) ?? null;
      const territories = byPlayer[p.id] ?? [];
      const territoryStorageTotals = emptyStorage();
      for (const t of territories) {
        for (const r of VALID_RESOURCES) {
          territoryStorageTotals[r] += (t.resource_storage[r] ?? 0);
        }
      }
      return {
        player_id: p.id,
        display_name: p.display_name,
        territories_owned: territories.length,
        territory_storage_totals: territoryStorageTotals,
        territory_storage_grand_total: sumStorage(territoryStorageTotals),
        ledger: ledger ? { gold: ledger.gold ?? 0, iron: ledger.iron ?? 0, timber: ledger.timber ?? 0, stone: ledger.stone ?? 0, food: ledger.food ?? 0 } : null,
        territories,
      };
    });

    return Response.json({
      debug: true,
      campaign_id,
      round,
      map_id: mapId,
      total_territories: allStates.length,
      owned_territories: ownedTerritories.length,
      player_summaries: playerSummaries,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});