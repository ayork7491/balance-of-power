/**
 * features/campaigns/types.ts
 *
 * Canonical TypeScript types for Campaign system.
 * All campaign pages, hooks, and components import from here.
 */

export type CampaignStatus = 'lobby' | 'active' | 'paused' | 'complete' | 'archived';
export type CampaignPhase = 'draft' | 'deploy' | 'attack' | 'battle' | 'fortify' | 'complete';
export type PhaseSchedule = 'weekly' | 'monthly' | 'manual';
export type VictoryCondition = 'domination' | 'score';
export type InviteType = 'invite' | 'join_request';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface CampaignSettings {
  max_players: number;
  starting_troops: number;
  max_attacks_per_phase: number;
  max_fortifications_per_phase: number;
  max_fortification_distance: number;
  phase_schedule: PhaseSchedule;
  battle_day: string;
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
  color: string;
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

/** Form state for campaign creation wizard */
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
  map_id: 'map_v1_standard',
  settings: { ...DEFAULT_CAMPAIGN_SETTINGS },
  invitee_emails: [],
};

export interface CampaignValidationErrors {
  name?: string;
  game_profile_id?: string;
  map_id?: string;
}

export function validateCampaignForm(form: CampaignFormData): CampaignValidationErrors {
  const errors: CampaignValidationErrors = {};
  if (!form.name.trim()) errors.name = 'Campaign name is required.';
  if (!form.game_profile_id) errors.game_profile_id = 'Please select a game profile.';
  return errors;
}