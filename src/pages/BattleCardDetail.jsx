/**
 * BattleCardDetail — full detail view for a single battle card.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Swords, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AppShell from '@/components/layout/AppShell';
import BattleTypeTag from '@/components/phases/battle/BattleTypeTag';
import BattleStatusTag from '@/components/phases/battle/BattleStatusTag';
import { PLAYER_COLORS } from '@/config/theme';
import { getMap } from '@/features/maps';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

function PlayerChip({ players, playerId }) {
  const p   = players?.find(pl => pl.id === playerId);
  const hex = getPlayerHex(players, playerId);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-muted/20 text-xs">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
      {p?.display_name ?? '?'}
    </span>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div className={`px-3 py-2 rounded border text-center ${accent ? 'border-primary/30 bg-primary/10' : 'border-border bg-muted/20'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono font-bold text-lg ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

export default function BattleCardDetail() {
  const { id: campaignId, battleId } = useParams();
  const navigate = useNavigate();

  const [card, setCard]       = useState(null);
  const [players, setPlayers] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myPlayer, setMyPlayer] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [me, camps, plrs] = await Promise.all([
        base44.auth.me(),
        base44.entities.Campaign.filter({ id: campaignId }),
        base44.entities.CampaignPlayer.filter({ campaign_id: campaignId }),
      ]);
      const camp = camps[0] ?? null;
      setCampaign(camp);
      setPlayers(plrs);
      const mp = plrs.find(p => p.user_id === me?.id) ?? null;
      setMyPlayer(mp);

      const res = await base44.functions.invoke('battlePhase', {
        action: 'getBattleCards',
        campaign_id: campaignId,
        round: camp?.current_round ?? 1,
      });
      const cards = res.data?.battle_cards ?? [];
      setCard(cards.find(c => c.id === battleId) ?? null);
      setLoading(false);
    }
    load();
  }, [campaignId, battleId]);

  const mapDef     = getMap(campaign?.map_id ?? 'map_v1_standard');
  const targetName = mapDef?.territories.find(t => t.territory_id === card?.target_territory_id)?.name
    ?? card?.target_territory_id ?? '—';

  const attackerIds = [...new Set((card?.attackers ?? []).map(a => a.player_id))];
  const canSubmit   = myPlayer && card &&
    (attackerIds.includes(myPlayer.id) || card.defender_player_id === myPlayer.id) &&
    ['awaiting_result', 'pending'].includes(card.status);

  if (loading) {
    return (
      <AppShell title="Battle Card">
        <div className="flex items-center justify-center py-20 text-muted-foreground text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (!card) {
    return (
      <AppShell title="Battle Card">
        <div className="max-w-lg mx-auto p-6">
          <p className="text-muted-foreground text-sm">Battle card not found.</p>
          <Link to={`/campaigns/${campaignId}`} className="text-primary text-xs mt-2 inline-block">← Back to campaign</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Battle Card">
      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Back */}
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaign
        </button>

        {/* Header */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Swords className="w-4 h-4 text-destructive" />
                <BattleTypeTag type={card.battle_type} />
                <BattleStatusTag status={card.status} />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">{targetName}</p>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground w-16">Attackers</span>
              {attackerIds.map(pid => <PlayerChip key={pid} players={players} playerId={pid} />)}
            </div>
            {card.defender_player_id && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Defender</span>
                <PlayerChip players={players} playerId={card.defender_player_id} />
              </div>
            )}
          </div>
        </div>

        {/* Scaling stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Total Troops" value={card.total_troops_in_battle} />
          <StatBox label="Scale Factor" value={`×${card.scale_factor?.toFixed(1)}`} />
          <StatBox label="Tabletop Size" value={`${card.tabletop_size} pts`} accent />
        </div>

        {/* Attacker breakdown */}
        {(card.attackers ?? []).length > 0 && (
          <div className="panel p-4 space-y-2">
            <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Attacker Breakdown</p>
            {card.attackers.map((a, i) => {
              const origin = mapDef?.territories.find(t => t.territory_id === a.origin_territory_id)?.name ?? a.origin_territory_id;
              return (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border bg-muted/10">
                  <div className="flex items-center gap-2">
                    <PlayerChip players={players} playerId={a.player_id} />
                    <span className="text-muted-foreground">from {origin}</span>
                  </div>
                  <span className="font-mono text-status-danger font-bold">{a.committed_troops} troops</span>
                </div>
              );
            })}
            {card.defender_player_id && (
              <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border bg-muted/10">
                <div className="flex items-center gap-2">
                  <PlayerChip players={players} playerId={card.defender_player_id} />
                  <span className="text-muted-foreground">defending {targetName}</span>
                </div>
                <span className="font-mono text-status-info font-bold">{card.defender_troops} troops</span>
              </div>
            )}
          </div>
        )}

        {/* Result (if submitted) */}
        {card.result && Object.keys(card.result).length > 0 && (
          <div className="panel p-4 space-y-2">
            <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Submitted Result</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Winner:</span>
              {card.result.winner_player_id
                ? <PlayerChip players={players} playerId={card.result.winner_player_id} />
                : <span className="text-xs text-muted-foreground">Draw</span>
              }
            </div>
            {card.result.surviving_tabletop_troops != null && (
              <p className="text-xs text-muted-foreground">Surviving tabletop troops: <span className="text-foreground font-mono">{card.result.surviving_tabletop_troops}</span></p>
            )}
            {card.result.notes && <p className="text-xs text-muted-foreground">Notes: {card.result.notes}</p>}
          </div>
        )}

        {/* Action button */}
        {canSubmit && (
          <Link
            to={`/campaigns/${campaignId}/battles/${battleId}/result`}
            className="block w-full text-center px-4 py-3 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all"
          >
            Submit Battle Result
          </Link>
        )}
      </div>
    </AppShell>
  );
}