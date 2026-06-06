/**
 * Balance of Power — Theme Configuration
 * Central source of truth for visual tokens, player colors, phase colors, and UI constants.
 * Do not hardcode these values in components — always reference this config.
 */
import type { PlayerColor, PlayerColorId } from '@/types/PlayerColor';
import type { CampaignPhase } from '@/types/CampaignPhase';

// ─── Player Colors ────────────────────────────────────────────────────────────

export const PLAYER_COLORS: PlayerColor[] = [
  { id: 'crimson', label: 'Crimson', hex: '#dc2626', tailwind: 'bg-red-600'     },
  { id: 'cobalt',  label: 'Cobalt',  hex: '#2563eb', tailwind: 'bg-blue-600'    },
  { id: 'emerald', label: 'Emerald', hex: '#16a34a', tailwind: 'bg-green-600'   },
  { id: 'gold',    label: 'Gold',    hex: '#ca8a04', tailwind: 'bg-yellow-600'  },
  { id: 'violet',  label: 'Violet',  hex: '#7c3aed', tailwind: 'bg-violet-600'  },
  { id: 'amber',   label: 'Amber',   hex: '#d97706', tailwind: 'bg-amber-600'   },
  { id: 'teal',    label: 'Teal',    hex: '#0d9488', tailwind: 'bg-teal-600'    },
  { id: 'rose',    label: 'Rose',    hex: '#e11d48', tailwind: 'bg-rose-600'    },
];

// ─── Phase Color Config ───────────────────────────────────────────────────────

export interface PhaseColorConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}

export const PHASE_COLORS: Partial<Record<CampaignPhase, PhaseColorConfig>> = {
  faction_selection: { label: 'Faction Select', color: '#7c3aed', bg: 'bg-violet-900/30', border: 'border-violet-600/40', text: 'text-violet-300' },
  territory_draft:   { label: 'Territory Draft', color: '#7c3aed', bg: 'bg-violet-900/30', border: 'border-violet-600/40', text: 'text-violet-300' },
  initial_deploy:    { label: 'Initial Deploy',  color: '#ca8a04', bg: 'bg-yellow-900/30', border: 'border-yellow-600/40', text: 'text-yellow-300' },
  deploy:   { label: 'Deploy',   color: '#ca8a04', bg: 'bg-yellow-900/30', border: 'border-yellow-600/40', text: 'text-yellow-300' },
  attack:   { label: 'Attack',   color: '#dc2626', bg: 'bg-red-900/30',    border: 'border-red-600/40',    text: 'text-red-300'    },
  battle:   { label: 'Battle',   color: '#ea580c', bg: 'bg-orange-900/30', border: 'border-orange-600/40', text: 'text-orange-300' },
  fortify:  { label: 'Fortify',  color: '#16a34a', bg: 'bg-green-900/30',  border: 'border-green-600/40',  text: 'text-green-300'  },
  complete: { label: 'Complete', color: '#0d9488', bg: 'bg-teal-900/30',   border: 'border-teal-600/40',   text: 'text-teal-300'   },
};

// ─── Campaign Status ──────────────────────────────────────────────────────────

export const CAMPAIGN_STATUS = {
  lobby:    { label: 'In Lobby',  color: 'text-muted-foreground' },
  active:   { label: 'Active',    color: 'text-status-locked'    },
  paused:   { label: 'Paused',    color: 'text-status-pending'   },
  complete: { label: 'Complete',  color: 'text-accent'           },
  archived: { label: 'Archived',  color: 'text-muted-foreground' },
} as const;

// ─── Battle Card Types & Statuses ─────────────────────────────────────────────

export const BATTLE_CARD_TYPES = {
  skirmish:          { label: 'Skirmish',         icon: '⚔️'  },
  siege:             { label: 'Siege',             icon: '🏰'  },
  double_siege:      { label: 'Double Siege',      icon: '🏯'  },
  capture_objective: { label: 'Capture Objective', icon: '🎯'  },
  bloodbath:         { label: 'Bloodbath',         icon: '💀'  },
} as const;

