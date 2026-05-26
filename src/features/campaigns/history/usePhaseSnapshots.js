import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function usePhaseSnapshots({ campaignId, round, enabled = true }) {
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (enabled && campaignId) {
      fetchSnapshots();
    }
  }, [campaignId, round, enabled]);

  const fetchSnapshots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getPhaseSnapshots', {
        campaign_id: campaignId,
        round,
      });
      setSnapshots(res.data.snapshots || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { snapshots, isLoading, error, reload: fetchSnapshots };
}