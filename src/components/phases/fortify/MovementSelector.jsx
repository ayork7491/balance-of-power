/**
 * MovementSelector — UI for selecting origin, destination, and troop count.
 * Allows explicit destination selection (not automatic).
 */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

export default function MovementSelector({ 
  campaign, myPlayer, stateById, mapDef, adjacencyMap, 
  selectedTerritoryId, maxDistance, existingMovements, onStageMovement, onClearSelection 
}) {
  const [troopCount, setTroopCount] = useState('');
  const [selectedDestination, setSelectedDestination] = useState(null);

  // Find valid destinations from selected territory
  const validDestinations = useMemo(() => {
    if (!selectedTerritoryId || !myPlayer) return [];
    
    const originState = stateById[selectedTerritoryId];
    if (!originState || originState.owner_player_id !== myPlayer.id) return [];
    
    // BFS to find all territories within maxDistance
    const visited = new Set([selectedTerritoryId]);
    const queue = [[selectedTerritoryId, 0]];
    const valid = [];
    
    while (queue.length > 0) {
      const [current, dist] = queue.shift();
      if (dist > 0 && dist <= maxDistance) {
        const currentState = stateById[current];
        if (currentState?.owner_player_id === myPlayer.id) {
          valid.push(current);
        }
      }
      if (dist < maxDistance) {
        const neighbors = adjacencyMap[current] || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push([neighbor, dist + 1]);
          }
        }
      }
    }
    
    return valid;
  }, [selectedTerritoryId, myPlayer, stateById, adjacencyMap, maxDistance]);

  // Calculate available troops at origin
  const availableTroops = useMemo(() => {
    if (!selectedTerritoryId) return 0;
    const originState = stateById[selectedTerritoryId];
    if (!originState) return 0;
    
    const alreadyCommitted = existingMovements
      .filter(m => m.origin_territory_id === selectedTerritoryId)
      .reduce((s, m) => s + (m.committed_troops || 0), 0);
    
    return Math.max(0, (originState.troop_count || 0) - alreadyCommitted);
  }, [selectedTerritoryId, stateById, existingMovements]);

  const handleStage = () => {
    if (!selectedTerritoryId || !selectedDestination || !troopCount) return;
    onStageMovement(selectedTerritoryId, selectedDestination, parseInt(troopCount));
    setTroopCount('');
    setSelectedDestination(null);
    onClearSelection();
  };

  if (!selectedTerritoryId) {
    return (
      <div className="p-3 rounded border border-border bg-muted/10 text-xs text-muted-foreground">
        Select one of your territories to start a movement
      </div>
    );
  }

  const originName = mapDef?.territories.find(t => t.territory_id === selectedTerritoryId)?.name ?? selectedTerritoryId;

  return (
    <div className="space-y-2 p-3 rounded border border-border bg-muted/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">From: {originName}</p>
        <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>

      {validDestinations.length === 0 ? (
        <p className="text-xs text-muted-foreground">No valid destinations within {maxDistance} moves</p>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Select destination:</p>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {validDestinations.map(tid => {
                const name = mapDef?.territories.find(t => t.territory_id === tid)?.name ?? tid;
                const isSelected = selectedDestination === tid;
                return (
                  <button
                    key={tid}
                    onClick={() => setSelectedDestination(tid)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      isSelected 
                        ? 'bg-primary/20 text-primary border-primary/40' 
                        : 'bg-muted/20 text-muted-foreground border-border hover:bg-muted/30'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Troops to move (max {availableTroops})</label>
            <Input
              type="number"
              min="1"
              max={availableTroops}
              value={troopCount}
              onChange={e => setTroopCount(e.target.value)}
              placeholder="0"
              className="h-8 text-xs"
            />
          </div>

          <Button
            onClick={handleStage}
            disabled={!troopCount || !selectedDestination || parseInt(troopCount) < 1 || parseInt(troopCount) > availableTroops}
            className="w-full h-8 text-xs"
          >
            Stage Movement
          </Button>
        </div>
      )}
    </div>
  );
}