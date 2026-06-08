/**
 * logisticsPhase — backend handler for Sprint 4E logistics framework.
 *
 * Actions:
 *   getLogisticsState  — player: returns hubs, routes, caravan capacity, warehouse states
 *   createRoute        — player: creates a SupplyRoute from a hub territory to a target
 *   deleteRoute        — player: removes an existing supply route
 *   collectRouteResources — player: collects resources via active routes into ledger
 *
 * ─── LOGISTICS MODEL ──────────────────────────────────────────────────────────
 *   Resource Hub (territory-scoped building) anchors supply routes.
 *   Each hub supports up to 3 routes.
 *   Routes extract from the destination territory's storage into the owner's ledger.
 *   Warehouse marks territory resources as protected (tracked, raids not yet implemented).
 *   Trade Network gives +1 supply caravan capacity (tracked, physical movement not yet implemented).
 *
 * ─── ROUTE VALIDATION ─────────────────────────────────────────────────────────
 *   1. Hub territory must be owned and have an active Resource Hub building.
 *   2. Hub must have route capacity remaining (< 3 existing active routes).
 *   3. Destination must be reachable within 3 adjacency steps.
 *   4. Owner must control the hub territory.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Adjacency data (inline — no local imports in Deno) ───────────────────────
// SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_ADJACENCY
// Do not edit this block manually. Update shatteredCrownConfig.ts first, then propagate.
// Covers: land, maritime, river_crossing edges (all traversable for supply routes).

const SC_ADJACENCY_TYPED = [
  // ── IRONSPINE internal ───────────────────────────────────────────────────
  {from:'I8',to:'I4',type:'land'},{from:'I4',to:'I3',type:'land'},
  {from:'I4',to:'I7',type:'land'},{from:'I6',to:'I3',type:'land'},
  {from:'I6',to:'I5',type:'land'},{from:'I6',to:'I7',type:'land'},
  {from:'I1',to:'I2',type:'land'},{from:'I1',to:'I5',type:'land'},
  {from:'I2',to:'I3',type:'land'},{from:'I2',to:'I5',type:'land'},
  // ── IRONSPINE ↔ FRACTURE BASIN ────────────────────────────────────────
  {from:'I6',to:'B1',type:'land'},{from:'I7',to:'B1',type:'land'},
  {from:'I7',to:'B3',type:'land'},
  // ── IRONSPINE ↔ SHATTERED COAST ───────────────────────────────────────
  {from:'I8',to:'C1',type:'maritime'},
  // ── WILD FRONTIER internal ────────────────────────────────────────────
  {from:'W1',to:'W2',type:'land'},{from:'W2',to:'W3',type:'land'},
  {from:'W2',to:'W4',type:'land'},{from:'W2',to:'W5',type:'land'},
  {from:'W3',to:'W5',type:'land'},{from:'W3',to:'W6',type:'land'},
  {from:'W4',to:'W5',type:'land'},{from:'W4',to:'W7',type:'land'},
  {from:'W5',to:'W6',type:'land'},{from:'W5',to:'W7',type:'land'},
  {from:'W5',to:'W8',type:'land'},{from:'W6',to:'W9',type:'land'},
  {from:'W7',to:'W8',type:'land'},{from:'W8',to:'W9',type:'land'},
  // ── WILD FRONTIER ↔ SUNFIELDS ─────────────────────────────────────────
  {from:'W7',to:'S1',type:'land'},{from:'W9',to:'S2',type:'land'},
  // ── FRACTURE BASIN internal ───────────────────────────────────────────
  {from:'B1',to:'B3',type:'land'},{from:'B1',to:'B2',type:'land'},
  {from:'B3',to:'B2',type:'land'},{from:'B3',to:'B4',type:'land'},
  {from:'B2',to:'B4',type:'land'},{from:'B2',to:'B5',type:'land'},
  {from:'B2',to:'B6',type:'land'},{from:'B4',to:'B7',type:'land'},
  {from:'B5',to:'B6',type:'land'},{from:'B5',to:'B8',type:'land'},
  {from:'B6',to:'B7',type:'land'},{from:'B6',to:'B8',type:'land'},
  {from:'B6',to:'B9',type:'land'},{from:'B7',to:'B10',type:'land'},
  {from:'B8',to:'B9',type:'land'},{from:'B9',to:'B10',type:'land'},
  // ── FRACTURE BASIN ↔ SHATTERED COAST ──────────────────────────────────
  {from:'B10',to:'C6',type:'maritime'},{from:'B10',to:'C4',type:'maritime'},
  // ── FRACTURE BASIN ↔ SUNFIELDS ────────────────────────────────────────
  {from:'B10',to:'S3',type:'river_crossing'},
  // ── SUNFIELDS internal ────────────────────────────────────────────────
  {from:'S1',to:'S2',type:'land'},{from:'S1',to:'S4',type:'land'},
  {from:'S4',to:'S5',type:'land'},{from:'S4',to:'S7',type:'land'},
  {from:'S7',to:'S5',type:'land'},{from:'S7',to:'S8',type:'land'},
  {from:'S2',to:'S3',type:'land'},{from:'S2',to:'S5',type:'land'},
  {from:'S5',to:'S8',type:'land'},{from:'S5',to:'S6',type:'land'},
  {from:'S3',to:'S6',type:'land'},{from:'S6',to:'S9',type:'land'},
  // ── SUNFIELDS ↔ SHATTERED COAST ───────────────────────────────────────
  {from:'S6',to:'C8',type:'maritime'},{from:'S9',to:'C8',type:'maritime'},
  // ── SHATTERED COAST internal ──────────────────────────────────────────
  {from:'C1',to:'C2',type:'maritime'},{from:'C2',to:'C3',type:'land'},
  {from:'C3',to:'C4',type:'maritime'},{from:'C3',to:'C5',type:'maritime'},
  {from:'C4',to:'C5',type:'maritime'},{from:'C4',to:'C6',type:'maritime'},
  {from:'C5',to:'C6',type:'maritime'},{from:'C5',to:'C7',type:'maritime'},
  {from:'C6',to:'C7',type:'maritime'},{from:'C6',to:'C8',type:'maritime'},
  {from:'C7',to:'C8',type:'maritime'},
];

// Build bidirectional adjacency map from Shattered Crown canonical data.
// All edge types (land, maritime, river_crossing) are traversable for supply routes.
function buildAdjacency() {
  const adj = {};
  for (const { from, to } of SC_ADJACENCY_TYPED) {
    if (!adj[from]) adj[from] = new Set();
    if (!adj[to])   adj[to]   = new Set();
    adj[from].add(to);
    adj[to].add(from);
  }
  return adj;
}

// BFS: find shortest path distance + path between two territories.
// Unlike fortification, routes do NOT require passing through owned territory.
function findRoutePath(startId, endId, adj) {
  if (startId === endId) return { distance: 0, path: [startId] };
  const visited = new Set([startId]);
  const queue = [[startId, [startId]]];
  while (queue.length > 0) {
    const [current, path] = queue.shift();
    const neighbors = adj[current] ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const newPath = [...path, neighbor];
        if (neighbor === endId) return { distance: newPath.length - 1, path: newPath };
        visited.add(neighbor);
        queue.push([neighbor, newPath]);
      }
    }
  }
  return { distance: Infinity, path: [] };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_ROUTE_DISTANCE = 3;
const BASE_ROUTE_CAPACITY = 3;
const VALID_RESOURCES = ['gold', 'iron', 'timber', 'stone', 'food'];

function emptyStorage() {
  return { gold: 0, iron: 0, timber: 0, stone: 0, food: 0 };
}

function mergeLedger(existing, incoming) {
  const result = { ...emptyStorage(), ...(existing ?? {}) };
  for (const r of VALID_RESOURCES) {
    result[r] = (result[r] ?? 0) + (incoming[r] ?? 0);
  }
  return result;
}

function sumStorage(storage) {
  if (!storage) return 0;
  return VALID_RESOURCES.reduce((sum, r) => sum + (storage[r] ?? 0), 0);
}

async function logEvent(base44, campaignId, round, eventType, playerId, payload) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId, phase: 'logistics', round,
    event_type: eventType, player_id: playerId ?? null, payload, is_public: true,
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
  const adj = buildAdjacency();

  // Acting-as support
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

  // ── ACTION: getLogisticsState ──────────────────────────────────────────────
  if (action === 'getLogisticsState') {
    const [allStates, allBuildings, allRoutes] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id, player_id: actingPlayer.id }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id, owner_player_id: actingPlayer.id }),
    ]);

    const myStates = allStates.filter(s => s.owner_player_id === actingPlayer.id);

    // Compute supply caravan capacity from Trade Network buildings
    const tradeNetworks = allBuildings.filter(b => b.building_type === 'trade_network' && b.status === 'active');
    const caravanCapacity = tradeNetworks.length; // 1 per Trade Network

    // Gather hubs: active Resource Hub buildings in player-owned territories
    const hubBuildings = allBuildings.filter(b => b.building_type === 'resource_hub' && b.status === 'active');
    
    // Also check legacy has_resource_hub flag
    const legacyHubTerritories = myStates.filter(ts => ts.has_resource_hub).map(ts => ts.territory_id);

    const allHubTerritoryIds = new Set([
      ...hubBuildings.map(b => b.territory_id),
      ...legacyHubTerritories,
    ]);

    // Build hub summaries
    const hubs = [];
    for (const tid of allHubTerritoryIds) {
      const ts = myStates.find(s => s.territory_id === tid);
      if (!ts) continue; // No longer owned

      const connectedRoutes = allRoutes.filter(r => r.hub_territory_id === tid && r.route_status === 'active');
      const routesUsed = connectedRoutes.length;
      const capacity = BASE_ROUTE_CAPACITY;

      hubs.push({
        territory_id: tid,
        routes_used: routesUsed,
        route_capacity: capacity,
        routes_remaining: capacity - routesUsed,
        connected_routes: connectedRoutes.map(r => ({
          id: r.id,
          source_territory_id: r.hub_territory_id,
          destination_territory_id: r.source_territory_id,
          path: r.metadata_json?.path ?? [],
          route_status: r.route_status,
          resource_type: r.resource_type,
          created_round: r.created_round,
        })),
      });
    }

    // Warehouse territories
    const warehouseBuildings = allBuildings.filter(b => b.building_type === 'warehouse' && b.status === 'active');
    const warehouseTerritoryIds = new Set(warehouseBuildings.map(b => b.territory_id));

    const warehouseTerritories = [...warehouseTerritoryIds].map(tid => {
      const ts = myStates.find(s => s.territory_id === tid);
      return {
        territory_id: tid,
        is_protected: true,
        storage: ts?.resource_storage ?? emptyStorage(),
        storage_total: sumStorage(ts?.resource_storage),
      };
    });

    // Active routes summary
    const activeRoutes = allRoutes.filter(r => r.route_status === 'active');

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      hubs,
      hub_count: hubs.length,
      caravan_capacity: caravanCapacity,
      active_routes: activeRoutes.length,
      total_route_capacity: hubs.reduce((s, h) => s + h.route_capacity, 0),
      routes: allRoutes.map(r => ({
        id: r.id,
        hub_territory_id: r.hub_territory_id,
        destination_territory_id: r.source_territory_id,
        path: r.metadata_json?.path ?? [],
        resource_type: r.resource_type,
        route_status: r.route_status,
        range_distance: r.range_distance,
        created_round: r.created_round,
      })),
      warehouse_territories: warehouseTerritories,
    });
  }

  // ── ACTION: createRoute ────────────────────────────────────────────────────
  if (action === 'createRoute') {
    const { hub_territory_id, destination_territory_id } = body;
    if (!hub_territory_id || !destination_territory_id) {
      return Response.json({ error: 'hub_territory_id and destination_territory_id are required' }, { status: 400 });
    }
    if (hub_territory_id === destination_territory_id) {
      return Response.json({ error: 'Hub and destination cannot be the same territory.' }, { status: 400 });
    }

    // Validate hub territory ownership
    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const hubState = allStates.find(s => s.territory_id === hub_territory_id);
    if (!hubState || hubState.owner_player_id !== actingPlayer.id) {
      return Response.json({ error: 'You do not own the hub territory.' }, { status: 400 });
    }

    // Validate hub building exists and is active
    const hubBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
      campaign_id, territory_id: hub_territory_id, building_type: 'resource_hub',
    });
    const activeHub = hubBuildings.find(b => b.status === 'active');
    const legacyHub = hubState.has_resource_hub;

    if (!activeHub && !legacyHub) {
      return Response.json({ error: 'No Resource Hub present in that territory.' }, { status: 400 });
    }

    // Check route capacity
    const existingRoutes = await base44.asServiceRole.entities.SupplyRoute.filter({
      campaign_id, owner_player_id: actingPlayer.id, hub_territory_id,
    });
    const activeCount = existingRoutes.filter(r => r.route_status === 'active').length;
    if (activeCount >= BASE_ROUTE_CAPACITY) {
      return Response.json({ error: `Resource Hub has no remaining route capacity. (${activeCount}/${BASE_ROUTE_CAPACITY} used)` }, { status: 400 });
    }

    // Check duplicate route
    const duplicate = existingRoutes.find(r => r.source_territory_id === destination_territory_id && r.route_status === 'active');
    if (duplicate) {
      return Response.json({ error: 'A route to that destination already exists from this hub.' }, { status: 400 });
    }

    // Validate adjacency/distance (route may cross any territory — no ownership restriction)
    const pathResult = findRoutePath(hub_territory_id, destination_territory_id, adj);
    if (pathResult.path.length === 0 || pathResult.distance > MAX_ROUTE_DISTANCE) {
      const msg = pathResult.path.length === 0
        ? 'Destination is not reachable from this hub.'
        : `Route exceeds maximum range of ${MAX_ROUTE_DISTANCE}. Distance: ${pathResult.distance}.`;
      return Response.json({ error: msg }, { status: 400 });
    }

    // Determine resource type from destination territory
    const destState = allStates.find(s => s.territory_id === destination_territory_id);
    const resourceType = destState?.resource_type ?? 'food';

    // Create the route
    const route = await base44.asServiceRole.entities.SupplyRoute.create({
      campaign_id,
      owner_player_id: actingPlayer.id,
      hub_territory_id,
      source_territory_id: destination_territory_id, // SupplyRoute schema: source = destination of route
      route_status: 'active',
      range_distance: pathResult.distance,
      resource_type: resourceType,
      created_round: round,
      metadata_json: {
        path: pathResult.path,
        path_length: pathResult.distance,
        created_at: new Date().toISOString(),
      },
    });

    // Update hub building metadata (routes_used counter)
    if (activeHub) {
      const meta = activeHub.metadata_json ?? {};
      await base44.asServiceRole.entities.TerritoryBuilding.update(activeHub.id, {
        metadata_json: { ...meta, routes_used: (meta.routes_used ?? 0) + 1 },
      });
    }

    await logEvent(base44, campaign_id, round, 'supply_route_created', actingPlayer.id, {
      hub_territory_id,
      destination_territory_id,
      path: pathResult.path,
      distance: pathResult.distance,
      resource_type: resourceType,
    });

    return Response.json({
      success: true,
      route_id: route.id,
      hub_territory_id,
      destination_territory_id,
      path: pathResult.path,
      distance: pathResult.distance,
      resource_type: resourceType,
    });
  }

  // ── ACTION: deleteRoute ────────────────────────────────────────────────────
  if (action === 'deleteRoute') {
    const { route_id } = body;
    if (!route_id) return Response.json({ error: 'route_id is required' }, { status: 400 });

    const routes = await base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id });
    const route = routes.find(r => r.id === route_id);
    if (!route) return Response.json({ error: 'Route not found' }, { status: 404 });
    if (route.owner_player_id !== actingPlayer.id && !isAdmin) {
      return Response.json({ error: 'You do not own this route' }, { status: 403 });
    }

    // Decrement hub building counter
    const hubBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
      campaign_id, territory_id: route.hub_territory_id, building_type: 'resource_hub',
    });
    const activeHub = hubBuildings.find(b => b.status === 'active');
    if (activeHub) {
      const meta = activeHub.metadata_json ?? {};
      await base44.asServiceRole.entities.TerritoryBuilding.update(activeHub.id, {
        metadata_json: { ...meta, routes_used: Math.max(0, (meta.routes_used ?? 1) - 1) },
      });
    }

    await base44.asServiceRole.entities.SupplyRoute.update(route_id, {
      route_status: 'inactive',
    });

    await logEvent(base44, campaign_id, round, 'supply_route_deleted', actingPlayer.id, {
      route_id,
      hub_territory_id: route.hub_territory_id,
      destination_territory_id: route.source_territory_id,
    });

    return Response.json({ success: true, route_id });
  }

  // ── ACTION: collectRouteResources ──────────────────────────────────────────
  // Extracts resources from destination territories via active routes into the owner's ledger.
  // Resources in warehoused territories are collected but flagged as protected (no effect yet).
  if (action === 'collectRouteResources') {
    const allRoutes = await base44.asServiceRole.entities.SupplyRoute.filter({
      campaign_id, owner_player_id: actingPlayer.id,
    });
    const activeRoutes = allRoutes.filter(r => r.route_status === 'active');

    if (activeRoutes.length === 0) {
      return Response.json({ success: true, collected: emptyStorage(), total_collected: 0, message: 'No active routes' });
    }

    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const allBuildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id });

    const collected = emptyStorage();
    const routeResults = [];

    for (const route of activeRoutes) {
      const destId = route.source_territory_id; // SupplyRoute.source = destination of route
      const destState = allStates.find(s => s.territory_id === destId);
      if (!destState) continue;

      const storage = destState.resource_storage ?? emptyStorage();
      const totalInStorage = sumStorage(storage);
      if (totalInStorage === 0) {
        routeResults.push({ route_id: route.id, destination: destId, extracted: emptyStorage(), total: 0 });
        continue;
      }

      // Extract up to 1 of primary resource type per route per collection
      const resourceType = route.resource_type ?? destState.resource_type ?? 'food';
      const available = storage[resourceType] ?? 0;
      const extract = Math.min(1, available);

      if (extract > 0) {
        collected[resourceType] = (collected[resourceType] ?? 0) + extract;

        // Deduct from territory storage
        const newStorage = { ...storage, [resourceType]: available - extract };
        await base44.asServiceRole.entities.TerritoryState.update(destState.id, {
          resource_storage: newStorage,
        });

        // Check if destination has warehouse protection (informational only for now)
        const destBuildings = allBuildings.filter(b => b.territory_id === destId && b.building_type === 'warehouse' && b.status === 'active');
        const isProtected = destBuildings.length > 0;

        routeResults.push({
          route_id: route.id,
          destination: destId,
          extracted: { [resourceType]: extract },
          total: extract,
          was_protected: isProtected, // future: raids would be blocked here
        });
      } else {
        routeResults.push({ route_id: route.id, destination: destId, extracted: emptyStorage(), total: 0 });
      }
    }

    const totalCollected = sumStorage(collected);

    if (totalCollected > 0) {
      // Merge into player ledger
      const ledgers = await base44.asServiceRole.entities.PlayerResourceLedger.filter({
        campaign_id, player_id: actingPlayer.id,
      });
      const existingLedger = ledgers[0];
      const newLedger = mergeLedger(existingLedger, collected);

      if (existingLedger) {
        await base44.asServiceRole.entities.PlayerResourceLedger.update(existingLedger.id, {
          ...newLedger, updated_at_round: round, updated_at_phase: 'logistics',
        });
      } else {
        await base44.asServiceRole.entities.PlayerResourceLedger.create({
          campaign_id, player_id: actingPlayer.id,
          ...newLedger, updated_at_round: round, updated_at_phase: 'logistics',
        });
      }
    }

    await logEvent(base44, campaign_id, round, 'route_resources_collected', actingPlayer.id, {
      active_routes: activeRoutes.length,
      collected,
      total_collected: totalCollected,
      route_results: routeResults,
    });

    return Response.json({
      success: true,
      collected,
      total_collected: totalCollected,
      route_results: routeResults,
      routes_processed: activeRoutes.length,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});