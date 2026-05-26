/**
 * fortifyPhase — backend handler for the fortify & build phase (Round 1+).
 *
 * Actions:
 *   startFortify     — admin: opens phase, creates PhaseDecision stubs
 *   stageMovement    — player stages troop movement between owned territories
 *   deleteMovement   — player removes staged movement
 *   startConstruction — player starts building a structure
 *   lockFortify      — player locks fortify/build decisions
 *   processPhaseEnd  — admin: applies movements, completes construction, advances phase
 *
 * ─── PRIVACY MODEL ────────────────────────────────────────────────────────────
 *   - stageMovement / startConstruction / lockFortify: user-scoped SDK
 *   - processPhaseEnd: asServiceRole + admin-only guard
 *   - Movements and construction are PRIVATE until processPhaseEnd reveals them
 *
 * ─── FORTIFICATION VALIDATION RULES ───────────────────────────────────────────
 *   - origin and destination must be owned by acting player
 *   - territories must be adjacent (or within max_fortification_distance)
 *   - committed_troops >= 1
 *   - committed_troops <= available troops at origin
 *   - total movements <= max_fortifications_per_phase (default 3)
 *
 * ─── STRUCTURE RULES ──────────────────────────────────────────────────────────
 *   - One structure per territory
 *   - One active construction project per player at a time
 *   - V1 structures: castle, barracks, stables
 *   - All structures cost resources and may take multiple rounds
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_FORTIFICATIONS = 3;
const DEFAULT_MAX_DISTANCE = 4;

const STRUCTURE_CONFIG = {
  castle: {
    cost: { brick: 2, lumber: 1, wool: 0, grain: 0, ore: 1 },
    rounds: 2,
    effect: 'Defensive bonus in battles',
  },
  barracks: {
    cost: { brick: 1, lumber: 2, wool: 1, grain: 0, ore: 0 },
    rounds: 1,
    effect: '+1 troop income per turn',
  },
  stables: {
    cost: { brick: 0, lumber: 2, wool: 2, grain: 1, ore: 0 },
    rounds: 1,
    effect: 'Increased fortification range',
  },
};

// ─── Inline: V1 Map Adjacency ─────────────────────────────────────────────────
// Reuse from attackPhase for movement validation

const V1_ADJACENCY_PAIRS = [
  ['frost_peak','irongate'],['irongate','tundra_flats'],['tundra_flats','glacier_pass'],
  ['glacier_pass','stormwatch'],['stormwatch','crow_harbor'],['irongate','pale_cliffs'],
  ['glacier_pass','veil_crossing'],['stormwatch','veil_crossing'],
  ['frost_peak','ashwood'],['pale_cliffs','redstone_ridge'],
  ['tundra_flats','heartlands'],['glacier_pass','golden_citadel'],
  ['veil_crossing','deepstone'],['veil_crossing','the_crossing'],
  ['stormwatch','blackstone'],['crow_harbor','ember_coast'],['veil_crossing','ashfen_coast'],
  ['ashwood','redstone_ridge'],['ashwood','dustmarsh'],['redstone_ridge','saltfen'],
  ['redstone_ridge','greywood'],['dustmarsh','saltfen'],['dustmarsh','verdant_vale'],
  ['saltfen','greywood'],['saltfen','verdant_vale'],['greywood','verdant_vale'],
  ['pale_cliffs','heartlands'],['redstone_ridge','heartlands'],['greywood','ember_vale'],
  ['saltfen','stonefield'],
  ['verdant_vale','sunken_delta'],['verdant_vale','dustplains'],
  ['heartlands','golden_citadel'],['heartlands','iron_ridge'],['heartlands','stonefield'],
  ['heartlands','ember_vale'],['golden_citadel','iron_ridge'],['golden_citadel','the_crossing'],
  ['golden_citadel','deepstone'],['iron_ridge','stonefield'],['iron_ridge','the_crossing'],
  ['ember_vale','stonefield'],
  ['deepstone','blackstone'],['the_crossing','ashfen_coast'],['the_crossing','ridgeline'],
  ['stonefield','sunspire'],['iron_ridge','verdant_basin'],['the_crossing','sea_gate'],
  ['ember_coast','blackstone'],['ember_coast','iron_coast'],['blackstone','scalewood'],
  ['blackstone','scalewood'],['blackstone','ashfen_coast'],['iron_coast','scalewood'],['iron_coast','the_bastion'],
  ['scalewood','the_bastion'],['scalewood','ridgeline'],['ashfen_coast','ridgeline'],
  ['ridgeline','the_bastion'],
  ['the_bastion','crimson_shore'],['the_bastion','southern_reach'],['ridgeline','sea_gate'],
  ['sunken_delta','dustplains'],['dustplains','amber_fields'],['amber_fields','sunspire'],
  ['sunspire','verdant_basin'],['verdant_basin','sea_gate'],
  ['sea_gate','crimson_shore'],['crimson_shore','southern_reach'],
  ['verdant_basin','crimson_shore'],
];

function buildAdjacency() {
  const adj = {};
  for (const [a, b] of V1_ADJACENCY_PAIRS) {
    if (!adj[a]) adj[a] = new Set();
    if (!adj[b]) adj[b] = new Set();
    adj[a].add(b);
    adj[b].add(a);
  }
  return adj;
}

function areAdjacent(a, b, adj) {
  return adj[a]?.has(b) ?? false;
}

// BFS to find shortest path distance
function findShortestDistance(startId, endId, adj) {
  if (startId === endId) return 0;
  const visited = new Set([startId]);
  const queue = [[startId, 0]];
  
  while (queue.length > 0) {
    const [current, dist] = queue.shift();
    const neighbors = adj[current] || new Set();
    
    for (const neighbor of neighbors) {
      if (neighbor === endId) return dist + 1;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, dist + 1]);
      }
    }
  }
  return Infinity; // No path found
}

// ─── Inline: Log helper ───────────────────────────────────────────────────────

async function log(base44, campaignId, round, phase, eventType, playerId, payload, isPublic = true) {
  await base44.asServiceRole.entities.SetupLog.create({
    campaign_id: campaignId,
    phase,
    round,
    event_type: eventType,
    player_id: playerId ?? null,
    payload,
    is_public: isPublic,
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

  const round = campaign.current_round ?? 1;
  const phase = 'fortify';
  const maxFortifications = campaign.settings?.max_fortifications_per_phase ?? DEFAULT_MAX_FORTIFICATIONS;
  const maxDistance = campaign.settings?.max_fortification_distance ?? DEFAULT_MAX_DISTANCE;

  // ── ACTION: startFortify ───────────────────────────────────────────────────────
  if (action === 'startFortify') {
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Campaign is not in fortify phase' }, { status: 400 });
    }

    // Idempotency guard
    const existingDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'fortify', round,
    });
    if (existingDecisions.length > 0) {
      return Response.json({ error: 'Fortify phase already started for this round' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);

    // Create PhaseDecision stubs for all active players
    for (const p of activePlayers) {
      await base44.asServiceRole.entities.PhaseDecision.create({
        campaign_id,
        player_id: p.id,
        phase: 'fortify',
        round,
        is_locked: false,
        data: { movements: [], construction: null },
      });
    }

    await log(base44, campaign_id, round, phase, 'phase_started', null, {
      active_players: activePlayers.length,
    }, true);

    return Response.json({ success: true, active_players: activePlayers.length });
  }

  // ── ACTION: stageMovement ─────────────────────────────────────────────────────
  if (action === 'stageMovement') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { origin_territory_id, destination_territory_id, committed_troops } = body;
    if (!origin_territory_id || !destination_territory_id || committed_troops == null) {
      return Response.json({ error: 'origin_territory_id, destination_territory_id, and committed_troops are required' }, { status: 400 });
    }
    if (!Number.isInteger(committed_troops) || committed_troops < 1) {
      return Response.json({ error: 'committed_troops must be a positive integer' }, { status: 400 });
    }

    // Load territory states
    const allStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const originState = allStates.find(s => s.territory_id === origin_territory_id);
    const destState = allStates.find(s => s.territory_id === destination_territory_id);

    // Validate ownership
    if (!originState || originState.owner_player_id !== myPlayer.id) {
      return Response.json({ error: `You do not own ${origin_territory_id}` }, { status: 400 });
    }
    if (!destState || destState.owner_player_id !== myPlayer.id) {
      return Response.json({ error: `You do not own ${destination_territory_id}` }, { status: 400 });
    }

    // Validate adjacency/distance
    const adj = buildAdjacency();
    const distance = findShortestDistance(origin_territory_id, destination_territory_id, adj);
    if (distance > maxDistance) {
      return Response.json({ error: `Distance ${distance} exceeds maximum ${maxDistance}` }, { status: 400 });
    }

    // Load own decision
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'fortify', round,
    });
    let decision = decisions[0];
    if (!decision) return Response.json({ error: 'No fortify decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your fortifications' }, { status: 400 });

    const currentMovements = decision.data?.movements ?? [];
    if (currentMovements.length >= maxFortifications) {
      return Response.json({ error: `Max ${maxFortifications} movements per phase` }, { status: 400 });
    }

    // Validate troops available (accounting for already-staged movements)
    const alreadyCommittedFromOrigin = currentMovements
      .filter(m => m.origin_territory_id === origin_territory_id)
      .reduce((s, m) => s + (m.committed_troops || 0), 0);
    const availableAtOrigin = (originState.troop_count || 0) - alreadyCommittedFromOrigin;
    
    if (committed_troops > availableAtOrigin) {
      return Response.json({
        error: `Cannot move ${committed_troops} troops — only ${availableAtOrigin} available at ${origin_territory_id}`,
      }, { status: 400 });
    }

    // Upsert movement
    const existingIdx = currentMovements.findIndex(
      m => m.origin_territory_id === origin_territory_id && m.destination_territory_id === destination_territory_id
    );
    const newMovement = {
      id: existingIdx >= 0 ? currentMovements[existingIdx].id : `mov_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      origin_territory_id,
      destination_territory_id,
      committed_troops,
    };
    const updatedMovements = existingIdx >= 0
      ? currentMovements.map((m, i) => i === existingIdx ? newMovement : m)
      : [...currentMovements, newMovement];

    await base44.entities.PhaseDecision.update(decision.id, {
      data: { movements: updatedMovements, construction: decision.data?.construction ?? null },
    });

    await log(base44, campaign_id, round, phase, 'movement_staged', myPlayer.id, {
      movement_count: updatedMovements.length,
    }, false);

    return Response.json({ success: true, movement_id: newMovement.id, movements: updatedMovements });
  }

  // ── ACTION: deleteMovement ────────────────────────────────────────────────────
  if (action === 'deleteMovement') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { movement_id } = body;
    if (!movement_id) return Response.json({ error: 'movement_id is required' }, { status: 400 });

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'fortify', round,
    });
    const decision = decisions[0];
    if (!decision) return Response.json({ error: 'No fortify decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'Already locked' }, { status: 400 });

    const updatedMovements = (decision.data?.movements ?? []).filter(m => m.id !== movement_id);
    await base44.entities.PhaseDecision.update(decision.id, {
      data: { movements: updatedMovements, construction: decision.data?.construction ?? null },
    });

    return Response.json({ success: true, movements: updatedMovements });
  }

  // ── ACTION: startConstruction ─────────────────────────────────────────────────
  if (action === 'startConstruction') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }
    const { territory_id, structure_type } = body;
    if (!territory_id || !structure_type) {
      return Response.json({ error: 'territory_id and structure_type are required' }, { status: 400 });
    }
    if (!STRUCTURE_CONFIG[structure_type]) {
      return Response.json({ error: `Invalid structure type: ${structure_type}` }, { status: 400 });
    }

    // Validate territory ownership
    const territoryState = await base44.asServiceRole.entities.TerritoryState.filter({
      campaign_id, territory_id,
    });
    const ts = territoryState[0];
    if (!ts || ts.owner_player_id !== myPlayer.id) {
      return Response.json({ error: `You do not own ${territory_id}` }, { status: 400 });
    }

    // Check for existing structure
    if ((ts.structures ?? []).includes(structure_type)) {
      return Response.json({ error: `Structure ${structure_type} already exists in ${territory_id}` }, { status: 400 });
    }

    // Check for any existing structure (one per territory limit)
    if ((ts.structures ?? []).length > 0) {
      return Response.json({ error: `Territory ${territory_id} already has a structure` }, { status: 400 });
    }

    // Check for active construction project
    const existingProjects = await base44.asServiceRole.entities.ConstructionProject.filter({
      campaign_id, player_id: myPlayer.id, status: 'in_progress',
    });
    if (existingProjects.length > 0) {
      return Response.json({ error: 'You already have an active construction project' }, { status: 400 });
    }

    // Load own decision
    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'fortify', round,
    });
    let decision = decisions[0];
    if (!decision) return Response.json({ error: 'No fortify decision found' }, { status: 404 });
    if (decision.is_locked) return Response.json({ error: 'You have already locked your fortifications' }, { status: 400 });
    if (decision.data?.construction) {
      return Response.json({ error: 'Construction project already started this phase' }, { status: 400 });
    }

    // Check resource availability
    const incomeRecords = await base44.asServiceRole.entities.DeployIncome.filter({
      campaign_id, player_id: myPlayer.id, round,
    });
    const income = incomeRecords[0];
    const config = STRUCTURE_CONFIG[structure_type];
    
    // For V1, check if player has resources from this round
    // (Simplified: assume resources are tracked in income.resources_generated)
    const resourcesGenerated = income?.resources_generated ?? {};
    const canAfford = Object.entries(config.cost).every(([res, amount]) => {
      if (amount === 0) return true;
      return (resourcesGenerated[res] ?? 0) >= amount;
    });

    if (!canAfford) {
      return Response.json({ 
        error: 'Insufficient resources for this structure',
        required: config.cost,
        available: resourcesGenerated,
      }, { status: 400 });
    }

    // Create construction project
    const project = await base44.asServiceRole.entities.ConstructionProject.create({
      campaign_id,
      round_started: round,
      player_id: myPlayer.id,
      territory_id,
      structure_type,
      total_cost: config.cost,
      resources_paid: config.cost, // V1: pay upfront
      rounds_required: config.rounds,
      rounds_completed: 0,
      status: 'in_progress',
    });

    // Update decision
    await base44.entities.PhaseDecision.update(decision.id, {
      data: { movements: decision.data?.movements ?? [], construction: { project_id: project.id } },
    });

    await log(base44, campaign_id, round, phase, 'construction_started', myPlayer.id, {
      structure_type,
      territory_id,
    }, false);

    return Response.json({ success: true, project_id: project.id });
  }

  // ── ACTION: lockFortify ───────────────────────────────────────────────────────
  if (action === 'lockFortify') {
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }

    const decisions = await base44.entities.PhaseDecision.filter({
      campaign_id, player_id: myPlayer.id, phase: 'fortify', round,
    });
    let decision = decisions[0];

    if (!decision) {
      // Create empty locked decision
      await base44.entities.PhaseDecision.create({
        campaign_id, player_id: myPlayer.id, phase: 'fortify', round,
        is_locked: true,
        locked_at: new Date().toISOString(),
        data: { movements: [], construction: null },
      });
    } else if (!decision.is_locked) {
      await base44.entities.PhaseDecision.update(decision.id, {
        is_locked: true,
        locked_at: new Date().toISOString(),
      });
    }

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
    if (campaign.current_phase !== 'fortify') {
      return Response.json({ error: 'Not in fortify phase' }, { status: 400 });
    }

    const activePlayers = players.filter(p => !p.is_eliminated);
    const allDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'fortify', round,
    });

    // All players auto-submitted (no hidden data to randomize)
    for (const p of activePlayers) {
      const dec = allDecisions.find(d => d.player_id === p.id);
      if (!dec || !dec.is_locked) {
        if (dec) {
          await base44.asServiceRole.entities.PhaseDecision.update(dec.id, {
            is_locked: true, is_auto_submitted: true,
          });
        } else {
          await base44.asServiceRole.entities.PhaseDecision.create({
            campaign_id, player_id: p.id, phase: 'fortify', round,
            is_locked: true, is_auto_submitted: true,
            data: { movements: [], construction: null },
          });
        }
        await log(base44, campaign_id, round, phase, 'auto_submitted', p.id, {
          display_name: p.display_name,
        }, false);
      }
    }

    // Reload finalized decisions
    const finalDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id, phase: 'fortify', round,
    });

    // REVEAL: Apply all troop movements
    const allTerritoryStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    const troopChanges = {}; // territory_id -> net change

    for (const dec of finalDecisions) {
      const movements = dec.data?.movements ?? [];
      for (const mov of movements) {
        // Subtract from origin
        troopChanges[mov.origin_territory_id] = (troopChanges[mov.origin_territory_id] || 0) - mov.committed_troops;
        // Add to destination
        troopChanges[mov.destination_territory_id] = (troopChanges[mov.destination_territory_id] || 0) + mov.committed_troops;
      }
    }

    // Apply troop changes
    for (const [tid, change] of Object.entries(troopChanges)) {
      if (change === 0) continue;
      const existing = allTerritoryStates.find(s => s.territory_id === tid);
      if (existing) {
        await base44.asServiceRole.entities.TerritoryState.update(existing.id, {
          troop_count: Math.max(0, (existing.troop_count || 0) + change),
        });
      }
    }

    // REVEAL: Complete construction projects
    const allProjects = await base44.asServiceRole.entities.ConstructionProject.filter({
      campaign_id, status: 'in_progress',
    });

    for (const project of allProjects) {
      const newRoundsCompleted = project.rounds_completed + 1;
      const isComplete = newRoundsCompleted >= project.rounds_required;

      if (isComplete) {
        // Add structure to territory
        const territoryStates = await base44.asServiceRole.entities.TerritoryState.filter({
          campaign_id, territory_id: project.territory_id,
        });
        const ts = territoryStates[0];
        if (ts) {
          const structures = ts.structures ?? [];
          if (!structures.includes(project.structure_type)) {
            structures.push(project.structure_type);
            await base44.asServiceRole.entities.TerritoryState.update(ts.id, {
              structures,
            });
          }
        }

        await base44.asServiceRole.entities.ConstructionProject.update(project.id, {
          rounds_completed: newRoundsCompleted,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

        await log(base44, campaign_id, round, phase, 'construction_completed', project.player_id, {
          structure_type: project.structure_type,
          territory_id: project.territory_id,
        }, true);
      } else {
        await base44.asServiceRole.entities.ConstructionProject.update(project.id, {
          rounds_completed: newRoundsCompleted,
        });
      }
    }

    // Phase snapshot
    const finalStates = await base44.asServiceRole.entities.TerritoryState.filter({ campaign_id });
    await base44.asServiceRole.entities.PhaseSnapshot.create({
      campaign_id,
      round,
      phase: 'fortify',
      snapshot_type: 'phase_end',
      territory_states: finalStates.map(ts => ({
        territory_id: ts.territory_id,
        owner_player_id: ts.owner_player_id ?? null,
        troop_count: ts.troop_count ?? 0,
        structures: ts.structures ?? [],
      })),
      player_standings: activePlayers.map(p => {
        const owned = finalStates.filter(ts => ts.owner_player_id === p.id);
        return {
          player_id: p.id,
          display_name: p.display_name,
          territory_count: owned.length,
          troop_total: owned.reduce((s, ts) => s + (ts.troop_count || 0), 0),
          is_eliminated: p.is_eliminated ?? false,
        };
      }),
    });

    await log(base44, campaign_id, round, phase, 'phase_advanced', null, {
      next_phase: campaign.current_round >= 1 ? 'deploy' : 'deploy', // Loop back to deploy for next round
      round,
      movements_applied: Object.keys(troopChanges).length / 2,
      constructions_completed: allProjects.filter(p => 
        (p.rounds_completed + 1) >= p.rounds_required
      ).length,
    }, true);

    // Advance to next round's deploy phase
    const nextRound = round + 1;
    await base44.asServiceRole.entities.Campaign.update(campaign_id, {
      current_round: nextRound,
      current_phase: 'deploy',
    });

    return Response.json({
      success: true,
      next_phase: 'deploy',
      next_round: nextRound,
      movements_applied: Object.keys(troopChanges).length / 2,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});