/**
 * ActiveDiplomaticEffects — Sprint 4H
 *
 * Renders a compact list of all active DiplomaticAction records for the current round.
 * Shows issuer, effect type, targets, expiry, and effect-specific metadata.
 */
import { PLAYER_COLORS } from '@/config/theme';

const ACTION_LABELS = {
  war_rations:         '⚔ War Rations',
  influence_network:   '🕊 Influence Network',
  merchant_convoy:     '🛒 Merchant Convoy',
  non_aggression_pact: '🤝 Non-Aggression Pact',
  broker_peace:        '☮ Broker Peace',
  coalition_warfare:   '⚡ Coalition Warfare',
  power_broker:        '👑 Power Broker',
};

const STATUS_COLORS = {
  active:    'text-status-locked',
  pending:   'text-status-pending',
  expired:   'text-muted-foreground',
  cancelled: 'text-muted-foreground/40',
};

const REGION_LABELS = {
  outer_passes: 'Outer Passes', high_crown: 'High Crown', northern_wilds: 'Northern Wilds',
  deepwoods: 'Deepwoods', northern_ruins: 'Northern Ruins', central_crossroads: 'Central Crossroads',
  southern_ruins: 'Southern Ruins', western_plains: 'Western Plains',
  eastern_granaries: 'Eastern Granaries', northern_isles: 'Northern Isles',
  southern_fractures: 'Southern Fractures',
};

function getPlayerName(players, playerId) {
  return players?.find(p => p.id === playerId)?.display_name ?? '?';
}

function getPlayerColor(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

function EffectDetail({ effect, players }) {
  const meta = effect.effect_metadata ?? {};

  switch (effect.action_type) {
    case 'war_rations':
      return <p className="text-[10px] text-muted-foreground">Food upkeep reduced this round.</p>;

    case 'influence_network': {
      const count = meta.spread_count ?? 0;
      const src = meta.source_territory ?? effect.target_territory_id;
      return (
        <p className="text-[10px] text-muted-foreground">
          +1 Perm. Influence spread to {count} territories adjacent to {src}.
        </p>
      );
    }

    case 'merchant_convoy':
      return (
        <p className="text-[10px] text-muted-foreground">
          Supply route {meta.protected_route_id ?? effect.target_supply_route_id} protected from disruption.
        </p>
      );

    case 'non_aggression_pact': {
      const restricted = getPlayerName(players, effect.target_player_id);
      const color = getPlayerColor(players, effect.target_player_id);
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span><span className="text-foreground">{restricted}</span> cannot attack issuer.</span>
          {effect.expires_round && <span className="text-muted-foreground/60">Expires round {effect.expires_round}.</span>}
        </div>
      );
    }

    case 'broker_peace': {
      const territory = meta.protected_territory_id ?? effect.target_territory_id;
      return (
        <p className="text-[10px] text-muted-foreground">
          Battle generation blocked at {territory}.
        </p>
      );
    }

    case 'coalition_warfare': {
      const coerced = getPlayerName(players, effect.target_player_id);
      const color = getPlayerColor(players, effect.target_player_id);
      const battleTerr = meta.battle_territory_id;
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span><span className="text-foreground">{coerced}</span> must contribute troops{battleTerr ? ` at ${battleTerr}` : ''}. (Pending)</span>
        </div>
      );
    }

    case 'power_broker': {
      const playerA = getPlayerName(players, effect.target_player_id);
      const playerB = getPlayerName(players, effect.target_player_b_id);
      const colorA = getPlayerColor(players, effect.target_player_id);
      const colorB = getPlayerColor(players, effect.target_player_b_id);
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorA }} />
          <span className="text-foreground">{playerA}</span>
          <span>↔</span>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorB }} />
          <span className="text-foreground">{playerB}</span>
          <span>Non-Aggression Pact.</span>
          {effect.expires_round && <span className="text-muted-foreground/60">Expires round {effect.expires_round}.</span>}
        </div>
      );
    }

    default:
      return null;
  }
}

export default function ActiveDiplomaticEffects({ effects, players, campaign }) {
  if (!effects || effects.length === 0) return null;

  const sorted = [...effects].sort((a, b) => (b.round ?? 0) - (a.round ?? 0));

  return (
    <div className="space-y-1.5">
      {sorted.map(effect => {
        const issuerName = getPlayerName(players, effect.player_id);
        const issuerColor = getPlayerColor(players, effect.player_id);
        const statusColor = STATUS_COLORS[effect.status] ?? 'text-muted-foreground';
        const label = ACTION_LABELS[effect.action_type] ?? effect.action_type;
        const regionLabel = REGION_LABELS[effect.region_id] ?? effect.region_id;

        return (
          <div
            key={effect.id}
            className="px-2.5 py-2 rounded border border-border bg-muted/5 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: issuerColor }} />
                <span className="text-xs font-medium text-foreground truncate">{label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-muted-foreground">{regionLabel}</span>
                <span className={`text-[9px] ${statusColor}`}>● {effect.status}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">by {issuerName} · {effect.influence_spent}🕊 spent · Rd {effect.round}</p>
            <EffectDetail effect={effect} players={players} />
          </div>
        );
      })}
    </div>
  );
}