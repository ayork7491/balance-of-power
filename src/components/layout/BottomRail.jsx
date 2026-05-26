/**
 * BottomRail — Campaign screen bottom quick-tab navigation rail.
 * Tabs: Map, Phase, Battles, Leaderboard, Territories, History.
 */
import { Map, Swords, Shield, Trophy, Grid3x3, ScrollText } from 'lucide-react';

const TABS = [
  { id: 'map',          label: 'Map',          icon: Map       },
  { id: 'phase',        label: 'Phase',        icon: Shield    },
  { id: 'battles',      label: 'Battles',      icon: Swords    },
  { id: 'leaderboard',  label: 'Standings',    icon: Trophy    },
  { id: 'territories',  label: 'Territories',  icon: Grid3x3   },
  { id: 'history',      label: 'History',      icon: ScrollText},
];

export default function BottomRail({ activeTab, onTabChange }) {
  return (
    <nav className="h-11 bg-panel-header border-t border-panel-border flex items-stretch shrink-0">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-display tracking-wider uppercase transition-colors ${
              isActive
                ? 'text-primary border-t-2 border-primary -mt-px bg-primary/5'
                : 'text-muted-foreground hover:text-foreground border-t-2 border-transparent'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : ''}`} />
            <span className="hidden sm:block">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}