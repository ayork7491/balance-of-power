/**
 * useCampaign — Real-time campaign data hook.
 * Subscribes to campaign + players + invites with automatic cleanup.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useCampaign(campaignId) {
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data
  const loadData = useCallback(async () => {
    if (!campaignId) return;
    
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const user = await base44.auth.me();
      setUserId(user?.id);

      // Load campaign
      const campaigns = await base44.entities.Campaign.filter({ id: campaignId });
      const campaignData = campaigns[0] ?? null;
      setCampaign(campaignData);

      if (!campaignData) {
        setError('Campaign not found');
        setLoading(false);
        return;
      }

      // Load players
      const playersData = await base44.entities.CampaignPlayer.filter({ campaign_id: campaignId });
      setPlayers(playersData);

      // Find my player record
      const myPlayerData = playersData.find(p => p.user_id === user?.id) ?? null;
      setMyPlayer(myPlayerData);

      // Load invites
      const invitesData = await base44.entities.CampaignInvite.filter({ campaign_id: campaignId });
      setInvites(invitesData);

      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load campaign');
      setLoading(false);
    }
  }, [campaignId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!campaignId) return;

    loadData();

    // Subscribe to campaign updates
    const unsubCampaign = base44.entities.Campaign.subscribe((event) => {
      if (event.id === campaignId) {
        setCampaign(event.data);
      }
    });

    // Subscribe to player changes
    const unsubPlayers = base44.entities.CampaignPlayer.subscribe((event) => {
      if (event.data?.campaign_id === campaignId) {
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
      }
    });

    // Subscribe to invite changes
    const unsubInvites = base44.entities.CampaignInvite.subscribe((event) => {
      if (event.data?.campaign_id === campaignId) {
        setInvites(prev => {
          if (event.type === 'delete') {
            return prev.filter(i => i.id !== event.id);
          }
          const exists = prev.find(i => i.id === event.id);
          if (exists) {
            return prev.map(i => i.id === event.id ? event.data : i);
          }
          return [...prev, event.data];
        });
      }
    });

    return () => {
      unsubCampaign();
      unsubPlayers();
      unsubInvites();
    };
  }, [campaignId, loadData]);

  // Update myPlayer when userId or players change
  useEffect(() => {
    if (!userId || players.length === 0) {
      setMyPlayer(null);
      return;
    }
    const my = players.find(p => p.user_id === userId) ?? null;
    setMyPlayer(my);
  }, [userId, players]);

  return {
    campaign,
    players,
    invites,
    myPlayer,
    userId,
    loading,
    error,
    reload: loadData,
  };
}