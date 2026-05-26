/**
 * Admin Test Mode types for perspective and action delegation.
 */

/**
 * Distinguishes between what the admin sees vs who they're acting as.
 */
export interface AdminTestContext {
  /**
   * Viewing As: Controls what data/UI perspective is shown.
   * May be simulated due to Base44 auth limitations.
   * null = admin's own view
   */
  viewingAsPlayerId: string | null;
  
  /**
   * Acting As: Controls which CampaignPlayer the admin is submitting actions for.
   * Only available in test campaigns or for test players.
   * null = actions submitted as authenticated user's player
   */
  actingAsPlayerId: string | null;
}

/**
 * Player record extended with test mode metadata.
 */
export interface TestPlayerRecord {
  id: string;
  campaign_id: string;
  user_id: string | null; // null for test players
  display_name: string;
  color: string;
  faction_name?: string;
  is_admin: boolean;
  is_test_player: boolean;
  is_ready: boolean;
  is_eliminated: boolean;
}

/**
 * Eligibility check for acting-as a specific player.
 */
export interface ActingAsEligibility {
  canActAs: boolean;
  reason?: string;
  requiresTestCampaign: boolean;
  isTestPlayer: boolean;
  isAdmin: boolean;
}