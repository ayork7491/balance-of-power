/**
 * config/buildingDefinitions.ts
 *
 * Sprint 3A building definition framework.
 * Definitions only — no construction gameplay implemented yet.
 *
 * Three pillars:
 *   Military   → Rule the World
 *   Economic   → Own the World
 *   Diplomatic → Lead the World
 *
 * Each building definition includes:
 *   - pillar: which power path it belongs to
 *   - cost: { gold, iron, timber, stone, food }
 *   - rounds: construction rounds required
 *   - effect: gameplay effect description (to be wired in Sprint 3B+)
 *   - max_per_territory: how many can exist in one territory (usually 1)
 */

import type { BuildingType, PillarType, ResourceBundle } from '@/types/Resources';

export interface BuildingDefinition {
  type: BuildingType;
  label: string;
  pillar: PillarType;
  cost: Partial<ResourceBundle>;
  rounds: number;
  effect: string;
  max_per_territory: number;
  notes?: string;
}

// ─── Military Buildings ───────────────────────────────────────────────────────

const MILITARY_BUILDINGS: BuildingDefinition[] = [
  {
    type: 'barracks',
    label: 'Barracks',
    pillar: 'military',
    cost: { gold: 2, iron: 1 },
    rounds: 1,
    effect: '+1 troop generation per deploy phase',
    max_per_territory: 1,
  },
  {
    type: 'war_council',
    label: 'War Council',
    pillar: 'military',
    cost: { gold: 3, iron: 2 },
    rounds: 2,
    effect: '+1 attack declaration per attack phase',
    max_per_territory: 1,
    notes: 'Campaign-wide limit applies. Only one War Council benefit per player.',
  },
  {
    type: 'logistics_corps',
    label: 'Logistics Corps',
    pillar: 'military',
    cost: { gold: 2, iron: 1, timber: 1 },
    rounds: 1,
    effect: '+1 fortification distance',
    max_per_territory: 1,
  },
];

// ─── Diplomatic Buildings ─────────────────────────────────────────────────────

const DIPLOMATIC_BUILDINGS: BuildingDefinition[] = [
  {
    type: 'embassy',
    label: 'Embassy',
    pillar: 'diplomatic',
    cost: { gold: 2, stone: 2 },
    rounds: 2,
    effect: 'Draw 4 objective cards, keep 2',
    max_per_territory: 1,
    notes: 'Can only be built in your own territories.',
  },
  {
    type: 'council_chamber',
    label: 'Council Chamber',
    pillar: 'diplomatic',
    cost: { gold: 3, stone: 2 },
    rounds: 2,
    effect: '+1 influence action per fortify phase',
    max_per_territory: 1,
  },
  {
    type: 'foreign_office',
    label: 'Foreign Office',
    pillar: 'diplomatic',
    cost: { gold: 2, stone: 1, timber: 1 },
    rounds: 1,
    effect: '+1 trade action per fortify phase',
    max_per_territory: 1,
  },
];

// ─── Economic Buildings ───────────────────────────────────────────────────────

const ECONOMIC_BUILDINGS: BuildingDefinition[] = [
  {
    type: 'marketplace',
    label: 'Marketplace',
    pillar: 'economic',
    cost: { gold: 2, timber: 1 },
    rounds: 1,
    effect: 'Activate +1 Resource Hub connection slot',
    max_per_territory: 1,
  },
  {
    type: 'builders_guild',
    label: 'Builders Guild',
    pillar: 'economic',
    cost: { gold: 3, timber: 2 },
    rounds: 2,
    effect: '+1 construction project active simultaneously',
    max_per_territory: 1,
  },
  {
    type: 'trade_network',
    label: 'Trade Network',
    pillar: 'economic',
    cost: { gold: 2, timber: 2 },
    rounds: 2,
    effect: '+1 supply caravan per fortify phase',
    max_per_territory: 1,
  },
  {
    type: 'resource_hub',
    label: 'Resource Hub',
    pillar: 'economic',
    cost: { gold: 3, timber: 1, stone: 1 },
    rounds: 2,
    effect: 'Enables up to 3 supply route connections within range 3',
    max_per_territory: 1,
    notes: 'Required anchor building for supply routes.',
  },
  {
    type: 'supply_route',
    label: 'Supply Route',
    pillar: 'economic',
    cost: { gold: 1, timber: 1 },
    rounds: 1,
    effect: 'Extracts 1 resource/round from a connected territory within range 3',
    max_per_territory: 3,
    notes: 'Requires a Resource Hub in the hub territory. Max 3 routes per hub.',
  },
  {
    type: 'warehouse',
    label: 'Warehouse / Vault',
    pillar: 'economic',
    cost: { gold: 2, stone: 1 },
    rounds: 1,
    effect: 'Stores resources safely; protects up to 5 resources from being lost on territory capture',
    max_per_territory: 1,
  },
];

// ─── Master registry ──────────────────────────────────────────────────────────

export const ALL_BUILDING_DEFINITIONS: BuildingDefinition[] = [
  ...MILITARY_BUILDINGS,
  ...DIPLOMATIC_BUILDINGS,
  ...ECONOMIC_BUILDINGS,
];

export const BUILDING_DEFINITIONS_BY_TYPE: Record<BuildingType, BuildingDefinition> =
  Object.fromEntries(ALL_BUILDING_DEFINITIONS.map(b => [b.type, b])) as Record<BuildingType, BuildingDefinition>;

export const BUILDINGS_BY_PILLAR: Record<PillarType, BuildingDefinition[]> = {
  military:   MILITARY_BUILDINGS,
  diplomatic: DIPLOMATIC_BUILDINGS,
  economic:   ECONOMIC_BUILDINGS,
};

/**
 * getBuildingDefinition — safe lookup with undefined return for unknown types.
 */
export function getBuildingDefinition(type: BuildingType): BuildingDefinition | undefined {
  return BUILDING_DEFINITIONS_BY_TYPE[type];
}