import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useHistoryLogs({ campaignId, round, phase, eventType, enabled = true }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (enabled && campaignId) {
      fetchLogs();
    }
  }, [campaignId, round, phase, eventType, enabled]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getHistoryLogs', {
        campaign_id: campaignId,
        round,
        phase,
        event_type: eventType,
      });
      setLogs(res.data.logs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { logs, isLoading, error, reload: fetchLogs };
}