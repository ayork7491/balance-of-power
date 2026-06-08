/**
 * services/rules-engine/buildings/buildingEffects.ts
 *
 * Sprint 4D — Building Passive Effect Framework
 *
 * Data-driven building effect system. All effects are defined here as structured
 * data and pure functions. No UI or API code. Import this wherever you need to
 * compute modifiers from a player's or territory's active buildings.
 *
 * ─── HOW IT WORKS ─────────────────────────────────────────────────────────────
 *
 * Each BuildingEffectDef describes:
 *   - effectType: what category of modifier it produces
 *   - scope:      'player' (affects the owning player globally)
 *                 'territory' (affects only the territory it's built in)
 *   - value:      numeric modifier (or 1 for boolean effects)
 *   - stackable:  whether multiple instances add their values together
 *
 * PlayerModifiers captures all player-scoped effects (the common case).
 * TerritoryModifiers captures territory-scoped effects.
 *
 * Usage:
 *   const mods = calcPlayerModifiers(myActiveBuildings);
 *   // mods.extraAttackDeclarations → 0 with no War Council, 1 with one, etc.
 *
 * ─── ADDING NEW BUILDINGS ─────────────────────────────────────────────────────
 *
 * 1. Add a BuildingEffectDef entry to BUILDING_EFFECT_DEFS.
 * 2. If the effect produces a new modifier type, extend PlayerModifiers or
 *    TerritoryModifiers and add the key to PLAYER_MODIFIER_DEFAULTS /
 *    TERRITORY_MODIFIER_DEFAULTS with a sensible default.
 * 3. Done. All consumers of calcPlayerModifiers / calcTerritoryModifiers
 *    pick up the change automatically.
 */

import type { BuildingType } from '@/types/Resources';

// ─── Effect type catalogue ────────────────────────────────────────────────────

export type BuildingEffectType =
  // Military
  | 'extra_troop_generation'       // +N troops per deploy phase
  | 'extra_attack_declarations'    // +N attack declarations per attack phase
  | 'extra_fortification_distance' // +N to max fortification distance
  // Diplomatic
  | 'embassy_card_draw'            // Use enhanced draw rule (draw 4 keep 2 vs draw 3 keep 1)
  | 'extra_influence_actions'      // +N influence actions per fortify phase
  | 'extra_trade_actions'          // +N trade actions per fortify phase
  // Economic
  | 'extra_hub_activations'        // +N Resource Hub activations per turn
  | 'extra_construction_slots'     // +N concurrent construction projects
  | 'extra_supply_caravans'        // +N supply caravans
  | 'supply_route_capacity'        // capacity N supply routes (territory-scoped)
  | 'resource_protection';         // resources protected in territory (territory-scoped)

export type EffectScope = 'player' | 'territory';

export interface BuildingEffectDef {
  buildingType: BuildingType;
  effectType: BuildingEffectType;
  scope: EffectScope;
  /** Numeric modifier contributed by one instance of this building. */
  value: number;
  /**
   * If true, multiple buildings of this type (or same effectType) stack additively.
   * If false, only the presence of at least one instance matters (capped at value).
   */
  stackable: boolean;
}

// ─── Effect definitions ───────────────────────────────────────────────────────

