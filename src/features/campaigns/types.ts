/**
 * features/campaigns/types.ts
 *
 * Canonical TypeScript types for the Campaign system.
 * This is the SINGLE SOURCE OF TRUTH for all campaign-related types.
 * All campaign pages, hooks, wizard steps, and components import from here.
 *
 * Field naming convention: snake_case throughout.
 * Do NOT use camelCase variants (e.g. maxPlayers) — those belong to gameplay.ts
 * for internal engine constants only and are not stored on entities.
 */

// ─── Status / Phase Enums ─────────────────────────────────────────────────────

export type CampaignStatus = 'lobby' | 'active' | 'paused' | 'complete' | 'archived';
export type CampaignPhase =
  | 'faction_selection'
  | 'territory_draft'
  | 'initial_deploy'
  | 'deploy'
  | 'attack'
  | 'battle'
  | 'fortify'
  | 'complete';
export type PhaseSchedule = 'weekly' | 'monthly' | 'manual';
export type VictoryCondition = 'domination' | 'score';
export type InviteType = 'invite' | 'join_request';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

// ─── V1 Limits ────────────────────────────────────────────────────────────────

export const CAMPAIGN_LIMITS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  MIN_STARTING_TROOPS: 1,
  MIN_ATTACKS: 1,
  MIN_FORTIFICATIONS: 1,
  MIN_FORTIFICATION_DISTANCE: 1,
} as const;

// ─── Settings ─────────────────────────────────────────────────────────────────

/** Per-campaign gameplay settings — all stored under Campaign.settings in the entity. */
export interface CampaignSettings {
  max_players: number;               // 2–8
  starting_troops: number;           // > 0
  max_attacks_per_phase: number;     // > 0
  max_fortifications_per_phase: number; // > 0
  max_fortification_distance: number;   // > 0 (graph distance in territories)
  phase_schedule: PhaseSchedule;
  battle_day: string;                // lowercase day name
  allow_faction_duplicates: boolean;
  victory_condition: VictoryCondition;
}

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  max_players: 6,
  starting_troops: 30,
  max_attacks_per_phase: 3,
  max_fortifications_per_phase: 3,
  max_fortification_distance: 4,
  phase_schedule: 'weekly',
  battle_day: 'saturday',
  allow_faction_duplicates: false,
  victory_condition: 'domination',
};

// ─── Entity Shapes ────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  description: string;
  admin_user_id: string;
  status: CampaignStatus;
  game_profile_id: string;
  game_profile_name: string;
  map_id: string;
  invite_code: string;
  current_round: number;
  current_phase: CampaignPhase;
  phase_deadline?: string;
  settings: CampaignSettings;
  created_date: string;
  updated_date: string;
}

export interface CampaignPlayer {
  id: string;
  campaign_id: string;
  user_id: string;
  display_name: string;
  color: string;           // PlayerColorId
  faction_name?: string;
  is_admin: boolean;
  is_ready: boolean;
  troop_count: number;
  is_eliminated: boolean;
  eliminated_at?: string;
  created_date: string;
  updated_date: string;
}

export interface CampaignInvite {
  id: string;
  campaign_id: string;
  campaign_name: string;
  invited_by_user_id: string;
  invited_by_name: string;
  invitee_email: string;
  invitee_user_id?: string;
  type: InviteType;
  status: InviteStatus;
  message?: string;
  created_date: string;
  updated_date: string;
}

// ─── Form / Wizard ────────────────────────────────────────────────────────────

/** Form state used by the campaign creation wizard. */
export interface CampaignFormData {
  name: string;
  description: string;
  game_profile_id: string;
  game_profile_name: string;
  map_id: string;
  settings: CampaignSettings;
  invitee_emails: string[];
}

export const DEFAULT_CAMPAIGN_FORM: CampaignFormData = {
  name: '',
  description: '',
  game_profile_id: '',
  game_profile_name: '',
  map_id: 'shattered_crown_v1',
  settings: { ...DEFAULT_CAMPAIGN_SETTINGS },
  invitee_emails: [],
};

// ─── Validation ───────────────────────────────────────────────────────────────

export interface CampaignValidationErrors {
  name?: string;
  game_profile_id?: string;
  // settings sub-fields
  max_players?: string;
  starting_troops?: string;
  max_attacks_per_phase?: string;
  max_fortifications_per_phase?: string;
  max_fortification_distance?: string;
  // invite emails
  invitee_emails?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCampaignForm(form: CampaignFormData): CampaignValidationErrors {
  const errors: CampaignValidationErrors = {};
  const s = form.settings;

  // Required fields
  if (!form.name.trim()) errors.name = 'Campaign name is required.';
  if (!form.game_profile_id) errors.game_profile_id = 'Please select a game profile.';

  // Settings numeric bounds
  if (s.max_players < CAMPAIGN_LIMITS.MIN_PLAYERS || s.max_players > CAMPAIGN_LIMITS.MAX_PLAYERS) {
    errors.max_players = `Max players must be between ${CAMPAIGN_LIMITS.MIN_PLAYERS} and ${CAMPAIGN_LIMITS.MAX_PLAYERS}.`;
  }
  if (!s.starting_troops || s.starting_troops < CAMPAIGN_LIMITS.MIN_STARTING_TROOPS) {
    errors.starting_troops = 'Starting troops must be greater than 0.';
  }
  if (!s.max_attacks_per_phase || s.max_attacks_per_phase < CAMPAIGN_LIMITS.MIN_ATTACKS) {
    errors.max_attacks_per_phase = 'Max attacks must be greater than 0.';
  }
  if (!s.max_fortifications_per_phase || s.max_fortifications_per_phase < CAMPAIGN_LIMITS.MIN_FORTIFICATIONS) {
    errors.max_fortifications_per_phase = 'Max fortifications must be greater than 0.';
  }
  if (!s.max_fortification_distance || s.max_fortification_distance < CAMPAIGN_LIMITS.MIN_FORTIFICATION_DISTANCE) {
    errors.max_fortification_distance = 'Fortification distance must be greater than 0.';
  }

  // Invite emails — validate any provided
  if (form.invitee_emails && form.invitee_emails.length > 0) {
    const invalid = form.invitee_emails.filter(e => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      errors.invitee_emails = `Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`;
    }
  }

  return errors;
}