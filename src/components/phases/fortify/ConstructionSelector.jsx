/**
 * ConstructionSelector — UI for selecting territory and structure type.
 */
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Castle, Hammer, X } from 'lucide-react';

// ⚠ SPRINT 3B: These legacy V1 structures (castle/barracks/stables) with old
// resource costs (brick/lumber/wool/grain/ore) are retained for backward
// compatibility with existing ConstructionProject records. Replace with
// TerritoryBuilding + new BuildingDefinitions when Sprint 3B construction
// gameplay is implemented.
const STRUCTURE_CONFIG = {
  castle: {
    cost: { brick: 2, lumber: 1, ore: 1 },
    rounds: 2,
    effect: 'Defensive bonus',
    icon: Castle,
  },
  barracks: {
    cost: { brick: 1, lumber: 2, wool: 1 },
    rounds: 1,
    effect: '+1 troop income',
    icon: Hammer,
  },
  stables: {
    cost: { lumber: 2, wool: 2, grain: 1 },
    rounds: 1,
    effect: 'Increased range',
    icon: Castle,
  },
};

export default function ConstructionSelector({
  campaign, myPlayer, stateById, mapDef, selectedTerritoryId, onStartConstruction, onClearSelection
}) {
  const [selectedStructure, setSelectedStructure] = useState(null);

  // Check if selected territory is valid for construction
  const isValidTerritory = useMemo(() => {
    if (!selectedTerritoryId || !myPlayer) return false;
    const ts = stateById[selectedTerritoryId];
    if (!ts || ts.owner_player_id !== myPlayer.id) return false;
    if ((ts.structures ?? []).length > 0) return false; // Already has structure
    return true;
  }, [selectedTerritoryId, myPlayer, stateById]);

  const handleStart = () => {
    if (selectedStructure && isValidTerritory) {
      onStartConstruction(selectedTerritoryId, selectedStructure);
      setSelectedStructure(null);
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

  const territoryName = mapDef?.territories.find(t => t.territory_id === selectedTerritoryId)?.name ?? selectedTerritoryId;

  if (!isValidTerritory) {
    return (
      <div className="p-3 rounded border border-border bg-muted/10 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{territoryName}</span>
          <button onClick={onClearSelection}>
            <X className="w-3 h-3" />
          </button>
        </div>
        <p className="mt-1 text-destructive">Cannot build here (already has structure)</p>
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

      <div className="space-y-1.5">
        {Object.entries(STRUCTURE_CONFIG).map(([type, config]) => {
          const Icon = config.icon;
          const isSelected = selectedStructure === type;
          return (
            <button
              key={type}
              onClick={() => setSelectedStructure(type)}
              className={`w-full flex items-center gap-3 p-2 rounded border text-left transition-colors ${
                isSelected 
                  ? 'border-primary/40 bg-primary/10' 
                  : 'border-border bg-muted/20 hover:bg-muted/30'
              }`}
            >
              <Icon className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground capitalize">{type}</p>
                <p className="text-xs text-muted-foreground">{config.effect}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{config.rounds} round{config.rounds > 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(config.cost).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ')}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleStart}
        disabled={!selectedStructure}
        className="w-full h-8 text-xs"
      >
        Start Construction
      </Button>
    </div>
  );
}