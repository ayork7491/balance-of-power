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
  military_attack:              { label: 'Military Attack',          icon: '⚔️',  color: 'text-red-400' },
  incite_rebellion:             { label: 'Incite Rebellion',         icon: '🔥',  color: 'text-orange-400' },
  uprising:                     { label: 'Uprising',                 icon: '✊',  color: 'text-orange-400' },
  manufactured_crisis:          { label: 'Manufactured Crisis',      icon: '⚡',  color: 'text-purple-400' },
  labor_strike:                 { label: 'Labor Strike',             icon: '🪧',  color: 'text-blue-400' },
  tax_protest:                  { label: 'Tax Protest',              icon: '💸',  color: 'text-blue-300' },
  supply_raid:                  { label: 'Supply Raid',              icon: '🚛',  color: 'text-amber-400' },
  supply_route_establishment:   { label: 'Route Establishment',      icon: '🛤️', color: 'text-amber-300' },
  supply_route_race:            { label: 'Route Race',               icon: '🏁',  color: 'text-amber-300' },
  supply_caravan_escort:        { label: 'Caravan Escort',           icon: '🐪',  color: 'text-amber-200' },
};

export const BATTLE_CONSEQUENCE_TEXT = {
  siege: {
    attacker_wins: 'Attacker captures the territory with surviving troops.',
    defender_wins: 'Defender holds. Attacker troops are lost.',
  },
  double_siege: {
    attacker_wins: 'Winning attacker captures the territory. Other attacker returns home.',
    defender_wins: 'Defender holds against both attackers.',
  },
  bloodbath: {
    winner: 'Winner captures loser\'s origin territory (if vacated) or returns home with survivors.',
    loser: 'Loser\'s committed troops are lost.',
  },
  capture_objectives: {
    winner: 'Winner captures the territory with survivors. Losers return reduced forces home.',
    losers: 'Losing forces return to origin with partial survivors.',
  },
  supply_route_establishment: {
    attacker_wins: 'Supply route is activated between the hub and source territory.',
    defender_wins: 'Route establishment fails. Cooldown applied before retry.',
  },
  supply_route_race: {
    attacker_wins: 'Challenger takes ownership of the contested supply route.',
    defender_wins: 'Defender retains the supply route. Challenger fails.',
  },
  supply_raid: {
    attacker_wins: 'Raider steals all [declared resource] stored in the target territory.',
    defender_wins: 'Raid repelled. No resources stolen.',
  },
  supply_caravan_escort: {
    defender_wins: 'Caravan delivered safely. Shipment added to destination territory storage.',
    attacker_wins: 'Caravan intercepted. 20% of shipment stolen; 80% destroyed.',
  },
  uprising: {
    attacker_wins: 'Garrison reduced. Diplomat gains influence in territory and region.',
    defender_wins: 'Uprising suppressed. Minor garrison loss. Diplomat influence spent.',
  },
  labor_strike: {
    attacker_wins: '50% of hub territory resources destroyed. Diplomat gains influence.',
    defender_wins: '10% resource loss. Strike suppressed.',
  },
  tax_protest: {
    attacker_wins: 'Diplomat seizes declared gold. Gains influence in territory and region.',
    defender_wins: 'Protest fails. No gold transferred.',
  },
  manufactured_crisis: {
    diplomat_wins: 'Diplomat gains 3 influence in both contested territories and 2 regional influence.',
    player_wins: 'Winning player resolves the crisis. Diplomat gains no reward.',
  },
};