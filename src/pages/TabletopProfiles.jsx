/**
 * TabletopProfiles — list of user-created tabletop game profiles with CRUD actions.
 * Data layer: useTabletopProfiles hook (features/profiles).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Plus, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import ProfileCard from '@/components/profiles/ProfileCard';
import { useTabletopProfiles } from '@/features/profiles';

export default function TabletopProfiles() {
  const { profiles, loading, error, reload, duplicateProfile, deleteProfile } = useTabletopProfiles();
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const handleDuplicate = async (profile) => {
    setActionError(null);
    setBusyId(profile.id);
    try {
      await duplicateProfile(profile);
    } catch {
      setActionError(`Failed to duplicate "${profile.game_name}". Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (profile) => {
    if (!confirm(`Delete "${profile.game_name}"? This cannot be undone.`)) return;
    setActionError(null);
    setBusyId(profile.id);
    try {
      await deleteProfile(profile.id);
    } catch {
      setActionError(`Failed to delete "${profile.game_name}". Please try again.`);
      setBusyId(null);
    }
  };

  return (
    <AppShell showBack title="Game Profiles">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Profiles connect Balance of Power to any tabletop game system. Reusable across campaigns.
          </p>
          <Link
            to="/profiles/create"
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </Link>
        </div>

        {/* Action-level error (duplicate / delete failures) */}
        {actionError && (
          <div className="flex items-center gap-2 p-3 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive flex-1">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}

        {/* Load error */}
        {error && !loading && (
          <div className="flex items-center gap-3 p-4 rounded border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive flex-1">{error}</p>
            <button
              onClick={reload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading profiles…
          </div>
        ) : !error && profiles.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Shield}
              title="No game profiles"
              description="Create your first tabletop game profile to get started."
              action={
                <Link
                  to="/profiles/create"
                  className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
                >
                  Create Profile
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={busyId === profile.id ? 'opacity-40 pointer-events-none transition-opacity' : ''}
              >
                <ProfileCard
                  profile={profile}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </AppShell>
  );
}