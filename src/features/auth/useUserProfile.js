/**
 * features/auth/useUserProfile.js
 *
 * Hook for reading and updating the authenticated user's profile.
 *
 * Reads:  base44.auth.me()
 * Writes: base44.auth.updateMe({ display_name, default_color })
 *
 * Resolves a `displayName` convenience field:
 *   display_name → full_name → email prefix → 'Commander'
 *
 * Error handling:
 *   Both load and update errors are caught and stored in `error`.
 *   Callers can inspect `error` to show user-facing messages.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/** Resolve the best display name from the raw user object. */
function resolveDisplayName(user) {
  if (!user) return 'Commander';
  return (
    user.display_name ||
    user.full_name ||
    (user.email ? user.email.split('@')[0] : null) ||
    'Commander'
  );
}

export function useUserProfile() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);   // string | null — user-facing message

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await base44.auth.me();
      setUser(me ? { ...me, displayName: resolveDisplayName(me) } : null);
    } catch (err) {
      setError('Failed to load your profile. Please refresh the page.');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * updateProfile — persist display_name and/or default_color.
   * Returns the updated user on success, or throws on failure.
   * Caller is responsible for showing success/error UI.
   */
  const updateProfile = useCallback(async ({ display_name, default_color }) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await base44.auth.updateMe({ display_name, default_color });
      const withDisplayName = { ...updated, displayName: resolveDisplayName(updated) };
      setUser(withDisplayName);
      return withDisplayName;
    } catch (err) {
      const msg = err?.message || 'Failed to save profile. Please try again.';
      setError(msg);
      throw err;  // re-throw so the page can react (e.g. keep save button enabled)
    } finally {
      setSaving(false);
    }
  }, []);

  return { user, loading, saving, error, updateProfile, refresh: load };
}