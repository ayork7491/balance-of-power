/**
 * Campaign Validation Utilities
 * Centralized validation guards for campaign operations.
 */

/**
 * Validate campaign start prerequisites.
 */
export function validateCampaignStart(campaign, adminUserId, players) {
  const errors = [];
  
  if (!campaign) {
    errors.push('Campaign not found');
  } else {
    if (campaign.admin_user_id !== adminUserId) {
      errors.push('Only the campaign admin can start the campaign');
    }
    if (campaign.status !== 'lobby') {
      errors.push('Campaign has already started or is no longer in the lobby');
    }
  }
  
  if (!players || players.length < 2) {
    errors.push('At least 2 players are required to start');
  }
  
  if (players && players.length >= 2) {
    const notReady = players.filter(p => !p.is_ready);
    if (notReady.length > 0) {
      const names = notReady.map(p => p.display_name).join(', ');
      errors.push(`Not all players are ready. Waiting on: ${names}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate campaign cleanup (delete/archive).
 */
export function validateCampaignCleanup(campaign, adminUserId) {
  const errors = [];
  
  if (!campaign) {
    errors.push('Campaign not found');
  } else if (campaign.admin_user_id !== adminUserId) {
    errors.push('Only the campaign admin can delete or archive this campaign');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate player is in campaign.
 */
export function validatePlayerMembership(campaign, myPlayer) {
  const errors = [];
  
  if (!campaign) {
    errors.push('Campaign not found');
  } else if (!myPlayer) {
    errors.push('You are not a player in this campaign');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate admin access (campaign or platform level).
 */
export function validateAdminAccess(campaign, userId, userRole) {
  const errors = [];
  
  if (!campaign) {
    errors.push('Campaign not found');
  } else {
    const isCampaignAdmin = campaign.admin_user_id === userId;
    const isPlatformAdmin = userRole === 'admin';
    
    if (!isCampaignAdmin && !isPlatformAdmin) {
      errors.push('Admin privileges required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}