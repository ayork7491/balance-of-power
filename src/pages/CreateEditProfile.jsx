/**
 * CreateEditProfile — form to create or edit a tabletop game profile.
 * Future: connected to TabletopGameProfile entity with faction list editing.
 */
import AppShell from '@/components/layout/AppShell';
import { Shield } from 'lucide-react';

export default function CreateEditProfile() {
  const isEdit = false; // Future: detect from URL params

  return (
    <AppShell showBack title={isEdit ? 'Edit Profile' : 'New Game Profile'}>
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Profile Details
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {[
              { label: 'Game Name', placeholder: 'e.g. Warhammer 40K', type: 'text' },
              { label: 'Troop Currency Name', placeholder: 'e.g. Points, Power Level', type: 'text' },
              { label: 'Average Battle Size', placeholder: 'e.g. 1000', type: 'number' },
            ].map(({ label, placeholder, type }) => (
              <div key={label} className="space-y-1">
                <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}

            <div className="space-y-1">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Factions / Army Types</label>
              <p className="text-xs text-muted-foreground">Faction list editor coming in next prompt.</p>
              <div className="panel p-3 border-dashed">
                <p className="text-xs text-muted-foreground text-center">No factions added yet</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="px-4 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all">
                {isEdit ? 'Save Changes' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}