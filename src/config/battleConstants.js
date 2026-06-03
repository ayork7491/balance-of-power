/**
 * config/battleConstants.js
 *
 * Shared constants for the battle system — used by both frontend components
 * and as a reference for the backend battlePhase function.
 *
 * ⚠ NOTE ON BACKEND SYNC:
 * Base44 backend functions cannot import from this file (no local imports in Deno).
 * Magic strings in functions/battlePhase must manually stay in sync with these
 * constants. This file is the SINGLE SOURCE OF TRUTH for documentation purposes.
 * Any change here must be reflected in functions/battlePhase.
 */

// ─── Battle Types ─────────────────────────────────────────────────────────────

export const BATTLE_TYPES = /** @type {const} */ ({
  SKIRMISH:           'skirmish',
  SIEGE:              'siege',
  DOUBLE_SIEGE:       'double_siege',
  CAPTURE_OBJECTIVES: 'capture_objectives',
  BLOODBATH:          'bloodbath',
});

/** @type {string[]} */
export const BATTLE_TYPE_VALUES = Object.values(BATTLE_TYPES);

// ─── Battle Statuses ──────────────────────────────────────────────────────────

export const BATTLE_STATUSES = /** @type {const} */ ({
  // Active / open
  PENDING:            'pending',
  AWAITING_RESULT:    'awaiting_result',

  // In-progress approval
  RESULT_SUBMITTED:   'result_submitted',
  AWAITING_APPROVAL:  'awaiting_approval',

  // Terminal
  RESOLVED:           'resolved',
  AUTO_RESOLVED:      'auto_resolved',
  FORFEITED:          'forfeited',

  // Carryover lifecycle
  DELAYED:            'delayed',
  ACTIVE_CARRYOVER:   'active_carryover',
  PENDING_APPROVAL:   'pending_approval',  // carryover result submitted, awaiting sign-off
});

/** @type {string[]} */
export const BATTLE_STATUS_VALUES = Object.values(BATTLE_STATUSES);

/** Statuses considered "resolved/terminal" — no further action needed */
export const RESOLVED_STATUSES = [
  BATTLE_STATUSES.RESOLVED,
  BATTLE_STATUSES.AUTO_RESOLVED,
  BATTLE_STATUSES.FORFEITED,
];

/** Statuses that indicate an open, unresolved battle (blocks phase advance) */
export const UNRESOLVED_STATUSES = [
  BATTLE_STATUSES.PENDING,
  BATTLE_STATUSES.AWAITING_RESULT,
  BATTLE_STATUSES.RESULT_SUBMITTED,
  BATTLE_STATUSES.AWAITING_APPROVAL,
  BATTLE_STATUSES.ACTIVE_CARRYOVER,
  BATTLE_STATUSES.PENDING_APPROVAL,
];

/** Statuses where a player can vote/set a preference */
export const VOTABLE_STATUSES = [
  BATTLE_STATUSES.PENDING,
  BATTLE_STATUSES.AWAITING_RESULT,
  BATTLE_STATUSES.ACTIVE_CARRYOVER,
];

/** Statuses that mean a result has been submitted and is awaiting approval */
export const APPROVABLE_STATUSES = [
  BATTLE_STATUSES.RESULT_SUBMITTED,
  BATTLE_STATUSES.AWAITING_APPROVAL,
  BATTLE_STATUSES.PENDING_APPROVAL,
];

/** Statuses in the carryover lifecycle (from prior rounds, still actionable) */
export const CARRYOVER_STATUSES = [
  BATTLE_STATUSES.DELAYED,
  BATTLE_STATUSES.ACTIVE_CARRYOVER,
  BATTLE_STATUSES.PENDING_APPROVAL,
];

// ─── Battle Preference Values ─────────────────────────────────────────────────

export const BATTLE_PREFERENCES = /** @type {const} */ ({
  PLAY_TABLETOP: 'play_tabletop',
  AUTO_RESOLVE:  'auto_resolve',
  DELAY:         'delay',
  FORFEIT:       'forfeit',
});

/** @type {string[]} */
export const BATTLE_PREFERENCE_VALUES = Object.values(BATTLE_PREFERENCES);

/** UI display config for each preference */
export const PREFERENCE_UI = [
  { key: BATTLE_PREFERENCES.PLAY_TABLETOP, label: 'Play Tabletop', color: 'text-status-locked' },
  { key: BATTLE_PREFERENCES.AUTO_RESOLVE,  label: 'Auto-Resolve',  color: 'text-status-info' },
  { key: BATTLE_PREFERENCES.DELAY,         label: 'Delay',          color: 'text-yellow-400' },
  { key: BATTLE_PREFERENCES.FORFEIT,       label: 'Forfeit',         color: 'text-destructive' },
];

// ─── Tally Outcomes ───────────────────────────────────────────────────────────

export const TALLY_OUTCOMES = /** @type {const} */ ({
  AUTO_RESOLVE:  'auto_resolve',
  DELAY:         'delay',
  TABLETOP:      'tabletop',
  FORFEIT_ONLY:  'forfeit_only',
});

// ─── Result Sources ───────────────────────────────────────────────────────────

export const RESULT_SOURCES = /** @type {const} */ ({
  MANUAL:  'manual',
  AUTO:    'auto',
  FORFEIT: 'forfeit',
});

// ─── Carryover / Recovery ─────────────────────────────────────────────────────

/** Max rounds back to search for carryover cards */
export const MAX_CARRYOVER_ROUNDS = 10;

/** Statuses that block phase advance when found in prior rounds */
export const CARRYOVER_BLOCKERS = [
  BATTLE_STATUSES.ACTIVE_CARRYOVER,
  BATTLE_STATUSES.PENDING_APPROVAL,
  BATTLE_STATUSES.AWAITING_APPROVAL,
  BATTLE_STATUSES.RESULT_SUBMITTED,
];