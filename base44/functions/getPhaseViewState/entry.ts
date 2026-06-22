/**
 * getPhaseViewState — Territory Phase View State (Atomic Architecture)
 *
 * Returns a server-filtered snapshot of territory state for the requesting player.
 * Replaces the broad TerritoryState.filter({ campaign_id }) + subscribe() pattern.
 *
 * Visibility rules:
 *   Own territories            → full data (troops, resources, influence)
 *   Enemy territories          → public data only (owner, structures, hub status)
 *   Intel-revealed territories → revealed subset only (per report type)
 *   Admin/test mode            → full data for all test players, clearly flagged
 *
 * Payload shape:
 * {
 *   territories: [{ territory_id, owner_player_id, troop_count, resource_storage,
 *                   structures, has_resource_hub, resource_type,
 *                   _hidden: bool, _revealed_by: string|null }],
 *   influence_by_territory: { [territory_id]: [{ player_id, influence_amount }] },
 *   influence_by_region:    { [region_id]:    [{ player_id, spendable_influence }] },
 *   intel_reports:          { [territory_id]: IntelligenceReport },  // latest per territory
 *   dev_records:            { [territory_id]: TerritoryDevelopment },
 *   buildings_by_territory: { [territory_id]: TerritoryBuilding[] },
 *   supply_routes:          SupplyRoute[],
 *   spread_threshold:       number,
 *   is_admin_payload:       bool,
 *   acting_player_id:       string,
 *   round:                  number,
 *   phase:                  string,
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Phases where enemy hidden information must be masked
const HIDDEN_INFO_PHASES = new Set(['attack', 'battle', 'fortify', 'deploy', 'initial_deploy']);

// How intel reports reveal information
const REVEAL_MAP = {
  recon_territory:       'troops',    // reveals troop_count only
  audit_stockpile:       'resources', // reveals resource_storage only
  investigate_influence: 'influence', // reveals influence only (handled in influence layer)
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { campaign_id, acting_as_player_id } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id required' }, { status: 400 });

    // ── Load campaign + players ──────────────────────────────────────────────
    const [campaigns, players] = await Promise.all([
      base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
      base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
    ]);
    const campaign = campaigns[0];
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const myPlayer = players.find(p => p.user_id === user.id);
    if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

    const isAdmin = campaign.admin_user_id === user.id || user.role === 'admin';

    // Resolve acting player (admin/test mode only)
    let actingPlayer = myPlayer;
    if (acting_as_player_id) {
      const target = players.find(p => p.id === acting_as_player_id);
      if (!target) return Response.json({ error: 'Invalid acting_as_player_id' }, { status: 400 });
      if (!isAdmin && target.id !== myPlayer.id) {
        return Response.json({ error: 'Only admins can act as other players' }, { status: 403 });
      }
      actingPlayer = target;
    }

    // Full admin spectator mode (sees all hidden data) only when explicitly requested.
    // Default admin view is filtered to their own player perspective, same as any player.
    // This prevents the admin account from leaking all test players' hidden information.
    const isExplicitSpectatorMode = isAdmin && !!body.admin_spectator_mode && !acting_as_player_id;
    const isAdminTestMode = isAdmin && !!acting_as_player_id;
    const actingPlayerId = actingPlayer.id;
    const phase = campaign.current_phase;
    const round = campaign.current_round ?? 1;
    const shouldMaskEnemies = HIDDEN_INFO_PHASES.has(phase) || !phase;

    // ── Load all territory data in parallel ──────────────────────────────────
    const [
      territoryStates,
      devRecords,
      buildings,
      supplyRoutes,
      intelReports,
      influenceRecords,
      regionalPools,
    ] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
      // Intel reports for the acting player only
      base44.asServiceRole.entities.IntelligenceReport.filter({
        campaign_id,
        viewer_player_id: actingPlayerId,
      }),
      // Permanent influence — all territories
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
      // Spendable influence — all regions
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
    ]);

    // ── Build intel reveal index ─────────────────────────────────────────────
    // For each territory, track what the most recent report revealed (troops / resources)
    // Only use the most recent report per territory per type to avoid stale overrides
    const intelByTerritory = {}; // { [territory_id]: { report_type, report_data, generated_round } }
    for (const report of intelReports) {
      const tid = report.target_territory_id;
      if (!tid) continue;
      const existing = intelByTerritory[tid];
      // Keep most recent report that has the highest generated_round
      if (!existing || (report.generated_round ?? 0) > (existing.generated_round ?? 0)) {
        intelByTerritory[tid] = report;
      }
    }

    // ── Apply visibility filtering to territory states ────────────────────────
    const filteredTerritories = territoryStates.map(ts => {
      const isOwn = ts.owner_player_id === actingPlayerId;
      // Full data shown for: own territories, explicit spectator mode, or non-masked phases.
      // Admin acting as a player sees only that player's allowed data (same as a real player).
      if (isOwn || isExplicitSpectatorMode || !shouldMaskEnemies) {
        // Full data — own territory or non-masked phase
        return { ...ts, _hidden: false, _revealed_by: null };
      }

      // Enemy territory in a masked phase — check for intel reveals
      const intel = intelByTerritory[ts.territory_id];
      const revealType = intel ? REVEAL_MAP[intel.report_type] : null;

      const masked = {
        ...ts,
        troop_count: null,
        resource_storage: null,
        _hidden: true,
        _revealed_by: null,
      };

      if (revealType === 'troops' && intel) {
        // recon_territory revealed troop count — apply it
        masked.troop_count = intel.report_data?.troop_count ?? null;
        masked._hidden = false;
        masked._revealed_by = 'recon_territory';
        masked._revealed_round = intel.generated_round;
      } else if (revealType === 'resources' && intel) {
        // audit_stockpile revealed resources — apply it
        masked.resource_storage = intel.report_data?.territory_storage ?? null;
        masked._revealed_by = 'audit_stockpile';
        masked._revealed_round = intel.generated_round;
        // troops still hidden
      }

      return masked;
    });

    // ── Build influence views ─────────────────────────────────────────────────
    // Permanent influence — only show own player's amounts + amounts revealed by intel
    const influenceByTerritory = {};
    for (const rec of influenceRecords) {
      const tid = rec.territory_id;
      if (!influenceByTerritory[tid]) influenceByTerritory[tid] = [];
      const isOwn = rec.player_id === actingPlayerId;
      const intelRec = intelByTerritory[tid];
      // Influence amounts are private — only own player's amounts visible
      // unless revealed by an investigate_influence intel report.
      // Admin-test mode respects the acting player's perspective (no bypass).
      const influenceRevealed = !shouldMaskEnemies
        || (intelRec && REVEAL_MAP[intelRec.report_type] === 'influence');

      if (isOwn || influenceRevealed) {
        influenceByTerritory[tid].push({
          player_id: rec.player_id,
          influence_amount: rec.influence_amount,
          last_updated_round: rec.last_updated_round,
          source: rec.source,
        });
      } else {
        // Enemy influence — show hidden marker so UI can show count without value
        influenceByTerritory[tid].push({
          player_id: rec.player_id,
          influence_amount: null,
          _hidden: true,
        });
      }
    }

    // Spendable influence — only own player's pools + all in admin mode
    const influenceByRegion = {};
    for (const pool of regionalPools) {
      const rid = pool.region_id;
      if (!influenceByRegion[rid]) influenceByRegion[rid] = [];
      const isOwn = pool.player_id === actingPlayerId;
      if (isOwn || !shouldMaskEnemies) {
        influenceByRegion[rid].push({
          player_id: pool.player_id,
          spendable_influence: pool.spendable_influence,
          last_updated_round: pool.last_updated_round,
        });
      }
    }

    // ── Build dev records index ───────────────────────────────────────────────
    const devRecordsByTerritory = {};
    for (const d of devRecords) devRecordsByTerritory[d.territory_id] = d;

    // ── Build buildings index ─────────────────────────────────────────────────
    const buildingsByTerritory = {};
    for (const b of buildings) {
      if (!buildingsByTerritory[b.territory_id]) buildingsByTerritory[b.territory_id] = [];
      buildingsByTerritory[b.territory_id].push(b);
    }

    // ── Build intel reports index (latest per territory) ─────────────────────
    const intelLatestByTerritory = {};
    for (const [tid, report] of Object.entries(intelByTerritory)) {
      intelLatestByTerritory[tid] = report;
    }

    // ── Spread threshold (static for now) ─────────────────────────────────────
    const SPREAD_THRESHOLD = 10;

    // ── Filter supply routes: own routes + routes targeting own territories ───
    // (so TerritoryDetailPanel can show "someone has a route targeting this territory")
    const ownTerritoryIds = new Set(
      territoryStates.filter(ts => ts.owner_player_id === actingPlayerId).map(ts => ts.territory_id)
    );
    const visibleSupplyRoutes = isExplicitSpectatorMode
      ? supplyRoutes
      : supplyRoutes.filter(r =>
          r.owner_player_id === actingPlayerId ||
          ownTerritoryIds.has(r.source_territory_id) ||
          ownTerritoryIds.has(r.hub_territory_id)
        );

    return Response.json({
      success: true,
      territories: filteredTerritories,
      influence_by_territory: influenceByTerritory,
      influence_by_region: influenceByRegion,
      intel_reports: intelLatestByTerritory,
      dev_records: devRecordsByTerritory,
      buildings_by_territory: buildingsByTerritory,
      supply_routes: visibleSupplyRoutes,
      spread_threshold: SPREAD_THRESHOLD,
      is_admin_payload: isAdminTestMode || isExplicitSpectatorMode,
      acting_player_id: actingPlayerId,
      round,
      phase,
    });
  } catch (err) {
    console.error('[getPhaseViewState] error:', err?.message ?? err);
    return Response.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
});