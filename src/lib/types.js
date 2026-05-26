/**
 * Type Definitions (JSDoc)
 * TypeScript-like type definitions for better IDE support and documentation.
 * This file serves as a bridge until full TypeScript migration.
 */

/**
 * @typedef {Object} Campaign
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} admin_user_id
 * @property {string} status - 'lobby' | 'active' | 'paused' | 'complete' | 'archived'
 * @property {string} game_profile_id
 * @property {string} game_profile_name
 * @property {string} map_id
 * @property {string} invite_code
 * @property {number} current_round
 * @property {string} current_phase
 * @property {string} phase_deadline
 * @property {string[]} setup_order
 * @property {number} setup_current_index
 * @property {string} draft_snake_direction
 * @property {number} draft_picks_remaining
 * @property {CampaignSettings} settings
 */

/**
 * @typedef {Object} CampaignSettings
 * @property {number} max_players
 * @property {number} starting_troops
 * @property {number} max_attacks_per_phase
 * @property {number} max_fortifications_per_phase
 * @property {number} max_fortification_distance
 * @property {string} phase_schedule
 * @property {string} battle_day
 * @property {boolean} allow_faction_duplicates
 * @property {string} victory_condition
 */

/**
 * @typedef {Object} CampaignPlayer
 * @property {string} id
 * @property {string} campaign_id
 * @property {string} user_id
 * @property {string} display_name
 * @property {string} color
 * @property {string} faction_name
 * @property {boolean} is_admin
 * @property {boolean} is_ready
 * @property {number} troop_count
 * @property {boolean} is_eliminated
 * @property {string} eliminated_at
 */

/**
 * @typedef {Object} CampaignInvite
 * @property {string} id
 * @property {string} campaign_id
 * @property {string} campaign_name
 * @property {string} invited_by_user_id
 * @property {string} invited_by_name
 * @property {string} invitee_email
 * @property {string} invitee_user_id
 * @property {string} type - 'invite' | 'join_request'
 * @property {string} status - 'pending' | 'accepted' | 'declined' | 'cancelled'
 * @property {string} message
 */

/**
 * @typedef {Object} TerritoryState
 * @property {string} campaign_id
 * @property {string} map_id
 * @property {string} territory_id
 * @property {string} owner_player_id
 * @property {number} troop_count
 * @property {string[]} structures
 */

/**
 * @typedef {Object} BattleCard
 * @property {string} id
 * @property {string} campaign_id
 * @property {number} round
 * @property {string} battle_type
 * @property {string} target_territory_id
 * @property {string} defender_player_id
 * @property {number} defender_troops
 * @property {Array<BattleAttacker>} attackers
 * @property {number} total_attacking_troops
 * @property {number} total_troops_in_battle
 * @property {number} scale_factor
 * @property {number} tabletop_size
 * @property {string} status
 * @property {boolean} is_mutual
 * @property {BattleResult} result
 * @property {Array} approvals
 * @property {string} resolved_at
 * @property {boolean} result_applied
 */

/**
 * @typedef {Object} BattleAttacker
 * @property {string} player_id
 * @property {string} origin_territory_id
 * @property {number} committed_troops
 */

/**
 * @typedef {Object} BattleResult
 * @property {string} winner_player_id
 * @property {number} surviving_tabletop_troops
 * @property {string} notes
 * @property {string} submitted_by
 * @property {string} submitted_at
 * @property {string} result_source
 * @property {string} applied_at
 */

/**
 * @typedef {Object} MapDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} width
 * @property {number} height
 * @property {Array<MapRegion>} regions
 * @property {string} background_image_url
 * @property {number} min_players
 * @property {number} max_players
 * @property {Array<TerritoryDefinition>} territories
 */

/**
 * @typedef {Object} MapRegion
 * @property {string} id
 * @property {string} name
 * @property {number} control_bonus
 * @property {string} color
 */

/**
 * @typedef {Object} TerritoryDefinition
 * @property {string} territory_id
 * @property {string} name
 * @property {string} region_id
 * @property {string} continent_id
 * @property {number} cx
 * @property {number} cy
 * @property {Array<number>} points
 * @property {Array<string>} neighbors
 */

/**
 * @typedef {Object} TabletopGameProfile
 * @property {string} id
 * @property {string} owner_user_id
 * @property {string} game_name
 * @property {string} troop_currency_name
 * @property {number} average_battle_size
 * @property {Array<GameFaction>} factions
 * @property {Object} terminology
 * @property {string} notes
 */

/**
 * @typedef {Object} GameFaction
 * @property {string} id
 * @property {string} name
 * @property {string} description
 */

/**
 * @typedef {Object} PhaseDecision
 * @property {string} id
 * @property {string} campaign_id
 * @property {string} player_id
 * @property {string} phase
 * @property {number} round
 * @property {boolean} is_locked
 * @property {boolean} is_auto_submitted
 * @property {Object} data
 * @property {string} locked_at
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} id
 * @property {string} email
 * @property {string} full_name
 * @property {string} display_name
 * @property {string} role
 * @property {string} created_date
 */

export {};