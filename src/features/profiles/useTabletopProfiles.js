/**
 * features/profiles/useTabletopProfiles.js
 *
 * Custom hook for all TabletopGameProfile CRUD operations.
 * Encapsulates API calls, loading/error state, and ownership filtering.
 * Pages should import this hook instead of calling base44 entities directly.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * @returns {{
 *   profiles: TabletopGameProfile[],
 *   loading: boolean,
 *   error: string|null,
 *   reload: () => Promise<void>,
 *   createProfile: (data: ProfileFormData) => Promise<TabletopGameProfile>,
 *   updateProfile: (id: string, data: ProfileFormData) => Promise<TabletopGameProfile>,
 *   deleteProfile: (id: string) => Promise<void>,
 *   duplicateProfile: (profile: TabletopGameProfile) => Promise<TabletopGameProfile>,
 *   getProfileById: (id: string) => Promise<TabletopGameProfile|null>,
 * }}
 */
export function useTabletopProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      // Always filter by owner_user_id — never load other users' profiles
      const data = await base44.entities.TabletopGameProfile.filter(
        { owner_user_id: user.id }
      );
      // Sort client-side by created_date descending
      data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setProfiles(data);
    } catch (err) {
      setError(`Failed to load profiles: ${err?.message ?? 'Unknown error'}. Please refresh and try again.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const createProfile = useCallback(async (formData) => {
    const user = await base44.auth.me();
    const payload = { ...formData, owner_user_id: user.id };
    const created = await base44.entities.TabletopGameProfile.create(payload);
    await reload();
    return created;
  }, [reload]);

  const updateProfile = useCallback(async (id, formData) => {
    const user = await base44.auth.me();
    const payload = { ...formData, owner_user_id: user.id };
    const updated = await base44.entities.TabletopGameProfile.update(id, payload);
    await reload();
    return updated;
  }, [reload]);

  const deleteProfile = useCallback(async (id) => {
    await base44.entities.TabletopGameProfile.delete(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const duplicateProfile = useCallback(async (profile) => {
    const { id, created_date, updated_date, ...rest } = profile;
    const payload = { ...rest, game_name: `${profile.game_name} (Copy)` };
    const created = await base44.entities.TabletopGameProfile.create(payload);
    await reload();
    return created;
  }, [reload]);

  /**
   * Fetch a single profile by id (used by the edit form).
   * Returns null if not found.
   */
  const getProfileById = useCallback(async (id) => {
    try {
      const results = await base44.entities.TabletopGameProfile.filter({ id });
      return results[0] ?? null;
    } catch {
      return null;
    }
  }, []);

  return {
    profiles,
    loading,
    error,
    reload,
    createProfile,
    updateProfile,
    deleteProfile,
    duplicateProfile,
    getProfileById,
  };
}