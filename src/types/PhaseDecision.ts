/**
 * PhaseDecision — a player's set of decisions for a given phase in a round.
 * Stored as a Base44 entity.
 *
 * CRITICAL SECURITY NOTE:
 * PhaseDecision records must NEVER be exposed to other players before is_locked = true.
 * This is enforced at the data-access layer (query filters), not just the UI.
 * Reading another player's unlocked decisions breaks the hidden-information model.
 */
import type { CampaignPhase } from './CampaignPhase';

export interface PhaseDecision {
  id: string;
  created_by_id: string;
  campaign_id: string;
  /** CampaignPlayer ID of the player making decisions */
  player_id: string;
  round: number;
  phase: CampaignPhase;
  /**
   * Serialised decision payload — shape varies by phase:
   *   deploy: { [territory_id]: troops_to_add }
   *   attack: [{ from_territory_id, to_territory_id, troops }]
   *   fortify: [{ from_territory_id, to_territory_id, troops }]
   *   draft: { [territory_id]: player_id } (admin-assigned only)
   */
  decisions: Record<string, unknown>;
  /**
   * When true, this player's decisions are final for the phase.
   * Only after ALL players are locked does the phase engine resolve.
   */
  is_locked: boolean;
  /** ISO timestamp when the player locked their decisions */
  locked_at?: string;
  created_date?: string;
  updated_date?: string;
}