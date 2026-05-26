/**
 * BattleCard — represents a tabletop battle generated from one or more attacks.
 *
 * IMPORTANT: One BattleCard does NOT always correspond to one attack.
 *   - siege / double_siege / capture_objectives: one target territory, one or more attackers.
 *   - bloodbath: two territories attacking each other simultaneously — ONE card covers BOTH directions.
 *   - skirmish: auto-resolved, no BattleCard created.
 *
 * Battle type decision tree (evaluated after committed troop deduction + territory vacation):
 *   bloodbath:           mutual attacks between the same two territories (A→B AND B→A)
 *   skirmish:            1 attacker, target is neutral or vacated (0 troops) → auto-resolve, no card
 *   capture_objectives:  2+ attackers, target is neutral or vacated → requires tabletop resolution
 *   siege:               1 attacker, target has a live defender
 *   double_siege:        2+ attackers, target has a live defender
 *
 * Battle scaling:
 *   scale_factor  = total_troops_in_battle / avg_battle_size  (min 1.0)
 *   tabletop_size = round(total_troops_in_battle / scale_factor)
 *   These allow very large app-scale conflicts to be played at a reasonable tabletop size.
 */

/** Five canonical battle types. Used in BattleCard.battle_type (entity) and here. */
export type BattleCardType =
  | 'skirmish'           // auto-resolved, no card; included for completeness
  | 'siege'              // 1 attacker vs defender
  | 'double_siege'       // 2+ attackers vs defender
  | 'capture_objectives' // 2+ attackers vs neutral/vacated territory
  | 'bloodbath';         // mutual attack pair — one card, no single defender

/** Canonical status lifecycle for a BattleCard. */
export type BattleCardStatus =
  | 'pending'            // generated, awaiting tabletop play
  | 'awaiting_result'    // all participants notified, result not yet entered
  | 'result_submitted'   // winner submitted; awaiting opponent approval
  | 'awaiting_approval'  // opponent has been notified, hasn't approved yet
  | 'resolved'           // approved and applied to territory state
  | 'auto_resolved'      // system auto-resolved (timeout / forfeit)
  | 'delayed'            // admin marked as delayed
  | 'forfeited';         // one side forfeited

/**
 * Attacker entry within a BattleCard.
 * Bloodbath cards have entries for BOTH sides — use origin_territory_id to distinguish.
 */
export interface BattleCardAttacker {
  player_id: string;
  origin_territory_id: string;
  committed_troops: number;
}

export interface BattleCard {
  id: string;
  campaign_id: string;
  round: number;
  battle_type: BattleCardType;

  /**
   * Primary contested territory.
   * For bloodbath: lexicographically first of the two mutual-attack territories.
   * For all others: the territory being attacked.
   */
  target_territory_id: string;

  /**
   * Defender's CampaignPlayer ID.
   * null for neutral / vacated territories and bloodbath cards.
   */
  defender_player_id: string | null;
  defender_troops: number;

  /** All attacking entries. Bloodbath includes entries from both territories. */
  attackers: BattleCardAttacker[];

  total_attacking_troops: number;
  total_troops_in_battle: number;

  /** scale_factor = total_troops / avg_battle_size (≥1.0) */
  scale_factor: number;
  /** Scaled-down tabletop point total */
  tabletop_size: number;

  status: BattleCardStatus;

  /** true only for bloodbath cards */
  is_mutual: boolean;

  /**
   * Submitted result object: { winner_player_id, surviving_tabletop_troops, notes, submitted_by, submitted_at }
   */
  result?: Record<string, unknown>;

  /** Approval records: { player_id, approved, flagged, at }[] */
  approvals?: Array<Record<string, unknown>>;

  resolved_at?: string;
  created_date?: string;
  updated_date?: string;
}