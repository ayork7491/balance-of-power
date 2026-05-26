/**
 * useMyCampaigns — Hook for loading user's campaigns with real-time updates.
 * Performance optimized with memoization and efficient subscriptions.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useMyCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await base44.auth.me();
      if (!user) {
        setCampaigns([]);
        setPlayers([]);
        setLoading(false);
        return;
      }

      // Load all campaigns user is part of
      const allCampaigns = await base44.entities.Campaign.list();
      const playerRecords = await base44.entities.CampaignPlayer.filter({ user_id: user.id });
      
      // Filter to only campaigns user is in
      const campaignIds = new Set(playerRecords.map(p => p.campaign_id));
      const userCampaigns = allCampaigns.filter(c => campaignIds.has(c.id));

      setCampaigns(userCampaigns);
      setPlayers(playerRecords);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load campaigns');
      setLoading(false);
    }
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    loadData();

    // Subscribe to campaign changes
    const unsubCampaigns = base44.entities.Campaign.subscribe((event) => {
      setCampaigns(prev => {
        const exists = prev.find(c => c.id === event.id);
        if (event.type === 'delete') {
          return prev.filter(c => c.id !== event.id);
        }
        if (exists) {
          return prev.map(c => c.id === event.id ? event.data : c);
        }
        // Only add if user is part of this campaign (check players)
        return prev;
      });
    });

    // Subscribe to player changes
    const unsubPlayers = base44.entities.CampaignPlayer.subscribe((event) => {
      setPlayers(prev => {
        if (event.type === 'delete') {
          return prev.filter(p => p.id !== event.id);
        }
        const exists = prev.find(p => p.id === event.id);
        if (exists) {
          return prev.map(p => p.id === event.id ? event.data : p);
        }
        return [...prev, event.data];
      });
    });

    return () => {
      unsubCampaigns();
      unsubPlayers();
    };
  }, [loadData]);

  return {
    campaigns,
    players,
    loading,
    error,
    reload: loadData,
  };
}