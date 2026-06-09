/**
 * intelligencePhase — Sprint 4M
 *
 * Handles Intelligence Actions using the reusable Influence Action Framework.
 * Actions: recon_territory, audit_stockpile, investigate_influence
 *
 * Actions:
 *   getIntelligenceState   — returns available intel actions, region pools, past reports
 *   submitIntelAction      — validate cost, spend influence, gather data, create IntelligenceReport
 *   getReports             — list IntelligenceReports for the acting player
 *
 * Framework:
 *   Each resolution_logic key maps to a handler in RESOLUTION_HANDLERS below.
 *   Adding a new Influence Action only requires:
 *     1. A new entry in config/influenceActionFramework.js (frontend)
 *     2. A new entry in RESOLUTION_HANDLERS below (backend)
 *     No other files need modification.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Action cost registry (mirrors frontend config) ───────────────────────────
const ACTION_COSTS = {
  recon_territory:        { type: 'influence', amount: 2 },
  audit_stockpile:        { type: 'influence', amount: 3 },
  investigate_influence:  { type: 'influence', amount: 3 },
};

const ACTION_REPORT_TYPES = {
  recon_territory:       'recon_territory',
  audit_stockpile:       'audit_stockpile',
  investigate_influence: 'investigate_influence',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function spendRegionalInfluence(base44, campaignId, playerId, regionId, amount, round) {
  const existing = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
    campaign_id: campaignId, region_id: regionId, player_id: playerId,
  });
  const record = existing[0];
  const current = record?.spendable_influence ?? 0;
  if (current < amount) {
    throw new Error(`Not enough influence in region '${regionId}'. Have ${current}, need ${amount}.`);
  }
  if (record) {
    await base44.asServiceRole.entities.RegionalInfluencePool.update(record.id, {
      spendable_influence: current - amount,
      last_updated_round: round,
    });
  }
  return current - amount;
}

// ─── Resolution Handlers ──────────────────────────────────────────────────────
// Each handler receives (base44, campaignId, targetTerritoryId, targetRegionId, players)
// and returns the report_data object — what gets stored in IntelligenceReport.report_data.
//
// Framework contract: add a new key here + a matching entry in influenceActionFramework.js
// to add a new intelligence action without touching any other files.

const RESOLUTION_HANDLERS = {

  // ── recon_territory ─────────────────────────────────────────────────────────
  async recon_territory(base44, campaignId, targetTerritoryId) {
    const [territoryStates, buildings, routes] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id: campaignId, territory_id: targetTerritoryId }),
      base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id: campaignId, territory_id: targetTerritoryId, status: 'active' }),
      base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id: campaignId }),
    ]);
    const ts = territoryStates[0];
    const activeRoutes = routes.filter(r =>
      (r.hub_territory_id === targetTerritoryId || r.source_territory_id === targetTerritoryId) &&
      r.route_status === 'active'
    );
    return {
      territory_id: targetTerritoryId,
      owner_player_id: ts?.owner_player_id ?? null,
      troop_count: ts?.troop_count ?? 0,               // PRIVATE — revealed by recon
      structures: ts?.structures ?? [],
      active_buildings: buildings.map(b => ({
        building_type: b.building_type,
        pillar_type: b.pillar_type,
        territory_id: b.territory_id,
      })),
      active_supply_routes: activeRoutes.map(r => ({
        id: r.id,
        hub_territory_id: r.hub_territory_id,
        source_territory_id: r.source_territory_id,
        owner_player_id: r.owner_player_id,
        resource_type: r.resource_type,
      })),
    };
  },

  // ── audit_stockpile ─────────────────────────────────────────────────────────
  async audit_stockpile(base44, campaignId, targetTerritoryId) {
    const [territoryStates, resourceLedgers] = await Promise.all([
      base44.asServiceRole.entities.TerritoryState.filter({ campaign_id: campaignId, territory_id: targetTerritoryId }),
      base44.asServiceRole.entities.PlayerResourceLedger.filter({ campaign_id: campaignId }),
    ]);
    const ts = territoryStates[0];
    const owner = ts?.owner_player_id ?? null;
    const ownerLedger = owner ? resourceLedgers.find(l => l.player_id === owner) : null;
    return {
      territory_id: targetTerritoryId,
      owner_player_id: owner,
      territory_storage: ts?.resource_storage ?? {},    // PRIVATE — revealed by audit
      owner_gold: ownerLedger?.gold ?? null,            // PRIVATE — revealed by audit
      owner_iron: ownerLedger?.iron ?? null,
      owner_timber: ownerLedger?.timber ?? null,
      owner_stone: ownerLedger?.stone ?? null,
      owner_food: ownerLedger?.food ?? null,
    };
  },

  // ── investigate_influence ────────────────────────────────────────────────────
  async investigate_influence(base44, campaignId, targetTerritoryId, targetRegionId) {
    const result = { territory_id: targetTerritoryId, region_id: targetRegionId };

    if (targetTerritoryId) {
      const territoryInfluence = await base44.asServiceRole.entities.TerritoryInfluence.filter({
        campaign_id: campaignId, territory_id: targetTerritoryId,
      });
      result.permanent_influence = territoryInfluence.map(ti => ({
        player_id: ti.player_id,
        influence_amount: ti.influence_amount,
      }));
    }

    if (targetRegionId) {
      const regionalPools = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
        campaign_id: campaignId, region_id: targetRegionId,
      });
      result.spendable_influence = regionalPools.map(rp => ({
        player_id: rp.player_id,
        spendable_influence: rp.spendable_influence,  // PRIVATE — revealed by investigate
      }));
    }

    return result;
  },
};

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
  const phase = campaign.current_phase ?? 'unknown';

  // Resolve acting player (admin impersonation support)
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

  // ── getIntelligenceState ───────────────────────────────────────────────────
  if (action === 'getIntelligenceState') {
    const [regionalPools, reports] = await Promise.all([
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id, player_id: actingPlayer.id }),
      base44.asServiceRole.entities.IntelligenceReport.filter({ campaign_id, viewer_player_id: actingPlayer.id }),
    ]);

    const regionPools = {};
    for (const p of regionalPools) regionPools[p.region_id] = p.spendable_influence ?? 0;

    const totalSpendable = Object.values(regionPools).reduce((s, v) => s + v, 0);

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      round,
      region_pools: regionPools,
      total_spendable_influence: totalSpendable,
      action_costs: ACTION_COSTS,
      reports_this_campaign: reports.length,
      recent_reports: reports
        .sort((a, b) => (b.generated_round ?? 0) - (a.generated_round ?? 0))
        .slice(0, 10)
        .map(r => ({
          id: r.id,
          report_type: r.report_type,
          target_territory_id: r.target_territory_id ?? null,
          target_region_id: r.target_region_id ?? null,
          generated_round: r.generated_round,
          generated_at: r.generated_at,
        })),
    });
  }

  // ── getReports ────────────────────────────────────────────────────────────
  if (action === 'getReports') {
    const { report_id } = body;

    if (report_id) {
      // Single full report
      const reports = await base44.asServiceRole.entities.IntelligenceReport.filter({ id: report_id });
      const report = reports[0];
      if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
      if (report.campaign_id !== campaign_id) return Response.json({ error: 'Campaign mismatch' }, { status: 403 });
      if (report.viewer_player_id !== actingPlayer.id && !isAdmin) {
        return Response.json({ error: 'Not your report' }, { status: 403 });
      }
      return Response.json({ success: true, report });
    }

    const reports = await base44.asServiceRole.entities.IntelligenceReport.filter({
      campaign_id, viewer_player_id: actingPlayer.id,
    });
    return Response.json({
      success: true,
      reports: reports
        .sort((a, b) => (b.generated_round ?? 0) - (a.generated_round ?? 0))
        .map(r => ({
          id: r.id,
          report_type: r.report_type,
          target_territory_id: r.target_territory_id ?? null,
          target_region_id: r.target_region_id ?? null,
          target_player_id: r.target_player_id ?? null,
          generated_round: r.generated_round,
          generated_phase: r.generated_phase,
          generated_at: r.generated_at,
          influence_spent: r.influence_spent ?? 0,
          report_data: r.report_data ?? {},
        })),
    });
  }

  // ── submitIntelAction ──────────────────────────────────────────────────────
  if (action === 'submitIntelAction') {
    const { intel_action_id, region_id, target_territory_id, target_region_id } = body;

    if (!intel_action_id) {
      return Response.json({ error: 'intel_action_id is required' }, { status: 400 });
    }

    const costConfig = ACTION_COSTS[intel_action_id];
    if (!costConfig) {
      return Response.json({ error: `Unknown intel action: ${intel_action_id}` }, { status: 400 });
    }

    const handler = RESOLUTION_HANDLERS[intel_action_id];
    if (!handler) {
      return Response.json({ error: `No resolution handler for: ${intel_action_id}` }, { status: 400 });
    }

    if (!region_id) {
      return Response.json({ error: 'region_id is required (influence source)' }, { status: 400 });
    }

    // target validation per action
    if ((intel_action_id === 'recon_territory' || intel_action_id === 'audit_stockpile') && !target_territory_id) {
      return Response.json({ error: 'target_territory_id is required for this action' }, { status: 400 });
    }
    if (intel_action_id === 'investigate_influence' && !target_territory_id && !target_region_id) {
      return Response.json({ error: 'target_territory_id or target_region_id is required for investigate_influence' }, { status: 400 });
    }

    // Spend influence
    await spendRegionalInfluence(base44, campaign_id, actingPlayer.id, region_id, costConfig.amount, round);

    // Gather data via resolution handler
    const reportData = await handler(base44, campaign_id, target_territory_id ?? null, target_region_id ?? null, players);

    // Determine target player from territory state
    let targetPlayerId = null;
    if (target_territory_id) {
      const states = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id, territory_id: target_territory_id });
      targetPlayerId = states[0]?.owner_player_id ?? null;
    }

    // Create IntelligenceReport (immutable snapshot)
    const now = new Date().toISOString();
    const report = await base44.asServiceRole.entities.IntelligenceReport.create({
      campaign_id,
      viewer_player_id: actingPlayer.id,
      target_player_id: targetPlayerId,
      target_territory_id: target_territory_id ?? null,
      target_region_id: target_region_id ?? null,
      report_type: ACTION_REPORT_TYPES[intel_action_id],
      generated_round: round,
      generated_phase: phase,
      generated_at: now,
      report_data: reportData,
      influence_spent: costConfig.amount,
      region_id_used: region_id,
    });

    // Log
    await base44.asServiceRole.entities.SetupLog.create({
      campaign_id, phase, round,
      event_type: `intel_action_${intel_action_id}`,
      player_id: actingPlayer.id,
      payload: {
        report_id: report.id,
        target_territory_id: target_territory_id ?? null,
        target_region_id: target_region_id ?? null,
        influence_spent: costConfig.amount,
        region_id,
      },
      is_public: false, // Intelligence actions are private
    });

    return Response.json({
      success: true,
      report_id: report.id,
      report_type: ACTION_REPORT_TYPES[intel_action_id],
      influence_spent: costConfig.amount,
      report_data: reportData,
      message: `${intel_action_id.replace(/_/g, ' ')} completed. Report saved.`,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});