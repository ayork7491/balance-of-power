/**
 * RegionLegend — compact region/continent legend overlay.
 * Top-left corner of the map viewport.
 */
import { motion } from 'framer-motion';

export default function RegionLegend({ regions }) {
  if (!regions?.length) return null;

  return (
    <motion.div 
      className="absolute top-3 left-3 z-10 space-y-1.5 pointer-events-none"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {regions.map((r, idx) => (
        <motion.div 
          key={r.id} 
          className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1.5 border border-white/10"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + (idx * 0.05) }}
        >
          <motion.div 
            className="w-3 h-3 rounded-sm shrink-0 shadow-sm" 
            style={{ backgroundColor: r.color }}
            whileHover={{ scale: 1.2 }}
          />
          <span className="font-display text-xs tracking-wider text-foreground/90 font-medium">{r.name}</span>
          {r.control_bonus > 0 && (
            <motion.span 
              className="text-xs text-primary font-mono font-bold bg-primary/10 px-1.5 py-0.5 rounded"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + (idx * 0.05) }}
            >
              +{r.control_bonus}
            </motion.span>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}