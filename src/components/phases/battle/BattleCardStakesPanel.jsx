/**
 * BattleCardStakesPanel — displays stakes, pillar info, and consequence preview
 * for a single BattleCard. Shown in BattleCardDetail for non-military cards.
 */
import { BATTLE_SOURCE_LABELS, BATTLE_CONSEQUENCE_TEXT } from '@/config/operationsConfig';
import OperationSourceBadge from '@/components/operations/OperationSourceBadge';

const BATTLE_TYPE_PILLAR = {
  siege: 'military', double_siege: 'military', bloodbath: 'military', capture_objectives: 'military', skirmish: 'military',
  supply_route_establishment: 'economic', supply_route_race: 'economic', supply_raid: 'economic', supply_caravan_escort: 'economic',
  uprising: 'diplomatic', labor_strike: 'diplomatic', tax_protest: 'diplomatic', manufactured_crisis: 'diplomatic',
};

const RESOURCE_ICONS = { gold: '💰', iron: '⚙️', timber: '🌲', stone: '🪨', food: '🌾' };

function MetaRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground min-w-[120px]">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function ConsequenceBlock({ heading, lines, accent }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className={`p-2 rounded border text-xs ${accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/10'}`}>
      <p className={`font-display uppercase tracking-wider text-[10px] mb-1 ${accent ? 'text-primary' : 'text-muted-foreground'}`}>
        {heading}
      </p>
      {lines.map((line, i) => <p key={i} className="text-foreground">{line}</p>)}
    </div>
  );
}

export default function BattleCardStakesPanel({ card, players, mapDef }) {
  if (!card) return null;

  const source = card.battle_card_source;
  const meta   = card.source_operation_metadata ?? {};
  const pillar = card.battle_pillar ?? BATTLE_TYPE_PILLAR[card.battle_type] ?? 'military';

  // Only show for non-military (military cards have enough context already)
  if (pillar === 'military' && !source) return null;

  const consequences = BATTLE_CONSEQUENCE_TEXT[card.battle_type];
  const sourceCfg    = source ? BATTLE_SOURCE_LABELS[source] : null;

  const getTerritoryName = (id) =>
    mapDef?.territories?.find(t => t.territory_id === id)?.name ?? id ?? '—';
  const getPlayerName = (id) =>
    players?.find(p => p.id === id)?.display_name ?? id ?? '—';

  // Build metadata rows based on battle type
  const metaRows = [];

  if (pillar === 'diplomatic') {
    if (meta.influence_spent) metaRows.push({ label: 'Influence Spent', value: `${meta.influence_spent}` });
    if (meta.region_id) metaRows.push({ label: 'From Region', value: meta.region_id.replace(/_/g, ' ') });
    if (meta.gold_transfer_amount) metaRows.push({ label: 'Gold at Stake', value: `${meta.gold_transfer_amount} gold` });
    if (meta.territory_b_id) metaRows.push({ label: 'Territory B', value: getTerritoryName(meta.territory_b_id) });
    if (meta.territory_b_player_id) metaRows.push({ label: 'Territory B Owner', value: getPlayerName(meta.territory_b_player_id) });
    if (meta.diplomat_committed_troops) metaRows.push({ label: 'Diplomat Troops', value: `${meta.diplomat_committed_troops}` });
    if (meta.troop_loss_basis) metaRows.push({ label: 'Garrison at Stake', value: `${meta.troop_loss_basis} (30% basis)` });
    if (meta.target_resource_hub) metaRows.push({ label: 'Target Hub', value: getTerritoryName(meta.target_resource_hub) });
  }

  if (pillar === 'economic') {
    if (meta.invested_gold) metaRows.push({ label: 'Gold Invested', value: `${meta.invested_gold}` });
    if (meta.declared_resource_type) metaRows.push({ label: 'Declared Resource', value: `${RESOURCE_ICONS[meta.declared_resource_type] ?? ''} ${meta.declared_resource_type}` });
    if (meta.supply_route_id) metaRows.push({ label: 'Target Route', value: meta.supply_route_id.slice(0, 8) + '…' });
    if (meta.route_target_territory) metaRows.push({ label: 'Route Territory', value: getTerritoryName(meta.route_target_territory) });
    if (meta.route_cooldown_until_round) metaRows.push({ label: 'Cooldown on Fail', value: `Until round ${meta.route_cooldown_until_round}` });
    if (meta.shipment_origin) metaRows.push({ label: 'Shipment Origin', value: getTerritoryName(meta.shipment_origin) });
    if (meta.shipment_destination) metaRows.push({ label: 'Shipment Destination', value: getTerritoryName(meta.shipment_destination) });
    if (meta.shipment_contents && Object.keys(meta.shipment_contents).length > 0) {
      const contents = Object.entries(meta.shipment_contents)
        .filter(([, v]) => v > 0)
        .map(([r, v]) => `${v} ${r}`)
        .join(', ');
      if (contents) metaRows.push({ label: 'Shipment', value: contents });
    }
  }

  // Build consequence lines
  const sourcePlayer = card.source_player_id ? getPlayerName(card.source_player_id) : null;

  let winLines = [];
  let loseLines = [];

  if (consequences) {
    if (card.battle_type === 'bloodbath') {
      winLines = [consequences.winner];
      loseLines = [consequences.loser];
    } else if (card.battle_type === 'capture_objectives') {
      winLines = [consequences.winner];
      loseLines = [consequences.losers];
    } else if (card.battle_type === 'manufactured_crisis') {
      winLines = [`Diplomat wins: ${consequences.diplomat_wins}`];
      loseLines = [`Player wins: ${consequences.player_wins}`];
    } else if (card.battle_type === 'supply_caravan_escort') {
      winLines = [`Caravan owner wins: ${consequences.defender_wins}`];
      loseLines = [`Interceptor wins: ${consequences.attacker_wins}`];
    } else if (card.battle_type === 'tax_protest') {
      winLines = [`Diplomat wins (defends): ${consequences.attacker_wins}`];
      loseLines = [`Taxed player wins (attacks): ${consequences.defender_wins}`];
    } else {
      if (consequences.attacker_wins) winLines.push(consequences.attacker_wins);
      if (consequences.defender_wins) loseLines.push(consequences.defender_wins);
    }
  }

  // Replace [declared resource] placeholder
  if (meta.declared_resource_type) {
    winLines = winLines.map(l => l.replace('[declared resource]', meta.declared_resource_type));
    loseLines = loseLines.map(l => l.replace('[declared resource]', meta.declared_resource_type));
  }

  return (
    <div className="panel p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Stakes & Consequences</p>
        {sourceCfg && <OperationSourceBadge source={source} size="xs" />}
        {sourcePlayer && (
          <span className="text-[10px] text-muted-foreground">by {sourcePlayer}</span>
        )}
      </div>

      {/* Metadata */}
      {metaRows.length > 0 && (
        <div className="space-y-1 pb-2 border-b border-border">
          {metaRows.map(({ label, value }, i) => (
            <MetaRow key={i} label={label} value={value} />
          ))}
        </div>
      )}

      {/* Consequence preview */}
      {(winLines.length > 0 || loseLines.length > 0) && (
        <div className="space-y-2">
          {winLines.length > 0 && (
            <ConsequenceBlock heading="If attacker/diplomat wins" lines={winLines} accent />
          )}
          {loseLines.length > 0 && (
            <ConsequenceBlock heading="If defender wins" lines={loseLines} />
          )}
        </div>
      )}
    </div>
  );
}