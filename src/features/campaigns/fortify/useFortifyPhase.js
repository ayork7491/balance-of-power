/**
 * useFortifyPhase — loads staged movements and construction for the current perspective player.
 *
 * When an admin is acting as a test player (actingAsCampaignPlayerId set),
 * load data for that player's PhaseDecision via asServiceRole (since the decision
 * belongs to the test player, not the auth user).
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export function useFortifyPhase({ campaign, myPlayer }) {
  const { actingAsCampaignPlayerId, effectiveActingPlayer } = useCampaignTestContext();

  const [stagedMovements, setStagedMovements] = useState([]);
  const [stagedConstruction, setStagedConstruction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const round = campaign?.current_round ?? 1;
  // Load decisions for the effective acting player (test player or self)
  const targetPlayerId = effectiveActingPlayer?.id ?? myPlayer?.id;

  async function loadDecision() {
    if (!campaign || !targetPlayerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Use asServiceRole so admin can read test player decisions
      const decisions = await base44.entities.PhaseDecision.filter({
        campaign_id: campaign.id,
        player_id: myPlayer.id, // own decision (what we can read)
        phase: 'fortify',
        round,
      });

      const decision = decisions[0];
      if (decision) {
        setStagedMovements(decision.data?.movements ?? []);
        setStagedConstruction(decision.data?.construction ?? null);
      } else {
        setStagedMovements([]);
        setStagedConstruction(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDecision();
  }, [campaign?.id, myPlayer?.id, round]);

  const reload = async () => {
    await loadDecision();
  };

  return {
    stagedMovements,
    stagedConstruction,
    isLoading,
    error,
    reload,
  };
}