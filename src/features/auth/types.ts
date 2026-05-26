/**
 * features/auth/types.ts
 * Typed models for the authentication and user profile systems.
 *
 * These are the app-level types. Base44 auth is not strictly typed at the SDK
 * boundary — these types describe the shape we expect and cast to.
 */

// ─── AuthUser ─────────────────────────────────────────────────────────────────

/**
 * AuthUser — the raw object returned by base44.auth.me().
 * Built-in fields managed by Base44 (read-only from the app's perspective).
 */
export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  created_date?: string;
  updated_date?: string;
  /** App-level extension — stored via base44.auth.updateMe() */
  display_name?: string;
  /** App-level extension — PlayerColorId stored via base44.auth.updateMe() */
  default_color?: string;
}

// ─── UserProfile ──────────────────────────────────────────────────────────────

/**
 * UserProfile — the composed profile object exposed to the UI.
 * Merges AuthUser built-in fields with app-level extension fields.
 * displayName resolves: display_name → full_name → email prefix → 'Commander'
 */
export interface UserProfile extends AuthUser {
  /** Resolved display name ready for UI (never empty) */
  displayName: string;
}

// ─── UpdateUserProfileInput ───────────────────────────────────────────────────

/**
 * UpdateUserProfileInput — the subset of fields the user can edit via Settings.
 * Passed to base44.auth.updateMe().
 */
export interface UpdateUserProfileInput {
  display_name?: string | null;
  default_color?: string | null;
}

// ─── AuthState ────────────────────────────────────────────────────────────────

/**
 * AuthState — shape of the value exposed by AuthContext / useAuth().
 */
export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authChecked: boolean;
  authError: AuthError | null;
  logout: (shouldRedirect?: boolean) => void;
  navigateToLogin: () => void;
  refreshUser: () => Promise<void>;
}

export interface AuthError {
  type: 'auth_required' | 'user_not_registered' | 'unknown';
  message: string;
}