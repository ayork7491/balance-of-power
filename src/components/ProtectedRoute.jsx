/**
 * ProtectedRoute — layout route that guards all authenticated app routes.
 *
 * Behaviour:
 *   Loading  → renders spinner fallback
 *   Auth error (user_not_registered) → renders UserNotRegisteredError
 *   Not authenticated → renders unauthenticatedElement (typically <Navigate to="/login" />)
 *   Authenticated → renders <Outlet /> (the nested protected page)
 *
 * Used in App.jsx as a layout route wrapping all protected paths.
 * Public auth paths (/login, /register, etc.) are declared OUTSIDE this component.
 */
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function ProtectedRoute({ unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authChecked, authError } = useAuth();

  // Still initialising — show global loading screen
  if (isLoadingPublicSettings || isLoadingAuth || !authChecked) {
    return <LoadingScreen message="Loading Balance of Power..." />;
  }

  // Platform-level "user not registered" error
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Not authenticated (expired session, no token, or auth_required error)
  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // Authenticated — render the nested route
  return <Outlet />;
}