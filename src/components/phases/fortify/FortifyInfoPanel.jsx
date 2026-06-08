/**
 * FortifyInfoPanel — Sprint 4D
 *
 * Right dock info panel for fortify phase.
 * Shows:
 *   - Building catalog (all buildings with effects)
 *   - My active building modifiers
 *   - Phase rules (modified by active buildings)
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Hammer, RefreshCw } from 'lucide-react';
import { ALL_BUILDING_DEFINITIONS } from '@/config/buildingDefinitions';
import { usePlayerBuildingModifiers } from '@/features/campaigns/buildings/usePlayerBuildingModifiers';
import PlayerModifiersCard from '@/components/buildings/PlayerModifiersCard';
import { getEffectiveConstructionSlots, getEffectiveMaxFortificationDistance } from '@/services/rules-engine/buildings/buildingEffects';

const PILLAR_COLORS = {
  military:   'text-red-400',
  economic:   'text-amber-400',
  diplomatic: 'text-blue-400',
};

const PILLAR_LABELS = {
  military:   '⚔ Military',
  economic:   '💰 Economic',
  diplomatic: '🕊 Diplomatic',
};

export default function FortifyInfoPanel({ campaign, players, myPlayer }) {
  const round = campaign?.current_round ?? 1;

  // Load territory states for legacy structure modifier calculation
  const [territoryStates, setTerritoryStates] = useState([]);
  useEffect(() => {
    if (!campaign?.id) return;
    base44.entities.TerritoryState.filter({ campaign_id: campaign.id })
      .then(setTerritoryStates)
      .catch(() => setTerritoryStates([]));
  }, [campaign?.id]);

  const { modifiers, loading: loadingMods } = usePlayerBuildingModifiers({
    campaignId: campaign?.id,
    playerId: myPlayer?.id,
    territoryStates,
  });

  const baseMaxFort = campaign?.settings?.max_fortifications_per_phase ?? 3;
  const baseFortDist = campaign?.settings?.max_fortification_distance ?? 4;
  const effectiveFortDist = getEffectiveMaxFortificationDistance(baseFortDist, modifiers);
  const baseConstructSlots = 1;
  const effectiveConstructSlots = getEffectiveConstructionSlots(baseConstructSlots, modifiers);

  // Group buildings by pillar for catalog display
  const byPillar = { military: [], economic: [], diplomatic: [] };
  for (const def of ALL_BUILDING_DEFINITIONS) {
    if (def.type === 'supply_route') continue; // internal building, not constructable directly
    byPillar[def.pillar]?.push(def);
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto dock-scroll">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-1">
        <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">
          Fortify Phase Info
        </p>
      </div>

      {/* Phase Rules */}
      <div className="space-y-1.5">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Phase Rules</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>• Max {baseMaxFort} movements per turn</p>
          <p className="flex items-center gap-1">
            • Fortification distance:{' '}
            <span className={effectiveFortDist > baseFortDist ? 'text-status-locked font-medium' : ''}>
              {effectiveFortDist}
            </span>
            {effectiveFortDist > baseFortDist && (
              <span className="text-status-locked">(+{effectiveFortDist - baseFortDist} from buildings)</span>
            )}
          </p>
          <p className="flex items-center gap-1">
            • Construction slots:{' '}
            <span className={effectiveConstructSlots > baseConstructSlots ? 'text-status-locked font-medium' : ''}>
              {effectiveConstructSlots}
            </span>
            {effectiveConstructSlots > baseConstructSlots && (
              <span className="text-status-locked">(+{effectiveConstructSlots - baseConstructSlots} from buildings)</span>
            )}
          </p>
        </div>
      </div>

      {/* My Active Modifiers */}
      {myPlayer && (
        <div className="space-y-1.5 pt-3 border-t border-border">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
            My Building Modifiers
          </p>
          <PlayerModifiersCard modifiers={modifiers} loading={loadingMods} />
        </div>
      )}

      {/* Building Catalog */}
      <div className="space-y-3 pt-3 border-t border-border">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">
          Building Catalog
        </p>

        {(['military', 'diplomatic', 'economic']).map(pillar => (
          <div key={pillar} className="space-y-1.5">
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${PILLAR_COLORS[pillar]}`}>
              {PILLAR_LABELS[pillar]}
            </p>
            {byPillar[pillar].map(def => (
              <div key={def.type} className="p-2 rounded border border-border bg-muted/10">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-xs font-medium text-foreground">{def.label}</p>
                  <span className="text-[10px] text-muted-foreground">{def.rounds}r</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{def.effect}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Cost: {Object.entries(def.cost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ')}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}