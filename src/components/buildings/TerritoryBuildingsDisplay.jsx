/**
 * TerritoryBuildingsDisplay — Sprint 4D
 *
 * Shows all buildings in a territory with their status and effect summary.
 * Used in TerritoryDetailPanel (and anywhere territory buildings are rendered).
 *
 * Handles:
 *   - Sprint 3B+ TerritoryBuilding records (from props)
 *   - Legacy V1 structures from TerritoryState.structures
 *
 * Shows:
 *   - Building name
 *   - Pillar category badge
 *   - Status badge (active / under construction / damaged)
 *   - Effect summary line
 *   - Territory-scoped effects (supply route capacity, resource protection)
 */
import { BUILDING_DEFINITIONS_BY_TYPE } from '@/config/buildingDefinitions';
import { calcTerritoryModifiers } from '@/services/rules-engine/buildings/buildingEffects';

const PILLAR_COLORS = {
  military:   { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400'    },
  economic:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400'  },
  diplomatic: { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400'   },
};

const STATUS_COLORS = {
  active:             'text-status-locked',
  under_construction: 'text-status-pending',
  planned:            'text-muted-foreground',
  damaged:            'text-status-danger',
  destroyed:          'text-muted-foreground/40',
};

const STATUS_LABELS = {
  active:             '● Active',
  under_construction: '◐ Building',
  planned:            '○ Planned',
  damaged:            '⚠ Damaged',
  destroyed:          '✗ Destroyed',
};

// Legacy V1 structure effect lookup
const LEGACY_EFFECTS = {
  castle:   { label: 'Castle',   pillar: 'military',   effect: 'Defensive fortification' },
  barracks: { label: 'Barracks', pillar: 'military',   effect: '+1 troop generation per deploy phase' },
  stables:  { label: 'Stables',  pillar: 'military',   effect: 'Cavalry support (legacy)' },
};

export default function TerritoryBuildingsDisplay({ territoryBuildings = [], legacyStructures = [] }) {
  const hasNewBuildings = territoryBuildings.filter(b => b.status !== 'destroyed').length > 0;
  const hasLegacy = legacyStructures.length > 0;

  if (!hasNewBuildings && !hasLegacy) return null;

  // Compute territory-scoped modifiers for the active buildings
  const territoryMods = calcTerritoryModifiers(territoryBuildings);

  return (
    <div className="space-y-1.5">
      {/* Sprint 3B+ buildings */}
      {territoryBuildings
        .filter(b => b.status !== 'destroyed')
        .map((b, idx) => {
          const def = BUILDING_DEFINITIONS_BY_TYPE[b.building_type];
          const pillar = b.pillar_type ?? def?.pillar ?? 'military';
          const pc = PILLAR_COLORS[pillar] ?? PILLAR_COLORS.military;
          const statusColor = STATUS_COLORS[b.status] ?? 'text-muted-foreground';
          const statusLabel = STATUS_LABELS[b.status] ?? b.status;

          return (
            <div
              key={b.id ?? idx}
              className={`px-2 py-1.5 rounded border text-xs ${pc.bg} ${pc.border}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium ${pc.text}`}>
                  {def?.label ?? b.building_type}
                </span>
                <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
              </div>
              {def?.effect && (
                <p className="text-muted-foreground mt-0.5 text-[10px]">{def.effect}</p>
              )}
            </div>
          );
        })}

      {/* Legacy V1 structures */}
      {legacyStructures.map((s, idx) => {
        const cfg = LEGACY_EFFECTS[s];
        const pillar = cfg?.pillar ?? 'military';
        const pc = PILLAR_COLORS[pillar];

        return (
          <div
            key={`legacy-${idx}`}
            className={`px-2 py-1.5 rounded border text-xs ${pc.bg} ${pc.border}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`font-medium ${pc.text}`}>{cfg?.label ?? s}</span>
              <span className="text-[10px] text-status-locked">● Active</span>
            </div>
            {cfg?.effect && (
              <p className="text-muted-foreground mt-0.5 text-[10px]">{cfg.effect}</p>
            )}
          </div>
        );
      })}

      {/* Territory-scoped modifiers */}
      {(territoryMods.supplyRouteCapacity > 0 || territoryMods.hasResourceProtection) && (
        <div className="mt-1 space-y-0.5">
          {territoryMods.supplyRouteCapacity > 0 && (
            <p className="text-[10px] text-accent">
              🏭 Supply route capacity: {territoryMods.supplyRouteCapacity}
            </p>
          )}
          {territoryMods.hasResourceProtection && (
            <p className="text-[10px] text-amber-400">
              🔒 Resources protected (Warehouse)
            </p>
          )}
        </div>
      )}
    </div>
  );
}