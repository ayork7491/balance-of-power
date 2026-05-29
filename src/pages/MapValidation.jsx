/**
 * MapValidation — interactive layer toggle page.
 * Buttons correspond 1-to-1 with the canonical 9-layer MapLayerStack.
 * Navigate to /map-validation
 */
import { useState, useMemo } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';
import MapRenderer from '@/components/map/MapRenderer';

// One entry per layer in the MapLayerStack, in render order (bottom → top)
const LAYERS = [
  {
    id: 'ocean',
    label: '00 Ocean',
    desc: 'Ocean vignette / depth shading',
  },
  {
    id: 'world',
    label: '01 World',
    desc: 'World Layer v2.0 — continent silhouettes & coastlines',
  },
  {
    id: 'geography',
    label: '02 Geography',
    desc: 'Terrain Layer 1.0 + Biome Layer 1.0',
  },
  {
    id: 'atlas',
    label: '03 Atlas Labels',
    desc: 'Continent/region names, compass rose (reserved)',
    reserved: true,
  },
  {
    id: 'continent',
    label: '04a Continent Atmo',
    desc: 'Programmatic continent atmosphere tints (sub-layer of 04)',
  },
  {
    id: 'territories',
    label: '04b Territories',
    desc: 'Territory polygon geometry & ownership fills',
  },
  {
    id: 'labels',
    label: '05 Labels',
    desc: 'Territory name text labels',
  },
  {
    id: 'routes',
    label: '06 Routes',
    desc: 'Adjacency lines & route hint corridors',
  },
  {
    id: 'markers',
    label: '07 Markers',
    desc: 'Troop counts, structures, objectives (reserved)',
    reserved: true,
  },
  {
    id: 'overlays',
    label: '08 UI Overlays',
    desc: 'Selection glows, hover effects, debug (reserved)',
    reserved: true,
  },
];

function LayerToggle({ layer, active, onToggle }) {
  return (
    <button
      onClick={() => !layer.reserved && onToggle(layer.id)}
      title={layer.desc}
      disabled={layer.reserved}
      className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-display tracking-wider uppercase transition-all whitespace-nowrap select-none ${
        layer.reserved
          ? 'opacity-30 cursor-not-allowed border-border text-muted-foreground bg-transparent'
          : active
            ? 'bg-primary/20 border-primary text-primary'
            : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
      }`}
    >
      <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${
        layer.reserved
          ? 'border-muted-foreground bg-transparent'
          : active
            ? 'bg-primary border-primary'
            : 'border-muted-foreground bg-transparent'
      }`} />
      {layer.label}
      {layer.reserved && <span className="ml-1 opacity-60 normal-case font-body tracking-normal">(reserved)</span>}
    </button>
  );
}

function ValidationMapRenderer({ layers }) {
  const mapDef = useMemo(() => {
    if (layers.territories && layers.labels) return MAP_SHATTERED_CROWN;
    return {
      ...MAP_SHATTERED_CROWN,
      territories: MAP_SHATTERED_CROWN.territories.map(t => ({
        ...t,
        points: layers.territories ? t.points : '',
        name:   layers.labels      ? t.name   : '',
      })),
    };
  }, [layers.territories, layers.labels]);

  return (
    <MapRenderer
      key={JSON.stringify(layers)}
      mapDef={mapDef}
      stateById={{}}
      players={[]}
      selectedId={null}
      highlightIds={new Set()}
      attackableIds={new Set()}
      onSelect={() => {}}
      underlayUrl={layers.world     ? MAP_SHATTERED_CROWN.underlay_url      : null}
      terrainLayerUrl={layers.geography ? MAP_SHATTERED_CROWN.terrain_layer_url : null}
      biomeLayerUrl={layers.geography   ? MAP_SHATTERED_CROWN.biome_layer_url   : null}
      _suppressContinentLayer={!layers.continent}
      _suppressConnectionLines={!layers.routes}
    />
  );
}

const ALL_ON = Object.fromEntries(
  LAYERS.filter(l => !l.reserved).map(l => [l.id, true])
);

export default function MapValidation() {
  const [layers, setLayers] = useState(ALL_ON);

  const toggle = (id) => setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  const activeCount  = Object.values(layers).filter(Boolean).length;
  const totalToggleable = LAYERS.filter(l => !l.reserved).length;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-panel-header shrink-0">
        <span className="text-xs font-display tracking-widest uppercase text-muted-foreground mr-1 shrink-0">
          Layers
        </span>

        {LAYERS.map(layer => (
          <LayerToggle
            key={layer.id}
            layer={layer}
            active={layers[layer.id] ?? false}
            onToggle={toggle}
          />
        ))}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => setLayers(ALL_ON)}
            className="px-3 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all whitespace-nowrap"
          >
            Reset All
          </button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {activeCount}/{totalToggleable} on
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <ValidationMapRenderer layers={layers} />
      </div>
    </div>
  );
}