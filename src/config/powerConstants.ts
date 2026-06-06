/**
 * config/powerConstants.ts
 *
 * Three-pillar power system constants.
 * Canonical enums for military/economic/diplomatic power and win conditions.
 *
 * ⚠ BACKEND SYNC NOTE:
 * Backend functions cannot import from this file (no local imports in Deno).
 * Magic strings in Deno functions must manually stay in sync.
 * This file is the SINGLE SOURCE OF TRUTH for all pillar/power/victory strings.
 */

// ─── Pillar / Power Types ─────────────────────────────────────────────────────

export const POWER_TYPES = /** @type {const} */ {
  MILITARY:   'military',   // occupancy_power — Rule the World
  ECONOMIC:   'economic',   // wealth_power    — Own the World
  DIPLOMATIC: 'diplomatic', // influence_power — Lead the World
} as const;

export type PowerTypeKey = keyof typeof POWER_TYPES;
export type PowerTypeValue = typeof POWER_TYPES[PowerTypeKey];

/** Power type → ledger field name mapping */
export const POWER_TYPE_TO_FIELD = {
  military:   'occupancy_power',
  economic:   'wealth_power',
  diplomatic: 'influence_power',
} as const;

// ─── Win Conditions ───────────────────────────────────────────────────────────

export const WIN_CONDITIONS = /** @type {const} */ {
  RULE_THE_WORLD: 'rule_the_world',  // military path
  OWN_THE_WORLD:  'own_the_world',   // economic path
  LEAD_THE_WORLD: 'lead_the_world',  // diplomatic path
} as const;

export type WinConditionKey = keyof typeof WIN_CONDITIONS;
export type WinConditionValue = typeof WIN_CONDITIONS[WinConditionKey];

/** Win condition → pillar mapping */
export const WIN_CONDITION_TO_PILLAR: Record<WinConditionValue, PowerTypeValue> = {
  rule_the_world: 'military',
  own_the_world:  'economic',
  lead_the_world: 'diplomatic',
};

export const WIN_CONDITION_VALUES = Object.values(WIN_CONDITIONS);

// ─── Pillar Building Types ────────────────────────────────────────────────────

export const MILITARY_BUILDING_TYPES   = ['barracks', 'war_council', 'logistics_corps'] as const;
export const DIPLOMATIC_BUILDING_TYPES = ['embassy', 'council_chamber', 'foreign_office'] as const;
export const ECONOMIC_BUILDING_TYPES   = ['marketplace', 'builders_guild', 'trade_network', 'resource_hub', 'supply_route', 'warehouse'] as const;

export const BUILDING_TYPE_TO_PILLAR: Record<string, PowerTypeValue> = {
  // Military
  barracks:        'military',
  war_council:     'military',
  logistics_corps: 'military',
  // Diplomatic
  embassy:          'diplomatic',
  council_chamber:  'diplomatic',
  foreign_office:   'diplomatic',
  // Economic
  marketplace:    'economic',
  builders_guild: 'economic',
  trade_network:  'economic',
  resource_hub:   'economic',
  supply_route:   'economic',
  warehouse:      'economic',
};

// ─── Supply Route Constants ───────────────────────────────────────────────────

/** Maximum supply route connections per Resource Hub */
export const MAX_SUPPLY_ROUTES_PER_HUB = 3;

/** Maximum range (territory hops) for a supply route */
export const MAX_SUPPLY_ROUTE_RANGE = 3;

// ─── Route / Building Statuses ────────────────────────────────────────────────

export const BUILDING_STATUSES = {
  PLANNED:            'planned',
  UNDER_CONSTRUCTION: 'under_construction',
  ACTIVE:             'active',
  DAMAGED:            'damaged',
  DESTROYED:          'destroyed',
} as const;

export const SUPPLY_ROUTE_STATUSES = {
  ACTIVE:    'active',
  DISRUPTED: 'disrupted',
  INACTIVE:  'inactive',
} as const;