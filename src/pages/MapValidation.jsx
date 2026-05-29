/**
 * MapValidation — Terrain Layer 1.0 implementation validation.
 *
 * 4 modes as required by the Terrain Layer spec:
 *   1. Full map (all layers)
 *   2. Terrain Layer ON / Territory Layer OFF
 *   3. Terrain Layer + World Layer only (no territories)
 *   4. (Continent overview — for reference)
 *
 * Navigate to /map-validation
 */
import { useState } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';
import MapRenderer from '@/components/map/MapRenderer';

const MODES = [
  {
    id: 'full',
    label: '1. Full Map',
    desc: 'All layers — terrain + world + territories + gameplay',
  },
  {
    id: 'terrain_no_territories',
    label: '2. Terrain ON / Territories OFF',
    desc: 'Terrain Layer 1.0 + World Layer 2.0, no territory polygons',
  },
  {
    id: 'terrain_and_world',
    label: '3. Terrain + World Only',
    desc: 'Terrain Layer 1.0 and World Layer 2.0 only — no gameplay layers',
  },
  {
    id: 'world_only',
    label: '4. World Layer Only',
    desc: 'World Layer 2.0 only — no terrain, no territories',
  },
];

// Strip territory polygon points (makes them invisible but preserves mapDef structure)
const MAPDEF_NO_POLYS = {
  ...MAP_SHATTERED_CROWN,
  territories: MAP_SHATTERED_CROWN.territories.map(t => ({ ...t, points: '' })),
};

export default function MapValidation() {
  const [mode, setMode] = useState('full');

  const current = MODES.find(m => m.id === mode);

  // Derive props per mode
  const mapDef         = (mode === 'terrain_no_territories' || mode === 'terrain_and_world' || mode === 'world_only')
                           ? MAPDEF_NO_POLYS
                           : MAP_SHATTERED_CROWN;
  const underlayUrl    = (mode === 'terrain_no_territories' || mode === 'terrain_and_world' || mode === 'world_only' || mode === 'full')
                           ? MAP_SHATTERED_CROWN.underlay_url
                           : null;
  const terrainLayerUrl = (mode === 'full' || mode === 'terrain_no_territories' || mode === 'terrain_and_world')
                           ? MAP_SHATTERED_CROWN.terrain_layer_url
                           : null;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mode selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 border-b border-border bg-panel-header shrink-0">
        <div className="flex gap-2 overflow-x-auto">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`shrink-0 px-3 py-1.5 rounded text-xs font-display tracking-wider uppercase transition-all whitespace-nowrap ${
                mode === m.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground sm:ml-auto">
          {current?.desc}
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
          terrainLayerUrl={terrainLayerUrl}
        />
      </div>
    </div>
  );
}