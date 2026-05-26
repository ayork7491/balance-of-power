/**
 * Settings — user account settings and defaults.
 * Future: connected to User entity for display name, default color, notification prefs.
 */
import AppShell from '@/components/layout/AppShell';
import { PLAYER_COLORS } from '@/config/theme';
import { User, Palette, Bell, Shield } from 'lucide-react';

export default function Settings() {
  return (
    <AppShell showBack title="Settings">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        <section className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Account
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Default Display Name</label>
              <input
                type="text"
                placeholder="Commander name..."
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                disabled
                className="w-full bg-muted border border-border rounded px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Palette className="w-3.5 h-3.5" />
              Default Player Color
            </h2>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-3">
              {PLAYER_COLORS.map(({ id, label, hex }) => (
                <button
                  key={id}
                  title={label}
                  className="w-8 h-8 rounded-full ring-2 ring-transparent hover:ring-white/40 transition-all"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Game Profiles
            </h2>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Manage your tabletop game profiles used in campaigns.</p>
            <a
              href="/profiles"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              Manage Profiles
            </a>
          </div>
        </section>

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