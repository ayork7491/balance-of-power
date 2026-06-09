/**
 * influenceActionFramework.js — Sprint 4M
 *
 * Reusable Influence Action framework.
 * Each action definition is a pure config object — no side effects, no imports.
 * The backend (intelligencePhase) reads action IDs from this registry and
 * executes the matching resolution_logic key.
 *
 * Framework contract per action:
 *   action_id         — unique stable identifier (used by backend)
 *   name              — display label
 *   description       — player-facing explanation
 *   category          — 'intelligence' | 'diplomacy' (extensible)
 *   cost_type         — 'influence' (all current actions)
 *   cost              — spendable influence amount
 *   target_rules      — what the action can target: 'territory' | 'region' | 'territory_or_region'
 *   report_type       — IntelligenceReport.report_type produced (null for non-intel actions)
 *   resolution_logic  — key matched by backend to determine consequence handler
 *   reveals           — human-readable list of what this action reveals (intel actions only)
 *   icon              — display emoji
 *   pillar_color      — tailwind class for accent coloring
 *
 * To add a future action (e.g. Broker Peace, Non-Aggression Pact):
 *   1. Add a new entry to INFLUENCE_ACTION_DEFINITIONS below.
 *   2. Add the matching resolution handler in the intelligencePhase backend.
 *   3. No other files need modification.
 */

export const INFLUENCE_ACTION_DEFINITIONS = [
  // ── Intelligence Actions ────────────────────────────────────────────────────
  {
    action_id: 'recon_territory',
    name: 'Recon Territory',
    description: 'Deploy scouts to reveal exact troop count, structures, and supply routes in a target territory.',
    category: 'intelligence',
    cost_type: 'influence',
    cost: 2,
    target_rules: 'territory',
    report_type: 'recon_territory',
    resolution_logic: 'recon_territory',
    reveals: ['Exact troop count', 'Structures', 'Active supply routes'],
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
    resolution_logic: 'audit_stockpile',
    reveals: ['Gold', 'Iron', 'Timber', 'Stone', 'Food'],
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
    resolution_logic: 'investigate_influence',
    reveals: ['Permanent influence totals per player', 'Spendable influence totals per player'],
    icon: '🕵️',
    pillar_color: 'text-purple-400',
    border_color: 'border-purple-500/30',
    bg_color: 'bg-purple-500/10',
  },

  // ── Future Diplomacy Actions (stubs — not yet active) ──────────────────────
  // Uncomment and implement resolution handlers when ready:
  //
  // {
  //   action_id: 'broker_peace',
  //   name: 'Broker Peace',
  //   category: 'diplomacy',
  //   cost: 5,
  //   target_rules: 'two_players',
  //   report_type: null,
  //   resolution_logic: 'broker_peace',
  // },
  // {
  //   action_id: 'non_aggression_pact',
  //   name: 'Non-Aggression Pact',
  //   category: 'diplomacy',
  //   cost: 4,
  //   target_rules: 'player',
  //   report_type: null,
  //   resolution_logic: 'non_aggression_pact',
  // },
];

/** Fast lookup by action_id */
export const INFLUENCE_ACTION_BY_ID = Object.fromEntries(
  INFLUENCE_ACTION_DEFINITIONS.map(a => [a.action_id, a])
);

/** Active intelligence actions only */
export const INTELLIGENCE_ACTIONS = INFLUENCE_ACTION_DEFINITIONS.filter(
  a => a.category === 'intelligence'
);

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