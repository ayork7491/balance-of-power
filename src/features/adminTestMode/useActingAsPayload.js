/**
 * useActingAsPayload — shared hook for building acting-as payloads.
 * 
 * All player-action calls (stage/lock/submit) should use this hook to ensure
 * consistent acting-as delegation across all phases.
 * 
 * Usage:
 *   const { getPayload, actingPlayer, actingAsId } = useActingAsPayload(myPlayer);
 *   
 *   // Then in any action:
 *   await base44.functions.invoke('deployPhase', {
 *     action: 'lockDeploy',
 *     campaign_id: campaign.id,
 *     ...getPayload(),  // spreads acting_as_player_id if set
 *   });
 */
import { useMemo } from 'react';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export function useActingAsPayload(myPlayer) {
  const { actingAsCampaignPlayerId, actingAsPlayer } = useCampaignTestContext();

  const actingPlayer = useMemo(() => {
    return actingAsPlayer || myPlayer;
  }, [actingAsPlayer, myPlayer]);

  const getPayload = useMemo(() => {
    return () => ({
      acting_as_player_id: actingAsCampaignPlayerId || null,
    });
  }, [actingAsCampaignPlayerId]);

  return {
    getPayload,
    actingPlayer,
    actingAsId: actingAsCampaignPlayerId,
    isActingAsSelf: !actingAsCampaignPlayerId,
  };
}