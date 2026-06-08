/**
 * services/maps/structureSlots.ts
 *
 * Sprint 4C — Structure Slot Enforcement (frontend utilities).
 *
 * SOURCE OF TRUTH for slot data: src/shared/maps/shatteredCrownConfig.ts
 * Do NOT hardcode slot arrays here — always read from SC_TERRITORY_BY_ID.
 *
 * Slot compatibility rules:
 *   military   building → requires military or omni slot
 *   economic   building → requires economic or omni slot
 *   diplomatic building → requires diplomatic or omni slot
 */

import { SC_TERRITORY_BY_ID } from '@/shared/maps/shatteredCrownConfig';
import type { SCSlotType } from '@/shared/maps/shatteredCrownConfig';

export type BuildingPillar = 'military' | 'economic' | 'diplomatic';

/** Returns the slot types that satisfy a given building pillar. */
export function compatibleSlots(pillar: BuildingPillar): SCSlotType[] {
  return [pillar, 'omni'];
}

/** Returns true if the given slot satisfies the building pillar. */
export function slotSatisfiesPillar(slot: SCSlotType, pillar: BuildingPillar): boolean {
  return slot === pillar || slot === 'omni';
}

/**
 * Computes slot availability for a territory given existing buildings.
 *
 * @param territoryId   - canonical territory ID (e.g. 'I4')
 * @param existingBuildings - array of pillar strings already occupying slots
 *                            (from TerritoryBuilding records or legacy structures)
 * @returns slotStatus object
 */
export interface SlotStatus {
  /** All slots from the canonical config (may include duplicates, e.g. ['military','military']) */
  allSlots: SCSlotType[];
  /** How many of each slot type exist */
  totalByType: Record<SCSlotType, number>;
  /** How many of each slot type are already occupied */
  occupiedByType: Record<SCSlotType, number>;
  /** How many of each slot type remain free */
  remainingByType: Record<SCSlotType, number>;
  /** Total slots */
  totalCount: number;
  /** Occupied count */
  occupiedCount: number;
  /** Free count */
  freeCount: number;
  /** Whether this is a non-SC territory (slots not applicable) */
  isSCTerritory: boolean;
}

function emptySlotCounts(): Record<SCSlotType, number> {
  return { military: 0, economic: 0, diplomatic: 0, omni: 0 };
}

export function getSlotStatus(
  territoryId: string,
  existingBuildingPillars: BuildingPillar[],
): SlotStatus {
  const config = SC_TERRITORY_BY_ID[territoryId];

  if (!config) {
    // V1 map or unknown territory — slots not applicable
    return {
      allSlots: [],
      totalByType: emptySlotCounts(),
      occupiedByType: emptySlotCounts(),
      remainingByType: emptySlotCounts(),
      totalCount: 0,
      occupiedCount: 0,
      freeCount: 0,
      isSCTerritory: false,
    };
  }

  const allSlots = config.structure_slots as SCSlotType[];
  const totalByType = emptySlotCounts();
  for (const s of allSlots) totalByType[s]++;

  // Greedily occupy slots: for each existing building, consume the most specific
  // matching slot first (prefer exact match over omni).
  const remaining = { ...totalByType };
  const occupiedByType = emptySlotCounts();
  let occupiedCount = 0;

  for (const pillar of existingBuildingPillars) {
    // Try exact slot first, then omni
    if (remaining[pillar] > 0) {
      remaining[pillar]--;
      occupiedByType[pillar]++;
      occupiedCount++;
    } else if (remaining['omni'] > 0) {
      remaining['omni']--;
      occupiedByType['omni']++;
      occupiedCount++;
    }
    // else: building exists but no slot found (legacy data — tolerated gracefully)
  }

  return {
    allSlots,
    totalByType,
    occupiedByType,
    remainingByType: { ...remaining } as Record<SCSlotType, number>,
    totalCount: allSlots.length,
    occupiedCount,
    freeCount: allSlots.length - occupiedCount,
    isSCTerritory: true,
  };
}

/**
 * Returns true if a building of the given pillar can be placed in a territory,
 * given current slot usage.
 */
export function canPlaceBuilding(
  territoryId: string,
  pillar: BuildingPillar,
  existingBuildingPillars: BuildingPillar[],
): boolean {
  const status = getSlotStatus(territoryId, existingBuildingPillars);
  if (!status.isSCTerritory) return true; // V1 — no restriction
  // Can place if there's a matching slot (exact) or an omni slot free
  return status.remainingByType[pillar] > 0 || status.remainingByType['omni'] > 0;
}

/**
 * Returns a human-readable error message when a building cannot be placed.
 */
export function getSlotBlockedReason(
  territoryId: string,
  pillar: BuildingPillar,
  existingBuildingPillars: BuildingPillar[],
): string | null {
  if (canPlaceBuilding(territoryId, pillar, existingBuildingPillars)) return null;
  const status = getSlotStatus(territoryId, existingBuildingPillars);
  if (status.freeCount === 0) {
    return 'All structure slots in this territory are occupied.';
  }
  return `This territory does not have an available ${pillar} slot.`;
}

/** Display label for a slot type. */
export const SLOT_LABELS: Record<SCSlotType, string> = {
  military:   'Military',
  economic:   'Economic',
  diplomatic: 'Diplomatic',
  omni:       'Omni',
};

/** Tailwind color classes for a slot type. */
export const SLOT_COLORS: Record<SCSlotType, { text: string; bg: string; border: string }> = {
  military:   { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  economic:   { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  diplomatic: { text: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30' },
  omni:       { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
};