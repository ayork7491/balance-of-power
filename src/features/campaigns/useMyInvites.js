/**
 * useMyInvites — Hook for loading user's pending campaign invites.
 * SECURITY: Uses backend function to fetch only user's own pending invites.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useMyInvites() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data via secure backend function
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await base44.functions.invoke('getMyInvites', {});
      const userInvites = res.data.invites ?? [];

      setInvites(userInvites);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load invites');
      setLoading(false);
    }
  }, []);

  // Real-time subscriptions (scoped to user's invites only)
  useEffect(() => {
    loadData();

    const unsubInvites = base44.entities.CampaignInvite.subscribe((event) => {
      setInvites(prev => {
        if (event.type === 'delete') {
          return prev.filter(i => i.id !== event.id);
        }
        const exists = prev.find(i => i.id === event.id);
        if (exists) {
          return prev.map(i => i.id === event.id ? event.data : i);
        }
        // Only add if it's a pending invite (backend already filtered, but double-check)
        if (event.data?.status === 'pending') {
          return [...prev, event.data];
        }
        return prev;
      });
    });

    return () => unsubInvites();
  }, [loadData]);

  return {
    invites,
    loading,
    error,
  };
}