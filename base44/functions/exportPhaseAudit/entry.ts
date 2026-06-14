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
// Takes pre-fetched data instead of re-querying — called with cached results.

function buildSnapshotFromData({
  territories, influence, regionalPools, supplyRoutes,
  buildings, battleCards, tradeProposals, objectives,
  victoryTrackers, phaseDecisions,
}, playerMap) {

  return {
    territory_states: (territories ?? []).map(t => ({
      ...tEnrich(t.territory_id),
      owner_player_id: t.owner_player_id ?? null,
      owner_name: t.owner_player_id ? (playerMap[t.owner_player_id]?.display_name ?? t.owner_player_id) : null,
      troop_count: t.troop_count ?? 0,
      resource_storage: t.resource_storage ?? {},
      has_resource_hub: t.has_resource_hub ?? false,
      structures: t.structures ?? [],
    })),
    permanent_influence: (influence ?? []).map(i => ({
      ...tEnrich(i.territory_id),
      player_id: i.player_id,
      player_name: playerMap[i.player_id]?.display_name ?? i.player_id,
      influence_amount: i.influence_amount ?? 0,
    })),
    spendable_influence: (regionalPools ?? []).map(p => ({
      region_id: p.region_id,
      player_id: p.player_id,
      player_name: playerMap[p.player_id]?.display_name ?? p.player_id,
      spendable_influence: p.spendable_influence ?? 0,
    })),
    buildings: (buildings ?? []).map(b => ({
      ...tEnrich(b.territory_id),
      player_id: b.player_id,
      player_name: playerMap[b.player_id]?.display_name ?? b.player_id,
      building_type: b.building_type,
      pillar_type: b.pillar_type,
      status: b.status,
      started_round: b.started_round,
      completed_round: b.completed_round,
    })),
    supply_routes: (supplyRoutes ?? []).map(r => ({
      id: r.id,
      owner_player_id: r.owner_player_id,
      owner_name: playerMap[r.owner_player_id]?.display_name ?? r.owner_player_id,
      hub: tEnrich(r.hub_territory_id),
      source: tEnrich(r.source_territory_id),
      route_status: r.route_status,
      resource_type: r.resource_type,
      created_round: r.created_round,
    })),
    battle_cards: (battleCards ?? []).map(bc => ({
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
    })),
    trade_proposals: (tradeProposals ?? []).filter(a => a.action_type === 'trade_proposal').map(a => ({
      id: a.id,
      round: a.round,
      proposer_player_id: a.player_id,
      proposer_name: playerMap[a.player_id]?.display_name ?? a.player_id,
      target_player_id: a.target_player_id,
      target_name: a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
      status: a.status,
      offer: a.effect_metadata?.offer ?? {},
      request: a.effect_metadata?.request ?? {},
    })),
    objectives: (objectives ?? []).map(o => ({
      player_id: o.player_id,
      player_name: playerMap[o.player_id]?.display_name ?? o.player_id,
      global_influence: o.global_influence ?? 0,
      objective_cards: o.objective_cards_json ?? {},
      updated_at_round: o.updated_at_round,
    })),
    victory_scores: (victoryTrackers ?? []).map(v => ({
      player_id: v.player_id,
      player_name: playerMap[v.player_id]?.display_name ?? v.player_id,
      occupancy_score: v.occupancy_score ?? 0,
      wealth_score: v.wealth_score ?? 0,
      influence_score: v.influence_score ?? 0,
      has_won: v.has_won ?? false,
      winning_condition: v.winning_condition ?? null,
    })),
    phase_lock_states: (phaseDecisions ?? []).map(pd => ({
      player_id: pd.player_id,
      player_name: playerMap[pd.player_id]?.display_name ?? pd.player_id,
      phase: pd.phase,
      round: pd.round,
      is_locked: pd.is_locked ?? false,
      locked_at: pd.locked_at ?? null,
    })),
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

const PHASE_ORDER = ['faction_selection', 'territory_draft', 'initial_deploy', 'deploy', 'attack', 'battle', 'fortify'];
function nextPhase(phase) {
  const idx = PHASE_ORDER.indexOf(phase);
  return (idx < 0 || idx >= PHASE_ORDER.length - 1) ? null : PHASE_ORDER[idx + 1];
}

const BEFORE_TYPES = new Set(['before', 'start', 'phase_start', 'phase_before']);
const AFTER_TYPES  = new Set(['after', 'end', 'phase_end', 'phase_after']);

// ── Battle Resolution Audit (uses pre-fetched allBattleCards + attackReveals) ─

function getBattleResolutionAudit(allBattleCards, playerMap, attackReveals) {
  // Build a lookup: origin→target→attack_id from AttackReveal records (which carry the stable attack_id)
  const attackIdLookup = {};
  for (const ar of (attackReveals ?? [])) {
    if (ar.attack_id) {
      const key = `${ar.player_id}|${ar.origin_territory_id}|${ar.target_territory_id}`;
      attackIdLookup[key] = ar.attack_id;
    }
  }
  const resolved = allBattleCards.filter(bc => bc.result_applied === true);
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
      source_player_id: bc.source_player_id ?? attackerEntries[0]?.player_id ?? null,
      source_player_name: (() => {
        const sid = bc.source_player_id ?? attackerEntries[0]?.player_id ?? null;
        return sid ? (playerMap[sid]?.display_name ?? sid) : null;
      })(),
      origin_action_id:   (() => {
        // 1. Prefer what's stored directly on the battle card metadata
        if (bc.source_operation_metadata?.origin_action_id) return bc.source_operation_metadata.origin_action_id;
        // 2. Check attack_id on the primary attacker entry (stored since 5H.1)
        const primaryAtk = (bc.attackers ?? [])[0];
        if (primaryAtk?.attack_id) return primaryAtk.attack_id;
        // 3. Fall back: look up via AttackReveal records
        if (primaryAtk) {
          const key = `${primaryAtk.player_id}|${primaryAtk.origin_territory_id}|${bc.target_territory_id}`;
          if (attackIdLookup[key]) return attackIdLookup[key];
        }
        return null;
      })(),
      origin_action_type: bc.source_operation_metadata?.origin_action_type ?? bc.battle_card_source ?? 'military_attack',
      origin_phase:       bc.source_operation_metadata?.origin_phase ?? (bc.battle_card_source === 'military_attack' ? 'attack' : 'attack'),
      origin_round:       bc.source_operation_metadata?.origin_round ?? bc.round ?? null,
      result_applied:     bc.result_applied ?? false,
      lifecycle: {
        origin_action_id:   (() => {
          if (bc.source_operation_metadata?.origin_action_id) return bc.source_operation_metadata.origin_action_id;
          const primaryAtk = (bc.attackers ?? [])[0];
          if (primaryAtk?.attack_id) return primaryAtk.attack_id;
          if (primaryAtk) {
            const key = `${primaryAtk.player_id}|${primaryAtk.origin_territory_id}|${bc.target_territory_id}`;
            if (attackIdLookup[key]) return attackIdLookup[key];
          }
          return null;
        })(),
        battle_card_id:     bc.id,
        resolution_id:      bc.result?.applied_at ? `res_${bc.id}` : null,
        ownership_change_id: (bc.result_applied && bc.result?.winner_player_id && bc.result?.winner_player_id !== bc.defender_player_id) ? `own_${bc.id}` : null,
      },
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
        troops: (() => {
          // winner_bop_survivors is written by battlePhase since 5F.8.
          // For older cards that lack it, compute it inline from TT survivors.
          if (result.winner_bop_survivors != null) return result.winner_bop_survivors;
          if (!winnerPlayerId) return null;
          const committedBOP = (bc.attackers ?? []).filter(a => a.player_id === winnerPlayerId).reduce((s, a) => s + (a.committed_troops ?? 0), 0) || (bc.defender_player_id === winnerPlayerId ? (bc.defender_troops ?? 0) : 0);
          const survivingTT = result.surviving_tabletop_troops ?? 0;
          const tabletopSz  = bc.tabletop_size ?? 0;
          const totalTroops = bc.total_troops_in_battle ?? 0;
          if (tabletopSz <= 0) return committedBOP;
          const ratio = Math.max(0, Math.min(1, survivingTT / tabletopSz));
          const raw   = Math.round(ratio * totalTroops);
          return committedBOP > 0 ? Math.min(raw, committedBOP) : raw;
        })(),
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
      combat_source_trace: bc.result?.combat_source_trace ?? null,
    });
  }

  return audit;
}

// ── Phase category helper ─────────────────────────────────────────────────────
function phaseCategory(phase) {
  if (phase === 'deploy')  return 'planning';
  if (phase === 'attack')  return 'operations';
  if (phase === 'battle')  return 'conflict';
  if (phase === 'fortify') return 'consolidation';
  return 'other';
}

// ── Build enriched submitted actions — strictly filtered to the selected phase ──

