/**
 * MapValidation — temporary validation page for World Layer v2.0 screenshots.
 * Renders the Shattered Crown map in 3 modes:
 *   1. Full map (all layers)
 *   2. Underlay only (no polygons, no ownership)
 *   3. Polygons only (no underlay)
 *
 * Navigate to /map-validation
 */
import { useState, useMemo } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';
import MapRenderer from '@/components/map/MapRenderer';

const MODES = [
  { id: 'full',           label: '1. Full Map (all layers)' },
  { id: 'underlay_only',  label: '2. Underlay only (polygons hidden)' },
  { id: 'polygons_only',  label: '3. Polygons only (underlay hidden)' },
];

export default function MapValidation() {
  const [mode, setMode] = useState('full');

  const underlayUrl = mode === 'polygons_only' ? null : MAP_SHATTERED_CROWN.underlay_url;

  // Build a mapDef with polygons stripped for underlay-only mode
  const mapDef = useMemo(() => {
    if (mode === 'underlay_only') {
      return {
        ...MAP_SHATTERED_CROWN,
        territories: MAP_SHATTERED_CROWN.territories.map(t => ({
          ...t,
          points: '', // empty polygon — won't render
        })),
      };
    }
    return MAP_SHATTERED_CROWN;
  }, [mode]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mode selector */}
      <div className="flex gap-2 p-3 border-b border-border bg-panel-header shrink-0 overflow-x-auto">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`shrink-0 px-3 py-1.5 rounded text-xs font-display tracking-wider uppercase transition-all ${
              mode === m.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        ))}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground self-center pr-2">
          World Layer v2.0 Validation
        </span>
      </div>

      {/* Map fills remaining space */}
      <div className="relative flex-1">
        <MapRenderer
          key={mode}
          mapDef={mapDef}
          stateById={{}}
          players={[]}
          selectedId={null}
          highlightIds={new Set()}
          attackableIds={new Set()}
          onSelect={() => {}}
          underlayUrl={underlayUrl}
        />
      </div>
    </div>
  );
}