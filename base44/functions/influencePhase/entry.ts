/**
 * influencePhase — Sprint 4G Regional Influence Economy
 *
 * Two forms of influence:
 *   Permanent Influence — stored on territories (TerritoryInfluence). Never reduced by actions.
 *   Spendable Influence — stored by player per region (RegionalInfluencePool). Action currency.
 *
 * Actions:
 *   getInfluenceState       — returns territory influence + regional pools for a campaign
 *   addInfluence            — direct: adds Permanent to territory + Spendable to region (NO spread)
 *   runMonumentGeneration   — admin: generates +1 perm+spend per active Monument per player
 *   runInfluenceSpread      — admin: checks threshold; spreads Permanent only (no Spendable)
 *   runRoundInfluence       — admin: runs monument generation + spread in one call
 *   testAddInfluence        — admin: convenience for testing
 *
 * ─── INFLUENCE SPREAD SAFETY ──────────────────────────────────────────────────
 *   Spread creates Permanent Influence ONLY.
 *   Spread NEVER creates Spendable Influence.
 *   Only direct generation (addInfluence, monument, objective rewards) creates Spendable.
 *
 * ─── ADJACENCY ────────────────────────────────────────────────────────────────
 *   SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_ADJACENCY
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Constants ────────────────────────────────────────────────────────────────

const INFLUENCE_SPREAD_THRESHOLD = 10; // Permanent influence needed to trigger spread

// ─── Territory → Region mapping (inline — no local imports in Deno) ───────────
// SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_TERRITORIES
const SC_TERRITORY_REGION = {
  I8:'outer_passes', I4:'outer_passes', I6:'outer_passes', I7:'outer_passes',
  I1:'high_crown',   I2:'high_crown',   I3:'high_crown',   I5:'high_crown',
  W1:'northern_wilds',W2:'northern_wilds',W3:'northern_wilds',W4:'northern_wilds',W5:'northern_wilds',
  W6:'deepwoods',    W7:'deepwoods',    W8:'deepwoods',    W9:'deepwoods',
  B1:'northern_ruins',B3:'northern_ruins',B2:'northern_ruins',B4:'northern_ruins',
  B5:'central_crossroads',B6:'central_crossroads',B7:'central_crossroads',
  B8:'southern_ruins',B9:'southern_ruins',B10:'southern_ruins',
  S1:'western_plains',S4:'western_plains',S7:'western_plains',S2:'western_plains',
  S5:'eastern_granaries',S8:'eastern_granaries',S3:'eastern_granaries',
  S6:'eastern_granaries',S9:'eastern_granaries',
  C1:'northern_isles',C2:'northern_isles',C3:'northern_isles',C4:'northern_isles',
  C5:'southern_fractures',C6:'southern_fractures',C7:'southern_fractures',C8:'southern_fractures',
};

// ─── Shattered Crown Adjacency ────────────────────────────────────────────────
// SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_ADJACENCY
const SC_ADJACENCY_TYPED = [
  {from:'I8',to:'I4',type:'land'},{from:'I4',to:'I3',type:'land'},
  {from:'I4',to:'I7',type:'land'},{from:'I6',to:'I3',type:'land'},
  {from:'I6',to:'I5',type:'land'},{from:'I6',to:'I7',type:'land'},
  {from:'I1',to:'I2',type:'land'},{from:'I1',to:'I5',type:'land'},
  {from:'I2',to:'I3',type:'land'},{from:'I2',to:'I5',type:'land'},
  {from:'I6',to:'B1',type:'land'},{from:'I7',to:'B1',type:'land'},
  {from:'I7',to:'B3',type:'land'},
  {from:'I8',to:'C1',type:'maritime'},
  {from:'W1',to:'W2',type:'land'},{from:'W2',to:'W3',type:'land'},
  {from:'W2',to:'W4',type:'land'},{from:'W2',to:'W5',type:'land'},
  {from:'W3',to:'W5',type:'land'},{from:'W3',to:'W6',type:'land'},
  {from:'W4',to:'W5',type:'land'},{from:'W4',to:'W7',type:'land'},
  {from:'W5',to:'W6',type:'land'},{from:'W5',to:'W7',type:'land'},
  {from:'W5',to:'W8',type:'land'},{from:'W6',to:'W9',type:'land'},
  {from:'W7',to:'W8',type:'land'},{from:'W8',to:'W9',type:'land'},
  {from:'W7',to:'S1',type:'land'},{from:'W9',to:'S2',type:'land'},
  {from:'B1',to:'B3',type:'land'},{from:'B1',to:'B2',type:'land'},
  {from:'B3',to:'B2',type:'land'},{from:'B3',to:'B4',type:'land'},
  {from:'B2',to:'B4',type:'land'},{from:'B2',to:'B5',type:'land'},
  {from:'B2',to:'B6',type:'land'},{from:'B4',to:'B7',type:'land'},
  {from:'B5',to:'B6',type:'land'},{from:'B5',to:'B8',type:'land'},
  {from:'B6',to:'B7',type:'land'},{from:'B6',to:'B8',type:'land'},
  {from:'B6',to:'B9',type:'land'},{from:'B7',to:'B10',type:'land'},
  {from:'B8',to:'B9',type:'land'},{from:'B9',to:'B10',type:'land'},
  {from:'B10',to:'C6',type:'maritime'},{from:'B10',to:'C4',type:'maritime'},
  {from:'B10',to:'S3',type:'river_crossing'},
  {from:'S1',to:'S2',type:'land'},{from:'S1',to:'S4',type:'land'},
  {from:'S4',to:'S5',type:'land'},{from:'S4',to:'S7',type:'land'},
  {from:'S7',to:'S5',type:'land'},{from:'S7',to:'S8',type:'land'},
  {from:'S2',to:'S3',type:'land'},{from:'S2',to:'S5',type:'land'},
  {from:'S5',to:'S8',type:'land'},{from:'S5',to:'S6',type:'land'},
  {from:'S3',to:'S6',type:'land'},{from:'S6',to:'S9',type:'land'},
  {from:'S6',to:'C8',type:'maritime'},{from:'S9',to:'C8',type:'maritime'},
  {from:'C1',to:'C2',type:'maritime'},{from:'C2',to:'C3',type:'land'},
  {from:'C3',to:'C4',type:'maritime'},{from:'C3',to:'C5',type:'maritime'},
  {from:'C4',to:'C5',type:'maritime'},{from:'C4',to:'C6',type:'maritime'},
  {from:'C5',to:'C6',type:'maritime'},{from:'C5',to:'C7',type:'maritime'},
  {from:'C6',to:'C7',type:'maritime'},{from:'C6',to:'C8',type:'maritime'},
  {from:'C7',to:'C8',type:'maritime'},
];

function buildAdjacency() {
  const adj = {};
  for (const { from, to } of SC_ADJACENCY_TYPED) {
    if (!adj[from]) adj[from] = [];
    if (!adj[to])   adj[to]   = [];
    adj[from].push(to);
    adj[to].push(from);
  }
  return adj;
}
const ADJ = buildAdjacency();

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * upsertPermanentInfluence — adds `amount` permanent influence for a player in a territory.
 * Returns the new total.
 */
