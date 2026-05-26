/**
 * useFortifyLockStatus — hook for fetching fortify phase lock status for all players.
 * Uses safe getFortifyLockStatus endpoint that does NOT expose private movements/construction.
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
        const res = await base44.functions.invoke('getFortifyLockStatus', {
          campaign_id: campaign.id,
          round: campaign.current_round ?? 1,
        });
        setAllLockStatus(res.data.lock_status ?? []);
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