/**
 * MapValidation — layer toggle page for the Shattered Crown map.
 * Navigate to /map-validation
 */
import { useState, useMemo } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';
import MapRenderer from '@/components/map/MapRenderer';

const LAYERS = [
  { id: 'background',   label: '00 Background',   desc: 'Single PNG background image' },
  { id: 'territories',  label: '01 Territories',   desc: 'Territory polygon geometry & ownership fills' },
  { id: 'labels',       label: '02 Labels',        desc: 'Territory name text labels' },
  { id: 'routes',       label: '03 Routes',        desc: 'Adjacency lines & route hint corridors' },
];

const ALL_ON = Object.fromEntries(LAYERS.map(l => [l.id, true]));

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
      <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${
        active ? 'bg-primary border-primary' : 'border-muted-foreground bg-transparent'
      }`} />
      {layer.label}
    </button>
  );
}

function ValidationMapRenderer({ layers }) {
  const mapDef = useMemo(() => {
    const base = { ...MAP_SHATTERED_CROWN };
    if (!layers.background) base.background_image_url = undefined;
    if (!layers.territories || !layers.labels) {
      base.territories = MAP_SHATTERED_CROWN.territories.map(t => ({
        ...t,
        points: layers.territories ? t.points : '',
        name:   layers.labels      ? t.name   : '',
      }));
    }
    return base;
  }, [layers]);

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
      _suppressConnectionLines={!layers.routes}
    />
  );
}

export default function MapValidation() {
  const [layers, setLayers] = useState(ALL_ON);
  const toggle = (id) => setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  const activeCount = Object.values(layers).filter(Boolean).length;

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-panel-header shrink-0">
        <span className="text-xs font-display tracking-widest uppercase text-muted-foreground mr-1 shrink-0">
          Layers
        </span>
        {LAYERS.map(layer => (
          <LayerToggle key={layer.id} layer={layer} active={layers[layer.id] ?? false} onToggle={toggle} />
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => setLayers(ALL_ON)}
            className="px-3 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all whitespace-nowrap"
          >
            Reset All
          </button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {activeCount}/{LAYERS.length} on
          </span>
        </div>
      </div>
      <div className="relative flex-1">
        <ValidationMapRenderer layers={layers} />
      </div>
    </div>
  );
}