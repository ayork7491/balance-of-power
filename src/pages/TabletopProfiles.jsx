/**
 * TabletopProfiles — list of user-created game profiles.
 * Future: connected to TabletopGameProfile entity.
 */
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { Shield, Plus, Edit, Swords } from 'lucide-react';

export default function TabletopProfiles() {
  return (
    <AppShell showBack title="Game Profiles">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Game profiles connect Balance of Power to any tabletop system.
          </p>
          <Link
            to="/profiles/create"
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </Link>
        </div>

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

      </div>
    </AppShell>
  );
}