/**
 * RegionLegend — compact region/continent legend.
 * Now rendered in right sidebar (not map overlay) to keep map viewport clear.
 */
import { motion } from 'framer-motion';

export default function RegionLegend({ regions }) {
  if (!regions?.length) return null;

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs font-display tracking-wider uppercase text-muted-foreground mb-2">
        Regions & Bonuses
      </p>
      {regions.map((r, idx) => (
        <motion.div 
          key={r.id} 
          className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-muted/10"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 * idx }}
        >
          <motion.div 
            className="w-3 h-3 rounded-sm shrink-0 shadow-sm" 
            style={{ backgroundColor: r.color }}
            whileHover={{ scale: 1.2 }}
          />
          <span className="font-display text-xs tracking-wider text-foreground/90 font-medium flex-1">{r.name}</span>
          {r.control_bonus > 0 && (
            <motion.span 
              className="text-xs text-primary font-mono font-bold bg-primary/10 px-1.5 py-0.5 rounded"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 + (idx * 0.05) }}
            >
              +{r.control_bonus}
            </motion.span>
          )}
        </motion.div>
      ))}
    </div>
  );
}