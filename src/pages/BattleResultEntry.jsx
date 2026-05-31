/**
 * BattleResultEntry — form for submitting a tabletop battle result.
 * Admin-only. Validates surviving_tabletop_troops ≤ winner's committed tabletop troops.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AppShell from '@/components/layout/AppShell';
import { PLAYER_COLORS } from '@/config/theme';
import { getMap } from '@/features/maps';

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

/** Max tabletop survivors for the selected winner */
function winnerMaxTabletop(card, winnerId) {
  if (!card || !winnerId) return 0;
  const totalTroops  = card.total_troops_in_battle ?? 1;
  const tabletopSize = card.tabletop_size ?? 0;
  // Sum winner's committed troops
  const attackerTroops = (card.attackers ?? [])
    .filter(a => a.player_id === winnerId)
    .reduce((s, a) => s + (a.committed_troops ?? 0), 0);
  const defenderTroops = card.defender_player_id === winnerId ? (card.defender_troops ?? 0) : 0;
  const committed = attackerTroops + defenderTroops;
  return totalTroops > 0 ? Math.round((committed / totalTroops) * tabletopSize) : 0;
}

export default function BattleResultEntry() {
  const { id: campaignId, battleId } = useParams();
  const navigate = useNavigate();

  const [card, setCard]         = useState(null);
  const [players, setPlayers]   = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState(null);

  const [winnerId, setWinnerId]     = useState('');
  const [survivors, setSurvivors]   = useState('');
  const [notes, setNotes]           = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [camps, plrs] = await Promise.all([
        base44.entities.Campaign.filter({ id: campaignId }),
        base44.entities.CampaignPlayer.filter({ campaign_id: campaignId }),
      ]);
      const camp = camps[0] ?? null;
      setCampaign(camp);
      setPlayers(plrs);

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

  const participantIds = [...new Set([
    ...(card?.attackers ?? []).map(a => a.player_id),
    ...(card?.defender_player_id ? [card.defender_player_id] : []),
  ])];

  const maxTabletop  = winnerMaxTabletop(card, winnerId);
  const survivorsNum = survivors !== '' ? Number(survivors) : null;
  const survivorError = survivorsNum !== null && winnerId && survivorsNum > maxTabletop
    ? `Max survivors for this winner: ${maxTabletop} tabletop pts`
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (survivorError) { setError(survivorError); return; }
    setSubmitting(true);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'submitResult',
      campaign_id: campaignId,
      battle_card_id: battleId,
      winner_player_id: winnerId || null,
      surviving_tabletop_troops: survivorsNum,
      notes: notes || null,
    });
    setSubmitting(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      navigate(`/campaigns/${campaignId}/battles/${battleId}`);
    }
  };

  if (loading) {
    return (
      <AppShell title="Submit Result">
        <div className="flex items-center justify-center py-20 text-muted-foreground text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (!card) {
    return (
      <AppShell title="Submit Result">
        <div className="max-w-lg mx-auto p-6">
          <p className="text-muted-foreground text-sm">Battle card not found.</p>
        </div>
      </AppShell>
    );
  }

  const totalTroops  = card.total_troops_in_battle ?? 0;
  const tabletopSize = card.tabletop_size ?? 0;

  return (
    <AppShell title="Submit Battle Result">
      <div className="max-w-lg mx-auto p-4 space-y-5">
        <button
          onClick={() => navigate(`/campaigns/${campaignId}/battles/${battleId}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Battle Card
        </button>

        <div className="panel p-4 space-y-1">
          <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">Reporting result for</p>
          <p className="font-display text-lg font-semibold text-foreground">{targetName}</p>
          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
            <span>BOP Troops: <span className="font-mono text-foreground">{totalTroops}</span></span>
            <span>Tabletop Size: <span className="font-mono text-primary">{tabletopSize} pts</span></span>
          </div>
          {card.is_mutual && <p className="text-xs text-warning mt-1">Bloodbath — Mutual attack</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Winner selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Winner</label>
            <div className="space-y-1.5">
              {participantIds.map(pid => {
                const p   = players.find(pl => pl.id === pid);
                const hex = getPlayerHex(players, pid);
                const checked = winnerId === pid;
                const isAttacker = (card.attackers ?? []).some(a => a.player_id === pid);
                const isDefender = card.defender_player_id === pid;
                const role = isAttacker && isDefender ? 'both' : isAttacker ? 'attacker' : isDefender ? 'defender' : '';
                // Show this player's tabletop committed troops
                const playerTabletop = winnerMaxTabletop(card, pid);
                return (
                  <label key={pid} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${checked ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/10 hover:bg-muted/20'}`}>
                    <input type="radio" name="winner" value={pid} checked={checked} onChange={() => { setWinnerId(pid); setSurvivors(''); }} className="sr-only" />
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: hex }} />
                    <span className="text-sm text-foreground">{p?.display_name ?? '?'}</span>
                    {role && <span className="text-xs text-muted-foreground">({role})</span>}
                    <span className="text-xs text-muted-foreground ml-auto">{playerTabletop} TT pts committed</span>
                    {checked && <Check className="w-3.5 h-3.5 text-primary" />}
                  </label>
                );
              })}
              <label className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${winnerId === '' ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/10 hover:bg-muted/20'}`}>
                <input type="radio" name="winner" value="" checked={winnerId === ''} onChange={() => { setWinnerId(''); setSurvivors(''); }} className="sr-only" />
                <span className="text-sm text-muted-foreground">Draw / No winner</span>
                {winnerId === '' && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
              </label>
            </div>
          </div>

          {/* Surviving troops — tabletop scale */}
          {winnerId && (
            <div className="space-y-1.5">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                Surviving Tabletop Troops (winner's remaining)
              </label>
              <input
                type="number"
                min="0"
                max={maxTabletop}
                value={survivors}
                onChange={e => setSurvivors(e.target.value)}
                placeholder={`0 – ${maxTabletop}`}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Enter tabletop pts remaining (max <span className="font-mono text-foreground">{maxTabletop}</span>). BOP will convert automatically.
              </p>
              {survivorError && <p className="text-xs text-destructive">{survivorError}</p>}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Scenario, special rules, narrative…"
              rows={3}
              className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting || survivors === '' || !!survivorError}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Submit Result
          </button>
        </form>
      </div>
    </AppShell>
  );
}