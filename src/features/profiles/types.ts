/**
 * features/profiles/types.ts
 *
 * Canonical TypeScript types for TabletopGameProfile.
 * These are the single source of truth — all forms, cards, hooks,
 * and future campaign selection UI must import from here.
 *
 * Canonical fields:
 *   id, owner_user_id, game_name, troop_currency_name,
 *   average_battle_size, factions, terminology, notes,
 *   created_date, updated_date
 */

/** A single faction/army type within a profile. */
export interface Faction {
  /** Client-generated UUID; stable across edits. */
  id: string;
  /** Display name — must be non-empty and unique within a profile. */
  name: string;
  /** Optional free-text description. */
  description: string;
}

/**
 * Terminology overrides. Every key is optional.
 * When present, the value replaces the BoP default label in campaign UIs.
 */
export interface ProfileTerminology {
  troop?: string;
  territory?: string;
  battle?: string;
  campaign?: string;
  deploy_phase?: string;
  attack_phase?: string;
  fortify_phase?: string;
}

/**
 * Full TabletopGameProfile record as returned by the Base44 entity API.
 * `id`, `created_date`, and `updated_date` are injected by the platform.
 */
export interface TabletopGameProfile {
  id: string;
  owner_user_id: string;
  game_name: string;
  /** Defaults to "Troops" when not set. */
  troop_currency_name: string;
  /** Average per-side troop count for a standard tabletop battle. Must be > 0. */
  average_battle_size: number;
  factions: Faction[];
  terminology: ProfileTerminology;
  notes: string;
  created_date: string;
  updated_date: string;
}

/**
 * The writable subset used when creating or updating a profile.
 * Omits platform-managed fields (id, created_date, updated_date).
 */
export type ProfileFormData = Omit<TabletopGameProfile, 'id' | 'created_date' | 'updated_date'>;

/** Default/blank form state for the create form. */
export const DEFAULT_PROFILE_FORM: ProfileFormData = {
  owner_user_id: '',
  game_name: '',
  troop_currency_name: '',
  average_battle_size: 1000,
  factions: [],
  terminology: {},
  notes: '',
};

/**
 * Validation errors keyed by form field.
 * Used by validateProfileForm and surfaced in the UI.
 */
export interface ProfileValidationErrors {
  game_name?: string;
  average_battle_size?: string;
  factions?: string;
}

/**
 * Validate a ProfileFormData object.
 * Returns an errors object — empty means valid.
 */
export function validateProfileForm(form: ProfileFormData): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};

  if (!form.game_name.trim()) {
    errors.game_name = 'Game name is required.';
  }

  if (!form.average_battle_size || form.average_battle_size <= 0) {
    errors.average_battle_size = 'Average battle size must be greater than 0.';
  }

  // Blank faction names
  const hasBlank = form.factions.some((f) => !f.name.trim());
  if (hasBlank) {
    errors.factions = 'All faction names must be non-empty.';
  }

  // Duplicate faction names (case-insensitive)
  const names = form.factions.map((f) => f.name.trim().toLowerCase()).filter(Boolean);
  const hasDupes = names.length !== new Set(names).size;
  if (hasDupes && !errors.factions) {
    errors.factions = 'Faction names must be unique within a profile.';
  }

  return errors;
}