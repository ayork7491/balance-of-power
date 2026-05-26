/**
 * UserProfile — the authenticated app user.
 * Mirrors the Base44 built-in User entity fields plus app-specific extensions.
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  /** Display name override (may differ from full_name) */
  display_name?: string;
  /** Default player color preference (PlayerColorId) */
  default_color?: string;
  created_date?: string;
  updated_date?: string;
}