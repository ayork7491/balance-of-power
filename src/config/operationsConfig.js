/**
 * operationsConfig.js — Sprint 4K
 * Display configuration for Operations Phase operations.
 */

export const OPERATION_CATEGORY_CONFIG = {
  diplomatic: {
    label: 'Diplomatic Operations',
    icon: '🎭',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  economic: {
    label: 'Economic Operations',
    icon: '⚙️',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
};

export const OPERATION_DEFINITIONS = [
  // ── Diplomatic ───────────────────────────────────────────────────────────
  {
    operation_type: 'incite_rebellion',
    category: 'diplomatic',
    label: 'Incite Rebellion',
    icon: '🔥',
    cost_type: 'influence',
    cost: 4,
    description: 'Stir unrest in a territory where you hold influence. Local rebels rise against the current controller.',
    requires: ['influence_in_target', 'region_id'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    objective_hooks: ['incite_rebellion'],
  },
  {
    operation_type: 'manufactured_crisis',
    category: 'diplomatic',
    label: 'Manufactured Crisis',
    icon: '⚡',
    cost_type: 'influence',
    cost: 4,
    description: 'Engineer a conflict in a region where you hold influence. Generates a battle card in a selected territory.',
    requires: ['region_id'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    objective_hooks: ['manufactured_crisis', 'use_influence_alter_battle'],
  },
  {
    operation_type: 'assassination',
    category: 'diplomatic',
    label: 'Assassination',
    icon: '🗡',
    cost_type: 'influence',
    cost: 6,
    description: 'Target a territory containing a structure. Primary objective: eliminate the structure. Generates a battle card.',
    requires: ['region_id', 'structure_in_target'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    objective_hooks: ['use_influence_alter_battle'],
  },
  {
    operation_type: 'mercenary_action',
    category: 'diplomatic',
    label: 'Mercenary Action',
    icon: '⚔️',
    cost_type: 'influence',
    cost: 6,
    description: 'Fund mercenary forces to engage in any valid territory. Battle participants are flagged as mercenary forces.',
    requires: ['region_id'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    objective_hooks: ['mercenary_action'],
  },

  // ── Economic ─────────────────────────────────────────────────────────────
  {
    operation_type: 'supply_raid',
    category: 'economic',
    label: 'Supply Raid',
    icon: '🚛',
    cost_type: 'resource',
    cost: 3,
    cost_resource: 'gold',
    description: 'Target an enemy supply route. Generates a battle card at the route territory.',
    requires: ['supply_route_id'],
    requires_territory: true,
    requires_supply_route: true,
    requires_hub: false,
    objective_hooks: [],
  },
  {
    operation_type: 'resource_interdiction',
    category: 'economic',
    label: 'Resource Interdiction',
    icon: '🏭',
    cost_type: 'resource',
    cost: 3,
    cost_resource: 'gold',
    description: 'Target a territory connected to a Resource Hub. Disrupts production. Generates a battle card.',
    requires: ['resource_hub_in_target'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: true,
    objective_hooks: ['cause_production_decrease'],
  },
];

export const OPERATION_BY_TYPE = Object.fromEntries(
  OPERATION_DEFINITIONS.map(op => [op.operation_type, op])
);

export const BATTLE_SOURCE_LABELS = {
  military_attack:      { label: 'Military Attack',       icon: '⚔️',  color: 'text-red-400' },
  incite_rebellion:     { label: 'Incite Rebellion',      icon: '🔥',  color: 'text-orange-400' },
  manufactured_crisis:  { label: 'Manufactured Crisis',   icon: '⚡',  color: 'text-yellow-400' },
  assassination:        { label: 'Assassination',         icon: '🗡',  color: 'text-purple-400' },
  mercenary_action:     { label: 'Mercenary Action',      icon: '⚔️',  color: 'text-purple-300' },
  supply_raid:          { label: 'Supply Raid',           icon: '🚛',  color: 'text-amber-400' },
  resource_interdiction:{ label: 'Resource Interdiction', icon: '🏭',  color: 'text-amber-300' },
};