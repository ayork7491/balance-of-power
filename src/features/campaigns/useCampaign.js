/**
 * useCampaign — Real-time campaign data hook.
 * SECURITY: Uses backend function to validate membership before loading data.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useCampaign(campaignId) {
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data via secure backend function
  const loadData = useCallback(async () => {
    if (!campaignId) return;
    
    try {
      setLoading(true);
      setError(null);

      const res = await base44.functions.invoke('getCampaignOverview', { campaign_id: campaignId });
      const { campaign: campaignData, players: playersData, invites: invitesData, myPlayer: myPlayerData } = res.data;

      if (!campaignData) {
        setError('Campaign not found');
        setLoading(false);
        return;
      }

      setCampaign(campaignData);
      setPlayers(playersData ?? []);
      setInvites(invitesData ?? []);
      setMyPlayer(myPlayerData ?? null);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load campaign');
      setLoading(false);
    }
  }, [campaignId]);

  // Real-time subscriptions (scoped to this campaign only)
  useEffect(() => {
    if (!campaignId) return;

    loadData();

    // Subscribe to campaign updates - only for this campaign
    const unsubCampaign = base44.entities.Campaign.subscribe((event) => {
      if (event.id === campaignId && event.data) {
        setCampaign(event.data);
      }
    });

    // Subscribe to player changes - only for this campaign
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

    // Subscribe to invite changes - only for this campaign
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

  return {
    campaign,
    players,
    invites,
    myPlayer,
    loading,
    error,
    reload: loadData,
  };
}