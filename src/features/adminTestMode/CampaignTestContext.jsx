import { createContext, useContext, useState, useMemo, useCallback } from 'react';

/**
 * Campaign Test Mode Context
 * 
 * Centralized state for admin test mode perspective and action delegation.
 * Single source of truth for viewing-as and acting-as across all campaign components.
 */

const CampaignTestContext = createContext(null);

/**
 * Provider component that wraps campaign screens.
 * Manages canonical test mode state.
 */
export function CampaignTestModeProvider({ children, campaign, players, isAdmin }) {
  const [viewingAsCampaignPlayerId, setViewingAsCampaignPlayerId] = useState(null);
  const [actingAsCampaignPlayerId, setActingAsCampaignPlayerId] = useState(null);

  // Determine if test mode is active
  const isTestMode = useMemo(() => {
    return isAdmin || players.some(p => p.is_test_player);
  }, [isAdmin, players]);

  // Determine if perspective is simulated (not authenticated user)
  const isSimulatedPerspective = useMemo(() => {
    return viewingAsCampaignPlayerId !== null;
  }, [viewingAsCampaignPlayerId]);

  // Get viewing-as player record
  const viewingAsPlayer = useMemo(() => {
    if (!viewingAsCampaignPlayerId) return null;
    return players.find(p => p.id === viewingAsCampaignPlayerId) ?? null;
  }, [players, viewingAsCampaignPlayerId]);

  // Get acting-as player record
  const actingAsPlayer = useMemo(() => {
    if (!actingAsCampaignPlayerId) return null;
    return players.find(p => p.id === actingAsCampaignPlayerId) ?? null;
  }, [players, actingAsCampaignPlayerId]);

  // Check eligibility for acting-as a specific player
  const canActAsPlayer = useCallback((playerId) => {
    if (!isAdmin) return false;
    const player = players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Can act as: own player, test players, or any player in test campaign
    const isTestCampaign = campaign?.name.toLowerCase().includes('test') || players.some(p => p.is_test_player);
    return player.is_test_player || isTestCampaign;
  }, [isAdmin, players, campaign]);

  // Available players for acting-as
  const availableActingAsPlayers = useMemo(() => {
    if (!isAdmin) return [];
    return players.filter(p => canActAsPlayer(p.id));
  }, [players, isAdmin, canActAsPlayer]);

  const value = {
    // State
    viewingAsCampaignPlayerId,
    actingAsCampaignPlayerId,
    viewingAsPlayer,
    actingAsPlayer,
    
    // Setters
    setViewingAsCampaignPlayerId,
    setActingAsCampaignPlayerId,
    
    // Flags
    isTestMode,
    isSimulatedPerspective,
    
    // Utilities
    availableActingAsPlayers,
    canActAsPlayer,
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