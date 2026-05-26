/**
 * TabletopProfiles — list of user-created tabletop game profiles with CRUD actions.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Plus, Loader2 } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import ProfileCard from '@/components/profiles/ProfileCard';
import { base44 } from '@/api/base44Client';

export default function TabletopProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    const data = await base44.entities.TabletopGameProfile.filter({ owner_user_id: user.id }, '-created_date');
    setProfiles(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDuplicate = async (profile) => {
    const { id, created_date, updated_date, ...rest } = profile;
    await base44.entities.TabletopGameProfile.create({
      ...rest,
      game_name: `${profile.game_name} (Copy)`,
    });
    await load();
  };

  const handleDelete = async (profile) => {
    if (!confirm(`Delete "${profile.game_name}"? This cannot be undone.`)) return;
    setDeletingId(profile.id);
    await base44.entities.TabletopGameProfile.delete(profile.id);
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    setDeletingId(null);
  };

  return (
    <AppShell showBack title="Game Profiles">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Profiles connect Balance of Power to any tabletop game system. They are reusable across campaigns.
          </p>
          <Link
            to="/profiles/create"
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all shrink-0 ml-4"
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading profiles…
          </div>
        ) : profiles.length === 0 ? (
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
              <div key={profile.id} className={deletingId === profile.id ? 'opacity-40 pointer-events-none' : ''}>
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