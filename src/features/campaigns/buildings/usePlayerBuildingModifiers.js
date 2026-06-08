/**
 * usePlayerBuildingModifiers
 *
 * Sprint 4D — Passive Effect Framework (Frontend Hook)
 *
 * Fetches all TerritoryBuilding records for a campaign, filters to buildings
 * owned by the target player, and computes their PlayerModifiers using the
 * building effect framework.
 *
 * Also handles legacy V1 structures from TerritoryState.structures so that
 * campaigns with the old barracks/stables still get their modifiers.
 *
 * Usage:
 *   const { modifiers, loading } = usePlayerBuildingModifiers({
 *     campaignId, playerId, territoryStates, // optional: for legacy structures
 *   });
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  calcPlayerModifiers,
  calcPlayerModifiersFromLegacy,
  mergePlayerModifiers,
  PLAYER_MODIFIER_DEFAULTS,
} from '@/services/rules-engine/buildings/buildingEffects';

export function usePlayerBuildingModifiers({ campaignId, playerId, territoryStates = [] }) {
  const [modifiers, setModifiers] = useState(PLAYER_MODIFIER_DEFAULTS);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaignId || !playerId) {
      setModifiers(PLAYER_MODIFIER_DEFAULTS);
      setBuildings([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const allBuildings = await base44.entities.TerritoryBuilding.filter({
          campaign_id: campaignId,
          player_id: playerId,
        });

        if (cancelled) return;
        setBuildings(allBuildings);

        // Compute Sprint 3B+ building modifiers
        const newBuildingMods = calcPlayerModifiers(allBuildings);

        // Compute legacy V1 structure modifiers from TerritoryState.structures
        // Only for territories owned by this player
        const ownedStates = territoryStates.filter(ts => ts.owner_player_id === playerId);
        const legacyStructures = ownedStates.flatMap(ts => ts.structures ?? []);
        const legacyMods = calcPlayerModifiersFromLegacy(legacyStructures);

        // Merge both
        setModifiers(mergePlayerModifiers(newBuildingMods, legacyMods));
      } catch {
        if (!cancelled) setModifiers(PLAYER_MODIFIER_DEFAULTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [campaignId, playerId, territoryStates]);

  return { modifiers, buildings, loading };
}