export const BATTLE_CARD_STATUS = {
  generated:         { label: 'Generated',         color: 'badge-info'    },
  awaiting_play:     { label: 'Awaiting Play',     color: 'badge-pending' },
  result_submitted:  { label: 'Result Submitted',  color: 'badge-pending' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'badge-pending' },
  resolved:          { label: 'Resolved',          color: 'badge-locked'  },
  delayed:           { label: 'Delayed',           color: 'badge-pending' },
  auto_resolved:     { label: 'Auto-Resolved',     color: 'badge-info'    },
  forfeited:         { label: 'Forfeited',         color: 'badge-danger'  },
} as const;

// ─── Terrain Types ────────────────────────────────────────────────────────────

export const TERRAIN_TYPES = [
  'plains', 'mountains', 'forest', 'desert', 'coastal', 'urban', 'tundra', 'swamp',
] as const;

export type TerrainType = typeof TERRAIN_TYPES[number];

// ─── Sprint 3A Resources ──────────────────────────────────────────────────────
// Three-pillar canonical resource set. Replaces V1 Catan-inspired resources.
// Must stay in sync with ResourceType union in types/Resources.ts.

export const RESOURCE_TYPES = [
  'gold', 'iron', 'timber', 'stone', 'food',
] as const;

export const RESOURCE_LABELS: Record<string, string> = {
  gold:   'Gold',
  iron:   'Iron',
  timber: 'Timber',
  stone:  'Stone',
  food:   'Food',
};

export const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  gold:   'Universal construction and building currency',
  iron:   'Military specialty structures',
  timber: 'Economic infrastructure and supply routes',
  stone:  'Diplomatic structures, monuments, embassies',
  food:   'Maintenance and sustainment (troops, population, stability)',
};

// ─── Power Types ──────────────────────────────────────────────────────────────

export const POWER_TYPE_CONFIG = {
  military:   { label: 'Military',   color: 'text-destructive',    bg: 'bg-destructive/10',    border: 'border-destructive/40',    icon: '⚔️'  },
  economic:   { label: 'Economic',   color: 'text-status-pending', bg: 'bg-status-pending/10', border: 'border-status-pending/40', icon: '💰'  },
  diplomatic: { label: 'Diplomatic', color: 'text-status-info',    bg: 'bg-status-info/10',    border: 'border-status-info/40',    icon: '🕊️'  },
} as const;

// ─── Win Conditions ───────────────────────────────────────────────────────────

export const WIN_CONDITION_CONFIG = {
  rule_the_world: { label: 'Rule the World', description: 'Military domination — hold the most territories and regions', pillar: 'military'   as const },
  own_the_world:  { label: 'Own the World',  description: 'Economic supremacy — control resources and trade networks',   pillar: 'economic'   as const },
  lead_the_world: { label: 'Lead the World', description: 'Diplomatic leadership — accumulate influence and objectives', pillar: 'diplomatic' as const },
} as const;

// ─── Building Types (Three-Pillar) ────────────────────────────────────────────
// Full definitions in config/buildingDefinitions.ts.
// Must stay in sync with BuildingType union in types/Resources.ts.

export const BUILDING_TYPES = [
  // Military
  'barracks', 'war_council', 'logistics_corps',
  // Diplomatic
  'embassy', 'council_chamber', 'foreign_office',
  // Economic
  'marketplace', 'builders_guild', 'trade_network',
  'resource_hub', 'supply_route', 'warehouse',
] as const;

// ─── Legacy V1 Structures (kept for backward compat) ──────────────────────────
// Existing ConstructionProject records still reference these types.
// Do not remove until V1 construction is fully migrated.

export const LEGACY_STRUCTURE_TYPES = [
  'castle', 'barracks', 'stables',
] as const;

// ─── Player Color Lookup Helper ───────────────────────────────────────────────

export function getPlayerColor(id: PlayerColorId): PlayerColor | undefined {
  return PLAYER_COLORS.find(c => c.id === id);
}