export const BUILDING_EFFECT_DEFS: BuildingEffectDef[] = [
  // ── Military ──────────────────────────────────────────────────────────────
  {
    buildingType: 'barracks',
    effectType: 'extra_troop_generation',
    scope: 'player',
    value: 1,
    stackable: true,
  },
  {
    buildingType: 'war_council',
    effectType: 'extra_attack_declarations',
    scope: 'player',
    value: 1,
    stackable: true,
  },
  {
    buildingType: 'logistics_corps',
    effectType: 'extra_fortification_distance',
    scope: 'player',
    value: 1,
    stackable: true,
  },

  // ── Diplomatic ────────────────────────────────────────────────────────────
  {
    buildingType: 'embassy',
    effectType: 'embassy_card_draw',
    scope: 'player',
    value: 1,
    // Not stackable — having any embassy gives the enhanced draw rule.
    // Multiple embassies don't give extra benefit.
    stackable: false,
  },
  {
    buildingType: 'council_chamber',
    effectType: 'extra_influence_actions',
    scope: 'player',
    value: 1,
    stackable: true,
  },
  {
    buildingType: 'foreign_office',
    effectType: 'extra_trade_actions',
    scope: 'player',
    value: 1,
    stackable: true,
  },

  // ── Monument — Sprint 4G ──────────────────────────────────────────────────
  {
    buildingType: 'monument',
    effectType: 'monument_influence_generation',
    scope: 'territory',
    value: 1,
    stackable: false,
  },

  // ── Economic ──────────────────────────────────────────────────────────────
  {
    buildingType: 'marketplace',
    effectType: 'extra_hub_activations',
    scope: 'player',
    value: 1,
    stackable: true,
  },
  {
    buildingType: 'builders_guild',
    effectType: 'extra_construction_slots',
    scope: 'player',
    value: 1,
    stackable: true,
  },
  {
    buildingType: 'trade_network',
    effectType: 'extra_supply_caravans',
    scope: 'player',
    value: 1,
    stackable: true,
  },
  {
    buildingType: 'resource_hub',
    effectType: 'supply_route_capacity',
    scope: 'territory',
    value: 3,
    stackable: false,
  },
  {
    buildingType: 'warehouse',
    effectType: 'resource_protection',
    scope: 'territory',
    value: 1,
    stackable: false,
  },
];

// ─── Index for fast lookup ────────────────────────────────────────────────────

export const EFFECTS_BY_BUILDING_TYPE: Partial<Record<BuildingType, BuildingEffectDef[]>> =
  BUILDING_EFFECT_DEFS.reduce((acc, def) => {
    if (!acc[def.buildingType]) acc[def.buildingType] = [];
    acc[def.buildingType]!.push(def);
    return acc;
  }, {} as Partial<Record<BuildingType, BuildingEffectDef[]>>);

// ─── Modifier shapes ──────────────────────────────────────────────────────────

/** All player-scoped modifiers aggregated across all active buildings. */
export interface PlayerModifiers {
  /** Extra troops added to base income during deploy phase. Barracks, stacks. */
  extraTroopGeneration: number;
  /** Extra attack declarations this attack phase. War Council, stacks. */
  extraAttackDeclarations: number;
  /** Extra added to max_fortification_distance. Logistics Corps, stacks. */
  extraFortificationDistance: number;
  /** True when player has at least one Embassy — uses draw-4-keep-2 rule. */
  hasEmbassyCardDraw: boolean;
  /** Extra influence actions per fortify phase. Council Chamber, stacks. */
  extraInfluenceActions: number;
  /** Extra trade actions per fortify phase. Foreign Office, stacks. */
  extraTradeActions: number;
  /** Extra Resource Hub activations per turn. Marketplace, stacks. */
  extraHubActivations: number;
  /** Extra concurrent construction slots. Builders Guild, stacks. */
  extraConstructionSlots: number;
  /** Extra supply caravans. Trade Network, stacks. */
  extraSupplyCaravans: number;
}

/** Territory-scoped modifiers for a single territory. */
export interface TerritoryModifiers {
  /** Max supply routes this territory's Resource Hub can support (0 if no hub). */
  supplyRouteCapacity: number;
  /** True if this territory has a Warehouse — resources are protected. */
  hasResourceProtection: boolean;
}

/** Neutral defaults — no buildings active. */
export const PLAYER_MODIFIER_DEFAULTS: PlayerModifiers = {
  extraTroopGeneration: 0,
  extraAttackDeclarations: 0,
  extraFortificationDistance: 0,
  hasEmbassyCardDraw: false,
  extraInfluenceActions: 0,
  extraTradeActions: 0,
  extraHubActivations: 0,
  extraConstructionSlots: 0,
  extraSupplyCaravans: 0,
};

