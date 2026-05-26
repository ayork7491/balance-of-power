/**
 * CampaignPhase — the ordered sequence of phases in each campaign round.
 * String literal union (not enum) for JSON compatibility.
 *
 * Phase order: draft → deploy → attack → battle → fortify → (repeat)
 * 'complete' is a terminal state, not a repeating phase.
 */
export type CampaignPhase =
  | 'draft'
  | 'deploy'
  | 'attack'
  | 'battle'
  | 'fortify'
  | 'complete';

/**
 * CampaignStatus — overall lifecycle state of a campaign.
 */
export type CampaignStatus =
  | 'lobby'      // Waiting for players to join and ready up
  | 'active'     // Campaign is running
  | 'paused'     // Admin has paused the campaign
  | 'complete'   // Victory condition met
  | 'archived';  // Archived, no longer active