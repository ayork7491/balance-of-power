/**
 * MapExport — simple utility page to download the current Shattered Crown map data as JSON.
 * Navigate to /map-export to use.
 */
import { useEffect } from 'react';
import { MAP_SHATTERED_CROWN } from '@/features/maps/mapData.shattered_crown';

export default function MapExport() {
  const exportData = {
    exported_at: new Date().toISOString(),
    source_version: '0.381-surgical-collision-cleanup',
    map_id: MAP_SHATTERED_CROWN.id,
    name: MAP_SHATTERED_CROWN.name,
    width: MAP_SHATTERED_CROWN.width,
    height: MAP_SHATTERED_CROWN.height,
    min_players: MAP_SHATTERED_CROWN.min_players,
    max_players: MAP_SHATTERED_CROWN.max_players,
    background_image_url: MAP_SHATTERED_CROWN.background_image_url,
    continents: MAP_SHATTERED_CROWN.continents,
    regions: MAP_SHATTERED_CROWN.regions,
    territories: MAP_SHATTERED_CROWN.territories,
    adjacency: MAP_SHATTERED_CROWN.adjacency,
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shattered_crown_map_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="panel p-8 max-w-md w-full text-center space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary tracking-widest uppercase">Map Export</h1>
          <p className="text-muted-foreground text-sm mt-2">Shattered Crown v3.8.1</p>
        </div>

        <div className="text-left bg-secondary/30 rounded-md p-4 space-y-1 text-xs font-mono text-muted-foreground">
          <div><span className="text-foreground">map_id:</span> {exportData.map_id}</div>
          <div><span className="text-foreground">version:</span> {exportData.source_version}</div>
          <div><span className="text-foreground">territories:</span> {exportData.territories.length}</div>
          <div><span className="text-foreground">adjacency edges:</span> {exportData.adjacency.length}</div>
          <div><span className="text-foreground">continents:</span> {exportData.continents.length}</div>
          <div><span className="text-foreground">regions:</span> {exportData.regions.length}</div>
          <div><span className="text-foreground">coordinate space:</span> {exportData.width} × {exportData.height}</div>
        </div>

        <button
          onClick={handleDownload}
          className="btn-tactical w-full py-3 text-sm"
        >
          ↓ Download JSON
        </button>

        <p className="text-xs text-muted-foreground">
          Exports geometry, adjacency, regions, continents, and resources. Does not include campaign state.
        </p>
      </div>
    </div>
  );
}