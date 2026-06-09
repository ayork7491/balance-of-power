/**
 * victoryConfig.js — Sprint 5A
 *
 * All victory framework constants. Tune here only — never hardcode in components or backend.
 *
 * Backend inlines a copy of MDS_BY_TERRITORY and ECONOMIC_BUILDING_INFRA_VALUE
 * (Deno cannot import local files). Update here first, then propagate to victoryPhase.js.
 */

// ── Thresholds ────────────────────────────────────────────────────────────────

export const VICTORY_THRESHOLDS = {
  military:   1000,   // MVS required to win
  economic:    500,   // EVS required to win
  diplomatic:  250,   // DVS (permanent influence) required to win
};

// ── Military Difficulty Score per territory ───────────────────────────────────
// MVS contribution = troops × MDS
// Higher MDS = more strategically important territory.
// Derived from: continent centrality, adjacency count, resource value, structure slots.
//
// Tier system:
//   5 = major chokepoints / crossroads (e.g. B6 Crownbreak, B10 Riftmarket, S5 Granary Cross)
//   4 = strong strategic value (continents gateways, multi-route nodes)
//   3 = moderate value (standard contested territory)
//   2 = peripheral / low-conflict zones
//   1 = isolated / minimal strategic value

export const MDS_BY_TERRITORY = {
  // ── IRONSPINE ──────────────────────────────────────────────────────────────
  I1: 2, I2: 3, I3: 3, I4: 3, I5: 2, I6: 4, I7: 4, I8: 3,

  // ── WILD FRONTIER ─────────────────────────────────────────────────────────
  W1: 2, W2: 4, W3: 2, W4: 3, W5: 5, W6: 3, W7: 4, W8: 3, W9: 3,

  // ── FRACTURE BASIN ────────────────────────────────────────────────────────
  B1: 3, B2: 5, B3: 4, B4: 3, B5: 4, B6: 5, B7: 3, B8: 3, B9: 3, B10: 5,

  // ── SUNFIELDS ─────────────────────────────────────────────────────────────
  S1: 3, S2: 4, S3: 3, S4: 3, S5: 5, S6: 3, S7: 3, S8: 3, S9: 3,

  // ── SHATTERED COAST ───────────────────────────────────────────────────────
  C1: 2, C2: 3, C3: 3, C4: 4, C5: 3, C6: 5, C7: 2, C8: 4,
};

// ── Economic Infrastructure Building Values ───────────────────────────────────
// EVS = gold + 30% × (sum of infra construction gold values for active economic buildings)
// Only economic pillar buildings count toward infrastructure value.
// Value = total gold cost of the building definition.

export const ECONOMIC_BUILDING_INFRA_VALUE = {
  marketplace:    2,  // cost: { gold: 2, timber: 1 }    → gold component = 2
  builders_guild: 3,  // cost: { gold: 3, timber: 2 }    → gold component = 3
  trade_network:  2,  // cost: { gold: 2, timber: 2 }    → gold component = 2
  resource_hub:   3,  // cost: { gold: 3, timber: 1, stone: 1 } → gold = 3
  supply_route:   1,  // cost: { gold: 1, timber: 1 }    → gold = 1
  warehouse:      2,  // cost: { gold: 2, stone: 1 }     → gold = 2
};

export const ECONOMIC_INFRA_BONUS_RATE = 0.30; // 30% of infra value added to EVS

// ── Display helpers ───────────────────────────────────────────────────────────

export const VICTORY_PILLAR_CONFIG = {
  military: {
    label: 'Military',
    icon: '⚔️',
    scoreLabel: 'MVS',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    barColor: 'bg-red-500',
    condition: 'rule_the_world',
  },
  economic: {
    label: 'Economic',
    icon: '💰',
    scoreLabel: 'EVS',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    barColor: 'bg-amber-500',
    condition: 'own_the_world',
  },
  diplomatic: {
    label: 'Diplomatic',
    icon: '🕊️',
    scoreLabel: 'DVS',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    barColor: 'bg-purple-500',
    condition: 'lead_the_world',
  },
};