export const TERRITORY_MODIFIER_DEFAULTS: TerritoryModifiers = {
  supplyRouteCapacity: 0,
  hasResourceProtection: false,
};

// ─── Minimal building shape consumed by calculators ──────────────────────────

export interface ActiveBuildingInput {
  building_type: string;
  /** Only 'active' buildings grant effects. Under-construction buildings do not. */
  status: string;
  territory_id?: string;
}

// ─── Core calculators ─────────────────────────────────────────────────────────

/**
 * calcPlayerModifiers
 *
 * Given a list of TerritoryBuilding records (all buildings for a player across
 * all their territories), returns the aggregated PlayerModifiers.
 *
 * Only buildings with status === 'active' contribute effects.
 * Legacy V1 structures (castle, barracks, stables) in TerritoryState.structures
 * are passed through separately via calcPlayerModifiersFromLegacy.
 *
 * @param buildings - TerritoryBuilding records for one player
 */
export function calcPlayerModifiers(buildings: ActiveBuildingInput[]): PlayerModifiers {
  const mods = { ...PLAYER_MODIFIER_DEFAULTS };

  const active = buildings.filter(b => b.status === 'active');

  for (const building of active) {
    const effects = EFFECTS_BY_BUILDING_TYPE[building.building_type as BuildingType] ?? [];
    for (const effect of effects) {
      if (effect.scope !== 'player') continue;
      applyPlayerEffect(mods, effect);
    }
  }

  return mods;
}

/**
 * calcPlayerModifiersFromLegacy
 *
 * Accepts legacy V1 structure strings (e.g. ['barracks', 'stables']) from
 * TerritoryState.structures. Converts them to the same ActiveBuildingInput shape
 * so they can contribute to player modifiers.
 *
 * Legacy 'castle' has no effect def — it's silently ignored.
 * Legacy 'barracks' → extra_troop_generation.
 * Legacy 'stables'  → no matching effect def currently (was fortification range
 *                      before Sprint 4D, now handled by logistics_corps).
 */
export function calcPlayerModifiersFromLegacy(legacyStructures: string[]): PlayerModifiers {
  const asBuildings: ActiveBuildingInput[] = legacyStructures.map(s => ({
    building_type: s,
    status: 'active',
  }));
  return calcPlayerModifiers(asBuildings);
}

/**
 * mergePlayerModifiers
 * Combines two PlayerModifiers objects (additive for numbers, OR for booleans).
 */
export function mergePlayerModifiers(a: PlayerModifiers, b: PlayerModifiers): PlayerModifiers {
  return {
    extraTroopGeneration: a.extraTroopGeneration + b.extraTroopGeneration,
    extraAttackDeclarations: a.extraAttackDeclarations + b.extraAttackDeclarations,
    extraFortificationDistance: a.extraFortificationDistance + b.extraFortificationDistance,
    hasEmbassyCardDraw: a.hasEmbassyCardDraw || b.hasEmbassyCardDraw,
    extraInfluenceActions: a.extraInfluenceActions + b.extraInfluenceActions,
    extraTradeActions: a.extraTradeActions + b.extraTradeActions,
    extraHubActivations: a.extraHubActivations + b.extraHubActivations,
    extraConstructionSlots: a.extraConstructionSlots + b.extraConstructionSlots,
    extraSupplyCaravans: a.extraSupplyCaravans + b.extraSupplyCaravans,
  };
}

/**
 * calcTerritoryModifiers
 *
 * Returns TerritoryModifiers for a single territory's buildings.
 *
 * @param buildings - TerritoryBuilding records for ONE territory
 */
