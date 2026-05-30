/**
 * useMapInteraction — canonical controller for campaign map territory interactions.
 * 
 * Centralizes territory click/tap handling across all campaign phases.
 * Routes territory selection to phase-specific action modes.
 * 
 * @param {object} params
 * @param {string} params.currentPhase - Current campaign phase
 * @param {string} params.selectedTerritoryId - Currently selected territory ID
 * @param {object} params.actingPlayer - Acting-as campaign player (or null for self)
 * @param {object} params.mapDef - Map definition (territories, adjacency)
 * @param {object} params.stateById - Territory state by ID
 * @param {array} params.players - All campaign players
 * @param {function} params.onSelect - Territory selection callback
 * @param {function} params.onAttackOriginSelect - Attack origin selected callback
 * @param {function} params.onAttackTargetSelect - Attack target selected callback
 * @param {function} params.onFortifyOriginSelect - Fortify origin selected callback
 * @param {function} params.onFortifyDestinationSelect - Fortify destination selected callback
 * @param {function} params.onBuildTerritorySelect - Build territory selected callback
 * @param {function} params.onDraftTerritorySelect - Draft territory selected callback
 * @param {function} params.onDeployTerritorySelect - Deploy territory selected callback
 * 
 * @returns {object} Interaction state and handlers
 */

import { useState, useCallback, useMemo } from 'react';

