/**
 * lib/AuthContext.jsx
 *
 * Global auth state for Balance of Power.
 *
 * Responsibilities:
 *   - Boot-time session check (reads appParams.token)
 *   - Exposes user, isAuthenticated, loading flags, authError
 *   - Does NOT redirect on its own — redirect logic lives in ProtectedRoute
 *
 * See AUTH_NOTES.md for full documentation of the Base44 auth model.
 */
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]                               = useState(null);
  const [isAuthenticated, setIsAuthenticated]         = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]             = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError]                     = useState(null);
  const [authChecked, setAuthChecked]                 = useState(false);
  const [appPublicSettings, setAppPublicSettings]     = useState(null);

  // ── checkUserAuth ──────────────────────────────────────────────────────────
  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      // Only set auth_required error for actual auth failures, not network errors
      if (error?.status === 401 || error?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Session expired. Please log in again.' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  // ── refreshUser ────────────────────────────────────────────────────────────
  /** Re-fetch the current user (e.g. after profile save). Does not change loading state. */
  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch {
      // silently ignore — session may have expired, ProtectedRoute will handle redirect
    }
  }, []);

  // ── checkAppState ──────────────────────────────────────────────────────────
  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);

    const appClient = createAxiosClient({
      baseURL: `/api/apps/public`,
      headers: { 'X-App-Id': appParams.appId },
      token: appParams.token,
      interceptResponses: true,
    });

    try {
      const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
      setAppPublicSettings(publicSettings);

      if (appParams.token) {
        await checkUserAuth();
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    } catch (appError) {
      // Platform-level error (not user auth error)
      const reason = appError?.data?.extra_data?.reason;
      if (reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
      } else if (reason === 'auth_required') {
        // App has requiresAuth=true at the platform level — should not happen in our setup
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        // Unknown platform error — still allow the app to render auth pages
        setAuthError({ type: 'unknown', message: appError?.message || 'Failed to load app settings' });
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, [checkUserAuth]);

  useEffect(() => { checkAppState(); }, [checkAppState]);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout('/login');
  }, []);

  // ── navigateToLogin ────────────────────────────────────────────────────────
  /** Only used as a last-resort fallback. Normal nav is done by ProtectedRoute. */
  const navigateToLogin = useCallback(() => {
    base44.auth.redirectToLogin('/');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      refreshUser,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};