function buildEnrichedActions(cache, phase, round, playerMap) {
  const category = phaseCategory(phase);
  const military = [];
  const economic = [];
  const diplomatic = [];

  // ── PLANNING (deploy) ─────────────────────────────────────────────────────
  if (category === 'planning') {
    // Troop deployments
    for (const d of (cache.phaseDecisions ?? []).filter(d => d.phase === 'deploy')) {
      const placements = d.data?.placements ?? {};
      const total = Object.values(placements).reduce((s, v) => s + (v || 0), 0);
      if (total > 0) {
        military.push({
          pillar: 'military', action_type: 'deploy_troops',
          player_id: d.player_id, player: playerMap[d.player_id]?.display_name ?? d.player_id,
          territories_placed: Object.entries(placements).map(([tid, cnt]) => ({ ...tEnrich(tid), troops: cnt })),
          total_troops: total, is_auto_submitted: d.is_auto_submitted ?? false,
          locked_at: d.locked_at ?? null, timestamp: d.locked_at ?? d.updated_date ?? null, round, phase,
        });
      }
    }

    // Resource activations — prefer planning_phase_locked log details, then resource_activations_locked fallback
    const planningLockLogMap = {};
    for (const l of (cache.phaseLogs ?? [])) {
      if (l.event_type === 'planning_phase_locked' && l.player_id) {
        const details = l.payload?.results?.economic?.activation_details ?? [];
        if (details.length > 0) planningLockLogMap[l.player_id] = details;
      }
    }
    const activationLogMap = {};
    for (const l of (cache.phaseLogs ?? [])) {
      if (l.event_type === 'resource_activations_locked' && l.player_id) {
        const details = l.payload?.activation_details ?? [];
        if (details.length > 0) activationLogMap[l.player_id] = details;
      }
    }
    for (const d of (cache.phaseDecisions ?? []).filter(d => d.phase === 'planning_stage')) {
      const staged = d.data?.economic_staged ?? [];
      if (staged.length > 0) {
        const details = planningLockLogMap[d.player_id] ?? activationLogMap[d.player_id] ?? [];
        economic.push({
          pillar: 'economic', action_type: 'activate_resources',
          player_id: d.player_id, player: playerMap[d.player_id]?.display_name ?? d.player_id,
          territories: staged.map(tid => tEnrich(tid)), territory_count: staged.length,
          activation_details: details.map(a => ({
            player_id: a.player_id ?? d.player_id,
            player_name: playerMap[a.player_id ?? d.player_id]?.display_name ?? (a.player_id ?? d.player_id),
            ...tEnrich(a.territory_id),
            territory_name: tName(a.territory_id),
            resource_type: a.resource_type,
            amount_generated: a.amount_generated ?? 1,
            before_amount: a.before_amount ?? 0,
            after_amount: a.after_amount ?? 0,
            storage_before: a.storage_before ?? {},
            storage_after: a.storage_after ?? {},
          })),
          timestamp: d.data?.locked_at ?? d.updated_date ?? null, round, phase,
        });
      }
    }

    // Objective keep/discard from planning lock log
    for (const l of (cache.phaseLogs ?? [])) {
      if (l.event_type === 'planning_phase_locked' && l.player_id) {
        const dip = l.payload?.results?.diplomatic;
        if (dip && !dip.skipped) {
          diplomatic.push({
            pillar: 'diplomatic', action_type: 'objective_keep',
            player_id: l.player_id, player: playerMap[l.player_id]?.display_name ?? l.player_id,
            kept_card_id: dip.kept, discarded_cards: dip.discarded ?? [],
            timestamp: l.created_date ?? null, round, phase,
          });
        }
      }
    }
  }

  // ── OPERATIONS (attack) ───────────────────────────────────────────────────
  if (category === 'operations') {
    // Accepted attacks
    for (const a of (cache.attackReveals ?? [])) {
      military.push({
        pillar: 'military', action_type: 'attack', validation_result: 'accepted',
        player_id: a.player_id, player: playerMap[a.player_id]?.display_name ?? a.player_id,
        source: tEnrich(a.origin_territory_id), target: tEnrich(a.target_territory_id),
        troops: a.committed_troops ?? 0, timestamp: a.created_date ?? null, round, phase,
      });
    }
    // Rejected attacks
    for (const l of (cache.phaseLogs ?? [])) {
      if (l.event_type === 'attacks_rejected_at_resolution' && l.payload?.rejected) {
        for (const r of l.payload.rejected) {
          military.push({
            pillar: 'military', action_type: 'attack', validation_result: 'rejected',
            rejection_reason: r.rejection_reason,
            player_id: r.player_id, player: playerMap[r.player_id]?.display_name ?? r.player_id,
            source: tEnrich(r.origin_territory_id), target: tEnrich(r.target_territory_id),
            troops: r.committed_troops ?? 0, timestamp: l.created_date ?? null, round, phase,
          });
        }
      }
    }
    // Construction staged during Operations
    for (const d of (cache.phaseDecisions ?? []).filter(d => d.phase === 'ops_stage' || d.phase === 'attack')) {
      const con = d.data?.construction;
      if (con?.territory_id) {
        economic.push({
          pillar: 'economic', action_type: 'start_construction',
          player_id: d.player_id, player: playerMap[d.player_id]?.display_name ?? d.player_id,
          territory: tEnrich(con.territory_id), building_type: con.structure_type ?? con.building_type, pillar_type: con.pillar,
          timestamp: con.staged_at ?? d.locked_at ?? null, round, phase,
        });
      }
    }
    // Influence / intelligence actions from Operations
    for (const a of (cache.dipActions ?? [])) {
      diplomatic.push({
        pillar: 'diplomatic', action_type: a.action_type,
        player_id: a.player_id, player: playerMap[a.player_id]?.display_name ?? a.player_id,
        region_id: a.region_id, influence_spent: a.influence_spent ?? 0,
        target_territory: a.target_territory_id ? tEnrich(a.target_territory_id) : null,
        target_player_id: a.target_player_id ?? null,
        target_player: a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
        status: a.status, timestamp: a.created_date ?? null, round, phase,
      });
    }
    for (const r of (cache.intelReports ?? [])) {
      diplomatic.push({
        pillar: 'diplomatic', action_type: r.report_type,
        player_id: r.viewer_player_id, player: playerMap[r.viewer_player_id]?.display_name ?? r.viewer_player_id,
        target_territory: r.target_territory_id ? tEnrich(r.target_territory_id) : null,
        target_player_id: r.target_player_id ?? null,
        target_player: r.target_player_id ? (playerMap[r.target_player_id]?.display_name ?? r.target_player_id) : null,
        influence_spent: r.influence_spent ?? 0, generated_phase: r.generated_phase,
        timestamp: r.generated_at ?? r.created_date ?? null, round, phase,
      });
    }
  }

  // ── CONFLICT (battle) ─────────────────────────────────────────────────────
  if (category === 'conflict') {
    // Battle preference votes
    for (const bc of (cache.allBattleCards ?? [])) {
      if (bc.battle_preferences && Object.keys(bc.battle_preferences).length > 0) {
        for (const [pid, pref] of Object.entries(bc.battle_preferences)) {
          military.push({
            pillar: 'military', action_type: 'battle_preference_vote',
            player_id: pid, player: playerMap[pid]?.display_name ?? pid,
            battle_card_id: bc.id, battle_type: bc.battle_type,
            target: tEnrich(bc.target_territory_id), preference: pref,
            timestamp: bc.voting_closes_at ?? null, round, phase,
          });
        }
      }
    }
  }

  // ── CONSOLIDATION (fortify) ───────────────────────────────────────────────
  if (category === 'consolidation') {
    for (const d of (cache.phaseDecisions ?? []).filter(d => d.phase === 'fortify')) {
      for (const m of (d.data?.movements ?? [])) {
        military.push({
          pillar: 'military', action_type: 'fortify',
          player_id: d.player_id, player: playerMap[d.player_id]?.display_name ?? d.player_id,
          source: tEnrich(m.origin_territory_id), target: tEnrich(m.destination_territory_id),
          troops: m.committed_troops ?? 0, timestamp: d.locked_at ?? d.updated_date ?? null, round, phase,
        });
      }
      const con = d.data?.construction;
      if (con?.territory_id) {
        economic.push({
          pillar: 'economic', action_type: 'start_construction',
          player_id: d.player_id, player: playerMap[d.player_id]?.display_name ?? d.player_id,
          territory: tEnrich(con.territory_id), building_type: con.structure_type, pillar_type: con.pillar,
          timestamp: con.staged_at ?? d.locked_at ?? null, round, phase,
        });
      }
      for (const c of (d.data?.caravans ?? [])) {
        economic.push({
          pillar: 'economic', action_type: 'caravan',
          player_id: d.player_id, player: playerMap[d.player_id]?.display_name ?? d.player_id,
          source: tEnrich(c.origin_territory_id), target: tEnrich(c.destination_territory_id),
          resources: c.resources ?? {}, timestamp: d.locked_at ?? d.updated_date ?? null, round, phase,
        });
      }
    }
    for (const a of (cache.dipActions ?? [])) {
      diplomatic.push({
        pillar: 'diplomatic', action_type: a.action_type,
        player_id: a.player_id, player: playerMap[a.player_id]?.display_name ?? a.player_id,
        region_id: a.region_id, influence_spent: a.influence_spent ?? 0,
        target_territory: a.target_territory_id ? tEnrich(a.target_territory_id) : null,
        target_player_id: a.target_player_id ?? null,
        target_player: a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
        status: a.status, timestamp: a.created_date ?? null, round, phase,
      });
    }
  }

  return { military, economic, diplomatic, all: [...military, ...economic, ...diplomatic] };
}

// ── Build generated artifacts from pre-fetched cache ─────────────────────────

