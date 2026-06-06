/**
 * resourceConfig.js — Single source of truth for resource metadata.
 *
 * All UI components, panels, and map popups must import from here.
 * Future: campaign/game-profile terminology overrides will be layered on top
 * by passing an optional `overrides` object to getResourceLabel() / getResourceConfig().
 *
 * Canonical resource set (Sprint 3B+):
 *   gold    — universal construction/building currency
 *   iron    — military specialty structures
 *   timber  — economic infrastructure and supply routes
 *   stone   — diplomatic structures, monuments, embassies
 *   food    — maintenance/sustainment resource
 *
 * Activation limit rule:
 *   Base activations = Math.max(1, Math.floor(ownedTerritoryCount / ACTIVATION_DIVISOR))
 *   +1 bonus for each Resource Hub owned.
 *   Clamped to [1, ownedTerritoryCount].
 */

export const RESOURCE_KEYS = ['gold', 'iron', 'timber', 'stone', 'food'];

/** Default display config per resource type. */
export const RESOURCE_CONFIG = {
  gold:   { label: 'Gold',   icon: '🥇', color: 'text-yellow-400',  bg: 'bg-yellow-900/20',  border: 'border-yellow-600/30' },
  iron:   { label: 'Iron',   icon: '⚙️', color: 'text-slate-400',   bg: 'bg-slate-800/30',   border: 'border-slate-600/30'  },
  timber: { label: 'Timber', icon: '🪵', color: 'text-amber-600',   bg: 'bg-amber-900/20',   border: 'border-amber-700/30'  },
  stone:  { label: 'Stone',  icon: '🪨', color: 'text-stone-400',   bg: 'bg-stone-800/20',   border: 'border-stone-600/30'  },
  food:   { label: 'Food',   icon: '🌾', color: 'text-green-400',   bg: 'bg-green-900/20',   border: 'border-green-600/30'  },
};

/** Fallback config for unknown resource keys. */
const FALLBACK_CONFIG = { label: 'Resource', icon: '?', color: 'text-foreground', bg: 'bg-muted/20', border: 'border-border' };

/**
 * Returns the display config for a resource type.
 * Pass optional `overrides` map (resourceKey → { label, icon }) for profile-level renaming.
 */
export function getResourceConfig(resourceType, overrides = {}) {
  const base = RESOURCE_CONFIG[resourceType] ?? FALLBACK_CONFIG;
  const override = overrides[resourceType];
  if (!override) return base;
  return { ...base, ...override };
}

/**
 * Returns the display label for a resource type.
 * Pass optional `overrides` for profile-level renaming.
 */
export function getResourceLabel(resourceType, overrides = {}) {
  return overrides[resourceType]?.label ?? RESOURCE_CONFIG[resourceType]?.label ?? resourceType;
}

/**
 * Returns the emoji icon for a resource type.
 */
export function getResourceIcon(resourceType, overrides = {}) {
  return overrides[resourceType]?.icon ?? RESOURCE_CONFIG[resourceType]?.icon ?? '?';
}

/**
 * Calculates the number of resource activations a player is allowed this round.
 *
 * Formula:
 *   base = Math.max(1, Math.floor(ownedCount / ACTIVATION_DIVISOR))
 *   bonus = number of Resource Hubs owned
 *   total = Math.min(base + bonus, ownedCount)
 *
 * ACTIVATION_DIVISOR = 3 means 1 activation per 3 territories (rounded down, min 1).
 * Examples:
 *   1–2 territories  → 1 activation
 *   3–5 territories  → 1–2 activations
 *   6–8 territories  → 2–3 activations
 *   9+ territories   → 3+ activations
 */
const ACTIVATION_DIVISOR = 3;

export function calcActivationLimit(ownedTerritoryCount, resourceHubCount = 0) {
  if (ownedTerritoryCount <= 0) return 0;
  const base = Math.max(1, Math.floor(ownedTerritoryCount / ACTIVATION_DIVISOR));
  const bonus = resourceHubCount;
  return Math.min(base + bonus, ownedTerritoryCount);
}

/** Zero-filled resource storage object. */
export function emptyStorage() {
  return { gold: 0, iron: 0, timber: 0, stone: 0, food: 0 };
}

/** Sum all resource amounts in a storage object. */
export function sumStorage(storage) {
  if (!storage) return 0;
  return RESOURCE_KEYS.reduce((sum, r) => sum + (storage[r] ?? 0), 0);
}