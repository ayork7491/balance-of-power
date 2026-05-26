/**
 * Balance of Power — Theme Configuration
 * Central source of truth for visual tokens, player colors, phase colors, and UI constants.
 * Do not hardcode these values in components — always reference this config.
 */

export const PLAYER_COLORS = [
  { id: 'crimson',   label: 'Crimson',   hex: '#dc2626', tailwind: 'bg-red-600'     },
  { id: 'cobalt',    label: 'Cobalt',    hex: '#2563eb', tailwind: 'bg-blue-600'    },
  { id: 'emerald',   label: 'Emerald',   hex: '#16a34a', tailwind: 'bg-green-600'   },
  { id: 'gold',      label: 'Gold',      hex: '#ca8a04', tailwind: 'bg-yellow-600'  },
  { id: 'violet',    label: 'Violet',    hex: '#7c3aed', tailwind: 'bg-violet-600'  },
  { id: 'amber',     label: 'Amber',     hex: '#d97706', tailwind: 'bg-amber-600'   },
  { id: 'teal',      label: 'Teal',      hex: '#0d9488', tailwind: 'bg-teal-600'    },
  { id: 'rose',      label: 'Rose',      hex: '#e11d48', tailwind: 'bg-rose-600'    },
];

export const PHASE_COLORS = {
  draft:    { label: 'Draft',    color: '#7c3aed', bg: 'bg-violet-900/30', border: 'border-violet-600/40', text: 'text-violet-300' },
  deploy:   { label: 'Deploy',   color: '#ca8a04', bg: 'bg-yellow-900/30', border: 'border-yellow-600/40', text: 'text-yellow-300' },
  attack:   { label: 'Attack',   color: '#dc2626', bg: 'bg-red-900/30',    border: 'border-red-600/40',    text: 'text-red-300'    },
  battle:   { label: 'Battle',   color: '#ea580c', bg: 'bg-orange-900/30', border: 'border-orange-600/40', text: 'text-orange-300' },
  fortify:  { label: 'Fortify',  color: '#16a34a', bg: 'bg-green-900/30',  border: 'border-green-600/40',  text: 'text-green-300'  },
  complete: { label: 'Complete', color: '#0d9488', bg: 'bg-teal-900/30',   border: 'border-teal-600/40',   text: 'text-teal-300'   },
};

export const CAMPAIGN_STATUS = {
  lobby:    { label: 'In Lobby',  color: 'text-muted-foreground' },
  active:   { label: 'Active',    color: 'text-status-locked'    },
  paused:   { label: 'Paused',    color: 'text-status-pending'   },
  complete: { label: 'Complete',  color: 'text-accent'           },
  archived: { label: 'Archived',  color: 'text-muted-foreground' },
};

export const BATTLE_CARD_TYPES = {
  skirmish:          { label: 'Skirmish',         icon: '⚔️'  },
  siege:             { label: 'Siege',             icon: '🏰'  },
  double_siege:      { label: 'Double Siege',      icon: '🏯'  },
  capture_objective: { label: 'Capture Objective', icon: '🎯'  },
  bloodbath:         { label: 'Bloodbath',         icon: '💀'  },
};

export const BATTLE_CARD_STATUS = {
  generated:         { label: 'Generated',         color: 'badge-info'    },
  awaiting_play:     { label: 'Awaiting Play',     color: 'badge-pending' },
  result_submitted:  { label: 'Result Submitted',  color: 'badge-pending' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'badge-pending' },
  resolved:          { label: 'Resolved',          color: 'badge-locked'  },
  delayed:           { label: 'Delayed',           color: 'badge-pending' },
  auto_resolved:     { label: 'Auto-Resolved',     color: 'badge-info'    },
  forfeited:         { label: 'Forfeited',         color: 'badge-danger'  },
};

export const TERRAIN_TYPES = [
  'plains', 'mountains', 'forest', 'desert', 'coastal', 'urban', 'tundra', 'swamp'
];

export const RESOURCE_TYPES = [
  'gold', 'iron', 'wood', 'food', 'stone', 'mana', 'fuel', 'data'
];

export const STRUCTURE_TYPES = [
  'fortress', 'barracks', 'watchtower', 'supply_depot', 'factory', 'shrine'
];