async function upsertPermanentInfluence(base44, campaignId, playerId, territoryId, amount, round, source) {
  const existing = await base44.asServiceRole.entities.TerritoryInfluence.filter({
    campaign_id: campaignId,
    territory_id: territoryId,
    player_id: playerId,
  });
  const record = existing[0];
  if (record) {
    const newAmount = Math.max(0, (record.influence_amount ?? 0) + amount);
    await base44.asServiceRole.entities.TerritoryInfluence.update(record.id, {
      influence_amount: newAmount,
      last_updated_round: round,
      source,
    });
    return newAmount;
  } else {
    const newAmount = Math.max(0, amount);
    await base44.asServiceRole.entities.TerritoryInfluence.create({
      campaign_id: campaignId,
      territory_id: territoryId,
      player_id: playerId,
      influence_amount: newAmount,
      last_updated_round: round,
      source,
    });
    return newAmount;
  }
}

/**
 * upsertSpendableInfluence — adds `amount` spendable influence for a player in a region.
 * Returns the new total.
 */
async function upsertSpendableInfluence(base44, campaignId, playerId, regionId, amount, round) {
  const existing = await base44.asServiceRole.entities.RegionalInfluencePool.filter({
    campaign_id: campaignId,
    region_id: regionId,
    player_id: playerId,
  });
  const record = existing[0];
  if (record) {
    const newAmount = Math.max(0, (record.spendable_influence ?? 0) + amount);
    await base44.asServiceRole.entities.RegionalInfluencePool.update(record.id, {
      spendable_influence: newAmount,
      last_updated_round: round,
    });
    return newAmount;
  } else {
    const newAmount = Math.max(0, amount);
    await base44.asServiceRole.entities.RegionalInfluencePool.create({
      campaign_id: campaignId,
      region_id: regionId,
      player_id: playerId,
      spendable_influence: newAmount,
      last_updated_round: round,
    });
    return newAmount;
  }
}

/**
 * addDirectInfluence — direct influence generation.
 * Creates BOTH permanent (on territory) and spendable (in territory's region).
 * Used by: addInfluence action, monument generation, objective rewards.
 */
