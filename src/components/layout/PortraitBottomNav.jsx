/**
 * PortraitBottomNav — Sprint 5B
 * Three-tab navigation: World Status | Command Center | History
 * Command Center is the primary action hub — visually emphasized.
 */
import { motion } from 'framer-motion';
import { Globe, Swords, ScrollText } from 'lucide-react';

const TABS = [
  { id: 'world',   label: 'World',   icon: Globe,      primary: false },
  { id: 'command', label: 'Command', icon: Swords,     primary: true  },
  { id: 'history', label: 'History', icon: ScrollText, primary: false },
];

export default function PortraitBottomNav({ activeTab, onTabChange }) {
  return (
    <motion.nav
      className="shrink-0 bg-panel-header border-t border-panel-border flex items-stretch"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        minHeight: '56px',
        position: 'relative',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {TABS.map(({ id, label, icon: Icon, primary }) => {
        const isActive = activeTab === id;
        return (
          <motion.button
            key={id}
            onClick={() => onTabChange(id)}
            className={[
              'flex flex-col items-center justify-center gap-1 py-2 touch-manipulation transition-all',
              primary ? 'flex-[1.5]' : 'flex-1',
              isActive
                ? primary
                  ? 'text-primary border-t-2 border-primary bg-primary/10'
                  : 'text-primary border-t-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground border-t-2 border-transparent',
            ].join(' ')}
            whileTap={{ scale: 0.92 }}
          >
            {primary ? (
              <div className={[
                'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-muted/40 text-muted-foreground border border-border',
              ].join(' ')}>
                <Icon className="w-5 h-5" />
              </div>
            ) : (
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
            )}
            <span className={`leading-none font-display tracking-wider uppercase ${primary ? 'text-[10px] font-bold' : 'text-[9px] font-medium'}`}>
              {label}
            </span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}