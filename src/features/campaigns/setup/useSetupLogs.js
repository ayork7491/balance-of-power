/**
 * useSetupLogs — fetches only PUBLIC setup log entries for a campaign.
 *
 * Privacy contract:
 *   - The SetupLog entity filter is { campaign_id, is_public: true }.
 *   - Private logs (troop_staged, auto_submitted with placement data) are
 *     never fetched by this hook. Filtering is done server-side by the query,
 *     not post-fetch on the client.
 *   - Real-time subscription also guards: only events with is_public=true
 *     are appended to local state.
 *
 * Base44 limitation:
 *   Base44 entity queries do not enforce row-level security on is_public.
 *   Any client that knows a SetupLog entity ID can still fetch it directly.
 *   True privacy enforcement must be done via a backend function if needed.
 *   For V1, the query filter { is_public: true } is sufficient because:
 *     (a) log IDs are not guessable (UUID), and
 *     (b) the subscription only surfaces is_public=true events.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useSetupLogs({ campaignId, phase = null }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      // Only request public logs — filter is server-side
      const filter = { campaign_id: campaignId, is_public: true };
      if (phase) filter.phase = phase;
      const data = await base44.entities.SetupLog.filter(filter);
      setLogs(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } finally {
      setLoading(false);
    }
  }, [campaignId, phase]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Real-time: only append if event is public
  useEffect(() => {
    if (!campaignId) return;
    const unsub = base44.entities.SetupLog.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      if (!event.data?.is_public) return;   // never surface private logs
      if (event.type === 'create') {
        setLogs(prev => [event.data, ...prev]);
      }
    });
    return unsub;
  }, [campaignId]);

  return { logs, loading, reload };
}