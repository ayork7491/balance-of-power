import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useLeaderboard(campaignId, enabled = true) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!campaignId || !enabled) {
      setLeaderboard([]);
      setIsLoading(false);
      return;
    }
    fetchLeaderboard();
  }, [campaignId, enabled]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getLeaderboard', { campaign_id: campaignId });
      setLeaderboard(res.data.leaderboard || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { leaderboard, isLoading, error, reload: fetchLeaderboard };
}