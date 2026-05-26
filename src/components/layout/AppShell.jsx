/**
 * AppShell — wraps non-campaign screens (Home, Settings, Lobby, etc.)
 * Provides a top nav bar with branding, back navigation, and user menu.
 */
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { useUserProfile } from '@/features/auth/useUserProfile';
import UserMenuButton from '@/components/auth/UserMenuButton';

export default function AppShell({ children, showBack = false, title = null }) {
  const navigate = useNavigate();
  const { user } = useUserProfile();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav bar */}
      <header className="h-12 bg-panel-header border-b border-panel-border flex items-center px-4 gap-3 shrink-0 z-20">
        {/* Home logo — always visible on every authenticated page */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <Shield className="w-5 h-5 text-primary group-hover:brightness-125 transition-all" />
          <span className="font-mono text-sm font-bold tracking-widest text-primary uppercase hidden sm:inline group-hover:brightness-125 transition-all">
            Balance of Power
          </span>
        </Link>

        {/* Back button — shown alongside logo when showBack=true */}
        {showBack && (
          <>
            <div className="w-px h-5 bg-border shrink-0" />
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-display tracking-wider uppercase"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </>
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

        <UserMenuButton user={user} />
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}