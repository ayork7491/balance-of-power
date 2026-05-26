/**
 * Campaign — the core game session entity.
 * Stored as a Base44 entity. One campaign has many CampaignPlayers, Territories, and BattleCards.
 */
import type { CampaignPhase, CampaignStatus } from './CampaignPhase';

export interface Campaign {
  id: string;
  created_by_id: string;
  /** Display name of the campaign */
  name: string;
  /** Current lifecycle status */
  status: CampaignStatus;
  /** Current round number (1-indexed) */
  current_round: number;
  /** Current active phase within the round */
  current_phase: CampaignPhase;
  /** ISO timestamp — when this phase must be locked */
  phase_deadline?: string;
  /** ID of the MapDefinition used for this campaign */
  map_id: string;
  /** ID of the TabletopGameProfile used for this campaign */
  game_profile_id: string;
  /** User ID of the campaign admin (may differ from created_by_id after transfer) */
  admin_user_id: string;
  /** Invite code players can use to join */
  invite_code?: string;
  /** Campaign-level gameplay setting overrides (optional, falls back to GAMEPLAY_DEFAULTS) */
  settings?: CampaignSettings;
  created_date?: string;
  updated_date?: string;
}

/**
 * CampaignSettings — per-campaign overrides for gameplay defaults.
 * Any field omitted here falls back to GAMEPLAY_DEFAULTS in config/gameplay.ts.
 */
export interface CampaignSettings {
  maxPlayers?: number;
  defaultStartingTroops?: number;
  defaultMaxAttacksPerPhase?: number;
  defaultMaxFortificationsPerPhase?: number;
  maxFortificationDistance?: number;
  defaultVictoryTerritoryPercent?: number;
  eliminationVictory?: boolean;
  defaultDeployPhaseDuration?: number;
  defaultAttackPhaseDuration?: number;
  defaultBattlePhaseDuration?: number;
  defaultFortifyPhaseDuration?: number;
  autoResolveDaysAfterBattle?: number;
}