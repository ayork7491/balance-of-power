/**
 * TerritoryDetailPanel — slide-up panel showing selected territory details.
 * Appears at the bottom-center of the map viewport when a territory is selected.
 * Reads from territory schema (static) + territory state (dynamic).
 *
 * During territory_draft phase, shows a Claim Territory button if the territory
 * is unclaimed and it is the current player's turn.
 */
import { X, Shield, Swords, MapPin, Check, Loader2, Lock } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';
import { getResourceConfig, getResourceIcon } from '@/config/resourceConfig';

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
  territory,            // TerritoryDefinition | null
  tState,               // TerritoryState | null
  players,              // CampaignPlayer[]
  regionDef,            // MapRegion | null
  continentDef,         // MapContinent | null
  adjacentTerritories,  // TerritoryDefinition[]
  onClose,
  // ── Lock state ──
  isLocked,             // boolean — territory is locked by a delayed battle
  // ── Draft phase claim support ──
  phase,                // Campaign current_phase (optional)
  isMyDraftTurn,        // boolean — is it the current player's turn to pick?
  onClaim,              // async fn — called to claim this territory
  claimSubmitting,      // boolean
  claimError,           // string | null
}) {
  if (!territory) return null;

  const owner = tState?.owner_player_id
    ? players.find(p => p.id === tState.owner_player_id || p.user_id === tState.owner_player_id)
    : null;
  const ownerColor = owner
    ? PLAYER_COLORS.find(c => c.id === owner.color)
    : null;

  // Resource type: prefer TerritoryState.resource_type (stamped at game start),
  // fall back to territory definition metadata.
  const resourceType = tState?.resource_type ?? territory?.resource_type ?? null;
  const resourceCfg = resourceType ? getResourceConfig(resourceType) : null;

  const isDraftPhase = phase === 'territory_draft';
  const isClaimed    = !!tState?.owner_player_id;
  const canClaim     = isDraftPhase && isMyDraftTurn && !isClaimed && !!onClaim;

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
          {/* Locked territory warning */}
          {isLocked && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-orange-500/40 bg-orange-500/10 text-xs text-orange-400">
              <Lock className="w-3 h-3 shrink-0" />
              <span>This territory is locked by a delayed battle. Deploy, attack, fortify, and construction are blocked until the battle resolves.</span>
            </div>
          )}

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

          {/* Region + Continent */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {regionDef && (
              <div>
                <p className="text-muted-foreground">Region</p>
                <p className="text-foreground font-medium">{regionDef.name}
                  {regionDef.control_bonus > 0 && <span className="ml-1 badge-info">+{regionDef.control_bonus}</span>}
                </p>
              </div>
            )}
            {continentDef && (
              <div>
                <p className="text-muted-foreground">Continent</p>
                <p className="text-foreground font-medium">{continentDef.name}
                  {continentDef.control_bonus > 0 && <span className="ml-1 badge-info">+{continentDef.control_bonus}</span>}
                </p>
              </div>
            )}
          </div>

          {/* Primary resource */}
          {resourceCfg && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Resource</span>
              <span className={`${resourceCfg.color}`}>
                {resourceCfg.icon} {resourceCfg.label}
              </span>
            </div>
          )}

          {/* Territory storage (if any resources are stored here) */}
          {tState?.resource_storage && Object.values(tState.resource_storage).some(v => v > 0) && (
            <div className="flex items-start justify-between text-xs gap-2">
              <span className="text-muted-foreground shrink-0">Stored</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {Object.entries(tState.resource_storage)
                  .filter(([, v]) => v > 0)
                  .map(([type, amount]) => {
                    const cfg = getResourceConfig(type);
                    return (
                      <span key={type} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        {cfg.icon} {amount}
                      </span>
                    );
                  })}
              </div>
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
                  <span key={t.territory_id} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Draft Phase Claim Button ── */}
          {isDraftPhase && (
            <div className="pt-2 border-t border-border">
              {isClaimed ? (
                <p className="text-xs text-destructive">
                  Already claimed by {owner?.display_name ?? 'another player'}
                </p>
              ) : canClaim ? (
                <>
                  {claimError && <p className="text-xs text-destructive mb-1">{claimError}</p>}
                  <button
                    onClick={onClaim}
                    disabled={claimSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
                  >
                    {claimSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Claim Territory
                  </button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {!isMyDraftTurn ? "Not your turn to pick." : "Tap an unclaimed territory to claim it."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}