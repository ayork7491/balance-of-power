/**
 * LoadingScreen — full-screen tactical loading indicator.
 */
import { motion } from 'framer-motion';

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <motion.div 
      className="fixed inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative">
        {/* Outer ring */}
        <motion.div
          className="w-16 h-16 border-2 border-border rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        {/* Spinning ring */}
        <motion.div
          className="absolute inset-0 w-16 h-16 border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        {/* Center glow */}
        <motion.div
          className="absolute inset-0 w-4 h-4 bg-primary/30 rounded-full blur-md"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      <motion.p 
        className="font-display text-sm tracking-widest uppercase text-muted-foreground"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {message}
      </motion.p>
    </motion.div>
  );
}