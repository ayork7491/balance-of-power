/**
 * useCampaign — Campaign data hook.
 * SECURITY: Uses backend function to validate membership before loading data.
 *
 * Rate-limit audit fix: removed all entity subscriptions (Campaign, CampaignPlayer,
 * CampaignInvite). These caused broad background traffic and cascading re-renders.
 * During active gameplay the campaign phase/round changes rarely — we use a 30s
 * lightweight poll instead. Explicit reload() is called after any phase action.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Poll interval during active gameplay (ms). Only fires if the tab is focused.
const POLL_INTERVAL_MS = 30_000;

export function useCampaign(campaignId) {
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryRef = useRef(null);
  const pollRef = useRef(null);
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
      const status = err?.response?.status ?? err?.status ?? 0;
      // 404/403 during phase transitions are transient — retry silently
      const isTransient = status === 404 || status === 403 || status === 0 || !status;
      if (!hasDataRef.current && !isTransient) {
        setError(err.message || 'Failed to load campaign');
      }
      // Retry with back-off on transient errors only
      if (isTransient) {
        retryRef.current = setTimeout(() => loadData(), 3000);
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!campaignId) return;

    loadData();

    // Lightweight poll — only when tab is visible, no entity subscriptions
    const schedulePoll = () => {
      pollRef.current = setTimeout(async () => {
        if (document.visibilityState === 'visible') {
          await loadData();
        }
        schedulePoll();
      }, POLL_INTERVAL_MS);
    };
    schedulePoll();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { campaign, players, invites, myPlayer, loading, error, reload: loadData };
}