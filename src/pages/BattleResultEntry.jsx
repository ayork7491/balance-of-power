/**
 * BattleResultEntry — form for submitting a tabletop battle result.
 * Admin-only.
 * Handles:
 *   - Standard (siege, bloodbath, skirmish): winner + winner survivors
 *   - capture_objectives: winner + winner survivors + per-loser survivor inputs
 *   - double_siege: defender held/lost + appropriate survivor inputs
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

function playerTabletopCommitted(card, pid) {
  if (!card) return 0;
  const totalTroops  = card.total_troops_in_battle ?? 1;
  const tabletopSize = card.tabletop_size ?? 0;
  const atkTroops = (card.attackers ?? []).filter(a => a.player_id === pid).reduce((s, a) => s + (a.committed_troops ?? 0), 0);
  const defTroops = card.defender_player_id === pid ? (card.defender_troops ?? 0) : 0;
  const committed = atkTroops + defTroops;
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

  // Standard fields
  const [winnerId, setWinnerId]   = useState('');
  const [survivors, setSurvivors] = useState('');
  const [notes, setNotes]         = useState('');

  // capture_objectives: loser survivor inputs { player_id -> string }
  const [loserSurvivors, setLoserSurvivors] = useState({});

  // double_siege
  const [defenderHeld, setDefenderHeld]     = useState(null); // null | true | false
  const [defenderSurvivors, setDefenderSurvivors] = useState('');
  const [attackerSurvivors, setAttackerSurvivors] = useState({}); // { player_id -> string }

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
      let found = cards.find(c => c.id === battleId) ?? null;
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

  const mapDef     = getMap(campaign?.map_id ?? 'map_v1_standard');
  const targetName = mapDef?.territories.find(t => t.territory_id === card?.target_territory_id)?.name
    ?? card?.target_territory_id ?? '—';

  const isDoubleSiege      = card?.battle_type === 'double_siege';
  const isCaptureObjectives = card?.battle_type === 'capture_objectives';

  const participantIds = [...new Set([
    ...(card?.attackers ?? []).map(a => a.player_id),
    ...(card?.defender_player_id ? [card.defender_player_id] : []),
  ])];

  // Unique attacker player IDs
  const attackerPlayerIds = [...new Set((card?.attackers ?? []).map(a => a.player_id))];

  // Validation
  const maxTabletop    = playerTabletopCommitted(card, winnerId);
  const survivorsNum   = survivors !== '' ? Number(survivors) : null;
  const survivorError  = survivorsNum !== null && winnerId && survivorsNum > maxTabletop
    ? `Max survivors for this winner: ${maxTabletop} tabletop pts` : null;

  function validateLoserSurvivors() {
    if (!isCaptureObjectives || !winnerId) return null;
    for (const atk of (card?.attackers ?? [])) {
      if (atk.player_id === winnerId) continue;
      const val = loserSurvivors[atk.player_id];
      const num = val !== undefined && val !== '' ? Number(val) : null;
      const maxTT = playerTabletopCommitted(card, atk.player_id);
      if (num !== null && num > maxTT) {
        const p = players.find(pl => pl.id === atk.player_id);
        return `${p?.display_name ?? atk.player_id} survivors exceed committed troops (max ${maxTT})`;
      }
    }
    return null;
  }

  function validateDoubleSiege() {
    if (!isDoubleSiege) return null;
    if (defenderHeld === null) return 'Select whether defender held or lost';
    if (defenderHeld) {
      if (defenderSurvivors === '') return 'Enter defender surviving troops';
      const maxDef = playerTabletopCommitted(card, card.defender_player_id);
      if (Number(defenderSurvivors) > maxDef) return `Defender survivors exceed committed troops (max ${maxDef})`;
    } else {
      for (const pid of attackerPlayerIds) {
        const val = attackerSurvivors[pid];
        if (val === undefined || val === '') return 'Enter surviving troops for each attacker';
        const maxAtk = playerTabletopCommitted(card, pid);
        if (Number(val) > maxAtk) {
          const p = players.find(pl => pl.id === pid);
          return `${p?.display_name ?? pid} survivors exceed committed troops (max ${maxAtk})`;
        }
      }
    }
    return null;
  }

  const loserError       = validateLoserSurvivors();
  const doubleSiegeError = validateDoubleSiege();

  const canSubmit = !submitting && !survivorError && !loserError && !doubleSiegeError && (
    isDoubleSiege
      ? defenderHeld !== null
      : (winnerId !== '' && survivors !== '')
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);

    let payload;

    if (isDoubleSiege) {
      payload = {
        action: 'submitResult',
        campaign_id: campaignId,
        battle_card_id: battleId,
        notes: notes || null,
        double_siege_result: {
          defender_held: defenderHeld,
          defender_surviving_tabletop: defenderHeld ? Number(defenderSurvivors) : 0,
          attacker_survivors: attackerPlayerIds.map(pid => ({
            player_id: pid,
            tabletop_survivors: defenderHeld ? 0 : Number(attackerSurvivors[pid] ?? 0),
          })),
        },
      };
    } else if (isCaptureObjectives) {
      const loserTT = {};
      for (const atk of (card?.attackers ?? [])) {
        if (atk.player_id === winnerId) continue;
        const val = loserSurvivors[atk.player_id];
        loserTT[atk.player_id] = val !== undefined && val !== '' ? Number(val) : 0;
      }
      payload = {
        action: 'submitResult',
        campaign_id: campaignId,
        battle_card_id: battleId,
        winner_player_id: winnerId || null,
        surviving_tabletop_troops: survivorsNum,
        loser_tabletop_survivors: loserTT,
        notes: notes || null,
      };
    } else {
      payload = {
        action: 'submitResult',
        campaign_id: campaignId,
        battle_card_id: battleId,
        winner_player_id: winnerId || null,
        surviving_tabletop_troops: survivorsNum,
        notes: notes || null,
      };
    }

    const res = await base44.functions.invoke('battlePhase', payload);
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
          {isDoubleSiege && <p className="text-xs text-status-info mt-1">Double Siege — 2 attackers vs 1 defender</p>}
          {isCaptureObjectives && <p className="text-xs text-status-info mt-1">Capture Objectives — Multiple attackers, no defender</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── DOUBLE SIEGE UI ── */}
          {isDoubleSiege && (
            <div className="space-y-4">
              {/* Defender held or lost */}
              <div className="space-y-1.5">
                <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Did Defender Hold?</label>
                <div className="flex gap-2">
                  {[true, false].map(held => (
                    <button
                      key={String(held)}
                      type="button"
                      onClick={() => { setDefenderHeld(held); setDefenderSurvivors(''); setAttackerSurvivors({}); }}
                      className={`flex-1 px-3 py-2.5 rounded border text-xs font-display tracking-widest uppercase transition-all ${
                        defenderHeld === held
                          ? held ? 'border-status-locked bg-status-locked/20 text-status-locked' : 'border-destructive bg-destructive/20 text-destructive'
                          : 'border-border bg-muted/10 hover:bg-muted/20 text-foreground'
                      }`}
                    >
                      {held ? 'Defender Held' : 'Defender Lost'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Defender held: defender survivors */}
              {defenderHeld === true && (
                <div className="space-y-1.5">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                    Defender Surviving Tabletop Troops
                  </label>
                  {(() => {
                    const defId = card.defender_player_id;
                    const p = players.find(pl => pl.id === defId);
                    const hex = getPlayerHex(players, defId);
                    const maxDef = playerTabletopCommitted(card, defId);
                    return (
                      <div className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-muted/10">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                        <span className="text-sm text-foreground flex-1">{p?.display_name ?? '?'} (defender)</span>
                        <input
                          type="number" min="0" max={maxDef}
                          value={defenderSurvivors}
                          onChange={e => setDefenderSurvivors(e.target.value)}
                          placeholder={`0–${maxDef}`}
                          className="w-24 bg-input border border-border rounded px-2 py-1 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">/ {maxDef} TT</span>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">Both attackers lose all committed troops.</p>
                </div>
              )}

              {/* Defender lost: per-attacker survivors */}
              {defenderHeld === false && (
                <div className="space-y-1.5">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                    Attacker Surviving Tabletop Troops
                  </label>
                  {attackerPlayerIds.map(pid => {
                    const p = players.find(pl => pl.id === pid);
                    const hex = getPlayerHex(players, pid);
                    const maxAtk = playerTabletopCommitted(card, pid);
                    return (
                      <div key={pid} className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-muted/10">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                        <span className="text-sm text-foreground flex-1">{p?.display_name ?? '?'}</span>
                        <input
                          type="number" min="0" max={maxAtk}
                          value={attackerSurvivors[pid] ?? ''}
                          onChange={e => setAttackerSurvivors(prev => ({ ...prev, [pid]: e.target.value }))}
                          placeholder={`0–${maxAtk}`}
                          className="w-24 bg-input border border-border rounded px-2 py-1 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">/ {maxAtk} TT</span>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">Territory becomes unclaimed. Attacker survivors return to their origin territories.</p>
                </div>
              )}
            </div>
          )}

          {/* ── STANDARD + CAPTURE OBJECTIVES: Winner selection ── */}
          {!isDoubleSiege && (
            <>
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
                    const playerTabletop = playerTabletopCommitted(card, pid);
                    return (
                      <label key={pid} className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${checked ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/10 hover:bg-muted/20'}`}>
                        <input type="radio" name="winner" value={pid} checked={checked} onChange={() => { setWinnerId(pid); setSurvivors(''); setLoserSurvivors({}); }} className="sr-only" />
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: hex }} />
                        <span className="text-sm text-foreground">{p?.display_name ?? '?'}</span>
                        {role && <span className="text-xs text-muted-foreground">({role})</span>}
                        <span className="text-xs text-muted-foreground ml-auto">{playerTabletop} TT pts committed</span>
                        {checked && <Check className="w-3.5 h-3.5 text-primary" />}
                      </label>
                    );
                  })}
                  <label className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${winnerId === '' ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/10 hover:bg-muted/20'}`}>
                    <input type="radio" name="winner" value="" checked={winnerId === ''} onChange={() => { setWinnerId(''); setSurvivors(''); setLoserSurvivors({}); }} className="sr-only" />
                    <span className="text-sm text-muted-foreground">Draw / No winner</span>
                    {winnerId === '' && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                  </label>
                </div>
              </div>

              {/* Winner survivors */}
              {winnerId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                    Winner Surviving Tabletop Troops
                  </label>
                  <input
                    type="number" min="0" max={maxTabletop} value={survivors}
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

              {/* Capture Objectives: loser survivor inputs */}
              {isCaptureObjectives && winnerId && (
                <div className="space-y-2">
                  <label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                    Loser Surviving Tabletop Troops
                  </label>
                  <p className="text-xs text-muted-foreground">Enter survivors for each losing attacker. Survivors return to their origin territory.</p>
                  {(card.attackers ?? []).filter(a => a.player_id !== winnerId).map(atk => {
                    const p = players.find(pl => pl.id === atk.player_id);
                    const hex = getPlayerHex(players, atk.player_id);
                    const maxTT = playerTabletopCommitted(card, atk.player_id);
                    const val = loserSurvivors[atk.player_id] ?? '';
                    const valNum = val !== '' ? Number(val) : null;
                    const err = valNum !== null && valNum > maxTT ? `Max ${maxTT}` : null;
                    return (
                      <div key={atk.player_id} className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-muted/10">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                        <span className="text-sm text-foreground flex-1">{p?.display_name ?? '?'}</span>
                        <input
                          type="number" min="0" max={maxTT}
                          value={val}
                          onChange={e => setLoserSurvivors(prev => ({ ...prev, [atk.player_id]: e.target.value }))}
                          placeholder={`0–${maxTT}`}
                          className="w-24 bg-input border border-border rounded px-2 py-1 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">/ {maxTT} TT</span>
                        {err && <span className="text-xs text-destructive">{err}</span>}
                      </div>
                    );
                  })}
                  {loserError && <p className="text-xs text-destructive">{loserError}</p>}
                </div>
              )}
            </>
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
          {doubleSiegeError && <p className="text-xs text-destructive">{doubleSiegeError}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
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