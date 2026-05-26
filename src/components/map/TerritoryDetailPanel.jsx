/**
 * TerritoryDetailPanel — slide-up panel showing selected territory details.
 * Appears at the bottom-center of the map viewport when a territory is selected.
 * Reads from territory schema (static) + territory state (dynamic).
 */
import { X, Shield, Swords, Users, MapPin } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';

const TERRAIN_LABELS = {
  mountains: '⛰ Mountains',
  forest:    '🌲 Forest',
  swamp:     '🌿 Swamp',
  tundra:    '❄️ Tundra',
  coastal:   '🌊 Coastal',
  desert:    '🏜 Desert',
  urban:     '🏙 Urban',
  plains:    '🌾 Plains',
};

export default function TerritoryDetailPanel({
  territory,     // TerritoryDef | null
  tState,        // TerritoryState | null
  players,       // CampaignPlayer[]
  regionDef,     // RegionDef | null
  adjacentTerritories, // TerritoryDef[]
  onClose,
}) {
  if (!territory) return null;

  const owner = tState?.owner_player_id
    ? players.find(p => p.id === tState.owner_player_id || p.user_id === tState.owner_player_id)
    : null;
  const ownerColor = owner
    ? PLAYER_COLORS.find(c => c.id === owner.color)
    : null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-2 pointer-events-none">
      <div className="panel pointer-events-auto shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="panel-header flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-display text-sm font-bold tracking-wider text-foreground truncate">
              {territory.name}
            </span>
            {territory.terrain && (
              <span className="text-xs text-muted-foreground shrink-0">
                {TERRAIN_LABELS[territory.terrain] ?? territory.terrain}
              </span>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Owner + troops */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {ownerColor ? (
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ownerColor.hex }} />
              ) : (
                <div className="w-3 h-3 rounded-full border border-muted-foreground shrink-0 opacity-40" />
              )}
              <span className="text-sm text-foreground font-medium">
                {owner ? owner.display_name : 'Unoccupied'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-foreground">
              <Shield className="w-3.5 h-3.5 text-primary" />
              {tState?.troop_count ?? 0}
              <span className="text-xs text-muted-foreground font-normal">troops</span>
            </div>
          </div>

          {/* Region */}
          {regionDef && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Region</span>
              <span className="text-foreground font-medium flex items-center gap-1">
                {regionDef.name}
                <span className="badge-info">{regionDef.control_bonus > 0 ? `+${regionDef.control_bonus}` : '—'}</span>
              </span>
            </div>
          )}

          {/* Structures */}
          {tState?.structures?.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Structures</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {tState.structures.map(s => (
                  <span key={s} className="badge-info capitalize">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Adjacent territories */}
          {adjacentTerritories.length > 0 && (
            <div className="text-xs">
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Swords className="w-3 h-3" /> Adjacent ({adjacentTerritories.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {adjacentTerritories.map(t => (
                  <span key={t.key} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}