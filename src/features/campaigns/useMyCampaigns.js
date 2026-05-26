/**
 * useMyCampaigns — Hook for loading user's campaigns with real-time updates.
 * SECURITY: Uses backend function to fetch only campaigns user belongs to.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useMyCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data via secure backend function
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await base44.functions.invoke('getMyCampaigns', {});
      const { campaigns: userCampaigns, players: playerRecords } = res.data;

      setCampaigns(userCampaigns ?? []);
      setPlayers(playerRecords ?? []);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load campaigns');
      setLoading(false);
    }
  }, []);

  // Real-time subscriptions (scoped to user's campaigns only)
  useEffect(() => {
    loadData();

    // Subscribe to campaign changes - filter client-side to user's campaigns
    const unsubCampaigns = base44.entities.Campaign.subscribe((event) => {
      setCampaigns(prev => {
        const isUserCampaign = prev.some(c => c.id === event.id);
        if (!isUserCampaign && event.type !== 'delete') {
          return prev; // Ignore campaigns user doesn't belong to
        }
        if (event.type === 'delete') {
          return prev.filter(c => c.id !== event.id);
        }
        const exists = prev.find(c => c.id === event.id);
        if (exists) {
          return prev.map(c => c.id === event.id ? event.data : c);
        }
        return prev;
      });
    });

    // Subscribe to player changes - filter to user's campaigns
    const unsubPlayers = base44.entities.CampaignPlayer.subscribe((event) => {
      setPlayers(prev => {
        if (event.type === 'delete') {
          return prev.filter(p => p.id !== event.id);
        }
        const exists = prev.find(p => p.id === event.id);
        if (exists) {
          return prev.map(p => p.id === event.id ? event.data : p);
        }
        // Only add if it's for a campaign user is in
        const isRelevant = prev.some(p => p.campaign_id === event.data?.campaign_id);
        if (isRelevant) {
          return [...prev, event.data];
        }
        return prev;
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