/**
 * Resources & Structures — Sprint 3A canonical types.
 *
 * Sprint 3A resources: three-pillar set (gold, iron, timber, stone, food).
 *   - gold:   universal construction/building currency
 *   - iron:   military specialty structures
 *   - timber: economic infrastructure and supply routes
 *   - stone:  diplomatic structures, monuments, embassies
 *   - food:   maintenance/sustainment (troops, population, stability)
 *
 * These type unions must stay in sync with RESOURCE_TYPES in config/theme.ts.
 *
 * MIGRATION NOTE (Sprint 3A):
 *   Old V1 resources (brick, lumber, wool, grain, ore) have been replaced.
 *   References in fortifyPhase backend function and resourceGeneration.js
 *   are flagged for update in Sprint 3B when resource generation is implemented.
 */

export type ResourceType =
  | 'gold'
  | 'iron'
  | 'timber'
  | 'stone'
  | 'food';

/** All resource keys as a runtime-safe array */
export const RESOURCE_KEYS: ResourceType[] = ['gold', 'iron', 'timber', 'stone', 'food'];

/** Zero-balance record shape for initialization */
export type ResourceBundle = Record<ResourceType, number>;

export function emptyResources(): ResourceBundle {
  return { gold: 0, iron: 0, timber: 0, stone: 0, food: 0 };
}

// ─── Power Types ──────────────────────────────────────────────────────────────

export type PowerType =
  | 'military'    // occupancy_power — Rule the World
  | 'economic'    // wealth_power    — Own the World
  | 'diplomatic'; // influence_power — Lead the World

export const POWER_TYPES: PowerType[] = ['military', 'economic', 'diplomatic'];

/** Win condition key — maps to power type paths */
export type WinCondition =
  | 'rule_the_world'   // military domination
  | 'own_the_world'    // economic supremacy
  | 'lead_the_world';  // diplomatic influence

export const WIN_CONDITIONS: WinCondition[] = [
  'rule_the_world',
  'own_the_world',
  'lead_the_world',
];

// ─── Building Types ───────────────────────────────────────────────────────────

/** Pillar-scoped building type (replaces old StructureType) */
export type BuildingType =
  // Military
  | 'barracks'
  | 'war_council'
  | 'logistics_corps'
  // Diplomatic
  | 'embassy'
  | 'council_chamber'
  | 'foreign_office'
  // Economic
  | 'marketplace'
  | 'builders_guild'
  | 'trade_network'
  | 'resource_hub'
  | 'supply_route'
  | 'warehouse';

/** Which pillar a building belongs to */
export type PillarType = 'military' | 'economic' | 'diplomatic';

/** Legacy V1 structure type — kept for backward compat with existing ConstructionProject records */
export type LegacyStructureType = 'castle' | 'barracks' | 'stables';