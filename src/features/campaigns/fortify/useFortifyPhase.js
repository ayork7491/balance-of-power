/**
 * useFortifyPhase — hook for managing fortify phase decisions.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export function useFortifyPhase({ campaign, myPlayer }) {
  const [stagedMovements, setStagedMovements] = useState([]);
  const [stagedConstruction, setStagedConstruction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const round = campaign?.current_round ?? 1;

  // Fetch own fortify decision
  useEffect(() => {
    if (!campaign || !myPlayer) {
      setIsLoading(false);
      return;
    }

    async function loadDecision() {
      setIsLoading(true);
      setError(null);
      try {
        const decisions = await base44.entities.PhaseDecision.filter({
          campaign_id: campaign.id,
          player_id: myPlayer.id,
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

    loadDecision();
  }, [campaign?.id, myPlayer?.id, round]);

  const reload = async () => {
    if (!campaign || !myPlayer) return;
    try {
      const decisions = await base44.entities.PhaseDecision.filter({
        campaign_id: campaign.id,
        player_id: myPlayer.id,
        phase: 'fortify',
        round,
      });
      const decision = decisions[0];
      if (decision) {
        setStagedMovements(decision.data?.movements ?? []);
        setStagedConstruction(decision.data?.construction ?? null);
      }
    } catch (err) {
      console.error('[useFortifyPhase] reload error:', err);
    }
  };

  return {
    stagedMovements,
    stagedConstruction,
    isLoading,
    error,
    reload,
  };
}