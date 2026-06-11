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

// ── Territory → name map (inline from SC config) ─────────────────────────────
const SC_TERRITORY_NAMES = {
  I1:'Iron Peaks',I2:'Ironholm',I3:'The Crucible',I4:'Forge Pass',I5:'Ashfall',I6:'Cinder Gate',I7:'Ember Ridge',I8:'Outer Pass',
  W1:'Willowfen',W2:'Briarwood',W3:'Thornwall',W4:'Gale Crossing',W5:'Deeproot',W6:'Mosshaven',W7:'Fernwatch',W8:'Oakhearth',W9:'Tangle Mire',
  B1:'Blightmoor',B2:'Crumble Flats',B3:'Ashwick',B4:'Ruinstone',B5:'Dustwall',B6:'Crossroads Keep',B7:'Gravel Reach',B8:'Sallow Pit',B9:'Bonewatch',B10:'Ruins End',
  S1:'Sunreach',S2:'Saltwind',S3:'Shoreholm',S4:'Gilded Plains',S5:'Harvest Cross',S6:'Amber Bay',S7:'Fieldstone',S8:'Verdant Mile',S9:'Tidecrest',
  C1:'Coldspire',C2:'Frostveil',C3:'Shattercap',C4:'Fracture Bay',C5:'Cliffwatch',C6:'Brokenshore',C7:'Tidal Shelf',C8:'Gull Ledge',
};

