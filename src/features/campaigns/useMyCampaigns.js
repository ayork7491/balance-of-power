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

      // Filter out archived and deleted campaigns — only show active/lobby/setup/in-progress
      const HIDDEN_STATUSES = new Set(['archived', 'deleted']);
      const activeCampaigns = (userCampaigns ?? []).filter(c => !HIDDEN_STATUSES.has(c.status));
      setCampaigns(activeCampaigns);
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

    const HIDDEN_STATUSES = new Set(['archived', 'deleted']);

    // Subscribe to campaign changes - filter client-side to user's campaigns
    const unsubCampaigns = base44.entities.Campaign.subscribe((event) => {
      setCampaigns(prev => {
        const isUserCampaign = prev.some(c => c.id === event.id);
        if (!isUserCampaign) return prev;
        if (event.type === 'delete') {
          return prev.filter(c => c.id !== event.id);
        }
        if (event.type === 'update') {
          // Remove from list if it's been archived or deleted
          if (HIDDEN_STATUSES.has(event.data?.status)) {
            return prev.filter(c => c.id !== event.id);
          }
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

  const removeCampaign = useCallback((campaignId) => {
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
  }, []);

  return {
    campaigns,
    players,
    loading,
    error,
    reload: loadData,
    removeCampaign,
  };
}