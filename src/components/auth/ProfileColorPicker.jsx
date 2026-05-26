/**
 * ProfileColorPicker — displays the 8 player color swatches.
 * Highlights the selected color with a ring and checkmark.
 * Used in Settings and future campaign join flows.
 */
import { Check } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

export default function ProfileColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {PLAYER_COLORS.map(({ id, label, hex }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onChange(id)}
            className={`
              w-9 h-9 rounded-full relative transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
              ${selected ? 'ring-2 ring-white/80 scale-110' : 'ring-2 ring-transparent hover:ring-white/30 hover:scale-105'}
            `}
            style={{ backgroundColor: hex }}
          >
            {selected && (
              <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
            )}
          </button>
        );
      })}
    </div>
  );
}