/**
 * ConstructionSelector — Sprint 4C.
 *
 * Replaced legacy V1 structure picker with the three-pillar building definitions.
 * Enforces structure slot rules from the canonical shatteredCrownConfig.ts.
 *
 * Slot rules:
 *   military   building → needs military or omni slot
 *   economic   building → needs economic or omni slot
 *   diplomatic building → needs diplomatic or omni slot
 *
 * A building option is disabled (with a clear reason) when:
 *   - The territory has no available slot of the correct type.
 *   - The territory already has a building of that type.
 */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ALL_BUILDING_DEFINITIONS, getBuildingPillar } from '@/config/buildingDefinitions';
import { getSlotStatus, canPlaceBuilding, getSlotBlockedReason, SLOT_LABELS, SLOT_COLORS } from '@/services/maps/structureSlots';
import TerritorySlotDisplay from '@/components/map/TerritorySlotDisplay';

const PILLAR_ICONS = { military: '⚔', economic: '💰', diplomatic: '🕊' };

/**
 * Extract building pillars from:
 *   - TerritoryState.structures (completed legacy V1 buildings)
 *   - TerritoryBuilding records (Sprint 3B+ completed AND in-progress)
 *
 * In-progress construction reserves a slot immediately to prevent
 * double-booking the same slot in the same round.
 */
function getExistingPillars(ts, territoryBuildings = []) {
  const pillars = [];
  // Completed legacy V1 structures — use getBuildingPillar for correct classification
  for (const s of ts?.structures ?? []) {
    pillars.push(getBuildingPillar(s));
  }
  // Sprint 3B+ TerritoryBuilding records (all statuses except destroyed)
  for (const b of territoryBuildings) {
    if (b.status !== 'destroyed') {
      // pillar_type is stored on the record; fall back to getBuildingPillar for safety
      pillars.push(b.pillar_type ?? getBuildingPillar(b.building_type));
    }
  }
  return pillars;
}

export default function ConstructionSelector({
  campaign,
  myPlayer,
  stateById,
  mapDef,
  selectedTerritoryId,
  territoryBuildings,   // TerritoryBuilding[] for the selected territory (active + in-progress)
  onStartConstruction,
  onClearSelection,
}) {
  const [selectedBuilding, setSelectedBuilding] = useState(null);

  const ts = selectedTerritoryId ? stateById[selectedTerritoryId] : null;
  const isOwned = ts?.owner_player_id === myPlayer?.id;
  const territoryName = mapDef?.territories?.find(t => t.territory_id === selectedTerritoryId)?.name ?? selectedTerritoryId;

  const existingPillars = useMemo(
    () => getExistingPillars(ts, territoryBuildings ?? []),
    [ts, territoryBuildings]
  );

  const slotStatus = useMemo(
    () => selectedTerritoryId ? getSlotStatus(selectedTerritoryId, existingPillars) : null,
    [selectedTerritoryId, existingPillars]
  );

  const handleStart = () => {
    if (selectedBuilding && selectedTerritoryId) {
      onStartConstruction(selectedTerritoryId, selectedBuilding.type);
      setSelectedBuilding(null);
      onClearSelection();
    }
  };

  if (!selectedTerritoryId) {
    return (
      <div className="p-3 rounded border border-border bg-muted/10 text-xs text-muted-foreground">
        Select one of your territories to build
      </div>
    );
  }

  if (!isOwned) {
    return (
      <div className="p-3 rounded border border-border bg-muted/10 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{territoryName}</span>
          <button onClick={onClearSelection}><X className="w-3 h-3" /></button>
        </div>
        <p className="mt-1 text-destructive">You do not own this territory.</p>
      </div>
    );
  }

  if (slotStatus && slotStatus.isSCTerritory && slotStatus.freeCount === 0) {
    return (
      <div className="p-3 rounded border border-border bg-muted/10 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">{territoryName}</span>
          <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
        </div>
        <TerritorySlotDisplay territoryId={selectedTerritoryId} existingBuildingPillars={existingPillars} />
        <p className="text-destructive">All structure slots in this territory are occupied.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded border border-border bg-muted/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">Build in: {territoryName}</p>
        <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Slot availability */}
      {slotStatus?.isSCTerritory && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available Slots</p>
          <TerritorySlotDisplay territoryId={selectedTerritoryId} existingBuildingPillars={existingPillars} />
        </div>
      )}

      {/* Building options grouped by pillar */}
      <div className="space-y-1.5 mt-2">
        {ALL_BUILDING_DEFINITIONS.map((def) => {
          const blocked = slotStatus?.isSCTerritory
            ? !canPlaceBuilding(selectedTerritoryId, def.pillar, existingPillars)
            : false;
          const blockedReason = blocked
            ? getSlotBlockedReason(selectedTerritoryId, def.pillar, existingPillars)
            : null;
          const isSelected = selectedBuilding?.type === def.type;
          const pillarColors = SLOT_COLORS[def.pillar] ?? SLOT_COLORS.omni;

          return (
            <button
              key={def.type}
              onClick={() => !blocked && setSelectedBuilding(def)}
              disabled={blocked}
              title={blocked ? blockedReason : undefined}
              className={`w-full flex items-start gap-3 p-2 rounded border text-left transition-colors ${
                blocked
                  ? 'border-border bg-muted/5 opacity-40 cursor-not-allowed'
                  : isSelected
                  ? `${pillarColors.border} ${pillarColors.bg}`
                  : 'border-border bg-muted/20 hover:bg-muted/30'
              }`}
            >
              <span className="text-sm mt-0.5 shrink-0">{PILLAR_ICONS[def.pillar]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-medium ${blocked ? 'text-muted-foreground' : 'text-foreground'}`}>{def.label}</p>
                  <span className={`text-[10px] px-1 py-0 rounded border ${pillarColors.border} ${pillarColors.bg} ${pillarColors.text}`}>
                    {SLOT_LABELS[def.pillar]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{def.effect}</p>
                {blocked && blockedReason && (
                  <p className="text-[10px] text-destructive mt-0.5">{blockedReason}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{def.rounds}r</p>
                <p className="text-[10px] text-muted-foreground">
                  {Object.entries(def.cost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ')}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleStart}
        disabled={!selectedBuilding}
        className="w-full h-8 text-xs mt-1"
      >
        Stage Construction
      </Button>
    </div>
  );
}