async function addDirectInfluence(base44, campaignId, playerId, territoryId, amount, round, source) {
  const regionId = SC_TERRITORY_REGION[territoryId];

  const newPermanent = await upsertPermanentInfluence(
    base44, campaignId, playerId, territoryId, amount, round, source
  );

  let newSpendable = null;
  if (regionId) {
    newSpendable = await upsertSpendableInfluence(
      base44, campaignId, playerId, regionId, amount, round
    );
  }

  return { permanent: newPermanent, spendable: newSpendable, region_id: regionId };
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

  // ── ACTION: getInfluenceState ──────────────────────────────────────────────
  if (action === 'getInfluenceState') {
    const [influenceRecords, regionalPools] = await Promise.all([
      base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
      base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
    ]);

    // Group permanent influence by territory_id
    const byTerritory = {};
    for (const r of influenceRecords) {
      if (!byTerritory[r.territory_id]) byTerritory[r.territory_id] = [];
      byTerritory[r.territory_id].push({
        player_id: r.player_id,
        influence_amount: r.influence_amount,
        last_updated_round: r.last_updated_round,
      });
    }

    // Group spendable influence by region_id → player_id
    const byRegion = {};
    for (const r of regionalPools) {
      if (!byRegion[r.region_id]) byRegion[r.region_id] = [];
      byRegion[r.region_id].push({
        player_id: r.player_id,
        spendable_influence: r.spendable_influence,
        last_updated_round: r.last_updated_round,
      });
    }

    // Compute per-player totals
    const playerTotals = {};
    for (const r of influenceRecords) {
      if (!playerTotals[r.player_id]) {
        playerTotals[r.player_id] = { permanent: 0, spendable: 0, by_region_permanent: {} };
      }
      playerTotals[r.player_id].permanent += r.influence_amount ?? 0;
      const regionId = SC_TERRITORY_REGION[r.territory_id];
      if (regionId) {
        playerTotals[r.player_id].by_region_permanent[regionId] =
          (playerTotals[r.player_id].by_region_permanent[regionId] ?? 0) + (r.influence_amount ?? 0);
      }
    }
    for (const r of regionalPools) {
      if (!playerTotals[r.player_id]) {
        playerTotals[r.player_id] = { permanent: 0, spendable: 0, by_region_permanent: {} };
      }
      playerTotals[r.player_id].spendable += r.spendable_influence ?? 0;
    }

    return Response.json({
      success: true,
      by_territory: byTerritory,
      by_region: byRegion,
      player_totals: playerTotals,
      spread_threshold: INFLUENCE_SPREAD_THRESHOLD,
      total_territory_records: influenceRecords.length,
      total_regional_records: regionalPools.length,
    });
  }

  // ── ACTION: addInfluence ───────────────────────────────────────────────────
  // Direct influence: creates BOTH Permanent (territory) and Spendable (region).
  if (action === 'addInfluence') {
    const { territory_id, amount } = body;
    if (!territory_id) return Response.json({ error: 'territory_id is required' }, { status: 400 });
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return Response.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const result = await addDirectInfluence(
      base44, campaign_id, actingPlayer.id, territory_id, amount, round, 'direct'
    );

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      territory_id,
      amount_added: amount,
      permanent_new_total: result.permanent,
      spendable_new_total: result.spendable,
      region_id: result.region_id,
    });
  }

  // ── ACTION: runMonumentGeneration (admin only) ─────────────────────────────
  // Finds all active Monument buildings, generates +1 Permanent + +1 Spendable per monument.
  if (action === 'runMonumentGeneration') {
    if (!isAdmin) return Response.json({ error: 'Admin only action' }, { status: 403 });

    const monuments = await base44.asServiceRole.entities.TerritoryBuilding.filter({
      campaign_id,
      building_type: 'monument',
      status: 'active',
    });

    const results = [];
    for (const monument of monuments) {
      const result = await addDirectInfluence(
        base44, campaign_id, monument.player_id, monument.territory_id, 1, round, 'monument'
      );
      results.push({
        territory_id: monument.territory_id,
        player_id: monument.player_id,
        region_id: result.region_id,
        permanent_new_total: result.permanent,
        spendable_new_total: result.spendable,
      });
    }

    return Response.json({
      success: true,
      monuments_processed: results.length,
      results,
    });
  }

  // ── ACTION: runInfluenceSpread (admin only) ────────────────────────────────
  // Threshold check: if a territory has >= INFLUENCE_SPREAD_THRESHOLD permanent influence
  // for a player, +1 permanent influence is added to all adjacent territories for that player.
  // SPREAD NEVER CREATES SPENDABLE INFLUENCE.
  if (action === 'runInfluenceSpread') {
    if (!isAdmin) return Response.json({ error: 'Admin only action' }, { status: 403 });

    const influenceRecords = await base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id });

    // Find all territory+player combos at or above threshold
    const spreadSources = influenceRecords.filter(
      r => (r.influence_amount ?? 0) >= INFLUENCE_SPREAD_THRESHOLD
    );

    const spreadResults = [];
    // Collect all spread operations to apply (deduplicate same territory+player pair)
    const spreadMap = {}; // key: `${playerId}:${territoryId}` → delta
    for (const source of spreadSources) {
      const neighbors = ADJ[source.territory_id] ?? [];
      for (const neighborId of neighbors) {
        const key = `${source.player_id}:${neighborId}`;
        spreadMap[key] = (spreadMap[key] ?? 0) + 1;
      }
    }

    // Apply all spread — Permanent Influence ONLY, no Spendable
    for (const [key, delta] of Object.entries(spreadMap)) {
      const [playerId, territoryId] = key.split(':');
      const newAmount = await upsertPermanentInfluence(
        base44, campaign_id, playerId, territoryId, delta, round, 'spread'
      );
      spreadResults.push({ player_id: playerId, territory_id: territoryId, delta, new_total: newAmount });
    }

    return Response.json({
      success: true,
      spread_threshold: INFLUENCE_SPREAD_THRESHOLD,
      sources_above_threshold: spreadSources.length,
      territories_affected: spreadResults.length,
      results: spreadResults,
    });
  }

  // ── ACTION: runRoundInfluence (admin only) ─────────────────────────────────
  // Convenience: runs monument generation + spread in sequence for the current round.
  if (action === 'runRoundInfluence') {
    if (!isAdmin) return Response.json({ error: 'Admin only action' }, { status: 403 });

    // 1. Monument generation (direct: Permanent + Spendable)
    const monuments = await base44.asServiceRole.entities.TerritoryBuilding.filter({
      campaign_id,
      building_type: 'monument',
      status: 'active',
    });
    const monumentResults = [];
    for (const monument of monuments) {
      const result = await addDirectInfluence(
        base44, campaign_id, monument.player_id, monument.territory_id, 1, round, 'monument'
      );
      monumentResults.push({
        territory_id: monument.territory_id,
        player_id: monument.player_id,
        region_id: result.region_id,
      });
    }

    // 2. Influence spread (Permanent ONLY — after monument generation so new amounts are counted)
    const influenceRecords = await base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id });
    const spreadSources = influenceRecords.filter(r => (r.influence_amount ?? 0) >= INFLUENCE_SPREAD_THRESHOLD);
    const spreadMap = {};
    for (const source of spreadSources) {
      const neighbors = ADJ[source.territory_id] ?? [];
      for (const neighborId of neighbors) {
        const key = `${source.player_id}:${neighborId}`;
        spreadMap[key] = (spreadMap[key] ?? 0) + 1;
      }
    }
    const spreadResults = [];
    for (const [key, delta] of Object.entries(spreadMap)) {
      const [playerId, territoryId] = key.split(':');
      const newAmount = await upsertPermanentInfluence(
        base44, campaign_id, playerId, territoryId, delta, round, 'spread'
      );
      spreadResults.push({ player_id: playerId, territory_id: territoryId, delta, new_total: newAmount });
    }

    return Response.json({
      success: true,
      round,
      monuments_processed: monumentResults.length,
      spread_sources: spreadSources.length,
      spread_territories_affected: spreadResults.length,
    });
  }

  // ── ACTION: testAddInfluence (admin only) ──────────────────────────────────
  if (action === 'testAddInfluence') {
    if (!isAdmin) return Response.json({ error: 'Admin only action' }, { status: 403 });
    const { territory_id, amount, target_player_id } = body;
    if (!territory_id || !amount || !target_player_id) {
      return Response.json({ error: 'territory_id, amount, and target_player_id are required' }, { status: 400 });
    }
    const targetPlayer = players.find(p => p.id === target_player_id);
    if (!targetPlayer) return Response.json({ error: 'Target player not found' }, { status: 404 });

    const result = await addDirectInfluence(
      base44, campaign_id, target_player_id, territory_id, amount, round, 'admin_test'
    );

    return Response.json({
      success: true,
      message: `Added ${amount} influence for ${targetPlayer.display_name} in ${territory_id}. Region: ${result.region_id}.`,
      player_id: target_player_id,
      player_name: targetPlayer.display_name,
      territory_id,
      region_id: result.region_id,
      amount_added: amount,
      permanent_new_total: result.permanent,
      spendable_new_total: result.spendable,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});