/**
 * operationsConfig.js — Sprint 4L v1
 * Display configuration for Operations Phase operations.
 *
 * Active operations: 4 diplomatic + 4 economic = 8 total.
 * Legacy types (incite_rebellion, assassination, mercenary_action, resource_interdiction)
 * are removed from the active catalog. Historical records remain readable via BATTLE_SOURCE_LABELS.
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
  // ── Diplomatic (influence cost) ───────────────────────────────────────────
  {
    operation_type: 'uprising',
    category: 'diplomatic',
    label: 'Uprising',
    icon: '✊',
    cost_type: 'influence',
    cost: 4,
    description: 'Stir unrest in an enemy territory. Local population revolts against the current controller, reducing their garrison.',
    requires: ['region_id'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    generates_battle_type: 'uprising',
    objective_hooks: ['uprising'],
  },
  {
    operation_type: 'labor_strike',
    category: 'diplomatic',
    label: 'Labor Strike',
    icon: '🪧',
    cost_type: 'influence',
    cost: 4,
    description: 'Incite workers to strike at an enemy resource hub territory, destroying stored resources.',
    requires: ['region_id'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    generates_battle_type: 'labor_strike',
    objective_hooks: ['labor_strike'],
  },
  {
    operation_type: 'tax_protest',
    category: 'diplomatic',
    label: 'Tax Protest',
    icon: '💸',
    cost_type: 'influence',
    cost: 4,
    description: 'Challenge an opponent\'s economic control in a territory. Win to seize gold; lose and your committed troops are lost.',
    requires: ['region_id'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    generates_battle_type: 'tax_protest',
    objective_hooks: ['tax_protest'],
  },
  {
    operation_type: 'manufactured_crisis',
    category: 'diplomatic',
    label: 'Manufactured Crisis',
    icon: '⚡',
    cost_type: 'influence',
    cost: 4,
    description: 'Engineer a conflict between two territories. As the diplomat-defender, win peacekeeping to gain influence in both.',
    requires: ['region_id'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    generates_battle_type: 'manufactured_crisis',
    objective_hooks: ['manufactured_crisis'],
  },

  // ── Economic (gold cost) ──────────────────────────────────────────────────
  {
    operation_type: 'supply_route_establishment',
    category: 'economic',
    label: 'Establish Supply Route',
    icon: '🛤️',
    cost_type: 'resource',
    cost: 3,
    cost_resource: 'gold',
    description: 'Contest control of a new supply route at a territory. Win to activate the route; lose and a cooldown applies.',
    requires: [],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    generates_battle_type: 'supply_route_establishment',
    objective_hooks: [],
  },
  {
    operation_type: 'supply_route_race',
    category: 'economic',
    label: 'Supply Route Race',
    icon: '🏁',
    cost_type: 'resource',
    cost: 3,
    cost_resource: 'gold',
    description: 'Challenge an existing enemy supply route. Win to take ownership; lose and a cooldown applies.',
    requires: ['supply_route_id'],
    requires_territory: true,
    requires_supply_route: true,
    requires_hub: false,
    generates_battle_type: 'supply_route_race',
    objective_hooks: [],
  },
  {
    operation_type: 'supply_raid',
    category: 'economic',
    label: 'Supply Raid',
    icon: '🚛',
    cost_type: 'resource',
    cost: 3,
    cost_resource: 'gold',
    description: 'Raid an enemy territory to steal stored resources. Declare which resource you are targeting before the battle.',
    requires: ['declared_resource_type'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    generates_battle_type: 'supply_raid',
    objective_hooks: [],
  },
  {
    operation_type: 'supply_caravan_escort',
    category: 'economic',
    label: 'Caravan Escort',
    icon: '🐪',
    cost_type: 'resource',
    cost: 2,
    cost_resource: 'gold',
    description: 'Move a resource shipment between territories under military escort. Defend it to deliver; fail and the caravan is intercepted.',
    requires: ['shipment_destination'],
    requires_territory: true,
    requires_supply_route: false,
    requires_hub: false,
    generates_battle_type: 'supply_caravan_escort',
    objective_hooks: [],
  },
];

export const OPERATION_BY_TYPE = Object.fromEntries(
  OPERATION_DEFINITIONS.map(op => [op.operation_type, op])
);

export const BATTLE_SOURCE_LABELS = {
  military_attack:              { label: 'Military Attack',          icon: '⚔️',  color: 'text-red-400',    pillar: 'military' },
  incite_rebellion:             { label: 'Uprising (Legacy)',        icon: '🔥',  color: 'text-orange-400', pillar: 'diplomatic' },
  uprising:                     { label: 'Uprising',                 icon: '✊',  color: 'text-orange-400', pillar: 'diplomatic' },
  manufactured_crisis:          { label: 'Manufactured Crisis',      icon: '⚡',  color: 'text-purple-400', pillar: 'diplomatic' },
  labor_strike:                 { label: 'Labor Strike',             icon: '🪧',  color: 'text-blue-400',   pillar: 'diplomatic' },
  tax_protest:                  { label: 'Tax Protest',              icon: '💸',  color: 'text-blue-300',   pillar: 'diplomatic' },
  supply_raid:                  { label: 'Supply Raid',              icon: '🚛',  color: 'text-amber-400',  pillar: 'economic' },
  supply_route_establishment:   { label: 'Route Establishment',      icon: '🛤️', color: 'text-amber-300',  pillar: 'economic' },
  supply_route_race:            { label: 'Route Race',               icon: '🏁',  color: 'text-amber-300',  pillar: 'economic' },
  supply_caravan_escort:        { label: 'Caravan Escort',           icon: '🐪',  color: 'text-amber-200',  pillar: 'economic' },
};

export const BATTLE_CONSEQUENCE_TEXT = {
  siege: {
    attacker_wins: 'Attacker captures the territory with surviving troops.',
    defender_wins: 'Defender holds. Attacker troops are lost.',
  },
  double_siege: {
    attacker_wins: 'Defender eliminated. Territory becomes unoccupied — no attacker claims it. All surviving attacker troops return to their origin territories.',
    defender_wins: 'Defender holds. All attacking troops are removed.',
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