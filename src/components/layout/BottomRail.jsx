/**
 * BottomRail — Campaign screen bottom quick-tab navigation rail.
 * Tabs: Map, Phase, Battles, Leaderboard, Territories, History.
 */
import { motion } from 'framer-motion';
import { Map, Swords, Shield, Trophy, ScrollText, Package, GitBranch, Feather } from 'lucide-react';

// Icon component wrapper
function IconComponent({ Icon, isActive }) {
  return (
    <motion.div
      animate={isActive ? { scale: 1.1 } : { scale: 1 }}
      transition={{ duration: 0.15 }}
    >
      <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
    </motion.div>
  );
}

const TABS = [
  { id: 'map',          label: 'Map',          icon: Map       },
  { id: 'phase',        label: 'Phase',        icon: Shield    },
  { id: 'resources',    label: 'Resources',    icon: Package   },
  { id: 'logistics',    label: 'Logistics',    icon: GitBranch },
  { id: 'influence',    label: 'Influence',    icon: Feather   },
  { id: 'battles',      label: 'Battles',      icon: Swords    },
  { id: 'leaderboard',  label: 'Standings',    icon: Trophy    },
  { id: 'history',      label: 'History',      icon: ScrollText},
];

export default function BottomRail({ activeTab, onTabChange }) {
  return (
    <motion.nav 
      className="h-12 bg-panel-header border-t border-panel-border flex items-stretch shrink-0"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{ touchAction: 'none' }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <motion.button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-display tracking-wider uppercase touch-manipulation active:scale-95 transition-transform ${
              isActive
                ? 'text-primary border-t-2 border-primary -mt-px bg-primary/5'
                : 'text-muted-foreground hover:text-foreground border-t-2 border-transparent'
            }`}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
          >
            <IconComponent Icon={Icon} isActive={isActive} />
            <span className="font-medium">{label}</span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}