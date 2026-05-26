/**
 * Acting-as permission validation helpers.
 * Centralized logic for determining if a user can act as a specific campaign player.
 * 
 * GLOBAL RULES:
 * 1. Any authenticated user can act as themselves (their own CampaignPlayer record)
 * 2. Campaign admins can act as test players in their campaign (test/debug mode)
 * 3. Platform admins can act as any player (debug override)
 * 4. Campaign admins CANNOT act as other real human players in normal campaigns
 * 5. Cannot act as eliminated players for actions that require active participation
 */

/**
 * Resolve the acting campaign player based on delegation request.
 * 
 * @param {Object} params
 * @param {Object} params.user - Authenticated user
 * @param {string} params.campaign_id - Campaign ID
 * @param {string} params.acting_as_player_id - Requested acting-as player ID (optional)
 * @param {Array} params.campaignPlayers - All campaign players (from getCampaignOverview)
 * @param {boolean} params.requireActive - Whether player must not be eliminated (default: true)
 * @returns {{ success: boolean, actingPlayer: Object|null, reason: string, code: string }}
 */
export function resolveActingCampaignPlayer({
  user,
  campaign_id,
  acting_as_player_id,
  campaignPlayers,
  requireActive = true,
}) {
  // Find user's own campaign player record
  const ownPlayer = campaignPlayers.find(p => p.user_id === user.id);
  
  // If no acting-as specified, default to own player
  if (!acting_as_player_id) {
    if (!ownPlayer) {
      return {
        success: false,
        actingPlayer: null,
        reason: 'You are not a member of this campaign.',
        code: 'NOT_CAMPAIGN_MEMBER',
      };
    }
    if (requireActive && ownPlayer.is_eliminated) {
      return {
        success: false,
        actingPlayer: ownPlayer,
        reason: 'Your player has been eliminated and cannot perform this action.',
        code: 'PLAYER_ELIMINATED',
      };
    }
    return {
      success: true,
      actingPlayer: ownPlayer,
      reason: 'Acting as yourself.',
      code: 'ACTING_AS_SELF',
    };
  }

  // Find the requested acting-as player
  const requestedPlayer = campaignPlayers.find(p => p.id === acting_as_player_id);
  
  if (!requestedPlayer) {
    return {
      success: false,
      actingPlayer: null,
      reason: 'Invalid player ID.',
      code: 'INVALID_PLAYER_ID',
    };
  }

  if (requestedPlayer.campaign_id !== campaign_id) {
    return {
      success: false,
      actingPlayer: null,
      reason: 'Player does not belong to this campaign.',
      code: 'PLAYER_NOT_IN_CAMPAIGN',
    };
  }

  // Check if acting as self
  if (requestedPlayer.id === ownPlayer?.id) {
    if (requireActive && requestedPlayer.is_eliminated) {
      return {
        success: false,
        actingPlayer: requestedPlayer,
        reason: 'Your player has been eliminated and cannot perform this action.',
        code: 'PLAYER_ELIMINATED',
      };
    }
    return {
      success: true,
      actingPlayer: requestedPlayer,
      reason: 'Acting as yourself.',
      code: 'ACTING_AS_SELF',
    };
  }

  // Check if requested player is a test player
  const isTestPlayer = requestedPlayer.is_test_player === true || 
    (requestedPlayer.user_id && requestedPlayer.user_id.startsWith('test_player_'));

  // Platform admin override (can act as anyone)
  if (user.role === 'admin') {
    if (requireActive && requestedPlayer.is_eliminated) {
      return {
        success: false,
        actingPlayer: requestedPlayer,
        reason: 'Cannot act as eliminated players (even with platform admin).',
        code: 'PLAYER_ELIMINATED',
      };
    }
    return {
      success: true,
      actingPlayer: requestedPlayer,
      reason: 'Platform admin override.',
      code: 'PLATFORM_ADMIN_OVERRIDE',
    };
  }

  // Campaign admin can act as test players only
  if (ownPlayer?.is_admin) {
    if (!isTestPlayer) {
      return {
        success: false,
        actingPlayer: null,
        reason: 'Campaign admins can only act as test players, not other real players.',
        code: 'CANNOT_ACT_AS_REAL_PLAYER',
      };
    }
    if (requireActive && requestedPlayer.is_eliminated) {
      return {
        success: false,
        actingPlayer: requestedPlayer,
        reason: 'Cannot act as eliminated test players.',
        code: 'PLAYER_ELIMINATED',
      };
    }
    return {
      success: true,
      actingPlayer: requestedPlayer,
      reason: 'Campaign admin acting as test player.',
      code: 'ADMIN_ACTING_AS_TEST',
    };
  }

  // Non-admin cannot act as others
  return {
    success: false,
    actingPlayer: null,
    reason: 'Only campaign admins can act as other players.',
    code: 'NOT_ADMIN',
  };
}

/**
 * Check if a user can act as a specific campaign player (boolean check).
 * 
 * @param {Object} params
 * @param {Object} params.user - Authenticated user
 * @param {string} params.campaign_id - Campaign ID
 * @param {string} params.target_player_id - Target player ID to act as
 * @param {Array} params.campaignPlayers - All campaign players
 * @param {boolean} params.requireActive - Whether player must not be eliminated
 * @returns {{ allowed: boolean, reason: string, code: string }}
 */
export function canActAsCampaignPlayer({
  user,
  campaign_id,
  target_player_id,
  campaignPlayers,
  requireActive = true,
}) {
  const result = resolveActingCampaignPlayer({
    user,
    campaign_id,
    acting_as_player_id: target_player_id,
    campaignPlayers,
    requireActive,
  });
  
  return {
    allowed: result.success,
    reason: result.reason,
    code: result.code,
  };
}

/**
 * Validate acting-as permission and throw error if invalid.
 * Convenience wrapper for backend functions.
 * 
 * @param {Object} params - Same as resolveActingCampaignPlayer
 * @throws {Error} If validation fails
 * @returns {Object} The resolved acting player
 */
export function validateActingAsPermission(params) {
  const result = resolveActingCampaignPlayer(params);
  
  if (!result.success) {
    const error = new Error(result.reason);
    error.code = result.code;
    throw error;
  }
  
  return result.actingPlayer;
}

/**
 * Get human-readable message for acting-as status.
 * 
 * @param {Object} resolutionResult - Result from resolveActingCampaignPlayer
 * @returns {string} User-friendly message
 */
export function getActingAsMessage(resolutionResult) {
  if (!resolutionResult.success) {
    return resolutionResult.reason;
  }
  
  switch (resolutionResult.code) {
    case 'ACTING_AS_SELF':
      return 'You can act as yourself.';
    case 'ADMIN_ACTING_AS_TEST':
      return 'Campaign admins can act as test players in test campaigns.';
    case 'PLATFORM_ADMIN_OVERRIDE':
      return 'Platform admin override active.';
    default:
      return resolutionResult.reason;
  }
}