/**
 * AppShell — wraps non-campaign screens (Home, Settings, Lobby, etc.)
 * Provides a top nav bar with branding, back navigation, and user menu.
 */
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Settings, LogOut, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';

export default function AppShell({ children, showBack = false, title = null }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    base44.auth.logout('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav bar */}
      <header className="h-12 bg-panel-header border-b border-panel-border flex items-center px-4 gap-3 shrink-0 z-20">
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-display tracking-wider uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
        ) : (
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm font-bold tracking-widest text-primary uppercase">
              Balance of Power
            </span>
          </Link>
        )}

        {title && (
          <>
            <div className="w-px h-5 bg-border shrink-0" />
            <span className="font-display text-sm font-semibold tracking-wider text-foreground truncate">
              {title}
            </span>
          </>
        )}

        <div className="flex-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs"
          >
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
              <Shield className="w-3 h-3" />
            </div>
            <ChevronDown className="w-3 h-3" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 w-40 bg-card border border-border rounded shadow-xl z-50 py-1 animate-fade-in">
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
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
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}