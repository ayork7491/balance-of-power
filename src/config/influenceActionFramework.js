/**
 * influenceActionFramework.js — Sprint 4M/4N
 *
 * Single unified catalog for ALL Influence Actions.
 * Categories: 'intelligence' | 'diplomatic' | 'economic_protection' | 'military_support' | 'battle_manipulation'
 *
 * Framework contract per action:
 *   action_id         — unique stable identifier (used by backend)
 *   name              — display label
 *   description       — player-facing explanation
 *   category          — grouping bucket (see above)
 *   cost_type         — 'influence' (all actions spend Spendable Regional Influence)
 *   cost              — spendable influence amount
 *   target_rules      — 'none' | 'territory' | 'region' | 'territory_or_region' | 'player' | 'two_players' | 'supply_route'
 *   report_type       — IntelligenceReport.report_type produced (null for non-intel actions)
 *   resolution_logic  — key matched by backend to determine consequence handler
 *   duration          — 'instant' | 'round' | 'round_plus_one'
 *   reveals           — human-readable list of what this action reveals (intel only)
 *   effect_summary    — human-readable one-line effect description for display
 *   icon              — display emoji
 *   pillar_color      — tailwind class for accent coloring
 *   border_color      — tailwind border class
 *   bg_color          — tailwind bg class
 *
 * To add a future action:
 *   1. Add a new entry below.
 *   2. Add the matching resolution handler in the relevant backend function.
 *   No other files need modification.
 *
 * INVARIANT: ALL actions spend only Spendable (Regional) Influence.
 *            Permanent Influence is NEVER reduced by any action here.
 */

export const INFLUENCE_ACTION_DEFINITIONS = [

  // ── Intelligence ─────────────────────────────────────────────────────────────
  {
    action_id: 'recon_territory',
    name: 'Recon Territory',
    description: 'Deploy scouts to reveal exact troop count, structures, and supply routes in a target territory.',
    category: 'intelligence',
    cost_type: 'influence',
    cost: 2,
    target_rules: 'territory',
    report_type: 'recon_territory',
    resolution_logic: 'recon_territory',        // handled by: intelligencePhase
    duration: 'instant',
    reveals: ['Exact troop count', 'Structures', 'Active supply routes'],
    effect_summary: 'Reveals troop count, structures, and supply routes.',
    icon: '🔭',
    pillar_color: 'text-cyan-400',
    border_color: 'border-cyan-500/30',
    bg_color: 'bg-cyan-500/10',
  },
  {
    action_id: 'audit_stockpile',
    name: 'Audit Stockpile',
    description: 'Infiltrate an enemy territory to reveal stored resource reserves.',
    category: 'intelligence',
    cost_type: 'influence',
    cost: 3,
    target_rules: 'territory',
    report_type: 'audit_stockpile',
    resolution_logic: 'audit_stockpile',        // handled by: intelligencePhase
    duration: 'instant',
    reveals: ['Gold', 'Iron', 'Timber', 'Stone', 'Food'],
    effect_summary: 'Reveals full resource ledger and territory storage.',
    icon: '📦',
    pillar_color: 'text-amber-400',
    border_color: 'border-amber-500/30',
    bg_color: 'bg-amber-500/10',
  },
  {
    action_id: 'investigate_influence',
    name: 'Investigate Influence',
    description: 'Map the influence networks operating in a territory or region.',
    category: 'intelligence',
    cost_type: 'influence',
    cost: 3,
    target_rules: 'territory_or_region',
    report_type: 'investigate_influence',
    resolution_logic: 'investigate_influence',  // handled by: intelligencePhase
    duration: 'instant',
    reveals: ['Permanent influence totals per player', 'Spendable influence totals per player'],
    effect_summary: 'Reveals who holds influence and how much.',
    icon: '🕵️',
    pillar_color: 'text-purple-400',
    border_color: 'border-purple-500/30',
    bg_color: 'bg-purple-500/10',
  },

  // ── Diplomatic ───────────────────────────────────────────────────────────────
  {
    action_id: 'war_rations',
    name: 'War Rations',
    description: 'Issue emergency rations to your forces, reducing food upkeep requirements this round.',
    category: 'military_support',
    cost_type: 'influence',
    cost: 2,
    target_rules: 'none',
    report_type: null,
    resolution_logic: 'war_rations',            // handled by: diplomaticPhase
    duration: 'round',
    reveals: [],
    effect_summary: 'Reduces food upkeep modifier for this round.',
    icon: '🍖',
    pillar_color: 'text-red-400',
    border_color: 'border-red-500/30',
    bg_color: 'bg-red-500/10',
  },
  {
    action_id: 'influence_network',
    name: 'Influence Network',
    description: 'Activate your network to spread permanent influence to all territories adjacent to a chosen hub.',
    category: 'diplomatic',
    cost_type: 'influence',
    cost: 2,
    target_rules: 'territory',
    report_type: null,
    resolution_logic: 'influence_network',      // handled by: diplomaticPhase
    duration: 'instant',
    reveals: [],
    effect_summary: '+1 Permanent Influence to all adjacent territories.',
    icon: '🕊️',
    pillar_color: 'text-status-info',
    border_color: 'border-status-info/30',
    bg_color: 'bg-status-info/10',
  },
  {
    action_id: 'merchant_convoy',
    name: 'Merchant Convoy',
    description: 'Assign armed escorts to a supply route, protecting it from disruption for the round.',
    category: 'economic_protection',
    cost_type: 'influence',
    cost: 2,
    target_rules: 'supply_route',
    report_type: null,
    resolution_logic: 'merchant_convoy',        // handled by: diplomaticPhase
    duration: 'round',
    reveals: [],
    effect_summary: 'Target supply route cannot be disrupted this round.',
    icon: '🛡️',
    pillar_color: 'text-amber-300',
    border_color: 'border-amber-400/30',
    bg_color: 'bg-amber-400/10',
  },
  {
    action_id: 'non_aggression_pact',
    name: 'Non-Aggression Pact',
    description: 'Negotiate an agreement with a player: they cannot attack you for one full round.',
    category: 'diplomatic',
    cost_type: 'influence',
    cost: 4,
    target_rules: 'player',
    report_type: null,
    resolution_logic: 'non_aggression_pact',    // handled by: diplomaticPhase
    duration: 'round_plus_one',
    reveals: [],
    effect_summary: 'Target player cannot attack you for 1 round.',
    icon: '🤝',
    pillar_color: 'text-green-400',
    border_color: 'border-green-500/30',
    bg_color: 'bg-green-500/10',
  },
  {
    action_id: 'broker_peace',
    name: 'Broker Peace',
    description: 'Intervene diplomatically to negate battle generation at a target territory this round.',
    category: 'battle_manipulation',
    cost_type: 'influence',
    cost: 4,
    target_rules: 'territory',
    report_type: null,
    resolution_logic: 'broker_peace',           // handled by: diplomaticPhase
    duration: 'round',
    reveals: [],
    effect_summary: 'Negates battle generation at target territory this round.',
    icon: '☮️',
    pillar_color: 'text-blue-400',
    border_color: 'border-blue-500/30',
    bg_color: 'bg-blue-500/10',
  },
  {
    action_id: 'coalition_warfare',
    name: 'Coalition Warfare',
    description: 'Coerce another player into contributing troops to your battle by force of coalition.',
    category: 'military_support',
    cost_type: 'influence',
    cost: 6,
    target_rules: 'player',
    report_type: null,
    resolution_logic: 'coalition_warfare',      // handled by: diplomaticPhase
    duration: 'round',
    reveals: [],
    effect_summary: 'Forces target player to contribute to your battle.',
    icon: '⚔️',
    pillar_color: 'text-orange-400',
    border_color: 'border-orange-500/30',
    bg_color: 'bg-orange-500/10',
  },
  {
    action_id: 'power_broker',
    name: 'Power Broker',
    description: 'Use your influence to create a non-aggression pact between two other players for one round.',
    category: 'diplomatic',
    cost_type: 'influence',
    cost: 6,
    target_rules: 'two_players',
    report_type: null,
    resolution_logic: 'power_broker',           // handled by: diplomaticPhase
    duration: 'round_plus_one',
    reveals: [],
    effect_summary: 'Creates a Non-Aggression Pact between two other players.',
    icon: '👑',
    pillar_color: 'text-purple-400',
    border_color: 'border-purple-500/30',
    bg_color: 'bg-purple-500/10',
  },
];

