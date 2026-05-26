/**
 * useUserProfile — hook for reading and updating the authenticated user's profile.
 *
 * Reads:  base44.auth.me()
 * Writes: base44.auth.updateMe(data)
 *
 * Exposes user, loading state, and a typed updateProfile() function.
 * The fields `display_name` and `default_color` are app-level extensions
 * stored on the User entity via updateMe().
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useUserProfile() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const me = await base44.auth.me();
    setUser(me);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * updateProfile — persist partial profile fields.
   * Only `display_name` and `default_color` are writable via this hook.
   * Returns the updated user object.
   */
  const updateProfile = useCallback(async ({ display_name, default_color }) => {
    setSaving(true);
    setError(null);
    const updated = await base44.auth.updateMe({ display_name, default_color });
    setUser(updated);
    setSaving(false);
    return updated;
  }, []);

  return { user, loading, saving, error, updateProfile, refresh: load };
}