export function calcTerritoryModifiers(buildings: ActiveBuildingInput[]): TerritoryModifiers {
  const mods = { ...TERRITORY_MODIFIER_DEFAULTS };
  const active = buildings.filter(b => b.status === 'active');

  for (const building of active) {
    const effects = EFFECTS_BY_BUILDING_TYPE[building.building_type as BuildingType] ?? [];
    for (const effect of effects) {
      if (effect.scope !== 'territory') continue;
      if (effect.effectType === 'supply_route_capacity') {
        mods.supplyRouteCapacity = effect.stackable
          ? mods.supplyRouteCapacity + effect.value
          : Math.max(mods.supplyRouteCapacity, effect.value);
      } else if (effect.effectType === 'resource_protection') {
        mods.hasResourceProtection = true;
      }
    }
  }

  return mods;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function applyPlayerEffect(mods: PlayerModifiers, effect: BuildingEffectDef): void {
  switch (effect.effectType) {
    case 'extra_troop_generation':
      mods.extraTroopGeneration += effect.value;
      break;
    case 'extra_attack_declarations':
      mods.extraAttackDeclarations += effect.value;
      break;
    case 'extra_fortification_distance':
      mods.extraFortificationDistance += effect.value;
      break;
    case 'embassy_card_draw':
      if (effect.stackable) {
        // stackable=false for embassy — presence check
        mods.hasEmbassyCardDraw = mods.hasEmbassyCardDraw || effect.value > 0;
      } else {
        mods.hasEmbassyCardDraw = true;
      }
      break;
    case 'extra_influence_actions':
      mods.extraInfluenceActions += effect.value;
      break;
    case 'extra_trade_actions':
      mods.extraTradeActions += effect.value;
      break;
    case 'extra_hub_activations':
      mods.extraHubActivations += effect.value;
      break;
    case 'extra_construction_slots':
      mods.extraConstructionSlots += effect.value;
      break;
    case 'extra_supply_caravans':
      mods.extraSupplyCaravans += effect.value;
      break;
  }
}

// ─── Derived helpers used by game systems ─────────────────────────────────────

/**
 * getEffectiveMaxAttacks
 * Returns the total attacks available to a player this phase.
 *
 * @param baseMax - campaign.settings.max_attacks_per_phase (default 3)
 * @param mods    - PlayerModifiers for this player
 */
export function getEffectiveMaxAttacks(baseMax: number, mods: PlayerModifiers): number {
  return baseMax + mods.extraAttackDeclarations;
}

/**
 * getEffectiveMaxFortificationDistance
 *
 * @param baseDistance - campaign.settings.max_fortification_distance (default 4)
 * @param mods         - PlayerModifiers for this player
 */
export function getEffectiveMaxFortificationDistance(baseDistance: number, mods: PlayerModifiers): number {
  return baseDistance + mods.extraFortificationDistance;
}

/**
 * getEffectiveConstructionSlots
 * Returns the total concurrent construction projects a player may have active.
 *
 * @param baseSlots - base allowed concurrent projects (default 1)
 * @param mods      - PlayerModifiers for this player
 */
export function getEffectiveConstructionSlots(baseSlots: number, mods: PlayerModifiers): number {
  return baseSlots + mods.extraConstructionSlots;
}

/**
 * getEffectiveTroopBonus
 * Returns how many extra troops to add to deploy income from buildings.
 *
 * @param mods - PlayerModifiers for this player
 */
export function getEffectiveTroopBonus(mods: PlayerModifiers): number {
  return mods.extraTroopGeneration;
}

/**
 * getBattleCardDrawRule
 * Returns the draw rule for battle cards.
 *
 * Default: { draw: 3, keep: 1 }
 * Embassy:  { draw: 4, keep: 2 }
 */
export function getBattleCardDrawRule(mods: PlayerModifiers): { draw: number; keep: number } {
  if (mods.hasEmbassyCardDraw) return { draw: 4, keep: 2 };
  return { draw: 3, keep: 1 };
}