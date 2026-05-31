/**
 * AdminBattleResultEntry — admin form for submitting/forcing battle results.
 * Supports manual entry, auto-resolve, forfeit, and delay actions.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, AlertTriangle, Flag, Clock, Zap, User, TestTube } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AppShell from '@/components/layout/AppShell';
import { PLAYER_COLORS } from '@/config/theme';
import { getMap } from '@/features/maps';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Max tabletop survivors for the selected winner */
function winnerMaxTabletop(card, winnerId) {
  if (!card || !winnerId) return 0;
  const totalTroops  = card.total_troops_in_battle ?? 1;
  const tabletopSize = card.tabletop_size ?? 0;
  const attackerTroops = (card.attackers ?? [])
    .filter(a => a.player_id === winnerId)
    .reduce((s, a) => s + (a.committed_troops ?? 0), 0);
  const defenderTroops = card.defender_player_id === winnerId ? (card.defender_troops ?? 0) : 0;
  const committed = attackerTroops + defenderTroops;
  return totalTroops > 0 ? Math.round((committed / totalTroops) * tabletopSize) : 0;
}

function getPlayerHex(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

export default function AdminBattleResultEntry() {
  const { id: campaignId, battleId } = useParams();
  const navigate = useNavigate();

  const [card, setCard]         = useState(null);
  const [players, setPlayers]   = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);

  const [myPlayer, setMyPlayer] = useState(null);
  const [actingAsId, setActingAsId] = useState(null);
  const [winnerId, setWinnerId]           = useState('');
  const [survivors, setSurvivors]         = useState('');
  const [notes, setNotes]                 = useState('');

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
      setMyPlayer(plrs.find(p => p.user_id === me?.id) ?? null);

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

  // Build participant list (all attackers + defender if applicable)
  const participantIds = [...new Set([
    ...(card?.attackers ?? []).map(a => a.player_id),
    ...(card?.defender_player_id ? [card.defender_player_id] : []),
  ])];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'submitResult',
      campaign_id: campaignId,
      battle_card_id: battleId,
      winner_player_id: winnerId || null,
      surviving_tabletop_troops: survivors !== '' ? Number(survivors) : null,
      notes: notes || null,
    });
    setActionLoading(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setSuccess('Result submitted successfully');
      // Reload card
      const cardsRes = await base44.functions.invoke('battlePhase', {
        action: 'getBattleCards',
        campaign_id: campaignId,
        round: campaign?.current_round ?? 1,
      });
      setCard(cardsRes.data?.battle_cards?.find(c => c.id === battleId) ?? null);
    }
  };

  const handleAutoResolve = async () => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'autoResolve',
      campaign_id: campaignId,
      battle_card_id: battleId,
    });
    setActionLoading(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setSuccess('Battle auto-resolved');
      const cardsRes = await base44.functions.invoke('battlePhase', {
        action: 'getBattleCards',
        campaign_id: campaignId,
        round: campaign?.current_round ?? 1,
      });
      setCard(cardsRes.data?.battle_cards?.find(c => c.id === battleId) ?? null);
    }
  };

  const handleForfeit = async (winnerId) => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'setForfeited',
      campaign_id: campaignId,
      battle_card_id: battleId,
      forfeited: true,
      winner_player_id: winnerId,
    });
    setActionLoading(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setSuccess('Battle marked as forfeited');
      const cardsRes = await base44.functions.invoke('battlePhase', {
        action: 'getBattleCards',
        campaign_id: campaignId,
        round: campaign?.current_round ?? 1,
      });
      setCard(cardsRes.data?.battle_cards?.find(c => c.id === battleId) ?? null);
    }
  };

  const handleDelay = async (delay) => {
    setError(null);
    setSuccess(null);
    setActionLoading(true);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'setDelayed',
      campaign_id: campaignId,
      battle_card_id: battleId,
      delayed: delay,
    });
    setActionLoading(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setSuccess(delay ? 'Battle delayed' : 'Battle resumed');
      const cardsRes = await base44.functions.invoke('battlePhase', {
        action: 'getBattleCards',
        campaign_id: campaignId,
        round: campaign?.current_round ?? 1,
      });
      setCard(cardsRes.data?.battle_cards?.find(c => c.id === battleId) ?? null);
    }
  };

  if (loading) {
    return (
      <AppShell title="Admin Result Entry">
        <div className="flex items-center justify-center py-20 text-muted-foreground text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (!card) {
    return (
      <AppShell title="Admin Result Entry">
        <div className="max-w-lg mx-auto p-6">
          <p className="text-muted-foreground text-sm">Battle card not found.</p>
        </div>
      </AppShell>
    );
  }

  const isDelayed = card.status === 'delayed';
  const isForfeited = card.status === 'forfeited';
  const testPlayers = players.filter(p => p.is_test_player);

  const maxTabletop = winnerMaxTabletop(card, winnerId);
  const survivorsNum = survivors !== '' ? Number(survivors) : null;
  const survivorError = survivorsNum !== null && winnerId && survivorsNum > maxTabletop
    ? `Max survivors for this winner: ${maxTabletop} tabletop pts`
    : null;

  return (
    <AppShell title="Admin Battle Control">
      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Back + Perspective */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(`/campaigns/${campaignId}/battles/${battleId}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Battle Card
          </button>
          {testPlayers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-status-pending/10 border border-status-pending/40 px-2 py-1 rounded">
              <TestTube className="w-3.5 h-3.5 text-status-pending shrink-0" />
              <span className="text-[10px] text-status-pending uppercase tracking-wider hidden sm:inline">Perspective</span>
              <Select value={actingAsId ?? 'self'} onValueChange={v => setActingAsId(v === 'self' ? null : v)}>
                <SelectTrigger className="h-7 text-xs w-32 sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self"><span className="flex items-center gap-1.5"><User className="w-3 h-3" /> My Player</span></SelectItem>
                  {testPlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-1.5"><TestTube className="w-3 h-3 text-status-pending" /> {p.display_name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="panel p-4 space-y-2">
          <p className="font-display text-lg font-semibold text-foreground">{targetName}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>BOP Troops: <span className="font-mono text-foreground">{card.total_troops_in_battle ?? 0}</span></span>
            <span>Tabletop: <span className="font-mono text-primary">{card.tabletop_size ?? 0} pts</span></span>
          </div>
          <p className="text-xs text-muted-foreground">
            Status: <span className={`font-medium ${isDelayed ? 'text-warning' : isForfeited ? 'text-destructive' : 'text-foreground'}`}>
              {card.status}
            </span>
          </p>
          {card.is_mutual && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Bloodbath</p>}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleDelay(!isDelayed)}
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-border bg-muted/20 text-xs font-display tracking-widest uppercase hover:bg-muted/30 transition-all disabled:opacity-40"
          >
            <Clock className="w-3.5 h-3.5" />
            {isDelayed ? 'Resume Battle' : 'Delay Battle'}
          </button>
          
          <button
            onClick={handleAutoResolve}
            disabled={actionLoading || ['resolved', 'auto_resolved', 'forfeited'].includes(card.status)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-warning text-warning text-xs font-display tracking-widest uppercase hover:bg-warning/10 transition-all disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5" />
            Auto-Resolve
          </button>
        </div>

        {/* Manual Result Entry */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="panel p-4 space-y-3">
            <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">Manual Result Entry</p>
            
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
                  const playerTabletop = winnerMaxTabletop(card, pid);
                  return (
                    <label key={pid} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${checked ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/10 hover:bg-muted/20'}`}>
                      <input
                        type="radio"
                        name="winner"
                        value={pid}
                        checked={checked}
                        onChange={() => { setWinnerId(pid); setSurvivors(''); }}
                        className="sr-only"
                      />
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: hex }} />
                      <span className="text-sm text-foreground">{p?.display_name ?? '?'}</span>
                      {role && <span className="text-xs text-muted-foreground">({role})</span>}
                      <span className="text-xs text-muted-foreground ml-auto">{playerTabletop} TT pts</span>
                      {checked && <Check className="w-3.5 h-3.5 text-primary" />}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Surviving troops */}
            {winnerId && (
              <div className="space-y-1.5">
                <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                  Surviving Tabletop Troops
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
                <p className="text-xs text-muted-foreground">Max for this winner: <span className="font-mono text-foreground">{maxTabletop}</span> pts</p>
                {survivorError && <p className="text-xs text-destructive">{survivorError}</p>}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={2}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-status-locked">{success}</p>}

          <button
            type="submit"
            disabled={actionLoading || survivors === '' || winnerId === '' || !!survivorError}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Submit Result
          </button>
        </form>

        {/* Forfeit Actions */}
        <div className="panel p-4 space-y-3">
          <p className="font-display text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2">
            <Flag className="w-3.5 h-3.5" />
            Forfeit Handling
          </p>
          <div className="space-y-2">
            {participantIds.map(pid => {
              const p   = players.find(pl => pl.id === pid);
              const hex = getPlayerHex(players, pid);
              return (
                <button
                  key={pid}
                  onClick={() => handleForfeit(pid)}
                  disabled={actionLoading}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded border border-destructive text-destructive text-xs hover:bg-destructive/10 transition-all disabled:opacity-40"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
                  {p?.display_name ?? '?'} wins by forfeit
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}