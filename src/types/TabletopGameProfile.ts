/**
 * TabletopGameProfile — defines the tabletop wargame a campaign is played with.
 * Stored as a Base44 entity. One user can have many profiles (different game systems).
 */
export interface TabletopGameProfile {
  id: string;
  created_by_id: string;
  /** Display name of the game system (e.g. "Warhammer 40,000 10th Ed") */
  game_name: string;
  /** Brief description of the game/faction setup */
  description?: string;
  /**
   * Average points size of a single battle in this game system.
   * Used by the battle scaling engine to map app troop counts → tabletop points.
   * e.g. 1000 (for a 1000pt Warhammer game)
   */
  average_battle_points: number;
  /** Available factions/armies the admin has configured */
  factions: FactionConfig[];
  /** Available point sizes for battles in this game */
  point_sizes: number[];
  /** Optional special house rules or notes */
  special_rules?: string;
  created_date?: string;
  updated_date?: string;
}

export interface FactionConfig {
  id: string;
  name: string;
  /** Optional hex color for display */
  color?: string;
  description?: string;
}