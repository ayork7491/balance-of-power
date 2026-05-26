/**
 * features/profiles/index.js
 *
 * Public API for the profiles feature.
 * Import from here — not from individual files — to keep coupling loose.
 */
export { useTabletopProfiles } from './useTabletopProfiles';
export {
  DEFAULT_PROFILE_FORM,
  validateProfileForm,
} from './types';
// Re-export types (JSDoc only in .js consumers — TypeScript consumers import types.ts directly)