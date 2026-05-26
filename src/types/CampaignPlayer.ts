/**
 * CampaignPlayer — a user's participation record within a specific campaign.
 * Join entity between Campaign and User. Stores per-player state.
 */
export interface CampaignPlayer {
  id: string;
  created_by_id: string;
  campaign_id: string;
  user_id: string;
  /** Display name within this campaign (may differ from UserProfile.display_name) */
  display_name: string;
  /** PlayerColorId selected by or assigned to this player */
  color: string;
  /** Faction name from the TabletopGameProfile */
  faction_name?: string;
  /** Whether this player has admin privileges in the campaign */
  is_admin: boolean;
  /** Whether this player has readied up in the lobby */
  is_ready: boolean;
  /** Current total troop count across all owned territories */
  troop_count: number;
  /** Whether this player has been eliminated */
  is_eliminated: boolean;
  /** ISO timestamp of elimination, if applicable */
  eliminated_at?: string;
  created_date?: string;
  updated_date?: string;
}