// ── Lookups ────────────────────────────────────────────────────────────────────

/** Fast lookup by action_id */
export const INFLUENCE_ACTION_BY_ID = Object.fromEntries(
  INFLUENCE_ACTION_DEFINITIONS.map(a => [a.action_id, a])
);

/** Intelligence actions only */
export const INTELLIGENCE_ACTIONS = INFLUENCE_ACTION_DEFINITIONS.filter(
  a => a.category === 'intelligence'
);

/** Diplomatic actions only (submitted via diplomaticPhase backend) */
export const DIPLOMATIC_ACTIONS = INFLUENCE_ACTION_DEFINITIONS.filter(
  a => a.category !== 'intelligence'
);

/** Actions by category */
export const ACTIONS_BY_CATEGORY = INFLUENCE_ACTION_DEFINITIONS.reduce((acc, a) => {
  if (!acc[a.category]) acc[a.category] = [];
  acc[a.category].push(a);
  return acc;
}, {});

/** Category display config */
export const CATEGORY_CONFIG = {
  intelligence:        { label: 'Intelligence',        icon: '🔭', color: 'text-cyan-400',       border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10' },
  diplomatic:          { label: 'Diplomatic',          icon: '🕊️', color: 'text-status-info',    border: 'border-status-info/30', bg: 'bg-status-info/10' },
  battle_manipulation: { label: 'Battle Manipulation', icon: '☮️', color: 'text-blue-400',        border: 'border-blue-500/30',    bg: 'bg-blue-500/10' },
  economic_protection: { label: 'Economic Protection', icon: '🛡️', color: 'text-amber-300',       border: 'border-amber-400/30',   bg: 'bg-amber-400/10' },
  military_support:    { label: 'Military Support',    icon: '⚔️', color: 'text-red-400',          border: 'border-red-500/30',     bg: 'bg-red-500/10' },
};

/** Visibility model — public vs private information */
export const INFORMATION_VISIBILITY = {
  public: [
    'Territory ownership',
    'Structures (type only)',
    'Supply routes (existence)',
    'Resource hubs',
    'Monuments',
    'Influence presence (which players have influence)',
    'Completed objectives',
    'Generated battle cards',
    'Region control',
    'Continent control',
  ],
  private: [
    'Exact troop counts',
    'Stored resources',
    'Gold reserves',
    'Objective cards in hand',
    'Spendable influence pools',
    'Planned Operations Phase actions',
    'Resource shipments before resolution',
  ],
};