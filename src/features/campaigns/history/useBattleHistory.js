import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useBattleHistory({ campaignId, round, enabled = true }) {
  const [battles, setBattles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (enabled && campaignId) {
      fetchBattles();
    }
  }, [campaignId, round, enabled]);

  const fetchBattles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getBattleHistory', {
        campaign_id: campaignId,
        round,
      });
      setBattles(res.data.battles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { battles, isLoading, error, reload: fetchBattles };
}