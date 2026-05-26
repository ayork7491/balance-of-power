/**
 * useDeployIncome — fetches public DeployIncome records for all players this round.
 * Income is public: everyone can see who received what.
 * Called after deploy phase has been started (startDeploy action).
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useDeployIncome({ campaignId, round, enabled = true }) {
  const [incomes, setIncomes] = useState([]);   // DeployIncome[] for all players
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const reload = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await base44.entities.DeployIncome.filter({ campaign_id: campaignId, round });
      setIncomes(rows);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load income data.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, round, enabled]);

  useEffect(() => { reload(); }, [reload]);

  return { incomes, loading, error, reload };
}