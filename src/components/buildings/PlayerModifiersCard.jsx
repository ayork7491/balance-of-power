/**
 * PlayerModifiersCard — Sprint 4D
 *
 * Displays the active building-derived modifiers for a player.
 * Shows a compact list of non-zero modifiers only (hides zeros).
 * Used in FortifyInfoPanel and anywhere a player modifier summary is needed.
 */
import { Loader2 } from 'lucide-react';
import { PLAYER_MODIFIER_DEFAULTS } from '@/services/rules-engine/buildings/buildingEffects';

const MODIFIER_CONFIG = [
  {
    key: 'extraTroopGeneration',
    label: 'Troop Generation',
    format: v => `+${v} per deploy phase`,
    icon: '⚔',
  },
  {
    key: 'extraAttackDeclarations',
    label: 'Attack Declarations',
    format: v => `+${v} per attack phase`,
    icon: '⚔',
  },
  {
    key: 'extraFortificationDistance',
    label: 'Fortification Distance',
    format: v => `+${v} territories`,
    icon: '🛡',
  },
  {
    key: 'hasEmbassyCardDraw',
    label: 'Battle Card Draw',
    format: () => 'Draw 4, Keep 2',
    icon: '🃏',
    isBool: true,
  },
  {
    key: 'extraInfluenceActions',
    label: 'Influence Actions',
    format: v => `+${v} per turn`,
    icon: '🕊',
  },
  {
    key: 'extraTradeActions',
    label: 'Trade Actions',
    format: v => `+${v} per turn`,
    icon: '💱',
  },
  {
    key: 'extraHubActivations',
    label: 'Hub Activations',
    format: v => `+${v} per turn`,
    icon: '🏭',
  },
  {
    key: 'extraConstructionSlots',
    label: 'Construction Projects',
    format: v => `+${v} concurrent`,
    icon: '🔨',
  },
  {
    key: 'extraSupplyCaravans',
    label: 'Supply Caravans',
    format: v => `+${v} capacity`,
    icon: '🚚',
  },
];

export default function PlayerModifiersCard({ modifiers, loading, title = 'Active Modifiers' }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Computing modifiers…
      </div>
    );
  }

  const mods = modifiers ?? PLAYER_MODIFIER_DEFAULTS;

  const activeRows = MODIFIER_CONFIG.filter(cfg => {
    const val = mods[cfg.key];
    return cfg.isBool ? val === true : val > 0;
  });

  if (activeRows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">No active building modifiers</div>
    );
  }

  return (
    <div className="space-y-1">
      {activeRows.map(cfg => (
        <div
          key={cfg.key}
          className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border bg-muted/10"
        >
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span>{cfg.icon}</span>
            {cfg.label}
          </span>
          <span className="text-status-locked font-medium font-mono">
            {cfg.format(mods[cfg.key])}
          </span>
        </div>
      ))}
    </div>
  );
}