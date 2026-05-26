/**
 * useFortifyLockStatus — hook for fetching fortify phase lock status for all players.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useFortifyLockStatus({ campaign }) {
  const [allLockStatus, setAllLockStatus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!campaign) {
      setIsLoading(false);
      return;
    }

    async function loadLockStatus() {
      setIsLoading(true);
      setError(null);
      try {
        const decisions = await base44.asServiceRole.entities.PhaseDecision.filter({
          campaign_id: campaign.id,
          phase: 'fortify',
          round: campaign.current_round ?? 1,
        });

        const lockStatus = decisions.map(d => ({
          player_id: d.player_id,
          is_locked: d.is_locked ?? false,
          locked_at: d.locked_at,
        }));

        setAllLockStatus(lockStatus);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadLockStatus();
  }, [campaign?.id, campaign?.current_round]);

  return { allLockStatus, isLoading, error };
}