const SC_TERRITORY_REGION = {
  I8:'outer_passes',I4:'outer_passes',I6:'outer_passes',I7:'outer_passes',
  I1:'high_crown',I2:'high_crown',I3:'high_crown',I5:'high_crown',
  W1:'northern_wilds',W2:'northern_wilds',W3:'northern_wilds',W4:'northern_wilds',W5:'northern_wilds',
  W6:'deepwoods',W7:'deepwoods',W8:'deepwoods',W9:'deepwoods',
  B1:'northern_ruins',B3:'northern_ruins',B2:'northern_ruins',B4:'northern_ruins',
  B5:'central_crossroads',B6:'central_crossroads',B7:'central_crossroads',
  B8:'southern_ruins',B9:'southern_ruins',B10:'southern_ruins',
  S1:'western_plains',S4:'western_plains',S7:'western_plains',S2:'western_plains',
  S5:'eastern_granaries',S8:'eastern_granaries',S3:'eastern_granaries',S6:'eastern_granaries',S9:'eastern_granaries',
  C1:'northern_isles',C2:'northern_isles',C3:'northern_isles',C4:'northern_isles',
  C5:'southern_fractures',C6:'southern_fractures',C7:'southern_fractures',C8:'southern_fractures',
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

function tName(id) { return SC_TERRITORY_NAMES[id] ?? id; }

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

  // Territories with enriched names and owner names
  const territorySnapshot = territories.map(t => ({
    territory_id: t.territory_id,
    territory_name: tName(t.territory_id),
    region_id: SC_TERRITORY_REGION[t.territory_id] ?? null,
    owner_player_id: t.owner_player_id ?? null,
    owner_name: t.owner_player_id ? (playerMap[t.owner_player_id]?.display_name ?? t.owner_player_id) : null,
    troop_count: t.troop_count ?? 0,
    resource_storage: t.resource_storage ?? {},
    has_resource_hub: t.has_resource_hub ?? false,
    structures: t.structures ?? [],
  }));

  // Permanent influence per territory per player
  const permInfluence = influence.map(i => ({
    territory_id: i.territory_id,
    territory_name: tName(i.territory_id),
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
    territory_id: b.territory_id,
    territory_name: tName(b.territory_id),
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
    hub_territory_id: r.hub_territory_id,
    hub_territory_name: tName(r.hub_territory_id),
    source_territory_id: r.source_territory_id,
    source_territory_name: tName(r.source_territory_id),
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
    target_territory_id: bc.target_territory_id,
    target_territory_name: tName(bc.target_territory_id),
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
        territory_id: t.territory_id,
        territory_name: t.territory_name,
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
        warnings.push({ type: 'unexpected_troop_increase', territory_id: t.territory_id, territory_name: t.territory_name, delta });
      } else if (delta < -30) {
        warnings.push({ type: 'unexpected_troop_decrease', territory_id: t.territory_id, territory_name: t.territory_name, delta });
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
          territory_id: t.territory_id,
          territory_name: t.territory_name,
          resource: res,
          before: bfr,
          after: aft,
          delta,
        });
        if (aft < 0) warnings.push({ type: 'resource_went_negative', territory_id: t.territory_id, resource: res, value: aft });
        if (delta > 50) warnings.push({ type: 'unexpected_resource_increase', territory_id: t.territory_id, resource: res, delta });
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
        territory_id: i.territory_id, territory_name: i.territory_name,
        before: bef?.influence_amount ?? 0, after: i.influence_amount, delta,
      });
      if (delta < 0) warnings.push({ type: 'permanent_influence_reduced', player_id: i.player_id, territory_id: i.territory_id, delta });
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
      structureChanges.push({ change: 'status_changed', territory_id: b.territory_id, territory_name: b.territory_name, building_type: b.building_type, from: bef.status, to: b.status });
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
        warnings.push({ type: 'battle_card_no_defender', battle_card_id: bc.id, battle_type: bc.battle_type, target: bc.target_territory_name });
      }
    } else if (bef.status !== bc.status) {
      battleCardChanges.push({ change: 'status_changed', id: bc.id, territory_name: bc.target_territory_name, from: bef.status, to: bc.status });
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

async function getPhaseSnapshotData(base44, campaignId, round, phase) {
  // Look for stored PhaseSnapshot records (before/after) for this exact phase
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

  // Try same round first
  const snapshots = await base44.asServiceRole.entities.PhaseSnapshot.filter({
    campaign_id: campaignId,
    round,
    phase: next,
  });
  const beforeRecord = snapshots.find(s =>
    s.snapshot_type === 'before' || s.type === 'before' || s.snapshot_type === 'start'
  );
  if (beforeRecord) return beforeRecord;

  // If phase was fortify (end of round), try round+1 deploy
  if (phase === 'fortify') {
    const nextRoundSnaps = await base44.asServiceRole.entities.PhaseSnapshot.filter({
      campaign_id: campaignId,
      round: round + 1,
      phase: 'deploy',
    });
    return nextRoundSnaps.find(s =>
      s.snapshot_type === 'before' || s.type === 'before' || s.snapshot_type === 'start'
    ) ?? null;
  }
  return null;
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
        origin_territory_id: a.origin_territory_id,
        origin_territory_name: tName(a.origin_territory_id),
        target_territory_id: a.target_territory_id,
        target_territory_name: tName(a.target_territory_id),
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
      target_territory_id: a.target_territory_id ?? null,
      target_territory_name: a.target_territory_id ? tName(a.target_territory_id) : null,
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
      target_territory_id: r.target_territory_id ?? null,
      target_territory_name: r.target_territory_id ? tName(r.target_territory_id) : null,
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
      target_territory_id: bc.target_territory_id,
      target_territory_name: tName(bc.target_territory_id),
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
      target_territory_id: r.target_territory_id ?? null,
      target_territory_name: r.target_territory_id ? tName(r.target_territory_id) : null,
      generated_phase: r.generated_phase,
    })),
    supply_routes_created: supplyRoutes.map(r => ({
      id: r.id,
      owner_name: playerMap[r.owner_player_id]?.display_name ?? r.owner_player_id,
      hub_territory_name: tName(r.hub_territory_id),
      source_territory_name: tName(r.source_territory_id),
      resource_type: r.resource_type,
    })),
    buildings_started: buildings.map(b => ({
      territory_id: b.territory_id,
      territory_name: tName(b.territory_id),
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

      // ── Snapshot resolution strategy ────────────────────────────────────
      //
      // before_snapshot: the stored "before" PhaseSnapshot for this phase.
      //   Represents state AT THE START of the phase, before any effects.
      //   Fallback: live state (current phase only).
      //
      // after_snapshot:
      //   For COMPLETED phases: the stored "after" PhaseSnapshot, OR the
      //   "before" snapshot of the NEXT phase (same data, different label).
      //   This represents the world AFTER effects have been applied.
      //   For IN-PROGRESS phases: live state (clearly labelled).
      //
      const [storedSnapshots, nextPhaseBeforeRecord, liveSnapshot] = await Promise.all([
        getPhaseSnapshotData(base44, campaign_id, targetRound, targetPhase),
        isCurrentPhase ? Promise.resolve(null) : getNextPhaseBeforeSnapshot(base44, campaign_id, targetRound, targetPhase),
        buildSnapshot(base44, campaign_id, playerMap),
      ]);

      const beforeRecord = storedSnapshots.find(s =>
        s.snapshot_type === 'before' || s.type === 'before' || s.snapshot_type === 'start'
      );
      const afterRecord = storedSnapshots.find(s =>
        s.snapshot_type === 'after' || s.type === 'after' || s.snapshot_type === 'end'
      );

      // Determine before snapshot and its metadata
      const beforeSnapshotData = beforeRecord?.data ?? liveSnapshot;
      const beforeCapturedAt   = beforeRecord?.created_date ?? null;
      const beforeSource = beforeRecord
        ? 'stored_phase_snapshot'
        : (isCurrentPhase ? 'live_state_at_export_time' : 'live_state_fallback_no_stored_snapshot');

      // Determine after snapshot and its metadata
      // Priority: explicit after record > next-phase before record > live (in-progress only)
      let afterSnapshotData, afterCapturedAt, afterSource, phaseCompletionState;

      if (isCurrentPhase) {
        // Phase still active — use live state, clearly marked
        afterSnapshotData    = liveSnapshot;
        afterCapturedAt      = new Date().toISOString();
        afterSource          = 'current_in_progress_state_only';
        phaseCompletionState = 'in_progress';
      } else if (afterRecord) {
        afterSnapshotData    = afterRecord.data;
        afterCapturedAt      = afterRecord.created_date ?? null;
        afterSource          = 'stored_phase_snapshot_after';
        phaseCompletionState = 'completed';
      } else if (nextPhaseBeforeRecord) {
        // The before-snapshot of the next phase IS the after-state of this phase
        afterSnapshotData    = nextPhaseBeforeRecord.data;
        afterCapturedAt      = nextPhaseBeforeRecord.created_date ?? null;
        afterSource          = 'next_phase_before_snapshot_equals_after';
        phaseCompletionState = 'completed';
      } else {
        // No stored records — use live state, warn that it may not reflect this phase's resolution
        afterSnapshotData    = liveSnapshot;
        afterCapturedAt      = new Date().toISOString();
        afterSource          = 'live_state_fallback_no_stored_after_snapshot';
        phaseCompletionState = 'completed_no_stored_snapshot';
      }

      // Phase timing from SetupLog events (best-effort; null if not recorded)
      const phaseLogs = await base44.asServiceRole.entities.SetupLog.filter({
        campaign_id,
        phase: targetPhase,
        round: targetRound,
      });
      const startLog = phaseLogs.find(l => l.event_type === 'phase_started' || l.event_type === 'deploy_started' || l.event_type === 'attack_started' || l.event_type === 'fortify_started');
      const endLog   = phaseLogs.find(l => l.event_type === 'phase_ended' || l.event_type === 'phase_advanced' || l.event_type === 'phase_complete');
      const phaseStartedAt    = startLog?.created_date ?? null;
      const phaseCompletedAt  = endLog?.created_date ?? null;

      // ── Submitted actions ───────────────────────────────────────────────
      const submittedActions = await getSubmittedActions(base44, campaign_id, targetRound, targetPhase, playerMap);

      // ── Generated artifacts ─────────────────────────────────────────────
      const generatedArtifacts = await getGeneratedArtifacts(base44, campaign_id, targetRound, playerMap);

      // ── Delta: compare true before vs true after ────────────────────────
      const deltaReport = calcDeltas(beforeSnapshotData, afterSnapshotData, playerMap);

      // ── Validation warnings ─────────────────────────────────────────────
      const validationWarnings = [];

      // Warn if after snapshot is not authoritative
      if (afterSource === 'live_state_fallback_no_stored_after_snapshot') {
        validationWarnings.push({
          type: 'after_snapshot_not_authoritative',
          message: 'No stored after-snapshot found for this phase. After snapshot reflects current live state, which may include changes from later phases.',
          severity: 'high',
        });
      }
      if (afterSource === 'live_state_fallback_no_stored_snapshot') {
        validationWarnings.push({
          type: 'before_snapshot_not_authoritative',
          message: 'No stored before-snapshot found for this phase. Before snapshot reflects current live state.',
          severity: 'high',
        });
      }

      // Phase lock missing for any active player
      const activePlayers = players.filter(p => !p.is_eliminated);
      const lockStates = afterSnapshotData.phase_lock_states ?? [];
      for (const p of activePlayers) {
        const lock = lockStates.find(l => l.player_id === p.id && l.phase === targetPhase && l.round === targetRound);
        if (!lock) {
          validationWarnings.push({
            type: 'phase_lock_missing',
            player_id: p.id,
            player_name: p.display_name,
            phase: targetPhase,
            round: targetRound,
          });
        }
      }

      // Duplicate objective opportunity same round
      const objActions = submittedActions.filter(a => a.action_type === 'phase_staging' && a.payload?.objective_dealt);
      const seenObj = new Set();
      for (const a of objActions) {
        if (seenObj.has(a.player_id)) {
          validationWarnings.push({ type: 'duplicate_objective_opportunity', player_id: a.player_id, player_name: a.player_name });
        }
        seenObj.add(a.player_id);
      }

      // Duplicate phase lock execution
      const lockActions = submittedActions.filter(a => a.is_locked);
      const seenLock = {};
      for (const a of lockActions) {
        const key = `${a.player_id}|${targetPhase}`;
        seenLock[key] = (seenLock[key] ?? 0) + 1;
        if (seenLock[key] > 1) {
          validationWarnings.push({ type: 'duplicate_phase_lock', player_id: a.player_id, player_name: a.player_name });
        }
      }

      // Negative resource totals in after snapshot
      for (const t of (afterSnapshotData.territory_states ?? [])) {
        for (const [res, val] of Object.entries(t.resource_storage ?? {})) {
          if ((val ?? 0) < 0) {
            validationWarnings.push({ type: 'resource_total_negative', territory_id: t.territory_id, territory_name: t.territory_name, resource: res, value: val });
          }
        }
      }

      // Negative spendable influence in after snapshot
      for (const p of (afterSnapshotData.spendable_influence ?? [])) {
        if ((p.spendable_influence ?? 0) < 0) {
          validationWarnings.push({ type: 'spendable_influence_negative', player_id: p.player_id, player_name: p.player_name, region_id: p.region_id, value: p.spendable_influence });
        }
      }

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
          game_version: '5F.1',
          active_win_conditions: campaign.settings?.active_win_conditions ?? [],
          // ── Snapshot timing ──────────────────────────────────────────
          phase_started_at:              phaseStartedAt,
          phase_completed_at:            phaseCompletedAt,
          before_snapshot_captured_at:   beforeCapturedAt,
          after_snapshot_captured_at:    afterCapturedAt,
          // ── Snapshot status clarity ──────────────────────────────────
          snapshot_status: {
            before_snapshot:       beforeSource,
            after_snapshot:        afterSource,
            phase_completion_state: phaseCompletionState,
            delta_report:          isCurrentPhase ? 'preliminary' : 'authoritative',
          },
        },
        before_snapshot: beforeSnapshotData,
        submitted_actions: submittedActions,
        generated_artifacts: generatedArtifacts,
        resolution_results: {
          note: 'Derived from delta between before_snapshot and after_snapshot. Submitted actions explain why changes occurred.',
          troop_movements:             deltaReport.troop_deltas?.filter(d => d.troop_delta !== 0) ?? [],
          ownership_changes:           deltaReport.troop_deltas?.filter(d => d.ownership_changed) ?? [],
          resource_changes:            deltaReport.resource_deltas ?? [],
          influence_changes:           [...(deltaReport.permanent_influence_deltas ?? []), ...(deltaReport.spendable_influence_deltas ?? [])],
          structure_changes:           deltaReport.structure_changes ?? [],
          battle_card_results:         deltaReport.battle_card_changes ?? [],
          trade_results:               deltaReport.trade_state_changes ?? [],
          victory_score_recalculations: deltaReport.victory_score_deltas ?? [],
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