export function useMapInteraction({
  currentPhase,
  selectedTerritoryId,
  actingPlayer,
  mapDef,
  stateById,
  players,
  adjacencyMap: adjacencyMapProp,
  onSelect,
  onAttackOriginSelect,
  onAttackTargetSelect,
  onFortifyOriginSelect,
  onFortifyDestinationSelect,
  onBuildTerritorySelect,
  onDraftTerritorySelect,
  onDeployTerritorySelect,
}) {
  // Interaction mode tracking
  const [interactionMode, setInteractionMode] = useState(null);
  const [attackOriginId, setAttackOriginId] = useState(null);
  const [fortifyOriginId, setFortifyOriginId] = useState(null);
  
  // Use provided adjacencyMap (built from mapDef.adjacency pairs) or fall back to building from mapDef
  const adjacencyMap = useMemo(() => {
    if (adjacencyMapProp && Object.keys(adjacencyMapProp).length > 0) return adjacencyMapProp;
    if (!mapDef?.adjacency) return {};
    const map = {};
    for (const t of mapDef.territories) map[t.territory_id] = new Set();
    for (const [a, b] of mapDef.adjacency) {
      map[a]?.add(b);
      map[b]?.add(a);
    }
    return map;
  }, [adjacencyMapProp, mapDef]);

  // Check if territory is owned by acting player
  const isOwnedByActingPlayer = useCallback((territoryId) => {
    if (!actingPlayer?.id) return false;
    const state = stateById[territoryId];
    return state?.owner_player_id === actingPlayer.id;
  }, [actingPlayer?.id, stateById]);

  // Check if territory is adjacent to another
  const areAdjacent = useCallback((tid1, tid2) => {
    return adjacencyMap[tid1]?.has(tid2) || adjacencyMap[tid2]?.has(tid1);
  }, [adjacencyMap]);

  // Get valid attack targets from origin
  const getValidAttackTargets = useCallback((originId) => {
    const adjacentIds = Array.from(adjacencyMap[originId] || []);
    return adjacentIds.filter(tid => {
      const state = stateById[tid];
      // Can attack enemy-owned or neutral/vacated territories
      return state?.owner_player_id !== actingPlayer?.id;
    });
  }, [adjacencyMap, stateById, actingPlayer?.id]);

  // Get valid fortify destinations from origin
  const getValidFortifyDestinations = useCallback((originId) => {
    const adjacentIds = Array.from(adjacencyMap[originId] || []);
    return adjacentIds.filter(tid => {
      // Can only move to own territories
      return isOwnedByActingPlayer(tid);
    });
  }, [adjacencyMap, isOwnedByActingPlayer]);

  // Get valid build territories (own territories without max structures)
  const getValidBuildTerritories = useCallback(() => {
    if (!mapDef || !actingPlayer?.id) return [];
    return mapDef.territories.filter(t => {
      const state = stateById[t.territory_id];
      if (!state || state.owner_player_id !== actingPlayer.id) return false;
      // Check if territory can build (not at structure limit)
      const structureCount = state.structures?.length || 0;
      return structureCount < 3; // Max 3 structures per territory
    });
  }, [mapDef, stateById, actingPlayer?.id]);

  // Main territory click handler
  const handleTerritoryClick = useCallback((territoryId) => {
    if (!territoryId) {
      onSelect(null);
      setInteractionMode(null);
      setAttackOriginId(null);
      setFortifyOriginId(null);
      return;
    }

    const territory = mapDef?.territories.find(t => t.territory_id === territoryId);
    const state = stateById[territoryId];
    
    switch (currentPhase) {
      case 'territory_draft': {
        // Draft phase: select unclaimed territory
        if (!state?.owner_player_id) {
          onSelect(territoryId);
          setInteractionMode('draft_claim');
          onDraftTerritorySelect?.(territoryId);
        } else {
          // Already claimed - just show details
          onSelect(territoryId);
          setInteractionMode('view_only');
        }
        break;
      }

      case 'initial_deploy':
      case 'deploy': {
        // Deploy phases: select owned territory for troop placement
        if (isOwnedByActingPlayer(territoryId)) {
          onSelect(territoryId);
          setInteractionMode('deploy_placement');
          onDeployTerritorySelect?.(territoryId);
        } else {
          // Not owned - just show details
          onSelect(territoryId);
          setInteractionMode('view_only');
        }
        break;
      }

      case 'attack': {
        // Attack phase: two-step selection
        if (!attackOriginId) {
          // First click: select attack origin (must own)
          if (isOwnedByActingPlayer(territoryId) && state?.troop_count > 0) {
            setAttackOriginId(territoryId);
            onSelect(territoryId);
            setInteractionMode('attack_origin_selected');
            onAttackOriginSelect?.(territoryId);
          } else {
            // Not owned or no troops - just show details
            onSelect(territoryId);
            setInteractionMode('view_only');
          }
        } else {
          // Second click: select attack target (must be adjacent enemy/neutral)
          const validTargets = getValidAttackTargets(attackOriginId);
          if (validTargets.includes(territoryId)) {
            onSelect(territoryId);
            setInteractionMode('attack_target_selected');
            onAttackTargetSelect?.(attackOriginId, territoryId);
          } else if (territoryId === attackOriginId) {
            // Clicked same origin - cancel attack selection
            setAttackOriginId(null);
            onSelect(null);
            setInteractionMode(null);
          } else if (isOwnedByActingPlayer(territoryId)) {
            // Clicked another own territory - change origin
            setAttackOriginId(territoryId);
            onSelect(territoryId);
            setInteractionMode('attack_origin_selected');
            onAttackOriginSelect?.(territoryId);
          } else {
            // Invalid target - just show details
            onSelect(territoryId);
            setInteractionMode('view_only');
          }
        }
        break;
      }

      case 'fortify': {
        // Fortify phase: two-step selection for movement
        if (!fortifyOriginId) {
          // First click: select fortify origin (must own)
          if (isOwnedByActingPlayer(territoryId) && state?.troop_count > 1) {
            setFortifyOriginId(territoryId);
            onSelect(territoryId);
            setInteractionMode('fortify_origin_selected');
            onFortifyOriginSelect?.(territoryId);
          } else {
            // Not owned or only 1 troop - just show details
            onSelect(territoryId);
            setInteractionMode('view_only');
          }
        } else {
          // Second click: select fortify destination (must be adjacent own territory)
          const validDestinations = getValidFortifyDestinations(fortifyOriginId);
          if (validDestinations.includes(territoryId)) {
            onSelect(territoryId);
            setInteractionMode('fortify_destination_selected');
            onFortifyDestinationSelect?.(fortifyOriginId, territoryId);
          } else if (territoryId === fortifyOriginId) {
            // Clicked same origin - cancel fortify selection
            setFortifyOriginId(null);
            onSelect(null);
            setInteractionMode(null);
          } else if (isOwnedByActingPlayer(territoryId)) {
            // Clicked another own territory - change origin
            setFortifyOriginId(territoryId);
            onSelect(territoryId);
            setInteractionMode('fortify_origin_selected');
            onFortifyOriginSelect?.(territoryId);
          } else {
            // Invalid destination - just show details
            onSelect(territoryId);
            setInteractionMode('view_only');
          }
        }
        break;
      }

      case 'battle': {
        // Battle phase: view-only, show territory details
        onSelect(territoryId);
        setInteractionMode('view_only');
        break;
      }

      default: {
        // Unknown phase: view-only
        onSelect(territoryId);
        setInteractionMode('view_only');
        break;
      }
    }
  }, [
    currentPhase,
    attackOriginId,
    fortifyOriginId,
    actingPlayer,
    mapDef,
    stateById,
    isOwnedByActingPlayer,
    getValidAttackTargets,
    getValidFortifyDestinations,
    onSelect,
    onAttackOriginSelect,
    onAttackTargetSelect,
    onFortifyOriginSelect,
    onFortifyDestinationSelect,
    onDraftTerritorySelect,
    onDeployTerritorySelect,
  ]);

  // Clear interaction state
  const clearInteraction = useCallback(() => {
    setInteractionMode(null);
    setAttackOriginId(null);
    setFortifyOriginId(null);
  }, []);

  return {
    // State
    interactionMode,
    attackOriginId,
    fortifyOriginId,
    
    // Handlers
    handleTerritoryClick,
    clearInteraction,
    
    // Utilities
    isOwnedByActingPlayer,
    areAdjacent,
    getValidAttackTargets,
    getValidFortifyDestinations,
    getValidBuildTerritories,
  };
}