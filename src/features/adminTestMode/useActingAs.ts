import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import type { CampaignPlayer } from '@/types/CampaignPlayer';
import type { ActingAsEligibility } from './types';

/**
 * Hook for managing "Acting As" state in Admin Test Mode.
 * 
 * Separates viewing perspective from action delegation.
 * Only allows acting as test players or in test campaigns.
 */
export function useActingAs(campaignId: string, players: CampaignPlayer[]) {
  const [actingAsPlayerId, setActingAsPlayerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTestCampaign, setIsTestCampaign] = useState(false);

  // Check admin status and test campaign flag
  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      campaignId ? base44.entities.Campaign.filter({ id: campaignId }) : Promise.resolve([])
    ]).then(([user, campaigns]) => {
      setIsAdmin(user?.role === 'admin');
      const campaign = campaigns[0];
      // Test campaign detection: name contains "test" or has test players
      setIsTestCampaign(
        campaign?.name.toLowerCase().includes('test') ||
        players.some(p => p.is_test_player)
      );
    }).catch(() => {});
  }, [campaignId, players]);

  // Get acting-as player record
  const actingAsPlayer = useMemo(
    () => players.find(p => p.id === actingAsPlayerId) ?? null,
    [players, actingAsPlayerId]
  );

  // Check eligibility for acting-as a specific player
  const checkEligibility = (player: CampaignPlayer): ActingAsEligibility => {
    const isTestPlayer = player.is_test_player;
    const isOwnPlayer = player.user_id === base44.auth.me()?.id;
    
    // Can act as:
    // 1. Own player (always)
    // 2. Test players (if admin)
    // 3. Any player in test campaign (if admin)
    const canActAs = isAdmin && (isOwnPlayer || isTestPlayer || isTestCampaign);
    
    return {
      canActAs,
      reason: !canActAs 
        ? 'Can only act as own player, test players, or players in test campaigns'
        : undefined,
      requiresTestCampaign: !isTestPlayer && !isOwnPlayer,
      isTestPlayer,
      isAdmin,
    };
  };

  // Filter players that admin can act as
  const availableActingAsPlayers = useMemo(
    () => players.filter(p => checkEligibility(p).canActAs),
    [players, isAdmin, isTestCampaign]
  );

  // Reset acting-as if current selection becomes invalid
  useEffect(() => {
    if (actingAsPlayerId && !availableActingAsPlayers.find(p => p.id === actingAsPlayerId)) {
      setActingAsPlayerId(null);
    }
  }, [actingAsPlayerId, availableActingAsPlayers]);

  return {
    actingAsPlayerId,
    actingAsPlayer,
    setActingAsPlayerId,
    availableActingAsPlayers,
    checkEligibility,
    isAdmin,
    isTestCampaign,
  };
}