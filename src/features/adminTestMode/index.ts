/**
 * Feature: adminTestMode
 *
 * Owns: Solo campaign simulation, perspective switching, phase force-advance,
 *       decision auto-fill, debug state overlay, hidden-information override.
 * Pages: /campaigns/:id/admin
 *
 * ARCHITECTURE CONSTRAINT:
 *   Test mode must still enforce hidden-information rules for each simulated perspective.
 *   The debug overlay (show all raw state) is admin-only and never shown to regular players.
 *
 * Future prompts will add: hooks/useTestMode.ts, components/PerspectiveSwitcher.tsx,
 *   components/DebugStateOverlay.tsx, etc.
 * Do not add logic to this file yet.
 */
export {};