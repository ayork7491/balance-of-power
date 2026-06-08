/**
 * objectiveDefinitions.js — Sprint 4I
 * Client-side config for objective display. Not used by backend.
 */

export const OBJECTIVE_TIER_REWARDS = { 1: 3, 2: 5, 3: 8, 4: 12 };

export const OBJECTIVE_CATEGORY_CONFIG = {
  military: {
    label: 'Military',
    icon: '⚔️',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
  economic: {
    label: 'Economic',
    icon: '💰',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },
  diplomatic: {
    label: 'Diplomatic',
    icon: '🕊',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  territorial: {
    label: 'Territorial',
    icon: '🗺',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    badgeClass: 'bg-green-500/20 text-green-300 border-green-500/40',
  },
  infrastructure: {
    label: 'Infrastructure',
    icon: '🏗',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  manipulation: {
    label: 'Manipulation',
    icon: '🎭',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
};

export const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };