import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function useLeaderboard(campaignId, enabled = true) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

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

  // Issue 5: auto-refresh standings on real-time entity changes
  useEffect(() => {
    if (!campaignId || !enabled) return;

    const debouncedRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchLeaderboard(), 800);
    };

    const unsubTerritory = base44.entities.TerritoryState.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      debouncedRefresh();
    });

    const unsubCampaign = base44.entities.Campaign.subscribe((event) => {
      if (event.id !== campaignId && event.data?.id !== campaignId) return;
      debouncedRefresh();
    });

    const unsubPlayer = base44.entities.CampaignPlayer.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      debouncedRefresh();
    });

    return () => {
      unsubTerritory();
      unsubCampaign();
      unsubPlayer();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [campaignId, enabled, fetchLeaderboard]);

  return { leaderboard, isLoading, error, reload: fetchLeaderboard };
}