/**
 * useActingAsPayload — shared hook for building acting-as payloads.
 *
 * PERMISSION MODEL:
 *   - Normal player:  effectiveActingPlayer = myPlayer. No acting_as_player_id sent.
 *   - Campaign admin: effectiveActingPlayer = actingAsPlayer (if set) OR myPlayer.
 *                     acting_as_player_id only sent when explicitly delegated to a test player.
 *
 * The backend resolves acting_as_player_id=null as "use authenticated user's own CampaignPlayer".
 * So for normal players, omitting acting_as_player_id is always correct.
 *
 * Usage:
 *   const { getPayload, actingPlayer } = useActingAsPayload(myPlayer);
 *
 *   await base44.functions.invoke('setupPhase', {
 *     action: 'lockDeploy',
 *     campaign_id: campaign.id,
 *     ...getPayload(),
 *   });
 */
import { useMemo } from 'react';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export function useActingAsPayload(myPlayer) {
  const { actingAsCampaignPlayerId, effectiveActingPlayer } = useCampaignTestContext();

  // The resolved acting player — always myPlayer for normal players
  const actingPlayer = useMemo(
    () => effectiveActingPlayer ?? myPlayer ?? null,
    [effectiveActingPlayer, myPlayer],
  );

  // Only include acting_as_player_id in the payload when explicitly delegating to
  // a different player (i.e. admin acting as a test player).
  // For normal self-actions, omit it so the backend uses the authenticated user.
  const getPayload = useMemo(() => {
    return () => ({
      acting_as_player_id: actingAsCampaignPlayerId ?? null,
    });
  }, [actingAsCampaignPlayerId]);

  return {
    getPayload,
    actingPlayer,
    actingAsId: actingAsCampaignPlayerId,
    isActingAsSelf: !actingAsCampaignPlayerId,
  };
}