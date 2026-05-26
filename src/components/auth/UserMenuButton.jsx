/**
 * UserMenuButton — compact user avatar + dropdown used in AppShell's top nav.
 * Shows first letter of display name or email initial, links to Settings, and handles logout.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, LogOut, ChevronDown, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { PLAYER_COLORS } from '@/config/theme';

export default function UserMenuButton({ user }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  // Get the user's default color for the avatar ring
  const colorDef = user?.default_color
    ? PLAYER_COLORS.find(c => c.id === user.default_color)
    : null;

  const initial = (user?.display_name || user?.full_name || user?.email || '?')
    .charAt(0)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs group"
        aria-label="User menu"
        aria-expanded={open}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-bold text-white ring-2 transition-all"
          style={colorDef
            ? { backgroundColor: colorDef.hex, ringColor: colorDef.hex }
            : { backgroundColor: 'hsl(var(--muted))', ringColor: 'transparent' }
          }
        >
          {colorDef ? initial : <User className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-9 w-48 bg-card border border-border rounded-md shadow-xl z-50 py-1 animate-fade-in">
            {/* User info */}
            {user && (
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-display tracking-wider font-semibold text-foreground truncate">
                  {user.display_name || user.full_name || 'Commander'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            )}

            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}