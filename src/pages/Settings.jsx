/**
 * Settings — user account settings and defaults.
 * Reads and writes: display_name, default_color via useUserProfile hook.
 * Email is read-only (managed by Base44 auth).
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import ProfileColorPicker from '@/components/auth/ProfileColorPicker';
import { useUserProfile } from '@/features/auth/useUserProfile';
import { User, Palette, Bell, Shield, Save, Loader2, Check } from 'lucide-react';

export default function Settings() {
  const { user, loading, saving, updateProfile } = useUserProfile();

  const [displayName, setDisplayName] = useState('');
  const [defaultColor, setDefaultColor] = useState('');
  const [saved, setSaved] = useState(false);

  // Populate form once user data loads
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || user.full_name || '');
      setDefaultColor(user.default_color || '');
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaved(false);
    await updateProfile({
      display_name: displayName.trim(),
      default_color: defaultColor || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AppShell showBack title="Settings">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading profile…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">

            {/* Account */}
            <section className="panel">
              <div className="panel-header">
                <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  Account
                </h2>
              </div>
              <div className="p-4 space-y-4">

                <div className="space-y-1.5">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                    Default Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Commander name…"
                    maxLength={32}
                    className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pre-fills when joining campaigns. Editable per campaign.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>

              </div>
            </section>

            {/* Default Player Color */}
            <section className="panel">
              <div className="panel-header">
                <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" />
                  Default Player Color
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Your preferred color when joining a campaign. Can be changed if already taken.
                </p>
                <ProfileColorPicker value={defaultColor} onChange={setDefaultColor} />
              </div>
            </section>

            {/* Save button */}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : saved ? (
                <><Check className="w-3.5 h-3.5" /> Saved</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save Changes</>
              )}
            </button>

          </form>
        )}

        {/* Game Profiles */}
        <section className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Game Profiles
            </h2>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Manage your tabletop game profiles used in campaigns.</p>
            <Link
              to="/profiles"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              Manage Profiles
            </Link>
          </div>
        </section>

        {/* Notifications (future) */}
        <section className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Bell className="w-3.5 h-3.5" />
              Notifications
            </h2>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Notification preferences — coming in a future update.</p>
          </div>
        </section>

      </div>
    </AppShell>
  );
}