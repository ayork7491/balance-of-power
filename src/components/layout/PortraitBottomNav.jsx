/**
 * PortraitBottomNav — Full-width bottom tab navigation for portrait mode.
 * Maps, Phase, Battles, Standings, Territories, History.
 *
 * Sits above safe area inset (home indicator on iOS).
 * Labels always visible (portrait has more horizontal space per icon than compact landscape).
 */
import { motion } from 'framer-motion';
import { Map, Shield, Swords, Trophy, Grid3x3, ScrollText } from 'lucide-react';

const TABS = [
  { id: 'map',         label: 'Map',       icon: Map       },
  { id: 'phase',       label: 'Phase',     icon: Shield    },
  { id: 'battles',     label: 'Battles',   icon: Swords    },
  { id: 'leaderboard', label: 'Standings', icon: Trophy    },
  { id: 'territories', label: 'Zones',     icon: Grid3x3   },
  { id: 'history',     label: 'History',   icon: ScrollText},
];

export default function PortraitBottomNav({ activeTab, onTabChange }) {
  return (
    <motion.nav
      className="shrink-0 bg-panel-header border-t border-panel-border flex items-stretch"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        minHeight: '52px',
      }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <motion.button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-display tracking-wider uppercase touch-manipulation transition-colors ${
              isActive
                ? 'text-primary border-t-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground border-t-2 border-transparent'
            }`}
            whileTap={{ scale: 0.9 }}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
            <span className="font-medium leading-none">{label}</span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}