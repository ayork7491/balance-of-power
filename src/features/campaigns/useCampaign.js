/**
 * useCampaign — Real-time campaign data hook.
 * SECURITY: Uses backend function to validate membership before loading data.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function useCampaign(campaignId) {
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryRef = useRef(null);
  const hasDataRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!campaignId) return;

    // Only show loading spinner on the very first load (no cached data yet)
    if (!hasDataRef.current) setLoading(true);
    setError(null);

    try {
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
      hasDataRef.current = true;
      retryRef.current = null;
    } catch (err) {
      // Don't wipe cached data on a transient error — just show a subtle error
      if (!hasDataRef.current) {
        setError(err.message || 'Failed to load campaign');
      }
      // Schedule silent retry in 4 seconds
      retryRef.current = setTimeout(() => loadData(), 4000);
    } finally {
      setLoading(false);
    }
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscriptions (scoped to this campaign only)
  useEffect(() => {
    if (!campaignId) return;

    loadData();

    // Subscribe to campaign updates — only update if data looks valid (has id + current_phase)
    const unsubCampaign = base44.entities.Campaign.subscribe((event) => {
      if (event.id === campaignId && event.data?.current_phase) {
        setCampaign(event.data);
      }
    });

    // Subscribe to player changes
    const unsubPlayers = base44.entities.CampaignPlayer.subscribe((event) => {
      if (event.data?.campaign_id === campaignId) {
        setPlayers(prev => {
          if (event.type === 'delete') return prev.filter(p => p.id !== event.id);
          const exists = prev.find(p => p.id === event.id);
          if (exists) return prev.map(p => p.id === event.id ? event.data : p);
          return [...prev, event.data];
        });
      }
    });

    // Subscribe to invite changes
    const unsubInvites = base44.entities.CampaignInvite.subscribe((event) => {
      if (event.data?.campaign_id === campaignId) {
        setInvites(prev => {
          if (event.type === 'delete') return prev.filter(i => i.id !== event.id);
          const exists = prev.find(i => i.id === event.id);
          if (exists) return prev.map(i => i.id === event.id ? event.data : i);
          return [...prev, event.data];
        });
      }
    });

    return () => {
      unsubCampaign();
      unsubPlayers();
      unsubInvites();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { campaign, players, invites, myPlayer, loading, error, reload: loadData };
}