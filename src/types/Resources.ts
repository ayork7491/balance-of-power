/**
 * Resources & Structures — V1 canonical types.
 *
 * V1 resources: Catan-inspired set. Do NOT add mana / fuel / data / gold — removed as non-canon.
 * V1 structures: minimal set for launch. factory / shrine / supply_depot removed as non-canon for V1.
 *
 * These type unions must stay in sync with RESOURCE_TYPES and STRUCTURE_TYPES in config/theme.ts.
 */

export type ResourceType =
  | 'brick'
  | 'lumber'
  | 'wool'
  | 'grain'
  | 'ore';

export type StructureType =
  | 'castle'
  | 'barracks'
  | 'stables';