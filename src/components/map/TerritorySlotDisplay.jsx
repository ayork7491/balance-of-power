/**
 * TerritorySlotDisplay — compact structure slot summary for the territory detail panel.
 * Shows each slot as a badge: occupied (dimmed) or free (colored).
 */
import { SLOT_LABELS, SLOT_COLORS } from '@/services/maps/structureSlots';
import { SC_TERRITORY_BY_ID } from '@/shared/maps/shatteredCrownConfig';

/**
 * Given all slots and existing building pillars, return an array of
 * { slotType, occupied } objects in config order.
 * Greedy: exact match first, then omni.
 */
function resolveSlotStates(allSlots, existingBuildingPillars) {
  // Copy slots into a mutable pool indexed by position
  const pool = allSlots.map((slotType, i) => ({ slotType, idx: i, occupied: false }));

  for (const pillar of existingBuildingPillars) {
    // Try exact slot first
    const exact = pool.find(p => !p.occupied && p.slotType === pillar);
    if (exact) { exact.occupied = true; continue; }
    // Fallback to omni
    const omni = pool.find(p => !p.occupied && p.slotType === 'omni');
    if (omni) { omni.occupied = true; }
    // else: no slot found (legacy tolerance)
  }
  return pool;
}

export default function TerritorySlotDisplay({ territoryId, existingBuildingPillars = [] }) {
  const config = SC_TERRITORY_BY_ID[territoryId];
  if (!config || !config.structure_slots?.length) return null;

  const slots = resolveSlotStates(config.structure_slots, existingBuildingPillars);
  const freeCount = slots.filter(s => !s.occupied).length;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {slots.map((entry, i) => {
          const c = SLOT_COLORS[entry.slotType] ?? SLOT_COLORS.omni;
          return (
            <span
              key={i}
              title={entry.occupied ? `${SLOT_LABELS[entry.slotType]} — occupied` : `${SLOT_LABELS[entry.slotType]} — free`}
              className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${
                entry.occupied
                  ? 'border-border bg-muted/10 text-muted-foreground/40'
                  : `${c.border} ${c.bg} ${c.text}`
              }`}
            >
              {SLOT_LABELS[entry.slotType]}
              {entry.occupied ? ' ✗' : ''}
            </span>
          );
        })}
      </div>
      {freeCount === 0 && slots.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">No slots available</p>
      )}
    </div>
  );
}