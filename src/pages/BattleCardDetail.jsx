/**
 * BattleCardDetail — full detail view for a single battle card.
 * Shows: battle type, territory, participants, attacker/defender roles,
 * troop counts, scaling, status, result, approvals, and action buttons.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Swords, Loader2, Check, Flag, AlertTriangle, Clock, Zap, Settings } from 'lucide-react';
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

function PlayerChip({ players, playerId, showRole }) {
  const p   = players?.find(pl => pl.id === playerId);
  const hex = getPlayerHex(players, playerId);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-muted/20 text-xs">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
      {p?.display_name ?? '?'}
      {showRole && <span className="text-muted-foreground/50">({showRole})</span>}
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

function ApprovalRow({ approval, players }) {
  const p = players?.find(pl => pl.id === approval.player_id);
  const hex = getPlayerHex(players, approval.player_id);
  return (
    <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border border-border bg-muted/10">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hex }} />
      <span className="flex-1">{p?.display_name ?? '?'}</span>
      <span className={`font-medium ${approval.approved ? 'text-status-locked' : 'text-destructive'}`}>
        {approval.approved ? 'Approved' : 'Rejected'}
      </span>
      {approval.flagged && <span className="text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Flagged</span>}
      <span className="text-muted-foreground/50">{new Date(approval.at).toLocaleString()}</span>
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
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myVote, setMyVote] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
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
  const participantIds = [...new Set([...attackerIds, ...(card?.defender_player_id ? [card.defender_player_id] : [])])];
  
  const canSubmit   = myPlayer && card &&
    participantIds.includes(myPlayer.id) &&
    ['pending', 'awaiting_result', 'delayed'].includes(card.status);

  const canApprove  = myPlayer && card &&
    participantIds.includes(myPlayer.id) &&
    card.status === 'result_submitted' &&
    card.result?.submitted_by !== myPlayer.id;

  const canVote     = myPlayer && card &&
    participantIds.includes(myPlayer.id) &&
    ['pending', 'awaiting_result'].includes(card.status);

  const isAdmin = myPlayer?.is_admin;

  // Get my existing vote
  useEffect(() => {
    if (card?.delay_votes && myPlayer?.id) {
      setMyVote(card.delay_votes[myPlayer.id] ?? null);
    }
  }, [card?.delay_votes, myPlayer?.id]);

  const handleApprove = async (approved, flagged = false) => {
    setActionLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'approveResult',
      campaign_id: campaignId,
      battle_card_id: battleId,
      approved,
      flagged,
    });
    setActionLoading(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      // Reload card
      const cardsRes = await base44.functions.invoke('battlePhase', {
        action: 'getBattleCards',
        campaign_id: campaignId,
        round: campaign?.current_round ?? 1,
      });
      setCard(cardsRes.data?.battle_cards?.find(c => c.id === battleId) ?? null);
    }
  };

  const handleVoteDelay = async (vote) => {
    setActionLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'voteDelay',
      campaign_id: campaignId,
      battle_card_id: battleId,
      vote,
    });
    setActionLoading(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      setMyVote(vote);
      // Reload card
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
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        {/* Back */}
        <button
          onClick={() => navigate(`/campaigns/${campaignId}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaign
        </button>

        {/* Header */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Swords className="w-4 h-4 text-destructive" />
                <BattleTypeTag type={card.battle_type} />
                <BattleStatusTag status={card.status} />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">{targetName}</p>
              {card.is_mutual && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Bloodbath — Mutual Attack</p>}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Round {card.round}</p>
              {card.resolved_at && <p>Resolved: {new Date(card.resolved_at).toLocaleString()}</p>}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Participants</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground w-16">Attackers</span>
              {card.attackers?.map((a, i) => {
                const origin = mapDef?.territories.find(t => t.territory_id === a.origin_territory_id)?.name ?? a.origin_territory_id;
                return (
                  <div key={i} className="flex items-center gap-1">
                    <PlayerChip players={players} playerId={a.player_id} />
                    <span className="text-xs text-muted-foreground">from {origin}</span>
                    <span className="text-xs font-mono text-status-danger">({a.committed_troops})</span>
                  </div>
                );
              })}
            </div>
            {card.defender_player_id && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Defender</span>
                <PlayerChip players={players} playerId={card.defender_player_id} />
                <span className="text-xs font-mono text-status-info">({card.defender_troops} troops)</span>
              </div>
            )}
          </div>
        </div>

        {/* Scaling stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Total Troops" value={card.total_troops_in_battle} />
          <StatBox label="Scale Factor" value={`×${card.scale_factor?.toFixed(2)}`} />
          <StatBox label="Tabletop Size" value={`${card.tabletop_size} pts`} accent />
        </div>

        {/* Result (if submitted) */}
        {card.result && Object.keys(card.result).length > 0 && (
          <div className="panel p-4 space-y-3">
            <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Battle Result</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Winner:</span>
              {card.result.winner_player_id
                ? <PlayerChip players={players} playerId={card.result.winner_player_id} />
                : <span className="text-xs text-muted-foreground">Draw / No winner</span>
              }
            </div>
            {card.result.surviving_tabletop_troops != null && (
              <p className="text-xs text-muted-foreground">
                Surviving tabletop troops: <span className="text-foreground font-mono">{card.result.surviving_tabletop_troops}</span>
              </p>
            )}
            {card.result.result_source && (
              <p className="text-xs text-muted-foreground">
                Source: <span className={`font-medium ${card.result.result_source === 'manual' ? 'text-status-locked' : 'text-warning'}`}>
                  {card.result.result_source}
                </span>
              </p>
            )}
            {card.result.notes && <p className="text-xs text-muted-foreground">Notes: {card.result.notes}</p>}
            {card.result.submitted_at && (
              <p className="text-xs text-muted-foreground">
                Submitted by: <span className="text-foreground">{new Date(card.result.submitted_at).toLocaleString()}</span>
              </p>
            )}
            {card.result.applied_at && (
              <p className="text-xs text-status-locked flex items-center gap-1">
                <Check className="w-3 h-3" /> Result applied to territories: {new Date(card.result.applied_at).toLocaleString()}
              </p>
            )}

            {/* Approvals */}
            {(card.approvals ?? []).length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border">
                <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Approvals</p>
                {card.approvals.map((a, i) => (
                  <ApprovalRow key={i} approval={a} players={players} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {error && <p className="text-xs text-destructive">{error}</p>}
        
        <div className="space-y-2">
          {/* Primary actions */}
          <div className="flex gap-2">
            {canSubmit && (
              <Link
                to={`/campaigns/${campaignId}/battles/${battleId}/result`}
                className="flex-1 text-center px-4 py-3 rounded bg-primary text-primary-foreground text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all"
              >
                Submit Result
              </Link>
            )}
            
            {canApprove && (
              <>
                <button
                  onClick={() => handleApprove(true)}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded bg-status-locked text-white text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => handleApprove(false, true)}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded border border-warning text-warning text-xs font-display tracking-widest uppercase hover:bg-warning/10 transition-all disabled:opacity-40"
                >
                  <Flag className="w-4 h-4" />
                  Flag
                </button>
              </>
            )}
          </div>

          {/* Delay voting */}
          {canVote && (
            <div className="panel p-3 space-y-2">
              <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Vote to Delay
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleVoteDelay('yes')}
                  disabled={actionLoading || myVote === 'yes'}
                  className={`flex-1 px-3 py-2 rounded text-xs font-display tracking-widest uppercase transition-all ${
                    myVote === 'yes' 
                      ? 'bg-warning/20 text-warning border border-warning' 
                      : 'bg-muted/20 text-muted-foreground border border-border hover:bg-warning/10'
                  } disabled:opacity-40`}
                >
                  Yes ({card.delay_votes ? Object.values(card.delay_votes).filter(v => v === 'yes').length : 0})
                </button>
                <button
                  onClick={() => handleVoteDelay('no')}
                  disabled={actionLoading || myVote === 'no'}
                  className={`flex-1 px-3 py-2 rounded text-xs font-display tracking-widest uppercase transition-all ${
                    myVote === 'no' 
                      ? 'bg-status-locked/20 text-status-locked border border-status-locked' 
                      : 'bg-muted/20 text-muted-foreground border border-border hover:bg-status-locked/10'
                  } disabled:opacity-40`}
                >
                  No ({card.delay_votes ? Object.values(card.delay_votes).filter(v => v === 'no').length : 0})
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Majority required: {Math.ceil(participantIds.length / 2)} of {participantIds.length} participants
              </p>
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && (
            <div className="panel p-3 space-y-2">
              <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <Settings className="w-3 h-3" />
                Admin Controls
              </p>
              <div className="flex gap-2">
                <Link
                  to={`/campaigns/${campaignId}/battles/${battleId}/admin`}
                  className="flex-1 text-center px-3 py-2.5 rounded border border-border bg-muted/20 text-xs font-display tracking-widest uppercase hover:bg-muted/30 transition-all"
                >
                  Manage Battle
                </Link>
                <button
                  onClick={() => handleVoteDelay(card.status === 'delayed' ? 'no' : 'yes')}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-2.5 rounded border border-warning text-warning text-xs font-display tracking-widest uppercase hover:bg-warning/10 transition-all disabled:opacity-40"
                >
                  {card.status === 'delayed' ? 'Resume' : 'Delay'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}