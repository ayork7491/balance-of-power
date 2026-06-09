/**
 * PortraitBottomSheet — Slide-up panel for portrait mode.
 * Replaces permanent sidebars on mobile portrait.
 *
 * Usage:
 *   <PortraitBottomSheet isOpen={open} onClose={() => setOpen(false)} title="Phase Actions">
 *     {panelContent}
 *   </PortraitBottomSheet>
 *
 * Behavior:
 *   - Slides up from bottom, overlaying the map
 *   - Backdrop tap closes it
 *   - Drag handle at top for visual affordance
 *   - Safe area aware (bottom padding for home indicator)
 *   - Stays above keyboard when inputs focused (uses 'max-h-[70vh]')
 */
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Fixed height — never grows with content. Map always remains visible above.
const SHEET_HEIGHT = '70vh';

export default function PortraitBottomSheet({
  isOpen,
  onClose,
  title,
  children,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Sheet — fixed height, never grows */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-panel-bg border-t border-panel-border rounded-t-2xl"
            style={{ height: SHEET_HEIGHT }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-border">
              <span className="font-display text-sm font-semibold tracking-wider uppercase text-foreground">
                {title}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/30 transition-colors touch-manipulation"
                aria-label="Close panel"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable content area — fills remaining height, scrolls internally */}
            <div
              className="flex-1 min-h-0 overflow-y-auto dock-scroll"
              style={{
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 'env(safe-area-inset-bottom, 12px)',
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}