function buildGeneratedArtifacts(cache, round, playerMap) {
  const battleCards = cache.allBattleCards ?? [];
  const dipActions  = cache.dipActions ?? [];
  const intelReports = cache.intelReports ?? [];
  const supplyRoutes = (cache.supplyRoutes ?? []).filter(r => r.created_round === round);
  const buildings    = (cache.buildings ?? []).filter(b => b.started_round === round);

  return {
    battle_cards_generated: battleCards.map(bc => ({
      id: bc.id, battle_type: bc.battle_type, battle_pillar: bc.battle_pillar,
      target: tEnrich(bc.target_territory_id),
      source_player_id: bc.source_player_id ?? null,
      source_player_name: (() => {
        const sid = bc.source_player_id ?? bc.attackers?.[0]?.player_id ?? null;
        return sid ? (playerMap[sid]?.display_name ?? sid) : null;
      })(),
      origin_action_id:   (() => {
        if (bc.source_operation_metadata?.origin_action_id) return bc.source_operation_metadata.origin_action_id;
        const primaryAtk = (bc.attackers ?? [])[0];
        if (primaryAtk?.attack_id) return primaryAtk.attack_id;
        if (primaryAtk) {
          for (const ar of (cache.attackReveals ?? [])) {
            if (ar.attack_id && ar.player_id === primaryAtk.player_id &&
                ar.origin_territory_id === primaryAtk.origin_territory_id &&
                ar.target_territory_id === bc.target_territory_id) return ar.attack_id;
          }
        }
        return null;
      })(),
      origin_action_type: bc.source_operation_metadata?.origin_action_type ?? bc.battle_card_source ?? null,
      origin_phase:       bc.source_operation_metadata?.origin_phase ?? (bc.battle_card_source === 'military_attack' ? 'attack' : null),
      origin_round:       bc.source_operation_metadata?.origin_round ?? bc.round ?? null,
      status: bc.status,
    })),
    trade_proposals_generated: dipActions.filter(a => a.action_type === 'trade_proposal').map(a => ({
      id: a.id, proposer_player_id: a.player_id,
      proposer_name: playerMap[a.player_id]?.display_name ?? a.player_id,
      target_player_id: a.target_player_id,
      target_name: a.target_player_id ? (playerMap[a.target_player_id]?.display_name ?? a.target_player_id) : null,
      status: a.status,
    })),
    intelligence_reports_generated: intelReports.map(r => ({
      id: r.id, report_type: r.report_type, viewer_player_id: r.viewer_player_id,
      viewer_name: playerMap[r.viewer_player_id]?.display_name ?? r.viewer_player_id,
      target: r.target_territory_id ? tEnrich(r.target_territory_id) : null,
      generated_phase: r.generated_phase,
    })),
    supply_routes_created: supplyRoutes.map(r => ({
      id: r.id, owner_name: playerMap[r.owner_player_id]?.display_name ?? r.owner_player_id,
      hub: tEnrich(r.hub_territory_id), source: tEnrich(r.source_territory_id), resource_type: r.resource_type,
    })),
    buildings_started: buildings.map(b => ({
      ...tEnrich(b.territory_id), player_name: playerMap[b.player_id]?.display_name ?? b.player_id,
      building_type: b.building_type, pillar_type: b.pillar_type, status: b.status,
    })),
    diplomatic_effects_created: dipActions.filter(a => a.action_type !== 'trade_proposal').map(a => ({
      id: a.id, action_type: a.action_type, player_name: playerMap[a.player_id]?.display_name ?? a.player_id,
      region_id: a.region_id, influence_spent: a.influence_spent ?? 0, status: a.status,
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
        before_snapshot_source:   'pending',
        after_snapshot_source:    'pending',
        delta_generation:         'pending',
        battle_audit_generation:  'pending',
        action_log_generation:    'pending',
        battle_validation_skipped: false,
        battle_validation_reason:  null,
      };

      // ── SINGLE BULK FETCH — all DB queries in one Promise.all ───────────
      // This eliminates rate-limit issues by batching every query together.
      const nextPhaseName = nextPhase(targetPhase);
      const [
        territories, influence, regionalPools, supplyRoutes,
        allBuildings, allBattleCards, dipActions, objectives,
        victoryTrackers, phaseDecisions,
        storedSnapshots,
        nextPhaseSnapshots,
        nextRoundSnapshots,
        phaseLogs,
        attackReveals,
        intelReports,
        territoryDevelopment,
      ] = await Promise.all([
        base44.asServiceRole.entities.TerritoryState.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryInfluence.filter({ campaign_id }),
        base44.asServiceRole.entities.RegionalInfluencePool.filter({ campaign_id }),
        base44.asServiceRole.entities.SupplyRoute.filter({ campaign_id }),
        base44.asServiceRole.entities.TerritoryBuilding.filter({ campaign_id }),
        base44.asServiceRole.entities.BattleCard.filter({ campaign_id, round: targetRound }),
        base44.asServiceRole.entities.DiplomaticAction.filter({ campaign_id, round: targetRound }),
        base44.asServiceRole.entities.PlayerInfluenceLedger.filter({ campaign_id }),
        base44.asServiceRole.entities.VictoryTracker.filter({ campaign_id }),
        base44.asServiceRole.entities.PhaseDecision.filter({ campaign_id, round: targetRound }),
        base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id, round: targetRound, phase: targetPhase }),
        nextPhaseName
          ? base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id, round: targetRound, phase: nextPhaseName })
          : Promise.resolve([]),
        targetPhase === 'fortify'
          ? base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id, round: targetRound + 1, phase: 'deploy' })
          : Promise.resolve([]),
        base44.asServiceRole.entities.SetupLog.filter({ campaign_id, phase: targetPhase, round: targetRound }),
        base44.asServiceRole.entities.AttackReveal.filter({ campaign_id, round: targetRound }),
        base44.asServiceRole.entities.IntelligenceReport.filter({ campaign_id, generated_round: targetRound }),
        base44.asServiceRole.entities.TerritoryDevelopment.filter({ campaign_id }),
      ]);

      // Build a cache object for helper functions
      const cache = {
        territories, influence, regionalPools, supplyRoutes,
        buildings: allBuildings, allBattleCards, dipActions, objectives,
        victoryTrackers, phaseDecisions, attackReveals, intelReports,
        territoryDevelopment,
      };

      // ── Build territory development section ──────────────────────────────
      // TerritoryDevelopment records are not stored in PhaseSnapshot — we always
      // layer them in from the live DB state, flagged as live_overlay.
      const SC_MAP_SLOTS = {
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

      function buildDevSection(devRecords, pMap) {
        return devRecords.map(d => {
          const devLevel = d.development_level ?? 1;
          const mapSlots = SC_MAP_SLOTS[d.territory_id] ?? [];
          // Slot breakdown: 1 base omni slot always; map slots unlock at levels 3, 5+
          const baseSlots = [{ type: 'omni', source: 'base', unlocked: true }];
          const mapSlotEntries = mapSlots.map((slotType, idx) => {
            const requiredLevel = idx === 0 ? 3 : (idx === 1 ? 5 : 7);
            return {
              type: slotType,
              source: 'map_defined',
              index: idx,
              required_level: requiredLevel,
              unlocked: devLevel >= requiredLevel,
            };
          });
          const allSlots = [...baseSlots, ...mapSlotEntries];
          return {
            ...tEnrich(d.territory_id),
            owner_player_id: d.owner_player_id ?? null,
            owner_name: d.owner_player_id ? (pMap[d.owner_player_id]?.display_name ?? d.owner_player_id) : null,
            is_capital: d.is_capital ?? false,
            capital_set_round: d.capital_set_round ?? null,
            development_level: devLevel,
            development_progress: d.development_progress ?? 0,
            food_to_next_level: d.food_to_next_level ?? 3,
            total_food_invested: d.total_food_invested ?? 0,
            unlocked_resources: d.unlocked_resources ?? ['primary'],
            unlocked_slot_count: d.unlocked_slot_count ?? 1,
            last_updated_round: d.last_updated_round ?? 0,
            slots: allSlots,
            slots_unlocked: allSlots.filter(s => s.unlocked).length,
            slots_locked: allSlots.filter(s => !s.unlocked).length,
            data_source: 'live_overlay',
          };
        });
      }

      const developmentSection = buildDevSection(territoryDevelopment, playerMap);

      // Per-player development summary
      const devByPlayer = {};
      for (const d of developmentSection) {
        if (!d.owner_player_id) continue;
        if (!devByPlayer[d.owner_player_id]) {
          devByPlayer[d.owner_player_id] = {
            player_id: d.owner_player_id,
            player_name: d.owner_name,
            capital_territory_id: null,
            total_food_invested: 0,
            territories: [],
          };
        }
        devByPlayer[d.owner_player_id].total_food_invested += d.total_food_invested;
        devByPlayer[d.owner_player_id].territories.push(d);
        if (d.is_capital) devByPlayer[d.owner_player_id].capital_territory_id = d.territory_id;
      }
      const devPlayerSummaries = Object.values(devByPlayer);

      // Dev-level deltas: compare last_updated_round to detect changes this round
      const devDeltas = developmentSection.filter(d => d.last_updated_round === targetRound).map(d => ({
        ...tEnrich(d.territory_id),
        owner_player_id: d.owner_player_id,
        owner_name: d.owner_name,
        development_level: d.development_level,
        food_invested_total: d.total_food_invested,
        is_capital: d.is_capital,
        unlocked_resources: d.unlocked_resources,
        unlocked_slot_count: d.unlocked_slot_count,
        note: `Updated in round ${targetRound}`,
      }));

      // Build live snapshot from cached data
      const liveSnapshot = buildSnapshotFromData(cache, playerMap);

      // Resolve phase snapshots
      const beforeRecord = storedSnapshots.find(s => BEFORE_TYPES.has(s.snapshot_type ?? s.type));
      // For deploy/planning phase: multiple phase_end snapshots can exist (one per player lock).
      // Pick the latest one (highest created_date) so it reflects the most complete post-activation state.
      const afterCandidates = storedSnapshots.filter(s => AFTER_TYPES.has(s.snapshot_type ?? s.type));
      const afterRecord = afterCandidates.length > 0
        ? afterCandidates.sort((a, b) => new Date(b.created_date ?? 0) - new Date(a.created_date ?? 0))[0]
        : null;
      const nextPhaseBeforeRecord = [...nextPhaseSnapshots, ...nextRoundSnapshots]
        .find(s => BEFORE_TYPES.has(s.snapshot_type ?? s.type)) ?? null;

      // ── Helpers: enrich a stored snapshot with canonical names ──────────────
      // Stored snapshots contain raw IDs. We layer on canonical display names.
      // NEVER merges with live state — if a field is absent in the stored record it stays absent.
      function enrichStoredSnapshot(stored, pMap) {
        if (!stored || typeof stored !== 'object') return stored;
        const enriched = { ...stored };

        // Territory states — add canonical names
        if (Array.isArray(stored.territory_states)) {
          enriched.territory_states = stored.territory_states.map(t => ({
            ...tEnrich(t.territory_id),
            owner_player_id:  t.owner_player_id ?? null,
            owner_name:       t.owner_player_id ? (pMap[t.owner_player_id]?.display_name ?? t.owner_player_id) : null,
            troop_count:      t.troop_count ?? 0,
            resource_storage: t.resource_storage ?? {},
            has_resource_hub: t.has_resource_hub ?? false,
            structures:       t.structures ?? [],
            resource_type:    t.resource_type ?? null,
          }));
        }

        // Permanent influence — add canonical names
        if (Array.isArray(stored.permanent_influence)) {
          enriched.permanent_influence = stored.permanent_influence.map(i => ({
            ...tEnrich(i.territory_id),
            player_id:        i.player_id,
            player_name:      pMap[i.player_id]?.display_name ?? i.player_id,
            influence_amount: i.influence_amount ?? 0,
          }));
        }

        // Spendable influence — add player names
        if (Array.isArray(stored.spendable_influence)) {
          enriched.spendable_influence = stored.spendable_influence.map(p => ({
            region_id:           p.region_id,
            player_id:           p.player_id,
            player_name:         pMap[p.player_id]?.display_name ?? p.player_id,
            spendable_influence: p.spendable_influence ?? 0,
          }));
        }

        // Buildings — add canonical names
        if (Array.isArray(stored.buildings)) {
          enriched.buildings = stored.buildings.map(b => ({
            ...tEnrich(b.territory_id),
            player_id:       b.player_id,
            player_name:     pMap[b.player_id]?.display_name ?? b.player_id,
            building_type:   b.building_type,
            pillar_type:     b.pillar_type,
            status:          b.status,
            started_round:   b.started_round,
            completed_round: b.completed_round,
          }));
        }

        // Supply routes — add canonical names
        if (Array.isArray(stored.supply_routes)) {
          enriched.supply_routes = stored.supply_routes.map(r => ({
            id:            r.id,
            owner_player_id: r.owner_player_id,
            owner_name:    pMap[r.owner_player_id]?.display_name ?? r.owner_player_id,
            hub:           tEnrich(r.hub_territory_id),
            source:        tEnrich(r.source_territory_id),
            route_status:  r.route_status,
            resource_type: r.resource_type,
            created_round: r.created_round,
          }));
        }

        // Objectives — add player names
        if (Array.isArray(stored.objectives)) {
          enriched.objectives = stored.objectives.map(o => ({
            player_id:        o.player_id,
            player_name:      pMap[o.player_id]?.display_name ?? o.player_id,
            global_influence: o.global_influence ?? 0,
            objective_cards:  o.objective_cards ?? {},
          }));
        }

        // Victory scores — add player names
        if (Array.isArray(stored.victory_scores)) {
          enriched.victory_scores = stored.victory_scores.map(v => ({
            player_id:         v.player_id,
            player_name:       pMap[v.player_id]?.display_name ?? v.player_id,
            occupancy_score:   v.occupancy_score ?? 0,
            wealth_score:      v.wealth_score ?? 0,
            influence_score:   v.influence_score ?? 0,
            has_won:           v.has_won ?? false,
            winning_condition: v.winning_condition ?? null,
          }));
        }

        return enriched;
      }

      // Classify stored snapshot schema
      // v2_full = has territory_states + at least one rich array (influence/buildings)
      // v1_territory_only = has territory_states but no rich arrays (legacy, pre-5F.5)
      // empty = no territory_states
      function classifySnapshot(record) {
        if (!record) return 'missing';
        const d = record.data ?? record;
        if (!Array.isArray(d.territory_states) || d.territory_states.length === 0) return 'empty';
        const hasRichFields = (
          (Array.isArray(d.permanent_influence) && d.permanent_influence.length >= 0) ||
          (Array.isArray(d.buildings) && d.buildings.length >= 0) ||
          (Array.isArray(d.supply_routes) && d.supply_routes.length >= 0) ||
          d._schema_version === 2
        );
        if (hasRichFields) return 'v2_full';
        return 'v1_territory_only';
      }

      // Resolve the data payload from a PhaseSnapshot record (handles nested .data or flat)
      function resolveStoredData(record) {
        if (!record) return null;
        // PhaseSnapshot stores fields at top-level (not nested under .data)
        return record;
      }

      // ── Resolve before snapshot ──────────────────────────────────────────
      let beforeSnapshotData, beforeCapturedAt, beforeSource;
      diagnostics.before_snapshot_population = 'pending';

      if (beforeRecord) {
        const schema = classifySnapshot(beforeRecord);
        const stored = resolveStoredData(beforeRecord);
        beforeSnapshotData = enrichStoredSnapshot(stored, playerMap);
        beforeCapturedAt = beforeRecord.created_date ?? null;
        diagnostics.before_snapshot_source = 'stored';
        if (schema === 'v2_full') {
          beforeSource = 'stored_full';
          diagnostics.before_snapshot_population = 'full_schema';
        } else if (schema === 'v1_territory_only') {
          beforeSource = 'stored_v1_territory_only';
          diagnostics.before_snapshot_population = 'v1_territory_only_legacy';
        } else {
          beforeSource = 'stored_empty';
          diagnostics.before_snapshot_population = 'failed_empty';
        }
      } else if (isCurrentPhase) {
        beforeSnapshotData = liveSnapshot;
        beforeCapturedAt   = new Date().toISOString();
        beforeSource       = 'live_state_at_export_time';
        diagnostics.before_snapshot_source = 'live_fallback';
        diagnostics.before_snapshot_population = (liveSnapshot.territory_states?.length > 0) ? 'success_live' : 'failed_empty';
      } else {
        beforeSnapshotData = null;
        beforeCapturedAt   = null;
        beforeSource       = 'missing_no_stored_snapshot';
        diagnostics.before_snapshot_source = 'missing';
        diagnostics.before_snapshot_population = 'failed_no_stored_snapshot';
      }

      // ── Resolve after snapshot ───────────────────────────────────────────
      let afterSnapshotData, afterCapturedAt, afterSource, phaseCompletionState;
      diagnostics.after_snapshot_population = 'pending';

      if (isCurrentPhase) {
        afterSnapshotData    = liveSnapshot;
        afterCapturedAt      = new Date().toISOString();
        afterSource          = 'current_in_progress_state_only';
        phaseCompletionState = 'in_progress';
        diagnostics.after_snapshot_source = 'live_in_progress';
        diagnostics.after_snapshot_population = (liveSnapshot.territory_states?.length > 0) ? 'success_live' : 'failed_empty';
      } else if (afterRecord) {
        const schema = classifySnapshot(afterRecord);
        const stored = resolveStoredData(afterRecord);
        afterSnapshotData = enrichStoredSnapshot(stored, playerMap);
        afterCapturedAt = afterRecord.created_date ?? null;
        phaseCompletionState = 'completed';
        diagnostics.after_snapshot_source = 'stored';
        if (schema === 'v2_full') {
          afterSource = 'stored_full';
          diagnostics.after_snapshot_population = 'full_schema';
        } else if (schema === 'v1_territory_only') {
          afterSource = 'stored_v1_territory_only';
          diagnostics.after_snapshot_population = 'v1_territory_only_legacy';
        } else {
          afterSource = 'stored_empty';
          diagnostics.after_snapshot_population = 'failed_empty';
        }
      } else if (nextPhaseBeforeRecord) {
        const schema = classifySnapshot(nextPhaseBeforeRecord);
        const stored = resolveStoredData(nextPhaseBeforeRecord);
        afterSnapshotData = enrichStoredSnapshot(stored, playerMap);
        afterCapturedAt = nextPhaseBeforeRecord.created_date ?? null;
        phaseCompletionState = 'completed';
        diagnostics.after_snapshot_source = 'stored_next_phase_start';
        if (schema === 'v2_full') {
          afterSource = 'next_phase_before_snapshot_full';
          diagnostics.after_snapshot_population = 'full_schema';
        } else if (schema === 'v1_territory_only') {
          afterSource = 'next_phase_before_snapshot_v1_territory_only';
          diagnostics.after_snapshot_population = 'v1_territory_only_legacy';
        } else {
          afterSource = 'next_phase_before_snapshot_empty';
          diagnostics.after_snapshot_population = 'failed_empty';
        }
      } else {
        afterSnapshotData    = null;
        afterCapturedAt      = null;
        afterSource          = 'missing_no_stored_after_snapshot';
        phaseCompletionState = 'completed_no_stored_snapshot';
        diagnostics.after_snapshot_source = 'missing';
        diagnostics.after_snapshot_population = 'failed_no_stored_snapshot';
      }

      // Phase timing from SetupLog events; fall back to phase_start snapshot date (Issue 6)
      const startLog = phaseLogs.find(l => ['phase_started','deploy_started','attack_started','fortify_started'].includes(l.event_type));
      const endLog   = phaseLogs.find(l => ['phase_ended','phase_advanced','phase_complete'].includes(l.event_type));
      const phaseStartedAt   = startLog?.created_date ?? beforeCapturedAt ?? null;
      const phaseCompletedAt = endLog?.created_date ?? null;

      // ── Enriched submitted actions (per pillar) — uses cache, no extra queries
      let enrichedActions = { military: [], economic: [], diplomatic: [], all: [] };
      try {
        enrichedActions = buildEnrichedActions(cache, targetPhase, targetRound, playerMap);
        diagnostics.action_log_generation = 'success';
      } catch (e) {
        diagnostics.action_log_generation = `error: ${e.message}`;
      }

      // ── Generated artifacts — uses cache, no extra queries ──────────────
      const generatedArtifacts = buildGeneratedArtifacts(cache, targetRound, playerMap);

      // ── Battle resolution audit — uses cache, no extra queries ──────────
      let battleAudit = [];
      try {
        battleAudit = getBattleResolutionAudit(allBattleCards, playerMap, cache.attackReveals);
        diagnostics.battle_audit_generation = 'success';
      } catch (e) {
        diagnostics.battle_audit_generation = `error: ${e.message}`;
      }

      // ── Delta: compare true before vs true after — granular diagnostics ──
      const emptyDelta = { troop_deltas: [], resource_deltas: [], permanent_influence_deltas: [], spendable_influence_deltas: [], victory_score_deltas: [], structure_changes: [], battle_card_changes: [], trade_state_changes: [], phase_lock_changes: [] };
      let deltaReport = { ...emptyDelta };
      diagnostics.ownership_delta_generation    = 'skipped';
      diagnostics.resource_delta_generation     = 'skipped';
      diagnostics.influence_delta_generation    = 'skipped';
      diagnostics.structure_delta_generation    = 'skipped';

      const canDelta = beforeSnapshotData && afterSnapshotData;
      if (canDelta) {
        try {
          deltaReport = calcDeltas(beforeSnapshotData, afterSnapshotData, playerMap);
          diagnostics.delta_generation = 'success';
          // Granular sub-diagnostics
          diagnostics.ownership_delta_generation  = (deltaReport.troop_deltas ?? []).some(d => d.ownership_changed) ? 'changes_found' : 'no_changes';
          diagnostics.resource_delta_generation   = (deltaReport.resource_deltas ?? []).length > 0 ? 'changes_found' : 'no_changes';
          diagnostics.influence_delta_generation  = ((deltaReport.permanent_influence_deltas ?? []).length + (deltaReport.spendable_influence_deltas ?? []).length) > 0 ? 'changes_found' : 'no_changes';
          diagnostics.structure_delta_generation  = (deltaReport.structure_changes ?? []).length > 0 ? 'changes_found' : 'no_changes';
        } catch (e) {
          diagnostics.delta_generation = `error: ${e.message}`;
        }
      } else {
        diagnostics.delta_generation = 'skipped_missing_snapshots';
      }

      // ── Ownership changes — derived from battle audit (primary) + snapshot delta (secondary) ──
      // Battle audit is the authoritative source: it records actual result_applied transitions.
      // Snapshot delta catches any changes not covered by a battle card (e.g. skirmishes, admin edits).
      const ownershipFromBattles = battleAudit
        .filter(b => b.result_applied !== false && b.ending_state?.owner_player_id)
        .map(b => {
          const afterOwner = b.ending_state?.owner_player_id ?? null;
          const afterName  = afterOwner ? (playerMap[afterOwner]?.display_name ?? afterOwner) : 'unoccupied';
          const beforeOwner = b.defender_player_id ?? null;
          const beforeName  = beforeOwner ? (playerMap[beforeOwner]?.display_name ?? beforeOwner) : 'unoccupied';
          // Only record if ownership actually changed
          if (afterOwner === beforeOwner) return null;
          return {
            territory:    b.target?.territory_name ?? b.target?.territory_id ?? b.target_territory_id,
            territory_id: b.target?.territory_id ?? b.target_territory_id,
            from:         beforeName,
            to:           afterName,
            cause:        `${(b.battle_type ?? '').replace(/_/g, ' ')} — ${b.winner ?? afterName} won`,
            source:       'battle_audit',
          };
        })
        .filter(Boolean);

      // Merge snapshot-delta ownership changes (deduplicate by territory_id)
      const battleTerritoryIds = new Set(ownershipFromBattles.map(c => c.territory_id));
      const ownershipFromDelta = (deltaReport.troop_deltas ?? [])
        .filter(d => d.ownership_changed && !battleTerritoryIds.has(d.territory_id))
        .map(d => ({
          territory:    d.territory_name ?? d.territory_id,
          territory_id: d.territory_id,
          from:         d.owner_before ?? 'unoccupied',
          to:           d.owner_after  ?? 'unoccupied',
          cause:        'snapshot_delta_no_battle_card',
          source:       'snapshot_delta',
        }));

      const ownershipChanges = [...ownershipFromBattles, ...ownershipFromDelta];

      const targetCategory = phaseCategory(targetPhase);
      const troopDeltasNonZero = (deltaReport.troop_deltas ?? []).filter(d => d.troop_delta !== 0);

      // ── Supplement troop_deltas with battle-derived troop changes ────────────
      // When snapshot-based deltas are empty (snapshots identical) but battles
      // resolved and changed territory ownership/troop counts, synthesize deltas
      // from the battle audit entries so troop_deltas is never empty.
      const battleDerivedTroopDeltas = [];
      if (troopDeltasNonZero.length === 0 && battleAudit.some(b => b.result_applied)) {
        // Build a before-troop map from the before snapshot
        const beforeTroopMap = {};
        for (const t of (beforeSnapshotData?.territory_states ?? [])) {
          beforeTroopMap[t.territory_id] = { troops: t.troop_count ?? 0, owner: t.owner_player_id ?? null };
        }
        // For each resolved battle, emit origin troop loss + target troop change
        for (const b of battleAudit) {
          if (!b.result_applied) continue;
          const targetId = b.target?.territory_id;

          // Origin territory: troops were committed out (already in before snapshot as reduced)
          for (const atk of (b.attacker_entries ?? [])) {
            const originId = atk.origin?.territory_id;
            if (!originId) continue;
            const beforeTroops = beforeTroopMap[originId]?.troops ?? 0;
            const committedLoss = atk.committed_troops ?? 0;
            if (committedLoss > 0) {
              battleDerivedTroopDeltas.push({
                territory_id: originId,
                territory_name: atk.origin?.territory_name ?? originId,
                player_id: atk.player_id,
                player: atk.player_name ?? atk.player_id,
                before: beforeTroops,
                after: Math.max(0, beforeTroops - committedLoss),
                delta: -committedLoss,
                cause: 'attack_committed',
                source: 'battle_audit',
              });
            }
          }

          // Target territory: ownership/troop change from battle resolution
          if (targetId) {
            const beforeEntry = beforeTroopMap[targetId] ?? { troops: b.starting_state?.troops ?? 0, owner: b.defender_player_id ?? null };
            const afterTroops = b.ending_state?.troops ?? null;
            const afterOwner = b.ending_state?.owner_player_id ?? null;
            if (afterTroops != null) {
              battleDerivedTroopDeltas.push({
                territory_id: targetId,
                territory_name: b.target?.territory_name ?? targetId,
                player_id: afterOwner,
                player: b.winner ?? (afterOwner ? (playerMap[afterOwner]?.display_name ?? afterOwner) : 'unoccupied'),
                from_owner: b.defender ?? (beforeEntry.owner ? (playerMap[beforeEntry.owner]?.display_name ?? beforeEntry.owner) : 'unoccupied'),
                to_owner: b.winner ?? 'unoccupied',
                before: beforeEntry.troops,
                after: afterTroops,
                delta: afterTroops - beforeEntry.troops,
                cause: 'battle_resolution_survivors',
                source: 'battle_audit',
              });
            }
          }
        }
      }

      // ── Validation warnings — PHASE-AWARE (Issue 5) ─────────────────────
      const validationWarnings = [];
      let exportValidationStatus = 'passed';

      // Empty snapshot detection — always check regardless of phase
      const beforeTerritoryCount = (beforeSnapshotData?.territory_states ?? []).length;
      const afterTerritoryCount  = (afterSnapshotData?.territory_states ?? []).length;
      if (beforeTerritoryCount === 0) {
        validationWarnings.push({ type: 'before_snapshot_empty', severity: 'critical',
          message: 'Before snapshot contains no territory data. Cannot generate accurate deltas.',
          reason: 'empty_snapshots' });
        exportValidationStatus = 'failed';
        diagnostics.before_snapshot_population = 'failed_empty';
      }
      if (afterTerritoryCount === 0) {
        validationWarnings.push({ type: 'after_snapshot_empty', severity: 'critical',
          message: 'After snapshot contains no territory data. Cannot generate accurate deltas.',
          reason: 'empty_snapshots' });
        exportValidationStatus = 'failed';
        diagnostics.after_snapshot_population = 'failed_empty';
      }

      // Missing stored snapshots
      if (diagnostics.before_snapshot_source === 'missing') {
        validationWarnings.push({ type: 'before_snapshot_missing', severity: 'high',
          message: 'No stored before-snapshot found for this phase/round.' });
        if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
      }
      if (diagnostics.after_snapshot_source === 'missing') {
        validationWarnings.push({ type: 'after_snapshot_missing', severity: 'high',
          message: 'No stored after-snapshot found for this phase/round.' });
        if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
      }
      if (diagnostics.before_snapshot_source === 'live_fallback') {
        validationWarnings.push({ type: 'before_snapshot_is_live', severity: 'low',
          message: 'Before snapshot uses live state (current phase — no stored start snapshot yet).' });
      }

      // Troop changes expected — only for Planning and Operations
      if (['planning', 'operations'].includes(targetCategory)) {
        if (troopDeltasNonZero.length === 0 && enrichedActions.military.some(a => a.action_type === 'deploy_troops' || a.action_type === 'attack')) {
          validationWarnings.push({ type: 'troop_changes_expected_but_empty', severity: 'medium',
            message: 'Military actions submitted but no troop deltas detected. Snapshots may not be authoritative.' });
        }
      }

      // Troop commitment not reflected — Operations only
      if (targetCategory === 'operations') {
        const attackActions = enrichedActions.military.filter(a => a.action_type === 'attack' && a.validation_result !== 'rejected');
        if (canDelta && attackActions.length > 0 && beforeSnapshotData?.territory_states) {
          const beforeTroopMap = {};
          for (const t of beforeSnapshotData.territory_states) beforeTroopMap[t.territory_id] = { owner: t.owner_player_id, troops: t.troop_count ?? 0 };
          for (const atk of attackActions) {
            const originId = atk.source?.territory_id;
            if (!originId) continue;
            const before = beforeTroopMap[originId];
            const afterEntry = (afterSnapshotData?.territory_states ?? []).find(t => t.territory_id === originId);
            if (before && afterEntry) {
              const expectedLoss = atk.troops ?? 0;
              const actualDelta = (afterEntry.troop_count ?? 0) - before.troops;
              if (expectedLoss > 0 && actualDelta >= 0 && before.owner === atk.player_id) {
                validationWarnings.push({
                  type: 'troop_commitment_not_reflected', severity: 'medium',
                  territory_id: originId, territory_name: atk.source?.territory_name ?? originId,
                  player_id: atk.player_id, player_name: atk.player,
                  committed: expectedLoss, snapshot_delta: actualDelta,
                  message: `${expectedLoss} troops committed from ${atk.source?.territory_name ?? originId} by ${atk.player} but snapshot troop delta is ${actualDelta} (expected decrease).`,
                });
              }
            }
          }
        }
      }

      // Ownership changes — Conflict only
      // Operations snapshot is captured BEFORE battle resolution, so comparing battle
      // ending state against it would produce false mismatches.
      if (targetCategory === 'conflict') {
        const resolvedBattlesWithOwnershipChange = battleAudit.filter(b =>
          b.result_applied !== false && b.ending_state?.owner_player_id &&
          b.ending_state?.owner_player_id !== b.defender_player_id
        );
        if (resolvedBattlesWithOwnershipChange.length > 0 && ownershipChanges.length === 0) {
          validationWarnings.push({ type: 'ownership_changes_expected_but_empty', severity: 'high',
            message: `${resolvedBattlesWithOwnershipChange.length} battle(s) resulted in ownership change but ownership_changes is empty.` });
          if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
        }
        // Ownership mismatch
        if (afterSnapshotData?.territory_states) {
          const afterOwnerMap = {};
          for (const t of afterSnapshotData.territory_states) afterOwnerMap[t.territory_id] = t.owner_player_id;
          for (const b of battleAudit) {
            if (!b.result_applied || !b.ending_state?.owner_player_id) continue;
            const targetId = b.target?.territory_id ?? b.target_territory_id;
            const snapOwner = afterOwnerMap[targetId];
            if (snapOwner && snapOwner !== b.ending_state.owner_player_id) {
              validationWarnings.push({
                type: 'ownership_mismatch', severity: 'high',
                territory_id: targetId, territory_name: b.target?.territory_name ?? targetId,
                battle_result_winner: b.winner ?? b.ending_state.owner_player_id,
                snapshot_owner: playerMap[snapOwner]?.display_name ?? snapOwner,
                message: `Ownership mismatch at ${b.target?.territory_name ?? targetId}: battle result shows ${b.winner} but snapshot shows ${playerMap[snapOwner]?.display_name ?? snapOwner}.`,
              });
              if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
            }
          }
        }
      } else {
        // Non-conflict phases: skip battle result validation entirely — battles resolve later
        diagnostics.battle_validation_skipped = true;
        diagnostics.battle_validation_reason = 'non_battle_phase';
      }

      // Resource activation warnings — Planning only (Issue 5)
      if (targetCategory === 'planning') {
        const activationActions = enrichedActions.economic.filter(a => a.action_type === 'activate_resources');
        const totalActivated = activationActions.reduce((s, a) => s + (a.territory_count ?? 0), 0);
        const hasActivationDetails = activationActions.some(a => (a.activation_details ?? []).length > 0);
        const hasResourceDeltas = (deltaReport.resource_deltas ?? []).length > 0;
        if (totalActivated > 0 && !hasActivationDetails && !hasResourceDeltas) {
          validationWarnings.push({ type: 'resource_changes_expected_but_empty', severity: 'medium',
            message: `${totalActivated} resource activation(s) submitted but neither activation_details nor resource_deltas were produced.` });
        }
        if (hasActivationDetails && !hasResourceDeltas) {
          validationWarnings.push({ type: 'resource_deltas_missing_using_log_fallback', severity: 'low',
            message: 'Resource deltas from log (not snapshot-based). Snapshot comparison requires resource_storage in both snapshots.' });
        }
      }

      // Influence warnings — Operations only
      if (targetCategory === 'operations') {
        if ((deltaReport.permanent_influence_deltas ?? []).length === 0 && enrichedActions.diplomatic.some(a => a.influence_spent > 0)) {
          validationWarnings.push({ type: 'influence_changes_expected_but_empty', severity: 'low',
            message: 'Influence spent but no influence deltas detected. Snapshots may not have influence data.' });
        }
      }

      // Snapshot identity check — only when there are phase-relevant actions AND no actual deltas exist
      const hasAnyActions = enrichedActions.all.length > 0 || allBattleCards.some(bc => bc.result_applied);
      if (canDelta && hasAnyActions && beforeSnapshotData && afterSnapshotData) {
        const beforeHash = JSON.stringify((beforeSnapshotData.territory_states ?? []).map(t => `${t.territory_id}:${t.owner_player_id}:${t.troop_count}`).sort());
        const afterHash  = JSON.stringify((afterSnapshotData.territory_states ?? []).map(t => `${t.territory_id}:${t.owner_player_id}:${t.troop_count}`).sort());
        // Only raise this warning if there are truly no detectable changes anywhere
        const hasAnyDetectedChanges = (
          troopDeltasNonZero.length > 0 ||
          ownershipChanges.length > 0 ||
          (deltaReport.resource_deltas ?? []).length > 0 ||
          ((deltaReport.permanent_influence_deltas ?? []).length + (deltaReport.spendable_influence_deltas ?? []). length) > 0 ||
          (deltaReport.structure_changes ?? []).length > 0 ||
          battleAudit.some(b => b.result_applied) ||
          beforeHash !== afterHash
        );
        if (!hasAnyDetectedChanges && ['operations', 'conflict'].includes(targetCategory)) {
          validationWarnings.push({ type: 'snapshot_changes_expected_but_missing', severity: 'high',
            message: 'Before and after snapshots are identical despite submitted actions.' });
          if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
        }
      }

      // Rejected attack warnings — Operations only
      if (targetCategory === 'operations') {
        const rejectedAttackActions = enrichedActions.military.filter(a => a.validation_result === 'rejected');
        for (const r of rejectedAttackActions) {
          const warnType = {
            origin_not_owned_by_attacker: 'unowned_origin_attack_blocked',
            target_owned_by_attacker:     'self_attack_attempt_blocked',
            insufficient_troops:          'insufficient_troops_attack_blocked',
            insufficient_troops_zero:     'insufficient_troops_attack_blocked',
            zero_troops_committed:        'insufficient_troops_attack_blocked',
            duplicate_submission:         'duplicate_attack_submission_blocked',
            stale_action_state:           'stale_attack_submission_blocked',
          }[r.rejection_reason] ?? 'attack_rejected';
          validationWarnings.push({
            type: warnType, severity: 'info',
            player_id: r.player_id, player_name: r.player,
            origin: r.source?.territory_name ?? r.source?.territory_id,
            target: r.target?.territory_name ?? r.target?.territory_id,
            rejection_reason: r.rejection_reason,
            message: `Attack from ${r.source?.territory_name ?? r.source?.territory_id} → ${r.target?.territory_name ?? r.target?.territory_id} was rejected: ${r.rejection_reason}`,
          });
        }
      }

      // Battle resolved but no battle_results — Conflict only
      if (targetCategory === 'conflict') {
        if (allBattleCards.some(bc => bc.result_applied) && battleAudit.length === 0) {
          validationWarnings.push({ type: 'battle_results_expected_but_empty', severity: 'high',
            message: 'Battle cards resolved but battle_results is empty.' });
          exportValidationStatus = 'failed';
        }
      }

      // ── Issue 5 validations — combat troop accounting ─────────────────────
      // Only run for Conflict phase. Operations snapshot is captured before battle
      // resolution, so any troop count comparisons against battle outcomes are invalid.
      if (targetCategory === 'conflict') {
        const afterTerritoryMap = {};
        for (const t of (afterSnapshotData?.territory_states ?? [])) afterTerritoryMap[t.territory_id] = t;
        const beforeTerritoryMap2 = {};
        for (const t of (beforeSnapshotData?.territory_states ?? [])) beforeTerritoryMap2[t.territory_id] = t;

        // 5.1: Attacker origin mismatch — troop_movement says before→after but after_snapshot disagrees
        const troopMovements = (deltaReport.troop_deltas ?? []).filter(d => d.troop_delta !== 0);
        for (const mv of troopMovements) {
          const snapEntry = afterTerritoryMap[mv.territory_id];
          if (snapEntry && mv.troops_after != null && snapEntry.troop_count !== mv.troops_after) {
            validationWarnings.push({
              type: 'troop_movement_snapshot_mismatch',
              code: 'troop_movement_snapshot_mismatch',
              severity: 'error',
              territory_id: mv.territory_id,
              territory_name: mv.territory_name ?? mv.territory_id,
              troop_movement_after: mv.troops_after,
              snapshot_after: snapEntry.troop_count,
              message: `Troop movement says after=${mv.troops_after} but after_snapshot shows ${snapEntry.troop_count} at ${mv.territory_name ?? mv.territory_id}`,
            });
            exportValidationStatus = 'failed';
          }
        }

        // 5.2: Defender starting mismatch — combat_source_trace.defender.before_snapshot_troops vs before_snapshot
        // If combat_source_trace is populated, use it as the authoritative check.
        // If source='before_snapshot', the trace and snapshot must agree.
        // If source='fallback_card_value', emit a warning (not a hard failure) since auto-resolve ran before snapshot existed.
        for (const b of battleAudit) {
          if (!b.result_applied) continue;
          const targetId = b.target?.territory_id;
          if (!targetId) continue;
          const beforeEntry = beforeTerritoryMap2[targetId];
          if (!beforeEntry) continue;

          const trace = b.combat_source_trace?.defender ?? null;
          if (trace) {
            // New path: combat_source_trace is populated
            if (trace.source === 'fallback_card_value') {
              // Snapshot was missing at auto-resolve time — warn, don't fail
              validationWarnings.push({
                type: 'battle_defender_troop_source_mismatch',
                code: 'battle_defender_troop_source_mismatch',
                severity: 'warning',
                territory_id: targetId,
                territory_name: b.target?.territory_name ?? targetId,
                battle_card_id: b.battle_card_id,
                before_snapshot_troops: beforeEntry.troop_count,
                trace_source: 'fallback_card_value',
                message: `Auto-resolve used fallback card value for defender at ${b.target?.territory_name ?? targetId} (snapshot unavailable at resolve time)`,
              });
              if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
            } else if (trace.before_snapshot_troops != null &&
                       trace.before_snapshot_troops !== beforeEntry.troop_count) {
              // Snapshot existed but trace disagrees with our before_snapshot — hard failure
              validationWarnings.push({
                type: 'battle_defender_troop_source_mismatch',
                code: 'battle_defender_troop_source_mismatch',
                severity: 'error',
                territory_id: targetId,
                territory_name: b.target?.territory_name ?? targetId,
                battle_card_id: b.battle_card_id,
                before_snapshot_troops: beforeEntry.troop_count,
                trace_before_snapshot_troops: trace.before_snapshot_troops,
                message: `Defender troop trace mismatch at ${b.target?.territory_name ?? targetId}: trace.before_snapshot=${trace.before_snapshot_troops}, audit_before_snapshot=${beforeEntry.troop_count}`,
              });
              exportValidationStatus = 'failed';
            }
          } else {
            // Legacy path: no combat_source_trace — compare card's starting_state vs before_snapshot
            const cardDefenderTroops = b.starting_state?.troops ?? null;
            if (cardDefenderTroops != null && beforeEntry.troop_count !== cardDefenderTroops) {
              validationWarnings.push({
                type: 'battle_defender_troop_source_mismatch',
                code: 'battle_defender_troop_source_mismatch',
                severity: 'error',
                territory_id: targetId,
                territory_name: b.target?.territory_name ?? targetId,
                battle_card_id: b.battle_card_id,
                before_snapshot_troops: beforeEntry.troop_count,
                battle_starting_troops: cardDefenderTroops,
                message: `Defender troop mismatch at ${b.target?.territory_name ?? targetId}: before_snapshot=${beforeEntry.troop_count}, battle_card.defender_troops=${cardDefenderTroops}`,
              });
              exportValidationStatus = 'failed';
            }
          }
        }

        // 5.3: Player standings mismatch — standings troop_total vs sum of owned territory troops
        for (const standing of (afterSnapshotData?.player_standings ?? [])) {
          const ownedTerritories = (afterSnapshotData?.territory_states ?? [])
            .filter(t => t.owner_player_id === standing.player_id);
          const territorySum = ownedTerritories.reduce((s, t) => s + (t.troop_count ?? 0), 0);
          const standingTotal = standing.troop_total ?? 0;
          if (Math.abs(territorySum - standingTotal) > 0) {
            validationWarnings.push({
              type: 'player_standings_troop_total_mismatch',
              code: 'player_standings_troop_total_mismatch',
              severity: 'error',
              player_id: standing.player_id,
              player_name: standing.display_name ?? (playerMap[standing.player_id]?.display_name ?? standing.player_id),
              territory_troop_sum: territorySum,
              standings_total: standingTotal,
              discrepancy: Math.abs(territorySum - standingTotal),
              message: `Player standings mismatch for ${standing.display_name ?? standing.player_id}: territory_sum=${territorySum}, standings_troop_total=${standingTotal}`,
            });
            if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
          }
        }
      }

      // Negative resources — always check
      if (afterSnapshotData?.territory_states) {
        for (const t of afterSnapshotData.territory_states) {
          for (const [res, val] of Object.entries(t.resource_storage ?? {})) {
            if ((val ?? 0) < 0) {
              validationWarnings.push({ type: 'resource_total_negative', ...tEnrich(t.territory_id), resource: res, value: val, severity: 'high' });
              exportValidationStatus = 'failed';
            }
          }
        }
      }
      if (afterSnapshotData?.spendable_influence) {
        for (const p of afterSnapshotData.spendable_influence) {
          if ((p.spendable_influence ?? 0) < 0) {
            validationWarnings.push({ type: 'spendable_influence_negative', player_id: p.player_id, player_name: p.player_name, region_id: p.region_id, value: p.spendable_influence, severity: 'high' });
            exportValidationStatus = 'failed';
          }
        }
      }

      // delta/battle generation errors
      if (diagnostics.delta_generation !== 'success' && diagnostics.delta_generation !== 'skipped_missing_snapshots') exportValidationStatus = 'failed';
      if (diagnostics.battle_audit_generation !== 'success' && exportValidationStatus === 'passed') exportValidationStatus = 'warning';

      // ── snapshot_vs_delta_consistency: Σ territory troop changes = Σ player standing changes ──
      // Validates that the sum of all territory troop deltas matches the sum of all player standing troop changes.
      // A mismatch indicates stale player standings or incorrect snapshot territory data.
      let snapshotVsDeltaConsistencyValid = true;
      if (canDelta && beforeSnapshotData?.player_standings && afterSnapshotData?.player_standings) {
        // Calculate total troop delta from territory states
        const beforeTerritoryTroopMap = {};
        for (const t of (beforeSnapshotData.territory_states ?? [])) {
          beforeTerritoryTroopMap[t.territory_id] = t.troop_count ?? 0;
        }
        let totalTerritoryTroopDelta = 0;
        for (const t of (afterSnapshotData.territory_states ?? [])) {
          const before = beforeTerritoryTroopMap[t.territory_id] ?? 0;
          totalTerritoryTroopDelta += (t.troop_count ?? 0) - before;
        }

        // Calculate total player standing troop delta
        const beforeStandingMap = {};
        for (const s of (beforeSnapshotData.player_standings ?? [])) {
          beforeStandingMap[s.player_id] = s.troop_total ?? 0;
        }
        let totalStandingTroopDelta = 0;
        for (const s of (afterSnapshotData.player_standings ?? [])) {
          const before = beforeStandingMap[s.player_id] ?? 0;
          totalStandingTroopDelta += (s.troop_total ?? 0) - before;
        }

        const consistencyDelta = Math.abs(totalTerritoryTroopDelta - totalStandingTroopDelta);
        // Allow small rounding tolerance (±1 per player)
        const tolerance = (afterSnapshotData.player_standings ?? []).length;
        if (consistencyDelta > tolerance) {
          snapshotVsDeltaConsistencyValid = false;
          validationWarnings.push({
            type: 'snapshot_vs_delta_consistency', severity: 'error',
            code: 'snapshot_vs_delta_consistency',
            message: `Territory troop delta (${totalTerritoryTroopDelta}) ≠ player standing troop delta (${totalStandingTroopDelta}). Difference: ${consistencyDelta}. Player standings may be stale.`,
            territory_troop_delta: totalTerritoryTroopDelta,
            standing_troop_delta: totalStandingTroopDelta,
            discrepancy: consistencyDelta,
          });
          exportValidationStatus = 'failed';
        }
        diagnostics.snapshot_vs_delta_consistency = snapshotVsDeltaConsistencyValid
          ? `passed (territory_delta=${totalTerritoryTroopDelta}, standing_delta=${totalStandingTroopDelta})`
          : `failed (discrepancy=${consistencyDelta})`;
      } else {
        diagnostics.snapshot_vs_delta_consistency = 'skipped_missing_data';
      }

      // Battle source metadata missing — check audit entries
      for (const b of battleAudit) {
        const hasSourceId = b.source_player_id != null;
        const hasSourceName = b.source_player_name != null;
        const isPlayerAction = ['siege', 'double_siege', 'capture_objectives', 'bloodbath',
          'supply_route_establishment', 'supply_route_race', 'supply_raid', 'supply_caravan_escort',
          'uprising', 'labor_strike', 'tax_protest', 'manufactured_crisis'].includes(b.battle_type);
        if (isPlayerAction && (!hasSourceId || !hasSourceName)) {
          validationWarnings.push({
            type: 'battle_source_metadata_missing', severity: 'medium',
            code: 'battle_source_player_name_missing',
            message: `Battle card ${b.battle_card_id} (${b.battle_type}) is missing source_player_${!hasSourceId ? 'id' : 'name'}.`,
            battle_card_id: b.battle_card_id,
          });
          if (exportValidationStatus === 'passed') exportValidationStatus = 'warning';
        }
      }

      // Territory troop mismatch — battle result troops vs after snapshot
      // Only valid for Conflict phase where the after-snapshot is captured post-resolution.
      // Operations after-snapshot is captured before combat resolves, so troop counts
      // will legitimately differ from any future battle ending state.
      if (targetCategory === 'conflict' && afterSnapshotData?.territory_states) {
        const afterTroopMap = {};
        for (const t of afterSnapshotData.territory_states) afterTroopMap[t.territory_id] = { troops: t.troop_count ?? 0, owner: t.owner_player_id };
        for (const b of battleAudit) {
          if (!b.result_applied || !b.ending_state?.owner_player_id) continue;
          const targetId = b.target?.territory_id ?? b.target_territory_id;
          const snap = afterTroopMap[targetId];
          if (!snap) continue;
          const expectedTroops = b.ending_state.troops;
          if (expectedTroops != null && snap.troops !== expectedTroops) {
            validationWarnings.push({
              type: 'battle_result_territory_troop_mismatch', severity: 'error',
              code: 'battle_result_territory_troop_mismatch',
              message: `Territory troop count does not match battle ending troop count at ${b.target?.territory_name ?? targetId}: battle result=${expectedTroops}, snapshot=${snap.troops}.`,
              battle_card_id: b.battle_card_id,
              territory_id: targetId,
              territory_name: b.target?.territory_name ?? targetId,
              expected_troops: expectedTroops,
              actual_troops: snap.troops,
            });
            exportValidationStatus = 'failed';
          }
        }
      }

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
          game_version: '5H.1',
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
        },

        generated_artifacts: generatedArtifacts,

        battle_results: battleAudit,

        resolution_results: {
          ownership_changes:           ownershipChanges,
          troop_movements:             troopDeltasNonZero.length > 0 ? troopDeltasNonZero : battleDerivedTroopDeltas,
          resource_changes:            (() => {
            // Prefer snapshot-based deltas (Issue 4); fall back to activation log for Planning
            const fromDelta = deltaReport.resource_deltas ?? [];
            if (fromDelta.length > 0) return fromDelta;
            if (targetCategory !== 'planning') return [];
            const entries = [];
            for (const action of enrichedActions.economic.filter(a => a.action_type === 'activate_resources')) {
              for (const d of (action.activation_details ?? [])) {
                entries.push({
                  player_id:   d.player_id,
                  player_name: d.player_name,
                  ...tEnrich(d.territory_id),
                  resource_type: d.resource_type,
                  resource:    d.resource_type,
                  before:      d.before_amount ?? 0,
                  after:       d.after_amount ?? 0,
                  delta:       d.amount_generated ?? 0,
                  source:      'activation_log',
                });
              }
            }
            return entries;
          })(),
          influence_changes:           [...(deltaReport.permanent_influence_deltas ?? []), ...(deltaReport.spendable_influence_deltas ?? [])],
          structure_changes:           deltaReport.structure_changes ?? [],
          battle_card_changes:         deltaReport.battle_card_changes ?? [],
          trade_results:               deltaReport.trade_state_changes ?? [],
          victory_score_changes:       deltaReport.victory_score_deltas ?? [],
          territory_development_changes: devDeltas,
        },

        after_snapshot: afterSnapshotData,

        territory_development: {
          note: 'Live overlay — TerritoryDevelopment records fetched at export time. Not stored in phase snapshots.',
          territories: developmentSection,
          player_summaries: devPlayerSummaries,
          updated_this_round: devDeltas,
        },

        delta_report: (() => {
          // Inject battle-derived troop deltas when snapshot-based ones are empty
          const enrichedDelta = (deltaReport.troop_deltas ?? []).length === 0 && battleDerivedTroopDeltas.length > 0
            ? { ...deltaReport, troop_deltas: battleDerivedTroopDeltas }
            : deltaReport;
          // If snapshots already have resource_deltas, return as-is.
          // For Planning only: if snapshot resource_deltas are empty, inject from activation log.
          if ((enrichedDelta.resource_deltas ?? []).length > 0 || targetCategory !== 'planning') return enrichedDelta;
          const entries = [];
          for (const action of enrichedActions.economic.filter(a => a.action_type === 'activate_resources')) {
            for (const d of (action.activation_details ?? [])) {
              entries.push({
                player_id:   d.player_id,
                player_name: d.player_name,
                ...tEnrich(d.territory_id),
                resource_type: d.resource_type,
                resource:    d.resource_type,
                before:      d.before_amount ?? 0,
                after:       d.after_amount ?? 0,
                delta:       d.amount_generated ?? 0,
                source:      'activation_log',
              });
            }
          }
          return entries.length > 0 ? { ...enrichedDelta, resource_deltas: entries } : enrichedDelta;
        })(),

        validation_warnings: validationWarnings,

        // validation_details: structured, machine-readable entries for every warning/error
        validation_details: validationWarnings
          .filter(w => w.severity !== 'info' && w.severity !== 'low')
          .map(w => ({
            severity: w.severity === 'critical' || w.severity === 'error' ? 'error' : 'warning',
            code: w.code ?? w.type,
            message: w.message ?? w.type,
            ...(w.battle_card_id ? { battle_card_id: w.battle_card_id } : {}),
            ...(w.territory_id ? { territory_id: w.territory_id, territory_name: w.territory_name ?? w.territory_id } : {}),
            ...(w.player_id ? { player_id: w.player_id } : {}),
          })),

        audit_health: (() => {
          // battle_cards_valid: all siege cards have source_player_id
          const siegeCards = battleAudit.filter(b => b.battle_type === 'siege' || b.battle_type === 'double_siege');
          const battleCardsValid = siegeCards.length === 0 || siegeCards.every(b => b.source_player_id != null);

          // ownership_changes_valid: no mismatch warnings
          const ownershipChangesValid = !validationWarnings.some(w => w.type === 'ownership_mismatch' || w.type === 'ownership_changes_expected_but_empty');

          // troop_counts_valid: no null ending troops on winner battles and no troop mismatch errors
          const troopCountsValid = battleAudit.every(b => !b.ending_state?.owner_player_id || b.ending_state.troops != null)
            && !validationWarnings.some(w => w.type === 'battle_result_territory_troop_mismatch');

          // resource_changes_valid: no negative resource warnings
          const resourceChangesValid = !validationWarnings.some(w => w.type === 'resource_total_negative' || w.type === 'resource_changes_expected_but_empty');

          // snapshot_integrity_valid: snapshots present and no consistency warnings
          const snapshotIntegrityValid = (
            diagnostics.before_snapshot_source !== 'missing' &&
            diagnostics.after_snapshot_source !== 'missing' &&
            beforeTerritoryCount > 0 &&
            afterTerritoryCount > 0 &&
            !validationWarnings.some(w => w.type === 'snapshot_changes_expected_but_missing')
          );

          // battle_source_metadata_valid: no missing source player id/name on player-action cards
          const battleSourceMetadataValid = !validationWarnings.some(w => w.type === 'battle_source_metadata_missing');

          // battle_lifecycle_valid: every battle result entry has a lifecycle object
          const battleLifecycleValid = battleAudit.every(b => b.lifecycle != null && typeof b.lifecycle === 'object');

          // validation_details_present: bundle always has validation_details array
          const validationDetailsPresent = true; // always populated above

          // snapshot_vs_delta_consistency_valid: no standing/territory mismatch
          const snapshotVsDeltaConsistencyCheck = !validationWarnings.some(w => w.type === 'snapshot_vs_delta_consistency');

          // troop_movement_snapshot_consistent: no attacker troop movement vs snapshot mismatch
          const troopMovementSnapshotConsistent = !validationWarnings.some(w => w.type === 'troop_movement_snapshot_mismatch');

          // defender_troop_source_consistent: no defender troop source mismatch
          const defenderTroopSourceConsistent = !validationWarnings.some(w => w.type === 'battle_defender_troop_source_mismatch');

          // player_standings_consistent: no player standings troop total mismatch
          const playerStandingsConsistent = !validationWarnings.some(w => w.type === 'player_standings_troop_total_mismatch');

          return {
            battle_cards_valid: battleCardsValid,
            ownership_changes_valid: ownershipChangesValid,
            troop_counts_valid: troopCountsValid,
            resource_changes_valid: resourceChangesValid,
            snapshot_integrity_valid: snapshotIntegrityValid,
            battle_source_metadata_valid: battleSourceMetadataValid,
            battle_lifecycle_valid: battleLifecycleValid,
            snapshot_vs_delta_consistency_valid: snapshotVsDeltaConsistencyCheck,
            troop_movement_snapshot_consistent: troopMovementSnapshotConsistent,
            defender_troop_source_consistent: defenderTroopSourceConsistent,
            player_standings_consistent: playerStandingsConsistent,
            validation_details_present: validationDetailsPresent,
            overall: battleCardsValid && ownershipChangesValid && troopCountsValid && resourceChangesValid && snapshotIntegrityValid && battleSourceMetadataValid && battleLifecycleValid && snapshotVsDeltaConsistencyCheck && troopMovementSnapshotConsistent && defenderTroopSourceConsistent && playerStandingsConsistent,
          };
        })(),
      };

      return Response.json({ success: true, bundle });
    }

    // ── ACTION: getSnapshotHealth ────────────────────────────────────────────────
    // Part 6: Diagnostic utility — reports snapshot health for all rounds/phases.
    // Returns a structured health report that immediately identifies missing snapshots.
    if (action === 'getSnapshotHealth') {
      const targetRound = body.round ?? campaign.current_round ?? 1;
      const phases = ['deploy', 'attack', 'battle', 'fortify'];

      // Bulk-fetch all snapshots for this campaign up to targetRound
      const [allSnapshots, allLogs] = await Promise.all([
        base44.asServiceRole.entities.PhaseSnapshot.filter({ campaign_id }),
        base44.asServiceRole.entities.SetupLog.filter({ campaign_id }),
      ]);

      const report = [];
      for (let r = 1; r <= targetRound; r++) {
        for (const ph of phases) {
          const beforeSnap = allSnapshots.find(s => s.round === r && s.phase === ph && s.snapshot_type === 'phase_start');
          const afterSnap = allSnapshots.filter(s => s.round === r && s.phase === ph && s.snapshot_type === 'phase_end')
            .sort((a, b) => new Date(b.created_date ?? 0) - new Date(a.created_date ?? 0))[0] ?? null;

          const startLog = allLogs.find(l => l.round === r && l.phase === ph && ['phase_started', 'deploy_started', 'attack_started', 'fortify_started'].includes(l.event_type));
          const endLog = allLogs.find(l => l.round === r && l.phase === ph && ['phase_advanced', 'phase_ended', 'phase_complete'].includes(l.event_type));

          const beforeTerritoryCount = (beforeSnap?.territory_states ?? []).length;
          const afterTerritoryCount = (afterSnap?.territory_states ?? []).length;
          const beforeHasInfluence = Array.isArray(beforeSnap?.permanent_influence) && beforeSnap.permanent_influence.length > 0;
          const afterHasInfluence = Array.isArray(afterSnap?.permanent_influence) && afterSnap.permanent_influence.length > 0;
          const beforeSchemaVersion = beforeSnap?._schema_version ?? null;
          const afterSchemaVersion = afterSnap?._schema_version ?? null;

          let validationStatus = 'ok';
          const issues = [];
          if (!beforeSnap) { validationStatus = 'missing_before'; issues.push('before_snapshot_missing'); }
          else if (beforeTerritoryCount === 0) { validationStatus = 'empty_before'; issues.push('before_snapshot_has_no_territories'); }
          else if (beforeSchemaVersion !== 2) { issues.push('before_snapshot_schema_v1_legacy'); }
          if (!afterSnap && endLog) { validationStatus = validationStatus === 'ok' ? 'missing_after' : validationStatus; issues.push('after_snapshot_missing_despite_phase_end_log'); }
          if (validationStatus === 'ok' && issues.length === 0) validationStatus = 'healthy';

          report.push({
            round: r,
            phase: ph,
            before_snapshot_exists: !!beforeSnap,
            after_snapshot_exists: !!afterSnap,
            before_territory_count: beforeTerritoryCount,
            after_territory_count: afterTerritoryCount,
            before_has_influence: beforeHasInfluence,
            after_has_influence: afterHasInfluence,
            before_schema_version: beforeSchemaVersion,
            after_schema_version: afterSchemaVersion,
            before_captured_at: beforeSnap?.created_date ?? null,
            after_captured_at: afterSnap?.created_date ?? null,
            phase_started_at: startLog?.created_date ?? null,
            phase_completed_at: endLog?.created_date ?? null,
            validation_status: validationStatus,
            issues,
          });
        }
      }

      const totalPhases = report.length;
      const healthyCount = report.filter(r => r.validation_status === 'healthy').length;
      const missingBeforeCount = report.filter(r => r.issues.includes('before_snapshot_missing')).length;
      const missingAfterCount = report.filter(r => r.issues.includes('after_snapshot_missing_despite_phase_end_log')).length;

      return Response.json({
        success: true,
        campaign_id,
        campaign_name: campaign.name,
        checked_up_to_round: targetRound,
        summary: {
          total_phases_checked: totalPhases,
          healthy: healthyCount,
          missing_before_snapshot: missingBeforeCount,
          missing_after_snapshot: missingAfterCount,
          overall_health: missingBeforeCount === 0 && missingAfterCount === 0 ? 'healthy' : 'issues_found',
        },
        phases: report,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});