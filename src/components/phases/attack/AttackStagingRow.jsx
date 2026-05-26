/**
 * AttackStagingRow — one staged attack entry in the left dock.
 * Shows origin → target, committed troops, delete button.
 * Only rendered for the current player's own attacks.
 */
import { Trash2, ArrowRight } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

function getTerritoryName(territoryId, mapDef) {
  return mapDef?.territories.find(t => t.territory_id === territoryId)?.name ?? territoryId;
}

export default function AttackStagingRow({ attack, mapDef, onDelete, disabled }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-muted/20 text-xs group">
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 text-foreground">
          <span className="truncate font-medium">{getTerritoryName(attack.origin_territory_id, mapDef)}</span>
          <ArrowRight className="w-3 h-3 shrink-0 text-status-danger" />
          <span className="truncate font-medium">{getTerritoryName(attack.target_territory_id, mapDef)}</span>
        </div>
        <p className="text-muted-foreground">
          <span className="font-mono text-status-danger font-bold">{attack.committed_troops}</span> troops committed
        </p>
      </div>
      {!disabled && (
        <button
          onClick={() => onDelete(attack.id)}
          className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          title="Remove attack"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}