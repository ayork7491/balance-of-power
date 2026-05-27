import { createContext, useContext, useState, useMemo, useCallback } from 'react';

/**
 * Campaign Test Mode Context
 *
 * Centralized state for admin test mode perspective and action delegation.
 *
 * PERMISSION MODEL:
 *  - Normal player:    always acts/views as self. No selectors shown.
 *  - Campaign admin:   acts/views as self OR test players only. Never other real humans.
 *  - Platform admin:   same as campaign admin (platform debug is opt-in via explicit override).
 *
 * Key resolved values:
 *  - effectiveActingPlayer  = actingAsPlayer || myPlayer  (never null for campaign members)
 *  - effectiveViewingPlayer = viewingAsPlayer || myPlayer (never null for campaign members)
 */

const CampaignTestContext = createContext(null);

/**
 * Provider component that wraps campaign screens.
 * myPlayer = the authenticated user's own CampaignPlayer record (always passed in).
 */
export function CampaignTestModeProvider({ children, campaign, players, isAdmin, myPlayer }) {
  // null means "use my own player" for both
  const [viewingAsCampaignPlayerId, setViewingAsCampaignPlayerId] = useState(null);
  const [actingAsCampaignPlayerId, setActingAsCampaignPlayerId] = useState(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);

  // Test mode: admin is present OR there are test players
  const isTestMode = useMemo(
    () => isAdmin && (players.some(p => p.is_test_player) || campaign?.name?.toLowerCase().includes('test')),
    [isAdmin, players, campaign?.name],
  );

  // ── Permission helpers ───────────────────────────────────────────────────

  /**
   * Can the current admin act as / view as a given player?
   * Allowed: own player, test players.
   * Blocked: other real human players.
   */
  const canDelegateToPlayer = useCallback((playerId) => {
    if (!isAdmin) return false;
    if (!playerId) return false;
    // Own player always allowed
    if (myPlayer && playerId === myPlayer.id) return true;
    const player = players.find(p => p.id === playerId);
    if (!player) return false;
    // Only test players allowed (not other real humans)
    return player.is_test_player === true;
  }, [isAdmin, myPlayer, players]);

  // ── Derived selector lists (admin-only, filtered) ────────────────────────

  /** Players the admin can act as: own player + test players only */
  const availableActingAsPlayers = useMemo(() => {
    if (!isAdmin) return [];
    return players.filter(p => canDelegateToPlayer(p.id));
  }, [isAdmin, players, canDelegateToPlayer]);

  /** Players the admin can view as: own player + test players only */
  const availableViewingAsPlayers = useMemo(() => {
    if (!isAdmin) return [];
    return players.filter(p => canDelegateToPlayer(p.id));
  }, [isAdmin, players, canDelegateToPlayer]);

  // ── Resolved player records ──────────────────────────────────────────────

  /** Raw selected viewing-as record (null = self) */
  const viewingAsPlayer = useMemo(() => {
    if (!viewingAsCampaignPlayerId) return null;
    // Validate permission; silently fall back to self if invalid
    if (!canDelegateToPlayer(viewingAsCampaignPlayerId)) return null;
    return players.find(p => p.id === viewingAsCampaignPlayerId) ?? null;
  }, [players, viewingAsCampaignPlayerId, canDelegateToPlayer]);

  /** Raw selected acting-as record (null = self) */
  const actingAsPlayer = useMemo(() => {
    if (!actingAsCampaignPlayerId) return null;
    if (!canDelegateToPlayer(actingAsCampaignPlayerId)) return null;
    return players.find(p => p.id === actingAsCampaignPlayerId) ?? null;
  }, [players, actingAsCampaignPlayerId, canDelegateToPlayer]);

  /**
   * effectiveActingPlayer — ALWAYS a valid CampaignPlayer (or null only if user
   * has no campaign record at all). Components should use this instead of
   * actingAsPlayer directly.
   */
  const effectiveActingPlayer = useMemo(
    () => actingAsPlayer ?? myPlayer ?? null,
    [actingAsPlayer, myPlayer],
  );

  /**
   * effectiveViewingPlayer — same pattern for display/perspective.
   */
  const effectiveViewingPlayer = useMemo(
    () => viewingAsPlayer ?? myPlayer ?? null,
    [viewingAsPlayer, myPlayer],
  );

  const isSimulatedPerspective = viewingAsCampaignPlayerId !== null && viewingAsPlayer !== null;

  // Safe setters: silently ignore invalid selections
  const safeSetActingAs = useCallback((id) => {
    if (id === null || canDelegateToPlayer(id)) {
      setActingAsCampaignPlayerId(id);
    }
  }, [canDelegateToPlayer]);

  const safeSetViewingAs = useCallback((id) => {
    if (id === null || canDelegateToPlayer(id)) {
      setViewingAsCampaignPlayerId(id);
    }
  }, [canDelegateToPlayer]);

  const value = {
    // Raw IDs
    viewingAsCampaignPlayerId,
    actingAsCampaignPlayerId,
    selectedTerritoryId,

    // Raw player records (null = using self)
    viewingAsPlayer,
    actingAsPlayer,

    // Resolved effective players — use these in action logic
    effectiveActingPlayer,
    effectiveViewingPlayer,

    // Setters (safe, validated)
    setViewingAsCampaignPlayerId: safeSetViewingAs,
    setActingAsCampaignPlayerId: safeSetActingAs,
    setSelectedTerritoryId,

    // Flags
    isTestMode,
    isAdmin,
    isSimulatedPerspective,

    // Filtered selector lists (admin only)
    availableActingAsPlayers,
    availableViewingAsPlayers,

    // Utilities
    canDelegateToPlayer,
    // Legacy alias
    canActAsPlayer: canDelegateToPlayer,
  };

  return (
    <CampaignTestContext.Provider value={value}>
      {children}
    </CampaignTestContext.Provider>
  );
}

/**
 * Hook to access campaign test context.
 * Must be used within CampaignTestModeProvider.
 */
export function useCampaignTestContext() {
  const context = useContext(CampaignTestContext);
  if (!context) {
    throw new Error('useCampaignTestContext must be used within CampaignTestModeProvider');
  }
  return context;
}

/**
 * Hook specifically for acting-as state.
 * Convenience wrapper that returns acting-as player and setter.
 */
export function useActingPlayer() {
  const { actingAsCampaignPlayerId, actingAsPlayer, setActingAsCampaignPlayerId, availableActingAsPlayers } = useCampaignTestContext();
  return {
    actingAsCampaignPlayerId,
    actingAsPlayer,
    setActingAsPlayerId: setActingAsCampaignPlayerId,
    availableActingAsPlayers,
  };
}