/**
 * PortraitPerspectivePicker — Mobile-safe perspective switcher for portrait mode.
 *
 * Replaces the Radix Select dropdown in portrait mode (which suffers from
 * Radix portal z-index + mobile Safari pointer-capture interaction bugs).
 *
 * UX: Tap button → bottom sheet opens → tap option → sheet closes → perspective updates.
 *
 * Permissions:
 *  - Only visible to campaign admins in test mode with test players.
 *  - Options: Self + test players (never other real human players).
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TestTube, User, ChevronDown, X, Check } from 'lucide-react';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';
import { useMemo } from 'react';

export default function PortraitPerspectivePicker() {
  const {
    isTestMode,
    isAdmin,
    availableActingAsPlayers,
    actingAsCampaignPlayerId,
    setViewingAsCampaignPlayerId,
    setActingAsCampaignPlayerId,
  } = useCampaignTestContext();

  const [sheetOpen, setSheetOpen] = useState(false);

  const testPlayers = useMemo(
    () => availableActingAsPlayers.filter(p => p.is_test_player),
    [availableActingAsPlayers]
  );

  const currentValue = actingAsCampaignPlayerId ?? 'self';
  const currentLabel = currentValue === 'self'
    ? 'Self'
    : testPlayers.find(p => p.id === currentValue)?.display_name ?? 'Self';

  const handleSelect = useCallback((val) => {
    if (val === 'self') {
      setActingAsCampaignPlayerId(null);
      setViewingAsCampaignPlayerId(null);
    } else {
      setActingAsCampaignPlayerId(val);
      setViewingAsCampaignPlayerId(val);
    }
    setSheetOpen(false);
  }, [setActingAsCampaignPlayerId, setViewingAsCampaignPlayerId]);

  if (!isAdmin || !isTestMode || testPlayers.length === 0) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => setSheetOpen(true)}
        className="flex items-center gap-1 bg-status-pending/10 border border-status-pending/40 px-1.5 py-0.5 rounded touch-manipulation active:brightness-125 transition-all"
        aria-label="Switch perspective"
      >
        <TestTube className="w-3 h-3 text-status-pending shrink-0" />
        <span className="text-[10px] text-status-pending font-display tracking-wide max-w-[56px] truncate">
          {currentLabel}
        </span>
        <ChevronDown className="w-2.5 h-2.5 text-status-pending shrink-0" />
      </button>

      {/* Bottom-sheet overlay — rendered via fixed positioning, not a portal */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-[200]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={() => setSheetOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[201] bg-panel-bg border-t border-panel-border rounded-t-xl pb-safe"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2">
                  <TestTube className="w-4 h-4 text-status-pending" />
                  <span className="font-display text-sm font-semibold tracking-wide text-foreground uppercase">
                    Switch Perspective
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Options */}
              <div className="px-3 pb-6 space-y-1">
                {/* Self */}
                <PickerOption
                  label="Self (My Player)"
                  icon={<User className="w-4 h-4 text-muted-foreground" />}
                  isSelected={currentValue === 'self'}
                  onSelect={() => handleSelect('self')}
                />

                {/* Test players */}
                {testPlayers.map(player => (
                  <PickerOption
                    key={player.id}
                    label={player.display_name}
                    sublabel="Test Player"
                    icon={<TestTube className="w-4 h-4 text-status-pending" />}
                    isSelected={currentValue === player.id}
                    onSelect={() => handleSelect(player.id)}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function PickerOption({ label, sublabel, icon, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all touch-manipulation
        ${isSelected
          ? 'bg-status-pending/20 border border-status-pending/50 text-foreground'
          : 'bg-secondary/50 border border-transparent text-secondary-foreground hover:bg-secondary active:bg-secondary/80'
        }
      `}
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
      </div>
      {isSelected && <Check className="w-4 h-4 text-status-pending shrink-0" />}
    </button>
  );
}