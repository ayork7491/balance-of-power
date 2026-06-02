/**
 * BattleCardDetail — full detail view for a single battle card.
 * Shows: battle type, territory, participants, attacker/defender roles,
 * troop counts (BOP + Tabletop), scaling, status, result, approvals, and action buttons.
 * Includes Perspective Selector for admin test mode.
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Swords, Loader2, Check, Flag, AlertTriangle, Clock, Settings, User, TestTube } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AppShell from '@/components/layout/AppShell';
import BattleTypeTag from '@/components/phases/battle/BattleTypeTag';
import BattleStatusTag from '@/components/phases/battle/BattleStatusTag';
import BattlePreferencePanel, { PreferenceRecord } from '@/components/phases/battle/BattlePreferencePanel';
import { PLAYER_COLORS } from '@/config/theme';
import { getMap } from '@/features/maps';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function StatBox({ label, value, sub, accent }) {
  return (
    <div className={`px-3 py-2 rounded border text-center ${accent ? 'border-primary/30 bg-primary/10' : 'border-border bg-muted/20'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono font-bold text-lg ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
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

/** Inline perspective selector — works without CampaignTestModeProvider context */
function InlinePerspectiveSelector({ players, myPlayer, actingAsId, onActingAsChange }) {
  const testPlayers = players.filter(p => p.is_test_player);
  if (!myPlayer?.is_admin || testPlayers.length === 0) return null;

  const currentValue = actingAsId ?? 'self';
  return (
    <div className="flex items-center gap-1.5 bg-status-pending/10 border border-status-pending/40 px-2 py-1 rounded">
      <TestTube className="w-3.5 h-3.5 text-status-pending shrink-0" />
      <span className="text-[10px] text-status-pending uppercase tracking-wider hidden sm:inline">Perspective</span>
      <Select value={currentValue} onValueChange={v => onActingAsChange(v === 'self' ? null : v)}>
        <SelectTrigger className="h-7 text-xs w-32 sm:w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="self">
            <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> My Player (Self)</span>
          </SelectItem>
          {testPlayers.map(p => (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-1.5">
                <TestTube className="w-3 h-3 text-status-pending" /> {p.display_name} (Test)
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function BattleCardDetail() {
  const { id: campaignId, battleId } = useParams();
  const navigate = useNavigate();

  const [card, setCard]         = useState(null);
  const [players, setPlayers]   = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [myPlayer, setMyPlayer] = useState(null);
  const [actingAsId, setActingAsId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]       = useState(null);

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
      let found = cards.find(c => c.id === battleId) ?? null;
      // Fallback: if not in current-round results (delayed from prior round not found),
      // search all rounds by fetching with round=1 up to current
      if (!found && camp?.current_round > 1) {
        for (let r = (camp.current_round - 1); r >= 1 && !found; r--) {
          const fallback = await base44.functions.invoke('battlePhase', {
            action: 'getBattleCards',
            campaign_id: campaignId,
            round: r,
          });
          found = (fallback.data?.battle_cards ?? []).find(c => c.id === battleId) ?? null;
        }
      }
      setCard(found);
      setLoading(false);
    }
    load();
  }, [campaignId, battleId]);

  // Effective acting player (for approval/vote actions)
  const effectivePlayer = useMemo(() => {
    if (actingAsId && players.length) {
      return players.find(p => p.id === actingAsId) ?? myPlayer;
    }
    return myPlayer;
  }, [actingAsId, players, myPlayer]);

  const mapDef     = getMap(campaign?.map_id ?? 'map_v1_standard');
  const targetName = mapDef?.territories.find(t => t.territory_id === card?.target_territory_id)?.name
    ?? card?.target_territory_id ?? '—';

  const isAdmin    = myPlayer?.is_admin;
  const attackerIds = [...new Set((card?.attackers ?? []).map(a => a.player_id))];
  const participantIds = [...new Set([...attackerIds, ...(card?.defender_player_id ? [card.defender_player_id] : [])])];

  const canSubmit  = isAdmin && card &&
    ['pending', 'awaiting_result', 'delayed', 'active_carryover', 'pending_approval', 'result_submitted', 'awaiting_approval'].includes(card.status);

  const canApprove = effectivePlayer && card &&
    participantIds.includes(effectivePlayer.id) &&
    ['result_submitted', 'awaiting_approval', 'pending_approval'].includes(card.status) &&
    card.result?.submitted_by !== effectivePlayer.id;

  const canVote    = effectivePlayer && card &&
    participantIds.includes(effectivePlayer.id) &&
    ['pending', 'awaiting_result', 'active_carryover'].includes(card.status);

  // Battle preference — single choice per player
  const myPreference = card?.battle_preferences?.[effectivePlayer?.id ?? ''] ?? 'play_tabletop';
  const votingClosed = card?.voting_closed ?? false;
  const canSetPreference = canVote && !votingClosed;

  // Troop breakdown for display
  const totalTroops   = card?.total_troops_in_battle ?? 0;
  const tabletopSize  = card?.tabletop_size ?? 0;
  const scaleFactor   = card?.scale_factor ?? 1;

  // Per-participant BOP + tabletop committed troops
  const participantTroopInfo = useMemo(() => {
    if (!card) return [];
    return participantIds.map(pid => {
      const isAttacker = (card.attackers ?? []).some(a => a.player_id === pid);
      const isDefender = card.defender_player_id === pid;
      const bopTroops = isAttacker
        ? (card.attackers ?? []).filter(a => a.player_id === pid).reduce((s, a) => s + (a.committed_troops ?? 0), 0)
        : (isDefender ? (card.defender_troops ?? 0) : 0);
      const tabletopTroops = totalTroops > 0 ? Math.round((bopTroops / totalTroops) * tabletopSize) : 0;
      return { pid, bopTroops, tabletopTroops, isAttacker, isDefender };
    });
  }, [card, participantIds, totalTroops, tabletopSize]);

  const reloadCard = async () => {
    // Try current round first, then search prior rounds for delayed cards
    const cardsRes = await base44.functions.invoke('battlePhase', {
      action: 'getBattleCards',
      campaign_id: campaignId,
      round: campaign?.current_round ?? 1,
    });
    let found = cardsRes.data?.battle_cards?.find(c => c.id === battleId) ?? null;
    if (!found && (campaign?.current_round ?? 1) > 1) {
      for (let r = (campaign.current_round - 1); r >= 1 && !found; r--) {
        const fallback = await base44.functions.invoke('battlePhase', {
          action: 'getBattleCards',
          campaign_id: campaignId,
          round: r,
        });
        found = (fallback.data?.battle_cards ?? []).find(c => c.id === battleId) ?? null;
      }
    }
    setCard(found);
  };

  const handleApprove = async (approved, flagged = false) => {
    setActionLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'approveResult',
      campaign_id: campaignId,
      battle_card_id: battleId,
      approved,
      flagged,
      acting_as_player_id: actingAsId ?? null,
    });
    setActionLoading(false);
    if (res.data?.error) { setError(res.data.error); } else { await reloadCard(); }
  };

  const handleAdminDelay = async (delayed) => {
    setActionLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'setDelayed',
      campaign_id: campaignId,
      battle_card_id: battleId,
      delayed,
    });
    setActionLoading(false);
    if (res.data?.error) { setError(res.data.error); } else { await reloadCard(); }
  };

  const handleAdminOverride = async (forceResolve) => {
    setActionLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'adminOverride',
      campaign_id: campaignId,
      battle_card_id: battleId,
      force_resolve: forceResolve,
    });
    setActionLoading(false);
    if (res.data?.error) { setError(res.data.error); } else { await reloadCard(); }
  };

  const handleSetPreference = async (preference) => {
    if (preference === 'forfeit') {
      if (!window.confirm(`Forfeit as ${effectivePlayer?.display_name}? You will lose all committed troops.`)) return;
    }
    setActionLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'setPreference',
      campaign_id: campaignId,
      battle_card_id: battleId,
      preference,
      acting_as_player_id: actingAsId ?? null,
    });
    setActionLoading(false);
    if (res.data?.error) {
      setError(res.data.error);
    } else {
      if (res.data?.battle_preferences) {
        setCard(prev => prev ? {
          ...prev,
          battle_preferences: res.data.battle_preferences,
          status: res.data.status ?? prev.status,
        } : prev);
      }
      await reloadCard();
    }
  };

  const handleCloseVoting = async () => {
    setActionLoading(true);
    setError(null);
    const res = await base44.functions.invoke('battlePhase', {
      action: 'closeBattleVoting',
      campaign_id: campaignId,
      battle_card_id: battleId,
    });
    setActionLoading(false);
    if (res.data?.error) { setError(res.data.error); } else { await reloadCard(); }
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
        {/* Back + Perspective */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(`/campaigns/${campaignId}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaign
          </button>
          <InlinePerspectiveSelector
            players={players}
            myPlayer={myPlayer}
            actingAsId={actingAsId}
            onActingAsChange={setActingAsId}
          />
        </div>

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

          {/* Participants with BOP + Tabletop troop breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Participants</p>
            <div className="space-y-1.5">
              {participantTroopInfo.map(({ pid, bopTroops, tabletopTroops, isAttacker, isDefender }) => {
                const origin = isAttacker
                  ? (mapDef?.territories.find(t => t.territory_id === (card.attackers ?? []).find(a => a.player_id === pid)?.origin_territory_id)?.name
                    ?? (card.attackers ?? []).find(a => a.player_id === pid)?.origin_territory_id)
                  : null;
                const role = isAttacker && isDefender ? 'both' : isAttacker ? 'attacker' : 'defender';
                return (
                  <div key={pid} className="flex items-center gap-2 flex-wrap text-xs bg-muted/10 rounded px-2 py-1.5">
                    <PlayerChip players={players} playerId={pid} showRole={role} />
                    {origin && <span className="text-muted-foreground">from {origin}</span>}
                    <span className="ml-auto flex items-center gap-3 text-xs font-mono">
                      <span title="BOP troops committed" className="text-status-danger">{bopTroops} BOP</span>
                      <span className="text-border">·</span>
                      <span title="Tabletop troops" className="text-primary">{tabletopTroops} TT</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scaling stats — clearly labeled BOP vs Tabletop */}
        <div className="panel p-3 space-y-2">
          <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Battle Scale</p>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="BOP Troops" value={totalTroops} sub="full-scale" />
            <StatBox label="Scale Factor" value={`×${scaleFactor?.toFixed(2)}`} sub="reduction" />
            <StatBox label="Tabletop Size" value={`${tabletopSize} pts`} sub="play this on table" accent />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Enter tabletop survivors when submitting results. BOP converts automatically.
          </p>
        </div>

        {/* Result (if submitted) */}
        {card.result && Object.keys(card.result).length > 0 && (
          <div className="panel p-4 space-y-3">
            <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">Battle Result</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Outcome:</span>
              {card.result.winner_player_id
                ? <PlayerChip players={players} playerId={card.result.winner_player_id} />
                : card.battle_type === 'double_siege' && card.result.double_siege_result?.defender_held === false
                  ? <span className="text-xs text-warning font-medium">Defender Lost — Territory Unclaimed</span>
                  : <span className="text-xs text-muted-foreground">Draw / No winner</span>
              }
            </div>
            {card.result.surviving_tabletop_troops != null && card.result.winner_player_id && (() => {
              const bopSurvivors = Math.round(
                (card.result.surviving_tabletop_troops / Math.max(1, tabletopSize)) * totalTroops
              );
              return (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="px-2 py-1.5 rounded border border-border bg-muted/10">
                    <p className="text-muted-foreground">Tabletop Survivors</p>
                    <p className="font-mono font-bold text-primary">{card.result.surviving_tabletop_troops} pts</p>
                  </div>
                  <div className="px-2 py-1.5 rounded border border-border bg-muted/10">
                    <p className="text-muted-foreground">BOP Survivors</p>
                    <p className="font-mono font-bold text-foreground">{bopSurvivors} troops</p>
                  </div>
                </div>
              );
            })()}
            {card.result.result_source && (
              <p className="text-xs text-muted-foreground">
                Source: <span className={`font-medium ${card.result.result_source === 'manual' ? 'text-status-locked' : 'text-warning'}`}>
                  {card.result.result_source}
                </span>
              </p>
            )}
            {card.result.notes && <p className="text-xs text-muted-foreground">Notes: {card.result.notes}</p>}
            {card.result.applied_at && (
              <p className="text-xs text-status-locked flex items-center gap-1">
                <Check className="w-3 h-3" /> Territories updated: {new Date(card.result.applied_at).toLocaleString()}
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
                  Approve{effectivePlayer && actingAsId ? ` as ${effectivePlayer.display_name}` : ''}
                </button>
                <button
                  onClick={() => handleApprove(false, true)}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded border border-warning text-warning text-xs font-display tracking-widest uppercase hover:bg-warning/10 transition-all disabled:opacity-40"
                >
                  <Flag className="w-4 h-4" />
                  Reject{effectivePlayer && actingAsId ? ` as ${effectivePlayer.display_name}` : ''}
                </button>
              </>
            )}
          </div>

          {/* Battle Preference — single choice per player */}
          {canVote && (
            <BattlePreferencePanel
              card={card}
              players={players}
              participantIds={participantIds}
              effectivePlayer={effectivePlayer}
              actingAsId={actingAsId}
              myPreference={myPreference}
              votingClosed={votingClosed}
              canSetPreference={canSetPreference}
              actionLoading={actionLoading}
              isAdmin={isAdmin}
              onSetPreference={handleSetPreference}
              onCloseVoting={handleCloseVoting}
            />
          )}

          {/* Preference record visible to admin after voting closes */}
          {isAdmin && !canVote && card.battle_preferences && Object.keys(card.battle_preferences).length > 0 && (
            <PreferenceRecord card={card} players={players} participantIds={participantIds} />
          )}

          {/* Admin actions */}
          {isAdmin && (
            <div className="panel p-3 space-y-2">
              <p className="text-xs font-display tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                <Settings className="w-3 h-3" /> Admin Controls
              </p>
              <div className="flex gap-2 flex-wrap">
                <Link
                  to={`/campaigns/${campaignId}/battles/${battleId}/admin`}
                  className="flex-1 text-center px-3 py-2.5 rounded border border-border bg-muted/20 text-xs font-display tracking-widest uppercase hover:bg-muted/30 transition-all"
                >
                  Manage Battle
                </Link>
                <button
                  onClick={() => handleAdminDelay(card.status !== 'delayed')}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-2.5 rounded border border-warning text-warning text-xs font-display tracking-widest uppercase hover:bg-warning/10 transition-all disabled:opacity-40"
                >
                  {card.status === 'delayed' ? 'Resume' : 'Delay'}
                </button>
              </div>
              {/* Override stuck battle */}
              {['awaiting_approval', 'result_submitted'].includes(card.status) && (card.result?.winner_player_id || (card.battle_type === 'double_siege' && card.result?.double_siege_result != null)) && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAdminOverride(false)}
                    disabled={actionLoading}
                    className="flex-1 px-3 py-2 rounded border border-border text-xs text-muted-foreground font-display tracking-wider uppercase hover:text-foreground transition-all disabled:opacity-40"
                  >
                    Clear Flags &amp; Re-Review
                  </button>
                  <button
                    onClick={() => handleAdminOverride(true)}
                    disabled={actionLoading}
                    className="flex-1 px-3 py-2 rounded border border-destructive text-destructive text-xs font-display tracking-widest uppercase hover:bg-destructive/10 transition-all disabled:opacity-40"
                  >
                    Force Resolve
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}