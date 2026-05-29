/**
 * MapValidation — interactive layer toggle page.
 * Each map rendering layer can be independently toggled on/off.
 * Navigate to /map-validation
 */
import { useState, useMemo } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';
import MapRenderer from '@/components/map/MapRenderer';

const LAYERS = [
  { id: 'world',      label: 'World Layer',      desc: 'Continent silhouettes & coastlines (World Layer 2.0)' },
  { id: 'terrain',    label: 'Terrain Layer',     desc: 'Mountains, forests, rivers, ruins (Terrain Layer 1.0)' },
  { id: 'territories', label: 'Territories',       desc: 'Interactive territory polygons' },
  { id: 'labels',     label: 'Labels',            desc: 'Territory name text labels' },
  { id: 'continent',  label: 'Continent Tints',   desc: 'Programmatic continent atmosphere layer' },
];

// MapRenderer with optional label suppression injected via mapDef override
function ValidationMapRenderer({ layers }) {
  const showTerritories = layers.territories;
  const showLabels      = layers.labels;

  const mapDef = useMemo(() => {
    if (showTerritories && showLabels) return MAP_SHATTERED_CROWN;
    return {
      ...MAP_SHATTERED_CROWN,
      territories: MAP_SHATTERED_CROWN.territories.map(t => ({
        ...t,
        // Empty points hides the polygon shape
        points: showTerritories ? t.points : '',
        // Use a sentinel to hide labels — MapRenderer checks scale >= 0.45
        // We suppress by passing an empty name when labels are off
        name: showLabels ? t.name : '',
      })),
    };
  }, [showTerritories, showLabels]);

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
      underlayUrl={layers.world    ? MAP_SHATTERED_CROWN.underlay_url     : null}
      terrainLayerUrl={layers.terrain ? MAP_SHATTERED_CROWN.terrain_layer_url : null}
      _suppressContinentLayer={!layers.continent}
      _suppressConnectionLines={!layers.territories}
    />
  );
}

function LayerToggle({ layer, active, onToggle }) {
  return (
    <button
      onClick={() => onToggle(layer.id)}
      title={layer.desc}
      className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-display tracking-wider uppercase transition-all whitespace-nowrap select-none ${
        active
          ? 'bg-primary/20 border-primary text-primary'
          : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
      }`}
    >
      {/* Toggle indicator */}
      <span className={`w-2.5 h-2.5 rounded-full border ${active ? 'bg-primary border-primary' : 'border-muted-foreground bg-transparent'}`} />
      {layer.label}
    </button>
  );
}

export default function MapValidation() {
  const [layers, setLayers] = useState({
    world: true,
    terrain: true,
    territories: true,
    labels: true,
    continent: true,
  });

  const toggle = (id) => setLayers(prev => ({ ...prev, [id]: !prev[id] }));

  const activeCount = Object.values(layers).filter(Boolean).length;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-panel-header shrink-0">
        <span className="text-xs font-display tracking-widest uppercase text-muted-foreground mr-1">Layers</span>
        {LAYERS.map(layer => (
          <LayerToggle
            key={layer.id}
            layer={layer}
            active={layers[layer.id]}
            onToggle={toggle}
          />
        ))}
        <button
          onClick={() => setLayers({ world: true, terrain: true, territories: true, labels: true, continent: true })}
          className="ml-auto px-3 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all whitespace-nowrap"
        >
          Reset All
        </button>
        <span className="text-xs text-muted-foreground">{activeCount}/{LAYERS.length} on</span>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <ValidationMapRenderer layers={layers} />
      </div>
    </div>
  );
}