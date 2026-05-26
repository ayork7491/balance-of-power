/**
 * Balance of Power — Domain Types
 * Central export for all shared domain interfaces and type aliases.
 * Import from '@/types' in all feature modules and components.
 */

export type { UserProfile } from './UserProfile';
export type { TabletopGameProfile } from './TabletopGameProfile';
export type { Campaign } from './Campaign';
export type { CampaignPlayer } from './CampaignPlayer';
export type { CampaignPhase, CampaignStatus } from './CampaignPhase';
export type { PlayerColor, PlayerColorId } from './PlayerColor';
export type { MapDefinition } from './MapDefinition';
export type { TerritoryDefinition, TerritoryConnection } from './TerritoryDefinition';
export type { BattleCard, BattleCardType, BattleCardStatus } from './BattleCard';
export type { PhaseDecision } from './PhaseDecision';
export type { ResourceType, StructureType } from './Resources';