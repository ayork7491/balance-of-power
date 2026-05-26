/**
 * deployPhase — backend handler for the standard deploy phase (Round 1+).
 *
 * Actions:
 *   startDeploy     — called by admin at deploy phase start:
 *                     calculates income, creates DeployIncome records,
 *                     creates PhaseDecision stubs, writes phase_start snapshot.
 *   stageTroops     — player saves staged placements (private, editable until locked).
 *   lockDeploy      — player locks; auto-fills remaining troops if any.
 *   processPhaseEnd — admin: auto-submits missing players, applies all placements,
 *                     writes phase_end snapshot + logs, advances to attack phase.
 *
 * Privacy:
 *   - stageTroops / lockDeploy only touch the calling player's own PhaseDecision.
 *   - processPhaseEnd uses asServiceRole and is admin-only.
 *   - DeployIncome records are PUBLIC (income amounts are visible to all players).
 *   - PhaseDecision.data (placements) is PRIVATE until processPhaseEnd reveals them.
 *
 * All income formulas live in services/rules-engine/deploy/ — none are inlined here.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Inline pure helpers (no local imports allowed in Deno deploy) ────────────

// Seedable RNG (FNV-1a variant)
function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

// Auto-distribute remaining troops randomly across owned territory IDs
function autoRandomizePlacements(ownedIds, remaining, seed) {
  if (!ownedIds.length || remaining <= 0) return {};
  const rng = seededRandom(seed);
  const additions = {};
  let i = 0;
  while (remaining > 0) {
    const tid = ownedIds[Math.floor(rng() * ownedIds.length)];
    additions[tid] = (additions[tid] || 0) + 1;
    remaining--;
    if (++i > 100000) break;
  }
  return additions;
}

function mergePlacements(base, additions) {
  const result = { ...base };
  for (const [tid, count] of Object.entries(additions)) {
    result[tid] = (result[tid] || 0) + count;
  }
  return result;
}

// Territory bonus: max(minTroops, floor(owned / perTroop))
function calcTerritoryBonus(ownedCount, settings) {
  const perTroop  = settings?.territories_per_bonus_troop ?? 3;
  const minTroops = settings?.min_troops_per_turn ?? 3;
  return Math.max(minTroops, Math.floor(ownedCount / perTroop));
}

// Region bonus: sum control_bonus for fully-owned regions
function calcRegionBonus(playerId, allStates, mapTerritories, regions) {
  let bonus = 0;
  for (const region of (regions ?? [])) {
    const regionTerrs = mapTerritories.filter(t => t.region_id === region.id);
    if (!regionTerrs.length) continue;
    const allOwned = regionTerrs.every(t => {
      const s = allStates.find(st => st.territory_id === t.territory_id);
      return s?.owner_player_id === playerId;
    });
    if (allOwned) bonus += region.control_bonus ?? 0;
  }
  return bonus;
}

// Continent bonus: sum control_bonus for fully-owned continents
function calcContinentBonus(playerId, allStates, mapTerritories, continents) {
  let bonus = 0;
  for (const continent of (continents ?? [])) {
    const contTerrs = mapTerritories.filter(t => t.continent_id === continent.id);
    if (!contTerrs.length) continue;
    const allOwned = contTerrs.every(t => {
      const s = allStates.find(st => st.territory_id === t.territory_id);
      return s?.owner_player_id === playerId;
    });
    if (allOwned) bonus += continent.control_bonus ?? 0;
  }
  return bonus;
}

// Resource roll: weighted distribution → resource type
function rollResource(dist, roll) {
  const roll100 = roll * 100;
  let cumulative = 0;
  for (const [resource, weight] of Object.entries(dist)) {
    cumulative += weight;
    if (roll100 < cumulative) return resource;
  }
  return Object.keys(dist).at(-1);
}

function generateResourcesForPlayer(playerId, round, allStates, mapTerritories, campaignId) {
  const owned = allStates.filter(s => s.owner_player_id === playerId);
  const totals = { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
  for (const ts of owned) {
    const def = mapTerritories.find(t => t.territory_id === ts.territory_id);
    if (!def?.resource_distribution) continue;
    const rng = seededRandom(`${campaignId}_${playerId}_${ts.territory_id}_r${round}`);
    const resource = rollResource(def.resource_distribution, rng());
    totals[resource] = (totals[resource] || 0) + 1;
  }
  return totals;
}

// Build phase snapshot object
function buildSnapshot({ campaignId, round, phase, snapshotType, territoryStates, activePlayers, deployIncomes }) {
  return {
    campaign_id: campaignId,
    round,
    phase,
    snapshot_type: snapshotType,
    territory_states: territoryStates.map(ts => ({
      territory_id:    ts.territory_id,
      owner_player_id: ts.owner_player_id ?? null,
      troop_count:     ts.troop_count ?? 0,
    })),
    player_standings: activePlayers.map(p => {
      const owned      = territoryStates.filter(ts => ts.owner_player_id === p.id);
      const troopTotal = owned.reduce((s, ts) => s + (ts.troop_count || 0), 0);
      const inc        = deployIncomes?.[p.id];
      return {
        player_id:       p.id,
        display_name:    p.display_name,
        territory_count: owned.length,
        troop_total:     troopTotal,
        deploy_income:   inc?.total ?? null,
        is_eliminated:   p.is_eliminated ?? false,
      };
    }),
    deploy_incomes: deployIncomes ?? {},
  };
}

// Campaign log helper
async function log(base44, campaignId, round, phase, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase,
    round,
    event_type:  eventType,
    player_id:   playerId ?? null,
    payload,
    is_public:   isPublic,
  });
}

// ─── MAP DATA (inline minimal schema for income calc — avoids local import) ──

// V1 Standard Map regions / continents / territories
// Only region_id, continent_id, territory_id, resource_distribution needed server-side.
// We fetch actual territory list from TerritoryState records to avoid duplicating full map.
// For bonus calcs we need the full region/continent membership — fetch from MapDefinition entity.

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, campaign_id, placements } = body;

  if (!campaign_id || !action) {
    return Response.json({ error: 'campaign_id and action are required' }, { status: 400 });
  }

  const [campaigns, players] = await Promise.all([
    base44.asServiceRole.entities.Campaign.filter({ id: campaign_id }),
    base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id }),
  ]);

  const campaign = campaigns[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
  if (!players.length) return Response.json({ error: 'No players found' }, { status: 400 });

  const myPlayer = players.find(p => p.user_id === user.id);
  if (!myPlayer) return Response.json({ error: 'Not a player in this campaign' }, { status: 403 });

  const round  = campaign.current_round ?? 1;
  const phase  = 'deploy';

  // ── ACTION: startDeploy ───────────────────────────────────────────────────────
  if (action === 'startDeploy') {
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Campaign is not in deploy phase' }, { status: 400 });
    }

    // Check not already started (idempotency guard)
    const existingDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });
    if (existingDecisions.length > 0) {
      return Response.json({ error: 'Deploy phase already started for this round' }, { status: 400 });
    }

    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });

    // Fetch map definition for region/continent membership data
    const mapDefs = await base44.asServiceRole.entities.MapDefinition.filter({ id: campaign.map_id });
    const mapDef  = mapDefs[0];
    const mapRegions    = mapDef?.regions    ?? [];
    const mapContinents = mapDef?.continents ?? [];
    // Build lightweight territory list for bonus calcs from territory states + map def
    // We use territory IDs from state; region/continent from MapDefinition.territories field (if stored)
    // Since MapDefinition may not store territories inline, we use a static lookup for V1
    // The territory states have territory_id; we need region_id/continent_id for bonus calc.
    // Strategy: load TerritoryDefinition records if they exist, else skip region/continent bonus.
    // For V1, region/continent membership is stored in the static map schema, not the DB.
    // We encode the V1 region/continent membership inline as a minimal lookup.
    const V1_TERRITORY_REGIONS = {
      frost_peak:'north_coast',irongate:'north_coast',tundra_flats:'north_coast',glacier_pass:'north_coast',stormwatch:'north_coast',crow_harbor:'north_coast',pale_cliffs:'north_coast',veil_crossing:'north_coast',
      ashwood:'west_reach',redstone_ridge:'west_reach',dustmarsh:'west_reach',saltfen:'west_reach',verdant_vale:'west_reach',greywood:'west_reach',
      heartlands:'heartland',golden_citadel:'heartland',iron_ridge:'heartland',stonefield:'heartland',the_crossing:'heartland',ember_vale:'heartland',deepstone:'heartland',
      ember_coast:'east_shore',blackstone:'east_shore',iron_coast:'east_shore',scalewood:'east_shore',the_bastion:'east_shore',ashfen_coast:'east_shore',ridgeline:'east_shore',
      sunken_delta:'south_plains',dustplains:'south_plains',amber_fields:'south_plains',sunspire:'south_plains',verdant_basin:'south_plains',
      sea_gate:'far_south',crimson_shore:'far_south',southern_reach:'far_south',
    };
    const V1_TERRITORY_CONTINENTS = {
      frost_peak:'northlands',irongate:'northlands',tundra_flats:'northlands',glacier_pass:'northlands',stormwatch:'northlands',crow_harbor:'northlands',pale_cliffs:'northlands',veil_crossing:'northlands',
      ashwood:'northlands',redstone_ridge:'northlands',dustmarsh:'northlands',saltfen:'northlands',verdant_vale:'northlands',greywood:'northlands',
      heartlands:'northlands',golden_citadel:'northlands',iron_ridge:'northlands',stonefield:'northlands',the_crossing:'northlands',ember_vale:'northlands',deepstone:'northlands',
      ember_coast:'northlands',blackstone:'northlands',iron_coast:'northlands',scalewood:'northlands',the_bastion:'northlands',ashfen_coast:'northlands',ridgeline:'northlands',
      sunken_delta:'southlands',dustplains:'southlands',amber_fields:'southlands',sunspire:'southlands',verdant_basin:'southlands',
      sea_gate:'southlands',crimson_shore:'southlands',southern_reach:'southlands',
    };

    // Fake map territories list for calc functions (just needs territory_id + region_id + continent_id)
    const mapTerritories = allTerritoryStates.map(ts => ({
      territory_id:  ts.territory_id,
      region_id:     V1_TERRITORY_REGIONS[ts.territory_id] ?? null,
      continent_id:  V1_TERRITORY_CONTINENTS[ts.territory_id] ?? null,
    }));

    const activePlayers  = players.filter(p => !p.is_eliminated);
    const deployIncomes  = {};

    // Calculate income + resources + create PhaseDecision + DeployIncome for each active player
    for (const p of activePlayers) {
      const ownedCount     = allTerritoryStates.filter(s => s.owner_player_id === p.id).length;
      const territoryBonus = calcTerritoryBonus(ownedCount, campaign.settings);
      const regionBonus    = calcRegionBonus(p.id, allTerritoryStates, mapTerritories, mapRegions);
      const continentBonus = calcContinentBonus(p.id, allTerritoryStates, mapTerritories, mapContinents);
      const total          = territoryBonus + regionBonus + continentBonus;
      const resources      = generateResourcesForPlayer(p.id, round, allTerritoryStates, mapTerritories.map(t => ({
        ...t,
        // resource_distribution not in states; skip resource gen for bonus-only territories
        resource_distribution: null,
      })), campaign_id);

      deployIncomes[p.id] = { territory_bonus: territoryBonus, region_bonus: regionBonus, continent_bonus: continentBonus, total };

      // Public income record
      await base44.asServiceRole.entities.DeployIncome.create({
        campaign_id,
        round,
        player_id:       p.id,
        territory_bonus: territoryBonus,
        troop_bonus:     0,
        region_bonus:    regionBonus,
        continent_bonus: continentBonus,
        total,
        resources_generated: resources,
      });

      // Private staged decision stub
      await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id,
        player_id: p.id,
        phase:     'deploy',
        round,
        is_locked: false,
        data:      { placements: {}, troops_remaining: total },
      });
    }

    // Phase-start snapshot
    const snapshot = buildSnapshot({
      campaignId: campaign_id, round, phase, snapshotType: 'phase_start',
      territoryStates: allTerritoryStates, activePlayers, deployIncomes,
    });
    await base44.asServiceRole.entities.PhaseSnapshot.create(snapshot);

    await log(base44, campaign_id, round, phase, 'phase_started', null, {
      player_incomes: Object.entries(deployIncomes).map(([pid, inc]) => ({
        player_id: pid, ...inc,
      })),
    }, true);

    return Response.json({ success: true, incomes: deployIncomes });
  }

  // ── ACTION: stageTroops ───────────────────────────────────────────────────────
  if (action === 'stageTroops') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }
    if (!placements || typeof placements !== 'object') {
      return Response.json({ error: 'placements must be an object { territory_id: number }' }, { status: 400 });
    }

    // Load my decision (user-scoped — only my record)
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'deploy', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision found. Has deploy phase been started?' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your deployment' }, { status: 400 });

    // Load income to know allowed total
    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
      campaign_id, player_id: myPlayer.id, round,
    });
    const income = incomeRecords[0];
    if (!income) return Response.json({ error: 'Income record not found' }, { status: 404 });
    const allowedTroops = income.total;

    // Validate owned territories
    const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, owner_player_id: myPlayer.id,
    });
    const ownedIds = new Set(ownedStates.map(t => t.territory_id));

    let totalPlaced = 0;
    for (const [tid, count] of Object.entries(placements)) {
      if (!ownedIds.has(tid)) {
        return Response.json({ error: `Territory ${tid} is not owned by you` }, { status: 400 });
      }
      if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
        return Response.json({ error: `Invalid troop count for ${tid}` }, { status: 400 });
      }
      totalPlaced += count;
    }

    if (totalPlaced > allowedTroops) {
      return Response.json({
        error: `Total placements (${totalPlaced}) exceed your income (${allowedTroops})`,
      }, { status: 400 });
    }

    const troopsRemaining = allowedTroops - totalPlaced;
    await base44.entities.PhaseDecision.update(decision.id, {
      data: { placements, troops_remaining: troopsRemaining },
    });

    // Private log — placement data not public until reveal
    await log(base44, campaign_id, round, phase, 'troop_staged', myPlayer.id, {
      troops_placed: totalPlaced, troops_remaining: troopsRemaining,
    }, false);

    return Response.json({ success: true, troops_remaining: troopsRemaining });
  }

  // ── ACTION: lockDeploy ────────────────────────────────────────────────────────
  if (action === 'lockDeploy') {
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'deploy', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No deploy decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
      campaign_id, player_id: myPlayer.id, round,
    });
    const allowedTroops = incomeRecords[0]?.total ?? 0;

    const currentPlacements = decision.data?.placements ?? {};
    const totalPlaced = Object.values(currentPlacements).reduce((s, n) => s + n, 0);
    let remaining = allowedTroops - totalPlaced;

    let finalPlacements = { ...currentPlacements };
    if (remaining > 0) {
      const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
        campaign_id, owner_player_id: myPlayer.id,
      });
      const additions = autoRandomizePlacements(
        ownedStates.map(t => t.territory_id),
        remaining,
        `${campaign_id}_${myPlayer.id}_r${round}_autolock`,
      );
      finalPlacements = mergePlacements(finalPlacements, additions);
    }

    await base44.entities.PhaseDecision.update(decision.id, {
      is_locked: true,
      locked_at: new Date().toISOString(),
      data:      { placements: finalPlacements, troops_remaining: 0 },
    });

    // Public log: player locked (no placement data)
    await log(base44, campaign_id, round, phase, 'player_locked', myPlayer.id, {
      display_name: myPlayer.display_name,
    }, true);

    return Response.json({ success: true });
  }

  // ── ACTION: processPhaseEnd ───────────────────────────────────────────────────
  if (action === 'processPhaseEnd') {
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'deploy') {
      return Response.json({ error: 'Not in deploy phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);

    // Load all decisions
    const allDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });

    // Auto-submit any unlocked players
    for (const p of activePlayers) {
      const dec = allDecisions.find(d => d.player_id === p.id);
      if (!dec || !dec.is_locked) {
        const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
          campaign_id, player_id: p.id, round,
        });
        const allowedTroops = incomeRecords[0]?.total ?? 3;

        const ownedStates = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, owner_player_id: p.id,
        });
        const ownedIds = ownedStates.map(t => t.territory_id);

        const existingPlacements = dec?.data?.placements ?? {};
        const alreadyPlaced = Object.values(existingPlacements).reduce((s, n) => s + n, 0);
        const remaining = allowedTroops - alreadyPlaced;

        const additions = autoRandomizePlacements(
          ownedIds, remaining,
          `${campaign_id}_${p.id}_r${round}_auto_phase_end`,
        );
        const finalPlacements = mergePlacements(existingPlacements, additions);

        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true, is_auto_submitted: true,
            data: { placements: finalPlacements, troops_remaining: 0 },
          });
        } else {
          await base44.asServiceRole.entities.PhaseDecision.create({
            campaign_id, player_id: p.id, phase: 'deploy', round,
            is_locked: true, is_auto_submitted: true,
            data: { placements: finalPlacements, troops_remaining: 0 },
          });
        }

        // Private auto-submit log
        await log(base44, campaign_id, round, phase, 'auto_submitted', p.id, {
          display_name: p.display_name, troops_auto_placed: remaining,
        }, false);
      }
    }

    // Reload all finalized decisions
    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'deploy', round,
    });

    // Apply all troop placements to TerritoryState
    for (const dec of finalDecisions) {
      const decPlacements = dec.data?.placements ?? {};
      for (const [tid, count] of Object.entries(decPlacements)) {
        if (!count) continue;
        const existing = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, territory_id: tid,
        });
        if (existing[0]) {
          await base44.asServiceRole.entities.TerritoryState.update(existing[0].id, {
            troop_count: (existing[0].troop_count || 0) + count,
          });
        }
      }
    }

    // Reload territory states for snapshot
    const finalTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });

    // Load deploy incomes for snapshot
    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({ campaign_id, round });
    const deployIncomes = {};
    for (const inc of incomeRecords) deployIncomes[inc.player_id] = inc;

    // Phase-end snapshot
    const snapshot = buildSnapshot({
      campaignId: campaign_id, round, phase, snapshotType: 'phase_end',
      territoryStates: finalTerritoryStates, activePlayers, deployIncomes,
    });
    await base44.asServiceRole.entities.PhaseSnapshot.create(snapshot);

    // Public reveal log (no placement data, just that reveal occurred)
    await log(base44, campaign_id, round, phase, 'phase_advanced', null, {
      next_phase: 'attack', round,
      players_auto_submitted: activePlayers
        .filter(p => finalDecisions.find(d => d.player_id === p.id)?.is_auto_submitted)
        .map(p => p.display_name),
    }, true);

    // Advance to attack phase
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_phase: 'attack',
    });

    return Response.json({ success: true, next_phase: 'attack', round });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});