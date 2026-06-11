/**
 * exportPhaseAudit — Sprint 5F
 *
 * Admin-only backend function that assembles a Phase Audit Bundle for any
 * round/phase combination. Returns a JSON blob the client can download.
 *
 * Actions:
 *   generateBundle  — main export; returns the full bundle as JSON
 *
 * Bundle structure:
 *   metadata, before_snapshot, submitted_actions, generated_artifacts,
 *   resolution_results, after_snapshot, delta_report, validation_warnings
 *
 * Security: admin-only. Regular players receive 403.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Canonical territory data ──────────────────────────────────────────────────
// SOURCE OF TRUTH: shared/maps/shatteredCrownConfig.ts — SC_TERRITORIES
// Do NOT edit manually. Update shatteredCrownConfig.ts first, then propagate here.

const SC_TERRITORY_DATA = {
  // Ironspine — outer_passes
  I8: { name:'Eastspire',         region_id:'outer_passes',       continent_id:'ironspine'       },
  I4: { name:'Greyhold',          region_id:'outer_passes',       continent_id:'ironspine'       },
  I6: { name:'Ridgefall',         region_id:'outer_passes',       continent_id:'ironspine'       },
  I7: { name:'Basinwatch',        region_id:'outer_passes',       continent_id:'ironspine'       },
  // Ironspine — high_crown
  I1: { name:'Frostgate',         region_id:'high_crown',         continent_id:'ironspine'       },
  I2: { name:'Northpass',         region_id:'high_crown',         continent_id:'ironspine'       },
  I3: { name:'Cliffwatch',        region_id:'high_crown',         continent_id:'ironspine'       },
  I5: { name:'Crownforge',        region_id:'high_crown',         continent_id:'ironspine'       },
  // Wild Frontier — northern_wilds
  W1: { name:'Thornwood Edge',    region_id:'northern_wilds',     continent_id:'wild_frontier'   },
  W2: { name:'Greenmarch',        region_id:'northern_wilds',     continent_id:'wild_frontier'   },
  W3: { name:'Broken Pines',      region_id:'northern_wilds',     continent_id:'wild_frontier'   },
  W4: { name:'Mossfen',           region_id:'northern_wilds',     continent_id:'wild_frontier'   },
  W5: { name:'Wildcross',         region_id:'northern_wilds',     continent_id:'wild_frontier'   },
  // Wild Frontier — deepwoods
  W6: { name:'Emberwood',         region_id:'deepwoods',          continent_id:'wild_frontier'   },
  W7: { name:'Lowbranch',         region_id:'deepwoods',          continent_id:'wild_frontier'   },
  W8: { name:'Riverholt',         region_id:'deepwoods',          continent_id:'wild_frontier'   },
  W9: { name:'Ashen Ford',        region_id:'deepwoods',          continent_id:'wild_frontier'   },
  // Fracture Basin — northern_ruins
  B1: { name:'North Ruin Gate',   region_id:'northern_ruins',     continent_id:'fracture_basin'  },
  B2: { name:'Old Bastion',       region_id:'northern_ruins',     continent_id:'fracture_basin'  },
  B3: { name:'Highbridge',        region_id:'northern_ruins',     continent_id:'fracture_basin'  },
  B4: { name:'East Rupture',      region_id:'northern_ruins',     continent_id:'fracture_basin'  },
  // Fracture Basin — central_crossroads
  B5: { name:'West Crucible',     region_id:'central_crossroads', continent_id:'fracture_basin'  },
  B6: { name:'Crownbreak',        region_id:'central_crossroads', continent_id:'fracture_basin'  },
  B7: { name:'Glass Rift',        region_id:'central_crossroads', continent_id:'fracture_basin'  },
  // Fracture Basin — southern_ruins
  B8: { name:'Southwatch Ruins',  region_id:'southern_ruins',     continent_id:'fracture_basin'  },
  B9: { name:'Golden Causeway',   region_id:'southern_ruins',     continent_id:'fracture_basin'  },
  B10:{ name:'Riftmarket',        region_id:'southern_ruins',     continent_id:'fracture_basin'  },
  // Sunfields — western_plains
  S1: { name:'Westmeadow',        region_id:'western_plains',     continent_id:'sunfields'       },
  S2: { name:'Sunroad',           region_id:'western_plains',     continent_id:'sunfields'       },
  S4: { name:'Amberhold',         region_id:'western_plains',     continent_id:'sunfields'       },
  S7: { name:'South Orchard',     region_id:'western_plains',     continent_id:'sunfields'       },
  // Sunfields — eastern_granaries
  S3: { name:'Harvest Ford',      region_id:'eastern_granaries',  continent_id:'sunfields'       },
  S5: { name:'Granary Cross',     region_id:'eastern_granaries',  continent_id:'sunfields'       },
  S6: { name:'Dawnmarch',         region_id:'eastern_granaries',  continent_id:'sunfields'       },
  S8: { name:'Lowgold',           region_id:'eastern_granaries',  continent_id:'sunfields'       },
  S9: { name:'Coastward Fields',  region_id:'eastern_granaries',  continent_id:'sunfields'       },
  // Shattered Coast — northern_isles
  C1: { name:'Northcliff',        region_id:'northern_isles',     continent_id:'shattered_coast' },
  C2: { name:'Saltwind Pass',     region_id:'northern_isles',     continent_id:'shattered_coast' },
  C3: { name:'Broken Harbor',     region_id:'northern_isles',     continent_id:'shattered_coast' },
  C4: { name:'Blacktide Gate',    region_id:'northern_isles',     continent_id:'shattered_coast' },
  // Shattered Coast — southern_fractures
  C5: { name:'Shardport',         region_id:'southern_fractures', continent_id:'shattered_coast' },
  C6: { name:'Mirror Cape',       region_id:'southern_fractures', continent_id:'shattered_coast' },
  C7: { name:'Southwake',         region_id:'southern_fractures', continent_id:'shattered_coast' },
  C8: { name:'Tidebreak',         region_id:'southern_fractures', continent_id:'shattered_coast' },
};

// Canonical region display names
const SC_REGION_NAMES = {
  outer_passes:       'Outer Passes',
  high_crown:         'High Crown',
  northern_wilds:     'Northern Wilds',
  deepwoods:          'Deepwoods',
  northern_ruins:     'Northern Ruins',
  central_crossroads: 'Central Crossroads',
  southern_ruins:     'Southern Ruins',
  western_plains:     'Western Plains',
  eastern_granaries:  'Eastern Granaries',
  northern_isles:     'Northern Isles',
  southern_fractures: 'Southern Fractures',
};

// Canonical continent display names
const SC_CONTINENT_NAMES = {
  ironspine:      'Ironspine',
  wild_frontier:  'Wild Frontier',
  fracture_basin: 'Fracture Basin',
  sunfields:      'Sunfields',
  shattered_coast:'Shattered Coast',
};

const PHASE_LABELS = {
  deploy: 'planning',
  attack: 'operations',
  battle: 'conflict',
  fortify: 'consolidation',
  faction_selection: 'faction_selection',
  territory_draft: 'territory_draft',
  initial_deploy: 'initial_deploy',
};

// Territory enrichment helpers
function tName(id) { return SC_TERRITORY_DATA[id]?.name ?? id; }
function tRegion(id) { return SC_TERRITORY_DATA[id]?.region_id ?? null; }
function tContinent(id) { return SC_TERRITORY_DATA[id]?.continent_id ?? null; }
function tRegionName(id) { return SC_REGION_NAMES[SC_TERRITORY_DATA[id]?.region_id] ?? null; }
function tContinentName(id) { return SC_CONTINENT_NAMES[SC_TERRITORY_DATA[id]?.continent_id] ?? null; }

// Enrich a territory reference with all canonical fields
function tEnrich(territory_id) {
  const d = SC_TERRITORY_DATA[territory_id];
  return {
    territory_id,
    territory_name:   d?.name ?? territory_id,
    region_id:        d?.region_id ?? null,
    region_name:      SC_REGION_NAMES[d?.region_id] ?? null,
    continent_id:     d?.continent_id ?? null,
    continent_name:   SC_CONTINENT_NAMES[d?.continent_id] ?? null,
  };
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

async function buildSnapshot(base44, campaignId, playerMap) {
  const [
    territories, influence, regionalPools, supplyRoutes,
    buildings, battleCards, tradeProposals, objectives,
    victoryTrackers, phaseDecisions,
  ] = await Promise.all([
    base44.asServiceRole.entities.TerritoryState.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.BattleCard.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.DiplomaticAction.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id: campaignId }),
    base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id: campaignId }),
  ]);

  // Territories with enriched canonical names and owner names
  const territorySnapshot = territories.map(t => ({
    ...tEnrich(t.territory_id),
    owner_player_id: t.owner_player_id ?? null,
    owner_name: t.owner_player_id ? (playerMap[t.owner_player_id]?.display_name ?? t.owner_player_id) : null,
    troop_count: t.troop_count ?? 0,
    resource_storage: t.resource_storage ?? {},
    has_resource_hub: t.has_resource_hub ?? false,
    structures: t.structures ?? [],
  }));

  // Permanent influence per territory per player
  const permInfluence = influence.map(i => ({
    ...tEnrich(i.territory_id),
    player_id: i.player_id,
    player_name: playerMap[i.player_id]?.display_name ?? i.player_id,
    influence_amount: i.influence_amount ?? 0,
  }));

  // Spendable influence per region per player
  const spendableInfluence = regionalPools.map(p => ({
    region_id: p.region_id,
    player_id: p.player_id,
    player_name: playerMap[p.player_id]?.display_name ?? p.player_id,
    spendable_influence: p.spendable_influence ?? 0,
  }));

  // Active buildings
  const buildingSnapshot = buildings.map(b => ({
    ...tEnrich(b.territory_id),
    player_id: b.player_id,
    player_name: playerMap[b.player_id]?.display_name ?? b.player_id,
    building_type: b.building_type,
    pillar_type: b.pillar_type,
    status: b.status,
    started_round: b.started_round,
    completed_round: b.completed_round,
  }));

  // Supply routes
  const routeSnapshot = supplyRoutes.map(r => ({
    id: r.id,
    owner_player_id: r.owner_player_id,
    owner_name: playerMap[r.owner_player_id]?.display_name ?? r.owner_player_id,
    hub: tEnrich(r.hub_territory_id),
    source: tEnrich(r.source_territory_id),
    route_status: r.route_status,
    resource_type: r.resource_type,
    created_round: r.created_round,
  }));

  // Battle cards
  const battleCardSnapshot = battleCards.map(bc => ({
    id: bc.id,
    round: bc.round,
    battle_type: bc.battle_type,
    battle_pillar: bc.battle_pillar,
    target: tEnrich(bc.target_territory_id),
    defender_player_id: bc.defender_player_id ?? null,
    defender_name: bc.defender_player_id ? (playerMap[bc.defender_player_id]?.display_name ?? bc.defender_player_id) : null,
    status: bc.status,
    result_applied: bc.result_applied ?? false,
    total_troops_in_battle: bc.total_troops_in_battle ?? 0,
  }));

  // Trade proposals (pending diplomatic actions)
  const tradeSnapshot = tradeProposals
    .filter(a => a.action_type === 'trade_proposal')
    .map(a => ({
      id: a.id,
      round: a.round,
      proposer_player_id: a.player_id,
      proposer_name: playerMap[a.player_id]?.display_name ?? a.player_id,
      target_player_id: a.target_player_id,
      target_name: a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
      status: a.status,
      offer: a.effect_metadata?.offer ?? {},
      request: a.effect_metadata?.request ?? {},
    }));

  // Objectives per player
  const objectiveSnapshot = objectives.map(o => ({
    player_id: o.player_id,
    player_name: playerMap[o.player_id]?.display_name ?? o.player_id,
    global_influence: o.global_influence ?? 0,
    objective_cards: o.objective_cards_json ?? {},
    updated_at_round: o.updated_at_round,
  }));

  // Victory scores
  const victorySnapshot = victoryTrackers.map(v => ({
    player_id: v.player_id,
    player_name: playerMap[v.player_id]?.display_name ?? v.player_id,
    occupancy_score: v.occupancy_score ?? 0,
    wealth_score: v.wealth_score ?? 0,
    influence_score: v.influence_score ?? 0,
    has_won: v.has_won ?? false,
    winning_condition: v.winning_condition ?? null,
  }));

  // Phase lock states
  const lockSnapshot = phaseDecisions.map(pd => ({
    player_id: pd.player_id,
    player_name: playerMap[pd.player_id]?.display_name ?? pd.player_id,
    phase: pd.phase,
    round: pd.round,
    is_locked: pd.is_locked ?? false,
    locked_at: pd.locked_at ?? null,
  }));

  return {
    territory_states: territorySnapshot,
    permanent_influence: permInfluence,
    spendable_influence: spendableInfluence,
    buildings: buildingSnapshot,
    supply_routes: routeSnapshot,
    battle_cards: battleCardSnapshot,
    trade_proposals: tradeSnapshot,
    objectives: objectiveSnapshot,
    victory_scores: victorySnapshot,
    phase_lock_states: lockSnapshot,
  };
}

// ── Delta calculator ──────────────────────────────────────────────────────────

function calcDeltas(before, after, playerMap) {
  const warnings = [];

  // ── Troop deltas ──
  const troopDeltas = [];
  const beforeTroopMap = {};
  for (const t of (before.territory_states ?? [])) beforeTroopMap[t.territory_id] = t;
  for (const t of (after.territory_states ?? [])) {
    const bef = beforeTroopMap[t.territory_id];
    const delta = (t.troop_count ?? 0) - (bef?.troop_count ?? 0);
    if (delta !== 0 || (bef?.owner_player_id !== t.owner_player_id)) {
      troopDeltas.push({
        ...tEnrich(t.territory_id),
        owner_before: bef?.owner_name ?? null,
        owner_after: t.owner_name ?? null,
        troops_before: bef?.troop_count ?? 0,
        troops_after: t.troop_count ?? 0,
        troop_delta: delta,
        ownership_changed: bef?.owner_player_id !== t.owner_player_id,
      });
      if (delta > 0 && !bef?.owner_player_id && t.owner_player_id) {
        // Occupation — expected
      } else if (delta > 30) {
        warnings.push({ type: 'unexpected_troop_increase', ...tEnrich(t.territory_id), delta });
      } else if (delta < -30) {
        warnings.push({ type: 'unexpected_troop_decrease', ...tEnrich(t.territory_id), delta });
      }
    }
  }

  // ── Resource deltas ──
  const resourceDeltas = [];
  for (const t of (after.territory_states ?? [])) {
    const bef = beforeTroopMap[t.territory_id];
    const afterStorage = t.resource_storage ?? {};
    const beforeStorage = bef?.resource_storage ?? {};
    const resources = new Set([...Object.keys(afterStorage), ...Object.keys(beforeStorage)]);
    for (const res of resources) {
      const aft = afterStorage[res] ?? 0;
      const bfr = beforeStorage[res] ?? 0;
      const delta = aft - bfr;
      if (delta !== 0) {
        resourceDeltas.push({
          ...tEnrich(t.territory_id),
          resource: res,
          before: bfr,
          after: aft,
          delta,
        });
        if (aft < 0) warnings.push({ type: 'resource_went_negative', ...tEnrich(t.territory_id), resource: res, value: aft });
        if (delta > 50) warnings.push({ type: 'unexpected_resource_increase', ...tEnrich(t.territory_id), resource: res, delta });
      }
    }
  }

  // ── Permanent influence deltas ──
  const permInfluenceDeltas = [];
  const beforePermMap = {};
  for (const i of (before.permanent_influence ?? [])) {
    beforePermMap[`${i.player_id}|${i.territory_id}`] = i;
  }
  for (const i of (after.permanent_influence ?? [])) {
    const key = `${i.player_id}|${i.territory_id}`;
    const bef = beforePermMap[key];
    const delta = (i.influence_amount ?? 0) - (bef?.influence_amount ?? 0);
    if (delta !== 0) {
      permInfluenceDeltas.push({
        player_id: i.player_id, player_name: i.player_name,
        ...tEnrich(i.territory_id),
        before: bef?.influence_amount ?? 0, after: i.influence_amount, delta,
      });
      if (delta < 0) warnings.push({ type: 'permanent_influence_reduced', player_id: i.player_id, ...tEnrich(i.territory_id), delta });
    }
  }

  // ── Spendable influence deltas ──
  const spendDeltas = [];
  const beforeSpendMap = {};
  for (const p of (before.spendable_influence ?? [])) {
    beforeSpendMap[`${p.player_id}|${p.region_id}`] = p;
  }
  for (const p of (after.spendable_influence ?? [])) {
    const key = `${p.player_id}|${p.region_id}`;
    const bef = beforeSpendMap[key];
    const delta = (p.spendable_influence ?? 0) - (bef?.spendable_influence ?? 0);
    if (delta !== 0) {
      spendDeltas.push({
        player_id: p.player_id, player_name: p.player_name,
        region_id: p.region_id,
        before: bef?.spendable_influence ?? 0, after: p.spendable_influence, delta,
      });
      if (p.spendable_influence < 0) warnings.push({ type: 'spendable_influence_negative', player_id: p.player_id, region_id: p.region_id, value: p.spendable_influence });
    }
  }

  // ── Victory score deltas ──
  const victoryDeltas = [];
  const beforeVicMap = {};
  for (const v of (before.victory_scores ?? [])) beforeVicMap[v.player_id] = v;
  for (const v of (after.victory_scores ?? [])) {
    const bef = beforeVicMap[v.player_id];
    victoryDeltas.push({
      player_id: v.player_id, player_name: v.player_name,
      occupancy_delta: (v.occupancy_score ?? 0) - (bef?.occupancy_score ?? 0),
      wealth_delta:    (v.wealth_score ?? 0)    - (bef?.wealth_score ?? 0),
      influence_delta: (v.influence_score ?? 0) - (bef?.influence_score ?? 0),
      has_won_after: v.has_won,
    });
  }

  // ── Structure changes ──
  const structureChanges = [];
  const beforeBuildMap = {};
  for (const b of (before.buildings ?? [])) beforeBuildMap[b.id ?? `${b.territory_id}|${b.building_type}|${b.player_id}`] = b;
  for (const b of (after.buildings ?? [])) {
    const key = b.id ?? `${b.territory_id}|${b.building_type}|${b.player_id}`;
    const bef = beforeBuildMap[key];
    if (!bef) {
      structureChanges.push({ change: 'created', ...b });
    } else if (bef.status !== b.status) {
      structureChanges.push({ change: 'status_changed', ...tEnrich(b.territory_id), building_type: b.building_type, from: bef.status, to: b.status });
    }
  }

  // ── Battle card state changes ──
  const battleCardChanges = [];
  const beforeBcMap = {};
  for (const bc of (before.battle_cards ?? [])) beforeBcMap[bc.id] = bc;
  for (const bc of (after.battle_cards ?? [])) {
    const bef = beforeBcMap[bc.id];
    if (!bef) {
      battleCardChanges.push({ change: 'created', ...bc });
      if (!bc.defender_player_id && bc.battle_type !== 'bloodbath') {
        warnings.push({ type: 'battle_card_no_defender', battle_card_id: bc.id, battle_type: bc.battle_type, target: bc.target ?? tEnrich(bc.target_territory_id) });
      }
    } else if (bef.status !== bc.status) {
      battleCardChanges.push({ change: 'status_changed', id: bc.id, target: bc.target ?? tEnrich(bc.target_territory_id), from: bef.status, to: bc.status });
    }
  }

  // ── Trade state changes ──
  const tradeChanges = [];
  const beforeTradeMap = {};
  for (const t of (before.trade_proposals ?? [])) beforeTradeMap[t.id] = t;
  for (const t of (after.trade_proposals ?? [])) {
    const bef = beforeTradeMap[t.id];
    if (!bef) {
      tradeChanges.push({ change: 'created', ...t });
    } else if (bef.status !== t.status) {
      tradeChanges.push({ change: 'status_changed', id: t.id, from: bef.status, to: t.status });
      if (t.status === 'active' && bef.status === 'pending') {
        // Check for missing destinations (can only check top-level presence)
        const offer = t.offer ?? {};
        if (Object.keys(offer.resources ?? {}).length > 0 || (offer.troops?.amount ?? 0) > 0) {
          // Accepted — assume validated by resolveTradeConsolidation
        }
      }
    }
  }

  // ── Phase lock deltas ──
  const lockChanges = [];
  const beforeLockMap = {};
  for (const l of (before.phase_lock_states ?? [])) beforeLockMap[`${l.player_id}|${l.phase}|${l.round}`] = l;
  for (const l of (after.phase_lock_states ?? [])) {
    const key = `${l.player_id}|${l.phase}|${l.round}`;
    const bef = beforeLockMap[key];
    if (!bef && l.is_locked) {
      lockChanges.push({ change: 'locked', player_id: l.player_id, player_name: l.player_name, phase: l.phase, round: l.round });
    } else if (bef && !bef.is_locked && l.is_locked) {
      lockChanges.push({ change: 'locked', player_id: l.player_id, player_name: l.player_name, phase: l.phase, round: l.round });
    } else if (bef && bef.is_locked && !l.is_locked) {
      lockChanges.push({ change: 'unlocked', player_id: l.player_id, player_name: l.player_name, phase: l.phase, round: l.round });
    }
  }

  return {
    troop_deltas: troopDeltas,
    resource_deltas: resourceDeltas,
    permanent_influence_deltas: permInfluenceDeltas,
    spendable_influence_deltas: spendDeltas,
    victory_score_deltas: victoryDeltas,
    structure_changes: structureChanges,
    battle_card_changes: battleCardChanges,
    trade_state_changes: tradeChanges,
    phase_lock_changes: lockChanges,
  };
}

// ── Phase snapshot retrieval ──────────────────────────────────────────────────

// Phase order — used to find "next phase" for after-snapshot reconstruction
const PHASE_ORDER = [
  'faction_selection', 'territory_draft', 'initial_deploy',
  'deploy', 'attack', 'battle', 'fortify',
];

function nextPhase(phase) {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

// All known snapshot_type values that mean "start of phase" (before effects)
const BEFORE_TYPES = new Set(['before', 'start', 'phase_start', 'phase_before']);
// All known snapshot_type values that mean "end of phase" (after effects)
const AFTER_TYPES  = new Set(['after', 'end', 'phase_end', 'phase_after']);

async function getPhaseSnapshotData(base44, campaignId, round, phase) {
  const snapshots = await base44.asServiceRole.entities.PhaseSnapshot.filter({
    campaign_id: campaignId,
    round,
    phase,
  });
  return snapshots;
}

// Find the "before" snapshot of the next phase, which equals the "after" of this phase
async function getNextPhaseBeforeSnapshot(base44, campaignId, round, phase) {
  const next = nextPhase(phase);
  if (!next) return null;

  const snapshots = await base44.asServiceRole.entities.PhaseSnapshot.filter({
    campaign_id: campaignId,
    round,
    phase: next,
  });
  const beforeRecord = snapshots.find(s => BEFORE_TYPES.has(s.snapshot_type ?? s.type));
  if (beforeRecord) return beforeRecord;

  // If phase was fortify (end of round), try round+1 deploy
  if (phase === 'fortify') {
    const nextRoundSnaps = await base44.asServiceRole.entities.PhaseSnapshot.filter({
      campaign_id: campaignId,
      round: round + 1,
      phase: 'deploy',
    });
    return nextRoundSnaps.find(s => BEFORE_TYPES.has(s.snapshot_type ?? s.type)) ?? null;
  }
  return null;
}

// ── Battle Resolution Audit ───────────────────────────────────────────────────

async function getBattleResolutionAudit(base44, campaignId, round, playerMap) {
  const allCards = await base44.asServiceRole.entities.BattleCard.filter({
    campaign_id: campaignId,
    round,
  });

  const resolved = allCards.filter(bc => bc.result_applied === true);
  const audit = [];

  for (const bc of resolved) {
    const result = bc.result ?? {};
    const winnerPlayerId = result.winner_player_id ?? null;
    const winnerName = winnerPlayerId ? (playerMap[winnerPlayerId]?.display_name ?? winnerPlayerId) : null;

    const attackerEntries = (bc.attackers ?? []).map(a => ({
      player_id:        a.player_id,
      player_name:      playerMap[a.player_id]?.display_name ?? a.player_id,
      origin:           tEnrich(a.origin_territory_id),
      committed_troops: a.committed_troops ?? 0,
    }));

    // Determine effects
    const effects = [];
    if (winnerPlayerId) {
      const attackerIds = new Set((bc.attackers ?? []).map(a => a.player_id));
      const attackerWon = attackerIds.has(winnerPlayerId);
      if (attackerWon && !bc.is_mutual) effects.push('territory_captured');
      if (bc.is_mutual && attackerWon) effects.push('bloodbath_won');
      if (!attackerWon) effects.push('territory_defended');
    }
    if (bc.battle_type === 'double_siege' && result.double_siege_result?.defender_held === false) {
      effects.push('territory_unclaimed');
    }
    if (result.result_source === 'auto') effects.push('auto_resolved');
    if (result.result_source === 'forfeit') effects.push('forfeit');
    if (bc.battle_type === 'skirmish') effects.push('skirmish_auto_captured');
    if (['uprising','labor_strike','tax_protest','manufactured_crisis'].includes(bc.battle_type)) {
      effects.push(`${bc.battle_type}_applied`);
    }
    if (['supply_route_establishment','supply_route_race','supply_raid','supply_caravan_escort'].includes(bc.battle_type)) {
      effects.push(`${bc.battle_type}_applied`);
    }

    audit.push({
      battle_card_id:   bc.id,
      battle_type:      bc.battle_type,
      battle_pillar:    bc.battle_pillar ?? 'military',
      target:           tEnrich(bc.target_territory_id),
      attacker:         attackerEntries[0]?.player_name ?? null,
      attacker_entries: attackerEntries,
      defender:         bc.defender_player_id ? (playerMap[bc.defender_player_id]?.display_name ?? bc.defender_player_id) : null,
      defender_player_id: bc.defender_player_id ?? null,

      starting_state: {
        owner:  bc.defender_player_id ? (playerMap[bc.defender_player_id]?.display_name ?? bc.defender_player_id) : 'unoccupied',
        troops: bc.defender_troops ?? 0,
        attacking_troops: bc.total_attacking_troops ?? 0,
        total_troops: bc.total_troops_in_battle ?? 0,
      },

      ending_state: {
        owner:  winnerName ?? 'unclaimed',
        owner_player_id: winnerPlayerId,
        troops: result.winner_bop_survivors ?? null,
        surviving_tabletop: result.surviving_tabletop_troops ?? null,
      },

      winner:       winnerName,
      winner_player_id: winnerPlayerId,
      effects,

      resolution: {
        source:       result.result_source ?? 'manual',
        submitted_at: result.submitted_at ?? null,
        applied_at:   result.applied_at ?? null,
        notes:        result.notes ?? '',
        double_siege: result.double_siege_result ?? null,
      },

      tabletop_size:  bc.tabletop_size ?? 0,
      scale_factor:   bc.scale_factor ?? 1,
      resolved_at:    bc.resolved_at ?? null,
      status:         bc.status,
    });
  }

  return audit;
}

// ── Enriched submitted actions per pillar ─────────────────────────────────────

async function getEnrichedSubmittedActions(base44, campaignId, round, phase, playerMap) {
  const military = [];
  const economic = [];
  const diplomatic = [];

  // ── Military: attack declarations (from AttackReveal) ──
  if (phase === 'attack' || phase === 'deploy') {
    const attacks = await base44.asServiceRole.entities.AttackReveal.filter({
      campaign_id: campaignId,
      round,
    });
    for (const a of attacks) {
      military.push({
        pillar:        'military',
        action_type:   'attack',
        player_id:     a.player_id,
        player:        playerMap[a.player_id]?.display_name ?? a.player_id,
        source:        tEnrich(a.origin_territory_id),
        target:        tEnrich(a.target_territory_id),
        troops:        a.committed_troops ?? 0,
        timestamp:     a.created_date ?? null,
        round,
        phase,
      });
    }
  }

  // ── Military: troop deployments (from PhaseDecision for deploy phase) ──
  if (phase === 'deploy') {
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id: campaignId, phase: 'deploy', round,
    });
    for (const d of decisions) {
      const placements = d.data?.placements ?? {};
      const total = Object.values(placements).reduce((s, v) => s + v, 0);
      if (total > 0) {
        military.push({
          pillar:             'military',
          action_type:        'deploy_troops',
          player_id:          d.player_id,
          player:             playerMap[d.player_id]?.display_name ?? d.player_id,
          territories_placed: Object.entries(placements).map(([tid, cnt]) => ({ ...tEnrich(tid), troops: cnt })),
          total_troops:       total,
          is_auto_submitted:  d.is_auto_submitted ?? false,
          locked_at:          d.locked_at ?? null,
          timestamp:          d.locked_at ?? d.updated_date ?? null,
          round,
          phase,
        });
      }
    }
  }

  // ── Military: fortifications (from PhaseDecision for fortify phase) ──
  if (phase === 'fortify') {
    const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id: campaignId, phase: 'fortify', round,
    });
    for (const d of decisions) {
      const movements = d.data?.movements ?? [];
      for (const m of movements) {
        military.push({
          pillar:       'military',
          action_type:  'fortify',
          player_id:    d.player_id,
          player:       playerMap[d.player_id]?.display_name ?? d.player_id,
          source:       tEnrich(m.origin_territory_id),
          target:       tEnrich(m.destination_territory_id),
          troops:       m.committed_troops ?? 0,
          timestamp:    d.locked_at ?? d.updated_date ?? null,
          round,
          phase,
        });
      }
      // Construction
      const construction = d.data?.construction;
      if (construction?.territory_id) {
        economic.push({
          pillar:         'economic',
          action_type:    'start_construction',
          player_id:      d.player_id,
          player:         playerMap[d.player_id]?.display_name ?? d.player_id,
          territory:      tEnrich(construction.territory_id),
          building_type:  construction.structure_type,
          pillar_type:    construction.pillar,
          timestamp:      construction.staged_at ?? d.locked_at ?? null,
          round,
          phase,
        });
      }
    }
  }

  // ── Economic: resource activations (from operations staging decisions) ──
  if (phase === 'deploy') {
    const stagingDecisions = await base44.asServiceRole.entities.PhaseDecision.filter({
      campaign_id: campaignId, phase: 'planning_stage', round,
    });
    for (const d of stagingDecisions) {
      const staged = d.data?.economic_staged ?? [];
      if (staged.length > 0) {
        economic.push({
          pillar:            'economic',
          action_type:       'activate_resources',
          player_id:         d.player_id,
          player:            playerMap[d.player_id]?.display_name ?? d.player_id,
          territories:       staged.map(tid => tEnrich(tid)),
          territory_count:   staged.length,
          timestamp:         d.data?.locked_at ?? d.updated_date ?? null,
          round,
          phase,
        });
      }
    }
  }

  // ── Economic: construction projects started this round ──
  const buildings = await base44.asServiceRole.entities.TerritoryBuilding.filter({
    campaign_id: campaignId, started_round: round,
  });
  for (const b of buildings) {
    economic.push({
      pillar:        'economic',
      action_type:   'build_' + b.building_type,
      player_id:     b.player_id,
      player:        playerMap[b.player_id]?.display_name ?? b.player_id,
      territory:     tEnrich(b.territory_id),
      building_type: b.building_type,
      status:        b.status,
      timestamp:     b.created_date ?? null,
      round,
      phase,
    });
  }

  // ── Diplomatic: all DiplomaticActions this round ──
  const dipActions = await base44.asServiceRole.entities.DiplomaticAction.filter({
    campaign_id: campaignId, round,
  });
  for (const a of dipActions) {
    diplomatic.push({
      pillar:              'diplomatic',
      action_type:         a.action_type,
      player_id:           a.player_id,
      player:              playerMap[a.player_id]?.display_name ?? a.player_id,
      region_id:           a.region_id,
      influence_spent:     a.influence_spent ?? 0,
      target_territory:    a.target_territory_id ? tEnrich(a.target_territory_id) : null,
      target_player_id:    a.target_player_id ?? null,
      target_player:       a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
      status:              a.status,
      timestamp:           a.created_date ?? null,
      round,
      phase,
    });
  }

  // ── Diplomatic: intelligence reports this round ──
  const intelReports = await base44.asServiceRole.entities.IntelligenceReport.filter({
    campaign_id: campaignId, generated_round: round,
  });
  for (const r of intelReports) {
    diplomatic.push({
      pillar:            'diplomatic',
      action_type:       r.report_type,
      player_id:         r.viewer_player_id,
      player:            playerMap[r.viewer_player_id]?.display_name ?? r.viewer_player_id,
      target_territory:  r.target_territory_id ? tEnrich(r.target_territory_id) : null,
      target_player_id:  r.target_player_id ?? null,
      target_player:     r.target_player_id ? (playerMap[r.target_player_id]?.display_name ?? r.target_player_id) : null,
      influence_spent:   r.influence_spent ?? 0,
      generated_phase:   r.generated_phase,
      timestamp:         r.generated_at ?? r.created_date ?? null,
      round,
      phase,
    });
  }

  return { military, economic, diplomatic, all: [...military, ...economic, ...diplomatic] };
}

// ── Submitted actions assembler ───────────────────────────────────────────────

async function getSubmittedActions(base44, campaignId, round, phase, playerMap) {
  const actions = [];

  // PhaseDecisions — staging records
  const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
    campaign_id: campaignId,
    round,
    phase,
  });
  for (const d of decisions) {
    actions.push({
      source: 'PhaseDecision',
      player_id: d.player_id,
      player_name: playerMap[d.player_id]?.display_name ?? d.player_id,
      action_type: 'phase_staging',
      pillar: phase === 'deploy' ? 'military' : phase === 'attack' ? 'multi' : 'multi',
      submitted_at: d.updated_date ?? d.created_date,
      is_locked: d.is_locked ?? false,
      payload: d.data ?? {},
    });
  }

  // AttackReveals — attack submissions during attack phase
  if (phase === 'attack' || phase === 'deploy') {
    const attacks = await base44.asServiceRole.entities.AttackReveal.filter({
      campaign_id: campaignId,
      round,
    });
    for (const a of attacks) {
      actions.push({
        source: 'AttackReveal',
        player_id: a.player_id,
        player_name: playerMap[a.player_id]?.display_name ?? a.player_id,
        action_type: 'attack_declaration',
        pillar: 'military',
        submitted_at: a.created_date,
        origin: tEnrich(a.origin_territory_id),
        target: tEnrich(a.target_territory_id),
        committed_troops: a.committed_troops,
      });
    }
  }

  // DiplomaticActions — submitted during any phase
  const dipActions = await base44.asServiceRole.entities.DiplomaticAction.filter({
    campaign_id: campaignId,
    round,
  });
  for (const a of dipActions) {
    const pillar = a.action_type === 'trade_proposal' ? 'diplomatic' :
                   ['war_rations','influence_network','merchant_convoy','non_aggression_pact',
                    'broker_peace','coalition_warfare','power_broker'].includes(a.action_type) ? 'diplomatic' : 'diplomatic';
    actions.push({
      source: 'DiplomaticAction',
      player_id: a.player_id,
      player_name: playerMap[a.player_id]?.display_name ?? a.player_id,
      action_type: a.action_type,
      pillar,
      submitted_at: a.created_date,
      region_id: a.region_id,
      influence_spent: a.influence_spent ?? 0,
      status: a.status,
      target_player_id: a.target_player_id ?? null,
      target_player_name: a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
      target: a.target_territory_id ? tEnrich(a.target_territory_id) : null,
      effect_metadata: a.effect_metadata ?? {},
    });
  }

  // IntelligenceReports — gathered this round
  const intelReports = await base44.asServiceRole.entities.IntelligenceReport.filter({
    campaign_id: campaignId,
    generated_round: round,
  });
  for (const r of intelReports) {
    actions.push({
      source: 'IntelligenceReport',
      player_id: r.viewer_player_id,
      player_name: playerMap[r.viewer_player_id]?.display_name ?? r.viewer_player_id,
      action_type: r.report_type,
      pillar: 'diplomatic',
      submitted_at: r.generated_at,
      generated_phase: r.generated_phase,
      target: r.target_territory_id ? tEnrich(r.target_territory_id) : null,
      target_player_id: r.target_player_id ?? null,
      target_player_name: r.target_player_id ? (playerMap[r.target_player_id]?.display_name ?? r.target_player_id) : null,
      influence_spent: r.influence_spent ?? 0,
      report_data: r.report_data ?? {},
    });
  }

  return actions;
}

// ── Generated artifacts ───────────────────────────────────────────────────────

async function getGeneratedArtifacts(base44, campaignId, round, playerMap) {
  const [
    battleCards,
    tradeProposals,
    intelReports,
    supplyRoutes,
    buildings,
    dipActions,
  ] = await Promise.all([
    base44.asServiceRole.entities.BattleCard.filter({ campaign_id: campaignId, round }),
    base44.asServiceRole.entities.DiplomaticAction.filter({ campaign_id: campaignId, round }),
    base44.asServiceRole.entities.IntelligenceReport.filter({ campaign_id: campaignId, generated_round: round }),
    base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id: campaignId, created_round: round }),
    base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id: campaignId, started_round: round }),
    base44.asServiceRole.entities.DiplomaticAction.filter({ campaign_id: campaignId, round }),
  ]);

  return {
    battle_cards_generated: battleCards.map(bc => ({
      id: bc.id,
      battle_type: bc.battle_type,
      battle_pillar: bc.battle_pillar,
      target: tEnrich(bc.target_territory_id),
      source_player_id: bc.source_player_id ?? null,
      source_player_name: bc.source_player_id ? (playerMap[bc.source_player_id]?.display_name ?? bc.source_player_id) : null,
      status: bc.status,
    })),
    trade_proposals_generated: tradeProposals
      .filter(a => a.action_type === 'trade_proposal')
      .map(a => ({
        id: a.id,
        proposer_player_id: a.player_id,
        proposer_name: playerMap[a.player_id]?.display_name ?? a.player_id,
        target_player_id: a.target_player_id,
        target_name: a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
        status: a.status,
      })),
    intelligence_reports_generated: intelReports.map(r => ({
      id: r.id,
      report_type: r.report_type,
      viewer_player_id: r.viewer_player_id,
      viewer_name: playerMap[r.viewer_player_id]?.display_name ?? r.viewer_player_id,
      target: r.target_territory_id ? tEnrich(r.target_territory_id) : null,
      generated_phase: r.generated_phase,
    })),
    supply_routes_created: supplyRoutes.map(r => ({
      id: r.id,
      owner_name: playerMap[r.owner_player_id]?.display_name ?? r.owner_player_id,
      hub: tEnrich(r.hub_territory_id),
      source: tEnrich(r.source_territory_id),
      resource_type: r.resource_type,
    })),
    buildings_started: buildings.map(b => ({
      ...tEnrich(b.territory_id),
      player_name: playerMap[b.player_id]?.display_name ?? b.player_id,
      building_type: b.building_type,
      pillar_type: b.pillar_type,
      status: b.status,
    })),
    diplomatic_effects_created: dipActions
      .filter(a => a.action_type !== 'trade_proposal')
      .map(a => ({
        id: a.id,
        action_type: a.action_type,
        player_name: playerMap[a.player_id]?.display_name ?? a.player_id,
        region_id: a.region_id,
        influence_spent: a.influence_spent ?? 0,
        status: a.status,
        expires_round: a.expires_round ?? null,
      })),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, campaign_id } = body;
    if (!campaign_id) return Response.json({ error: 'campaign_id is required' }, { status: 400 });

    const campaigns = await base44.asServiceRole.entities.Campaign.filter({ id: campaign_id });
    const campaign = campaigns[0];
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    // Admin-only gate
    if (campaign.admin_user_id !== user.id) {
      return Response.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const players = await base44.asServiceRole.entities.CampaignPlayer.filter({ campaign_id });
    const playerMap = {};
    for (const p of players) playerMap[p.id] = p;

    // ── ACTION: generateBundle ──────────────────────────────────────────────
    if (action === 'generateBundle') {
      const targetRound = body.round ?? campaign.current_round ?? 1;
      const targetPhase = body.phase ?? campaign.current_phase ?? 'deploy';
      const isCurrentPhase = (
        targetRound === (campaign.current_round ?? 1) &&
        targetPhase === campaign.current_phase
      );

      // ── Diagnostics tracker ─────────────────────────────────────────────
      const diagnostics = {
        before_snapshot_source: 'pending',
        after_snapshot_source:  'pending',
        delta_generation:       'pending',
        battle_audit_generation: 'pending',
        action_log_generation:  'pending',
      };

      // ── Snapshot resolution strategy ────────────────────────────────────
      //
      // PHASE_START / phase_start snapshots: written by phase functions at the
      //   very beginning of a phase (before any player actions take effect).
      //   These are the authoritative "before" state.
      //
      // PHASE_END / phase_end snapshots: written by processPhaseEnd immediately
      //   after all effects are applied. These are the authoritative "after" state.
      //
      // Fallback chain:
      //   before = stored phase_start → live state (current phase only)
      //   after  = stored phase_end → next-phase phase_start → live state (in-progress only)
      //
      const [storedSnapshots, nextPhaseBeforeRecord, liveSnapshot] = await Promise.all([
        getPhaseSnapshotData(base44, campaign_id, targetRound, targetPhase),
        isCurrentPhase ? Promise.resolve(null) : getNextPhaseBeforeSnapshot(base44, campaign_id, targetRound, targetPhase),
        buildSnapshot(base44, campaign_id, playerMap),
      ]);

      const beforeRecord = storedSnapshots.find(s => BEFORE_TYPES.has(s.snapshot_type ?? s.type));
      const afterRecord  = storedSnapshots.find(s => AFTER_TYPES.has(s.snapshot_type ?? s.type));

      // ── Resolve before snapshot ──────────────────────────────────────────
      let beforeSnapshotData, beforeCapturedAt, beforeSource;

      // A stored before-snapshot has all the minimal fields (territory_states,
      // player_standings). We merge with a live buildSnapshot to ensure rich fields
      // (resources, influence, buildings, etc.) are present when the stored record
      // uses the old minimal schema.
      if (beforeRecord) {
        // Prefer stored record's territory_states/player_standings but fill in rich
        // fields from liveSnapshot if missing (live is good enough for before-rich context
        // since these fields don't change rapidly).
        const stored = beforeRecord.data ?? {};
        if (stored.territory_states && !stored.permanent_influence) {
          // Old minimal schema — enrich territory_states with canonical names
          const enrichedTS = (stored.territory_states ?? []).map(t => ({
            ...tEnrich(t.territory_id),
            owner_player_id: t.owner_player_id ?? null,
            owner_name: t.owner_player_id ? (playerMap[t.owner_player_id]?.display_name ?? t.owner_player_id) : null,
            troop_count: t.troop_count ?? 0,
            resource_storage: t.resource_storage ?? {},
            has_resource_hub: t.has_resource_hub ?? false,
            structures: t.structures ?? [],
          }));
          beforeSnapshotData = {
            ...liveSnapshot,        // rich fields from live (best available for before context)
            territory_states: enrichedTS,    // authoritative: from stored record
            player_standings: stored.player_standings ?? liveSnapshot.player_standings,
          };
          beforeSource = 'stored_phase_snapshot_minimal_enriched';
        } else {
          beforeSnapshotData = stored;
          beforeSource = 'stored';
        }
        beforeCapturedAt = beforeRecord.created_date ?? null;
        diagnostics.before_snapshot_source = 'stored';
      } else if (isCurrentPhase) {
        beforeSnapshotData = liveSnapshot;
        beforeCapturedAt   = new Date().toISOString();
        beforeSource       = 'live_state_at_export_time';
        diagnostics.before_snapshot_source = 'live_fallback';
      } else {
        // Completed phase but no stored before — use live (contaminated but best available)
        beforeSnapshotData = liveSnapshot;
        beforeCapturedAt   = new Date().toISOString();
        beforeSource       = 'live_state_fallback_no_stored_snapshot';
        diagnostics.before_snapshot_source = 'live_fallback_missing';
      }

      // ── Resolve after snapshot ───────────────────────────────────────────
      let afterSnapshotData, afterCapturedAt, afterSource, phaseCompletionState;

      if (isCurrentPhase) {
        afterSnapshotData    = liveSnapshot;
        afterCapturedAt      = new Date().toISOString();
        afterSource          = 'current_in_progress_state_only';
        phaseCompletionState = 'in_progress';
        diagnostics.after_snapshot_source = 'live_in_progress';
      } else if (afterRecord) {
        // Full authoritative stored after-snapshot
        const stored = afterRecord.data ?? {};
        if (stored.territory_states && !stored.permanent_influence) {
          const enrichedTS = (stored.territory_states ?? []).map(t => ({
            ...tEnrich(t.territory_id),
            owner_player_id: t.owner_player_id ?? null,
            owner_name: t.owner_player_id ? (playerMap[t.owner_player_id]?.display_name ?? t.owner_player_id) : null,
            troop_count: t.troop_count ?? 0,
            resource_storage: t.resource_storage ?? {},
            has_resource_hub: t.has_resource_hub ?? false,
            structures: t.structures ?? [],
          }));
          afterSnapshotData = {
            ...liveSnapshot,
            territory_states: enrichedTS,
            player_standings: stored.player_standings ?? liveSnapshot.player_standings,
          };
          afterSource = 'stored_after_minimal_enriched';
        } else {
          afterSnapshotData = stored;
          afterSource = 'stored';
        }
        afterCapturedAt      = afterRecord.created_date ?? null;
        phaseCompletionState = 'completed';
        diagnostics.after_snapshot_source = 'stored';
      } else if (nextPhaseBeforeRecord) {
        const stored = nextPhaseBeforeRecord.data ?? {};
        if (stored.territory_states && !stored.permanent_influence) {
          const enrichedTS = (stored.territory_states ?? []).map(t => ({
            ...tEnrich(t.territory_id),
            owner_player_id: t.owner_player_id ?? null,
            owner_name: t.owner_player_id ? (playerMap[t.owner_player_id]?.display_name ?? t.owner_player_id) : null,
            troop_count: t.troop_count ?? 0,
            resource_storage: t.resource_storage ?? {},
            has_resource_hub: t.has_resource_hub ?? false,
            structures: t.structures ?? [],
          }));
          afterSnapshotData = {
            ...liveSnapshot,
            territory_states: enrichedTS,
            player_standings: stored.player_standings ?? liveSnapshot.player_standings,
          };
          afterSource = 'next_phase_before_snapshot_minimal_enriched';
        } else {
          afterSnapshotData = nextPhaseBeforeRecord.data;
          afterSource = 'next_phase_before_snapshot_equals_after';
        }
        afterCapturedAt      = nextPhaseBeforeRecord.created_date ?? null;
        phaseCompletionState = 'completed';
        diagnostics.after_snapshot_source = 'stored_next_phase_start';
      } else {
        afterSnapshotData    = liveSnapshot;
        afterCapturedAt      = new Date().toISOString();
        afterSource          = 'live_state_fallback_no_stored_after_snapshot';
        phaseCompletionState = 'completed_no_stored_snapshot';
        diagnostics.after_snapshot_source = 'live_fallback_missing';
      }

      // Phase timing from SetupLog events (best-effort; null if not recorded)
      const phaseLogs = await base44.asServiceRole.entities.SetupLog.filter({
        campaign_id,
        phase: targetPhase,
        round: targetRound,
      });
      const startLog = phaseLogs.find(l => ['phase_started','deploy_started','attack_started','fortify_started'].includes(l.event_type));
      const endLog   = phaseLogs.find(l => ['phase_ended','phase_advanced','phase_complete'].includes(l.event_type));
      const phaseStartedAt   = startLog?.created_date ?? null;
      const phaseCompletedAt = endLog?.created_date ?? null;

      // ── Enriched submitted actions (per pillar) ─────────────────────────
      let enrichedActions = { military: [], economic: [], diplomatic: [], all: [] };
      try {
        enrichedActions = await getEnrichedSubmittedActions(base44, campaign_id, targetRound, targetPhase, playerMap);
        diagnostics.action_log_generation = 'success';
      } catch (e) {
        diagnostics.action_log_generation = `error: ${e.message}`;
      }

      // ── Legacy flat submitted actions (kept for backward compat) ───────
      const submittedActions = await getSubmittedActions(base44, campaign_id, targetRound, targetPhase, playerMap);

      // ── Generated artifacts ─────────────────────────────────────────────
      const generatedArtifacts = await getGeneratedArtifacts(base44, campaign_id, targetRound, playerMap);

      // ── Battle resolution audit ─────────────────────────────────────────
      let battleAudit = [];
      try {
        battleAudit = await getBattleResolutionAudit(base44, campaign_id, targetRound, playerMap);
        diagnostics.battle_audit_generation = 'success';
      } catch (e) {
        diagnostics.battle_audit_generation = `error: ${e.message}`;
      }

      // ── Delta: compare true before vs true after ────────────────────────
      let deltaReport = { troop_deltas: [], resource_deltas: [], permanent_influence_deltas: [], spendable_influence_deltas: [], victory_score_deltas: [], structure_changes: [], battle_card_changes: [], trade_state_changes: [], phase_lock_changes: [] };
      try {
        deltaReport = calcDeltas(beforeSnapshotData, afterSnapshotData, playerMap);
        diagnostics.delta_generation = 'success';
      } catch (e) {
        diagnostics.delta_generation = `error: ${e.message}`;
      }

      // ── Ownership changes with cause attribution ────────────────────────
      const ownershipChanges = (deltaReport.troop_deltas ?? [])
        .filter(d => d.ownership_changed)
        .map(d => {
          // Try to find which battle card caused this ownership change
          const battle = battleAudit.find(b =>
            b.target?.territory_id === d.territory_id && b.ending_state?.owner_player_id === (d.owner_after ? players.find(p => p.display_name === d.owner_after)?.id : null)
          );
          // Try to find which attack caused it
          const attack = enrichedActions.military.find(a =>
            a.action_type === 'attack' && a.target?.territory_id === d.territory_id
          );
          const cause = battle
            ? `${battle.battle_type.replace(/_/g, ' ')} — ${battle.winner ?? 'unknown'} won`
            : (attack ? `attack by ${attack.player}` : 'unknown');
          return {
            territory:    d.territory_name ?? d.territory_id,
            territory_id: d.territory_id,
            from:         d.owner_before ?? 'unoccupied',
            to:           d.owner_after  ?? 'unoccupied',
            cause,
          };
        });

      // ── Validation warnings ─────────────────────────────────────────────
      const validationWarnings = [];
      let exportValidationStatus = 'passed';

      if (diagnostics.before_snapshot_source.includes('missing')) {
        validationWarnings.push({ type: 'before_snapshot_not_authoritative', severity: 'high',
          message: 'No stored before-snapshot found. Before snapshot reflects current live state.' });
        exportValidationStatus = 'failed';
      }
      if (diagnostics.after_snapshot_source.includes('missing')) {
        validationWarnings.push({ type: 'after_snapshot_not_authoritative', severity: 'high',
          message: 'No stored after-snapshot found. After snapshot reflects current live state.' });
        exportValidationStatus = 'failed';
      }

      // Ownership changed but no ownership_changes populated
      const troopDeltasWithOwnerChange = (deltaReport.troop_deltas ?? []).filter(d => d.ownership_changed);
      if (troopDeltasWithOwnerChange.length > 0 && ownershipChanges.length === 0) {
        validationWarnings.push({ type: 'ownership_changes_expected_but_empty', severity: 'medium',
          message: `${troopDeltasWithOwnerChange.length} territory ownership change(s) detected but no changes populated.` });
      }

      // Troop changes but empty troop_deltas
      const troopDeltasNonZero = (deltaReport.troop_deltas ?? []).filter(d => d.troop_delta !== 0);
      if (troopDeltasNonZero.length === 0 && enrichedActions.military.some(a => a.action_type === 'deploy_troops' || a.action_type === 'attack')) {
        validationWarnings.push({ type: 'troop_changes_expected_but_empty', severity: 'medium',
          message: 'Military actions submitted but no troop deltas detected. Snapshots may not be authoritative.' });
      }

      // Battle resolved but no battle_results
      const resolvedBattleCount = battleAudit.filter(b => b.resolution?.applied_at).length;
      if (resolvedBattleCount > 0 && battleAudit.length === 0) {
        validationWarnings.push({ type: 'battle_results_expected_but_empty', severity: 'high',
          message: 'Battle cards resolved but battle_results is empty.' });
        exportValidationStatus = 'failed';
      }

      // Phase lock missing for any active player
      const activePlayers = players.filter(p => !p.is_eliminated);

      // Negative resources
      for (const t of (afterSnapshotData.territory_states ?? [])) {
        for (const [res, val] of Object.entries(t.resource_storage ?? {})) {
          if ((val ?? 0) < 0) {
            validationWarnings.push({ type: 'resource_total_negative', ...tEnrich(t.territory_id), resource: res, value: val, severity: 'high' });
            exportValidationStatus = 'failed';
          }
        }
      }
      for (const p of (afterSnapshotData.spendable_influence ?? [])) {
        if ((p.spendable_influence ?? 0) < 0) {
          validationWarnings.push({ type: 'spendable_influence_negative', player_id: p.player_id, player_name: p.player_name, region_id: p.region_id, value: p.spendable_influence, severity: 'high' });
          exportValidationStatus = 'failed';
        }
      }

      // delta_generation or battle_audit errors
      if (diagnostics.delta_generation !== 'success') exportValidationStatus = 'failed';
      if (diagnostics.battle_audit_generation !== 'success') exportValidationStatus = 'warning';

      diagnostics.export_validation = exportValidationStatus;

      // ── Assemble bundle ─────────────────────────────────────────────────
      const bundleStatus = isCurrentPhase ? 'in_progress' : 'completed';

      const bundle = {
        metadata: {
          campaign_id,
          campaign_name: campaign.name,
          round_number: targetRound,
          phase: targetPhase,
          phase_label: PHASE_LABELS[targetPhase] ?? targetPhase,
          export_generated_at: new Date().toISOString(),
          exported_by_player_id: players.find(p => p.user_id === user.id)?.id ?? user.id,
          exported_by_user_id: user.id,
          exported_by_name: user.full_name ?? user.email,
          bundle_status: bundleStatus,
          game_version: '5F.2',
          active_win_conditions: campaign.settings?.active_win_conditions ?? [],
          phase_started_at:              phaseStartedAt,
          phase_completed_at:            phaseCompletedAt,
          before_snapshot_captured_at:   beforeCapturedAt,
          after_snapshot_captured_at:    afterCapturedAt,
          snapshot_status: {
            before_snapshot:        beforeSource,
            after_snapshot:         afterSource,
            phase_completion_state: phaseCompletionState,
            delta_report:           isCurrentPhase ? 'preliminary' : (diagnostics.delta_generation === 'success' ? 'authoritative' : 'error'),
          },
          export_validation: exportValidationStatus,
        },

        diagnostics,

        before_snapshot: beforeSnapshotData,

        submitted_actions: {
          military:   enrichedActions.military,
          economic:   enrichedActions.economic,
          diplomatic: enrichedActions.diplomatic,
          all:        enrichedActions.all,
          _legacy:    submittedActions,
        },

        generated_artifacts: generatedArtifacts,

        battle_results: battleAudit,

        resolution_results: {
          ownership_changes:           ownershipChanges,
          troop_movements:             troopDeltasNonZero,
          resource_changes:            deltaReport.resource_deltas ?? [],
          influence_changes:           [...(deltaReport.permanent_influence_deltas ?? []), ...(deltaReport.spendable_influence_deltas ?? [])],
          structure_changes:           deltaReport.structure_changes ?? [],
          battle_card_changes:         deltaReport.battle_card_changes ?? [],
          trade_results:               deltaReport.trade_state_changes ?? [],
          victory_score_changes:       deltaReport.victory_score_deltas ?? [],
        },

        after_snapshot: afterSnapshotData,

        delta_report: deltaReport,

        validation_warnings: validationWarnings,
      };

      return Response.json({ success: true, bundle });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});