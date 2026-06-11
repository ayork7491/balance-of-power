import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useLeaderboard(campaignId, enabled = true) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!campaignId || !enabled) return;
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
  }, [campaignId, enabled]);

  // Initial fetch
  useEffect(() => {
    if (!campaignId || !enabled) {
      setLeaderboard([]);
      return;
    }
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Leaderboard refreshes only on explicit reload() — no broad subscriptions during play.
  // Broad TerritoryState/CampaignPlayer subscriptions during active phases caused excessive
  // backend polling and rate-limit errors. Consumers should call reload() after phase advances.

  return { leaderboard, isLoading, error, reload: fetchLeaderboard };
}