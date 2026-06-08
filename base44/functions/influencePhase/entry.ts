/**
 * influencePhase — Sprint 4F backend handler for the influence framework.
 *
 * Actions:
 *   getInfluenceState   — player: returns all influence records for a campaign
 *   addInfluence        — player/admin: adds influence to a territory + spreads +1 to adjacents
 *   testAddInfluence    — admin only: convenience wrapper for testing
 *
 * ─── INFLUENCE MODEL ──────────────────────────────────────────────────────────
 *   TerritoryInfluence records are per-player per-territory.
 *   Multiple players can hold influence in the same territory.
 *   Influence does NOT affect ownership, troop counts, or resource generation.
 *   Spread: gaining influence in a territory also grants +1 to each adjacent territory.
 *
 * ─── ADJACENCY ────────────────────────────────────────────────────────────────
 *   Uses canonical Shattered Crown adjacency (land + maritime + river_crossing).
 *   SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_ADJACENCY
 *   Do not edit this block manually. Update shatteredCrownConfig.ts, then propagate.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Shattered Crown Adjacency (inline — no local imports in Deno) ────────────
// SOURCE OF TRUTH: src/shared/maps/shatteredCrownConfig.ts — SC_ADJACENCY
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

// Build bidirectional adjacency map. All types (land, maritime, river_crossing) traversable.
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

const ADJ = buildAdjacency();

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * upsertInfluence — adds `amount` influence for `playerId` in `territoryId`.
 * Creates a new record if none exists. Clamps to minimum 0.
 * Returns the updated amount.
 */
async function upsertInfluence(base44, campaignId, playerId, territoryId, amount, round, source) {
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
 * addInfluenceWithSpread — adds `amount` to target territory,
 * then +1 to each adjacent territory using SC canonical adjacency.
 */
async function addInfluenceWithSpread(base44, campaignId, playerId, territoryId, amount, round, source) {
  // Apply to primary territory
  const primaryAmount = await upsertInfluence(base44, campaignId, playerId, territoryId, amount, round, source);

  // Spread +1 to all adjacent territories
  const neighbors = ADJ[territoryId] ?? new Set();
  const spreadResults = [];
  for (const neighborId of neighbors) {
    const neighborAmount = await upsertInfluence(base44, campaignId, playerId, neighborId, 1, round, 'spread');
    spreadResults.push({ territory_id: neighborId, influence_amount: neighborAmount });
  }

  return {
    primary: { territory_id: territoryId, influence_amount: primaryAmount },
    spread: spreadResults,
  };
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

  // ── ACTION: getInfluenceState ──────────────────────────────────────────────
  // Returns all influence records for the campaign, grouped by territory.
  if (action === 'getInfluenceState') {
    const records = await base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id });

    // Group by territory_id
    const byTerritory = {};
    for (const r of records) {
      if (!byTerritory[r.territory_id]) byTerritory[r.territory_id] = [];
      byTerritory[r.territory_id].push({
        player_id: r.player_id,
        influence_amount: r.influence_amount,
        last_updated_round: r.last_updated_round,
      });
    }

    return Response.json({
      success: true,
      by_territory: byTerritory,
      total_records: records.length,
    });
  }

  // ── ACTION: addInfluence ───────────────────────────────────────────────────
  // Adds influence to a territory + spreads +1 to adjacents.
  // Any player can call this for themselves; admins can act_as any player.
  if (action === 'addInfluence') {
    const { territory_id, amount } = body;
    if (!territory_id) return Response.json({ error: 'territory_id is required' }, { status: 400 });
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return Response.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const result = await addInfluenceWithSpread(
      base44, campaign_id, actingPlayer.id, territory_id, amount, round, 'action'
    );

    return Response.json({
      success: true,
      player_id: actingPlayer.id,
      territory_id,
      amount_added: amount,
      primary: result.primary,
      spread: result.spread,
      adjacencies_affected: result.spread.length,
    });
  }

  // ── ACTION: testAddInfluence (admin only) ──────────────────────────────────
  // Testing convenience: add influence for any player to any territory.
  // Example: { action: 'testAddInfluence', campaign_id, target_player_id, territory_id, amount: 5 }
  if (action === 'testAddInfluence') {
    if (!isAdmin) {
      return Response.json({ error: 'Admin only action' }, { status: 403 });
    }
    const { territory_id, amount, target_player_id } = body;
    if (!territory_id || !amount || !target_player_id) {
      return Response.json({ error: 'territory_id, amount, and target_player_id are required' }, { status: 400 });
    }

    const targetPlayer = players.find(p => p.id === target_player_id);
    if (!targetPlayer) return Response.json({ error: 'Target player not found' }, { status: 404 });

    const result = await addInfluenceWithSpread(
      base44, campaign_id, target_player_id, territory_id, amount, round, 'admin_test'
    );

    return Response.json({
      success: true,
      message: `Added ${amount} influence for ${targetPlayer.display_name} in ${territory_id} + spread to ${result.spread.length} adjacent territories.`,
      player_id: target_player_id,
      player_name: targetPlayer.display_name,
      territory_id,
      amount_added: amount,
      primary: result.primary,
      spread: result.spread,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});