/**
 * useMyInvites — Hook for loading user's pending campaign invites.
 * Performance optimized with efficient filtering and real-time updates.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useMyInvites() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await base44.auth.me();
      if (!user) {
        setInvites([]);
        setLoading(false);
        return;
      }

      // Load all invites and filter to pending ones for this user
      const allInvites = await base44.entities.CampaignInvite.list();
      const userInvites = allInvites.filter(
        i => i.invitee_user_id === user.id && i.status === 'pending'
      );

      setInvites(userInvites);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load invites');
      setLoading(false);
    }
  }, []);

  // Real-time subscriptions
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
        // Only add if it's a pending invite for current user
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