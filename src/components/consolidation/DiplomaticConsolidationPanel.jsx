/**
 * DiplomaticConsolidationPanel — Sprint 5B.7
 *
 * Diplomatic tab content during Consolidation Phase.
 * Shows:
 *   - Objective Hand (all currently held objectives, read-only)
 *   - Active Diplomatic Effects (pacts, broker peace, coalition, merchant convoy, war rations)
 *   - Trade Proposals (create / review incoming / review outgoing)
 *
 * Does NOT show:
 *   - Draw/discard objectives (Planning Phase only)
 *   - Influence action forms (Operations Phase only)
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Feather, ChevronDown, ChevronRight, Star, ShieldCheck, Send, Inbox, Users2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// ── Objective Hand ────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  military:   { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400' },
  economic:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400' },
  diplomatic: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  territorial:{ bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400' },
};

function ObjectiveCard({ cardId, objectiveDef, isCompleted }) {
  const cat = objectiveDef?.region_scope ? 'territorial' : 'diplomatic';
  const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.diplomatic;

  return (
    <div className={`rounded border ${colors.border} ${colors.bg} px-3 py-2.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold ${colors.text} truncate`}>
            {objectiveDef?.title ?? cardId}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
            {objectiveDef?.description ?? '—'}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {objectiveDef?.influence_reward > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-purple-400 font-mono">
              <Star className="w-2.5 h-2.5" /> {objectiveDef.influence_reward}
            </span>
          )}
          {isCompleted && (
            <span className="text-[10px] text-green-400">✓ Done</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ObjectiveHandSection({ campaign, actingPlayerId }) {
  const [expanded, setExpanded] = useState(true);
  const [hand, setHand] = useState([]);
  const [defs, setDefs] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const ledger = await base44.entities.PlayerInfluenceLedger.filter({
        campaign_id: campaign.id,
        player_id: actingPlayerId,
      });
      const cards = ledger[0]?.objective_cards_json ?? {};
      const held = cards.held ?? [];
      const completed = (cards.completed ?? []).map(c => c.card_id ?? c);

      // Load card definitions
      if (held.length > 0) {
        const cardDefs = await base44.entities.SecretObjectiveCard.filter({});
        const defsMap = {};
        cardDefs.forEach(d => { defsMap[d.card_id] = d; });
        setDefs(defsMap);
      }
      setHand(held.map(id => ({ id, completed: completed.includes(id) })));
    } catch { setHand([]); }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { if (expanded) load(); }, [expanded, load]);

  return (
    <div className="rounded border border-purple-500/30 bg-purple-500/5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-display text-xs tracking-wider uppercase font-semibold text-purple-400 flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5" /> Objective Hand ({hand.length})
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          ) : hand.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No objectives in hand.</p>
          ) : (
            hand.map(({ id, completed }) => (
              <ObjectiveCard key={id} cardId={id} objectiveDef={defs[id]} isCompleted={completed} />
            ))
          )}
          <p className="text-[10px] text-muted-foreground italic">Draw and discard objectives during Planning Phase.</p>
        </div>
      )}
    </div>
  );
}

// ── Active Diplomatic Effects ─────────────────────────────────────────────────

const ACTION_LABELS = {
  war_rations:         { label: 'War Rations',         icon: '⚔️',  color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/5' },
  influence_network:   { label: 'Influence Network',   icon: '🕸️', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/5' },
  merchant_convoy:     { label: 'Merchant Convoy',     icon: '🚢',  color: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/5' },
  non_aggression_pact: { label: 'Non-Aggression Pact', icon: '🤝',  color: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/5' },
  broker_peace:        { label: 'Broker Peace',        icon: '🕊️', color: 'text-cyan-400',   border: 'border-cyan-500/30',   bg: 'bg-cyan-500/5' },
  coalition_warfare:   { label: 'Coalition Warfare',   icon: '⚔️',  color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/5' },
  power_broker:        { label: 'Power Broker',        icon: '👑',  color: 'text-primary',    border: 'border-primary/30',    bg: 'bg-primary/5' },
};

function ActiveEffectsSection({ campaign, actingPlayerId, players }) {
  const [expanded, setExpanded] = useState(true);
  const [effects, setEffects] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const data = await base44.entities.DiplomaticAction.filter({
        campaign_id: campaign.id,
        player_id: actingPlayerId,
        status: 'active',
      });
      setEffects(data ?? []);
    } catch { setEffects([]); }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { if (expanded) load(); }, [expanded, load]);

  const getPlayerName = (id) => players?.find(p => p.id === id)?.display_name ?? id;

  return (
    <div className="rounded border border-cyan-500/30 bg-cyan-500/5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-display text-xs tracking-wider uppercase font-semibold text-cyan-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Active Effects ({effects.length})
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          ) : effects.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active diplomatic effects.</p>
          ) : (
            effects.map(e => {
              const cfg = ACTION_LABELS[e.action_type] ?? { label: e.action_type, icon: '🎯', color: 'text-foreground', border: 'border-border', bg: 'bg-muted/10' };
              return (
                <div key={e.id} className={`rounded border ${cfg.border} ${cfg.bg} px-3 py-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{cfg.icon}</span>
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    {e.expires_round && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        Expires R{e.expires_round}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                    {e.target_player_id && <span>→ {getPlayerName(e.target_player_id)}</span>}
                    {e.target_player_b_id && <span>& {getPlayerName(e.target_player_b_id)}</span>}
                    {e.region_id && <span>Region: {e.region_id.replace(/_/g, ' ')}</span>}
                    {e.influence_spent > 0 && <span>Cost: {e.influence_spent} inf</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Trade Proposals ───────────────────────────────────────────────────────────

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };

function TradeProposalsSection({ campaign, actingPlayerId, players }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState('outgoing'); // 'create' | 'incoming' | 'outgoing'
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [targetPlayer, setTargetPlayer] = useState('');
  const [offer, setOffer] = useState({});
  const [request, setRequest] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  const resourceTypes = ['gold', 'iron', 'timber', 'stone', 'food'];

  const loadProposals = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const [sent, received] = await Promise.all([
        base44.entities.DiplomaticAction.filter({
          campaign_id: campaign.id,
          player_id: actingPlayerId,
          action_type: 'trade_proposal',
        }).catch(() => []),
        base44.entities.DiplomaticAction.filter({
          campaign_id: campaign.id,
          target_player_id: actingPlayerId,
          action_type: 'trade_proposal',
        }).catch(() => []),
      ]);
      setOutgoing(sent ?? []);
      setIncoming(received ?? []);
    } catch { }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { if (expanded) loadProposals(); }, [expanded, loadProposals]);

  const handleCreate = async () => {
    if (!targetPlayer) { setCreateError('Select a target player.'); return; }
    setSubmitting(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      await base44.entities.DiplomaticAction.create({
        campaign_id: campaign.id,
        round: campaign.current_round ?? 1,
        player_id: actingPlayerId,
        action_type: 'trade_proposal',
        region_id: 'trade',
        status: 'pending',
        target_player_id: targetPlayer,
        effect_metadata: { offer, request },
      });
      setCreateSuccess('Trade proposal sent.');
      setTargetPlayer(''); setOffer({}); setRequest({});
      setActiveSection('outgoing');
      loadProposals();
    } catch (e) {
      setCreateError(e?.response?.data?.error ?? 'Failed to create proposal.');
    } finally { setSubmitting(false); }
  };

  const getPlayerName = (id) => players?.find(p => p.id === id)?.display_name ?? id;
  const otherPlayers = (players ?? []).filter(p => p.id !== actingPlayerId && !p.is_eliminated);

  const renderResourceEditor = (label, state, setState) => (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground">{label}:</p>
      <div className="grid grid-cols-3 gap-1">
        {resourceTypes.map(r => (
          <div key={r} className="flex items-center gap-1">
            <span className="text-[10px]">{RESOURCE_ICONS[r]}</span>
            <input
              type="number" min={0} max={99}
              value={state[r] ?? 0}
              onChange={e => setState(prev => ({ ...prev, [r]: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground"
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderProposal = (p, isIncoming) => {
    const meta = p.effect_metadata ?? {};
    const offerData = meta.offer ?? {};
    const requestData = meta.request ?? {};
    const fromName = isIncoming ? getPlayerName(p.player_id) : getPlayerName(p.target_player_id);
    const statusColors = { pending: 'text-amber-400', active: 'text-green-400', expired: 'text-muted-foreground', cancelled: 'text-destructive' };

    return (
      <div key={p.id} className="rounded border border-border bg-muted/10 px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{isIncoming ? `From: ${fromName}` : `To: ${fromName}`}</span>
          <span className={`text-[10px] capitalize ${statusColors[p.status] ?? 'text-muted-foreground'}`}>{p.status}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <p className="text-muted-foreground mb-0.5">{isIncoming ? 'They offer:' : 'You offer:'}</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(offerData).filter(([,v]) => v > 0).map(([r, v]) => (
                <span key={r}>{RESOURCE_ICONS[r]}{v}</span>
              ))}
              {Object.values(offerData).every(v => !v) && <span className="text-muted-foreground italic">nothing</span>}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">{isIncoming ? 'They want:' : 'You want:'}</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(requestData).filter(([,v]) => v > 0).map(([r, v]) => (
                <span key={r}>{RESOURCE_ICONS[r]}{v}</span>
              ))}
              {Object.values(requestData).every(v => !v) && <span className="text-muted-foreground italic">nothing</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded border border-border bg-muted/5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-display text-xs tracking-wider uppercase font-semibold text-foreground flex items-center gap-1.5">
          <Users2 className="w-3.5 h-3.5 text-muted-foreground" /> Trade Proposals
          {(incoming.length > 0 || outgoing.length > 0) && (
            <span className="text-[10px] text-muted-foreground">({incoming.length} in / {outgoing.length} out)</span>
          )}
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Sub-tabs */}
          <div className="flex gap-1">
            {[
              { id: 'outgoing', icon: Send,  label: 'Outgoing' },
              { id: 'incoming', icon: Inbox, label: 'Incoming' },
              { id: 'create',   icon: Users2, label: 'Create' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-display tracking-wider uppercase transition-colors ${
                  activeSection === id ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>

          {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>}

          {activeSection === 'outgoing' && !loading && (
            outgoing.length === 0
              ? <p className="text-xs text-muted-foreground italic">No outgoing proposals.</p>
              : <div className="space-y-2">{outgoing.map(p => renderProposal(p, false))}</div>
          )}

          {activeSection === 'incoming' && !loading && (
            incoming.length === 0
              ? <p className="text-xs text-muted-foreground italic">No incoming proposals.</p>
              : <div className="space-y-2">{incoming.map(p => renderProposal(p, true))}</div>
          )}

          {activeSection === 'create' && (
            <div className="space-y-3">
              {createError && <p className="text-[10px] text-destructive">{createError}</p>}
              {createSuccess && <p className="text-[10px] text-green-400">{createSuccess}</p>}

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Send proposal to:</label>
                <select
                  value={targetPlayer}
                  onChange={e => setTargetPlayer(e.target.value)}
                  className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
                >
                  <option value="">— select player —</option>
                  {otherPlayers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
              </div>

              {renderResourceEditor('You offer', offer, setOffer)}
              {renderResourceEditor('You want', request, setRequest)}

              <p className="text-[10px] text-muted-foreground italic">
                Note: Resource transfer resolution requires admin approval. This sprint adds proposal visibility only.
              </p>

              <button
                onClick={handleCreate}
                disabled={submitting || !targetPlayer}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-primary/40 bg-primary/10 text-primary text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Proposal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function DiplomaticConsolidationPanel({ campaign, myPlayer, actingAsPlayerId, players, mapDef, stateById }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Feather className="w-3.5 h-3.5 text-purple-400" />
        <p className="font-display text-xs tracking-widest uppercase text-purple-400">Diplomatic</p>
      </div>

      <ObjectiveHandSection campaign={campaign} actingPlayerId={actingPlayerId} />
      <ActiveEffectsSection campaign={campaign} actingPlayerId={actingPlayerId} players={players} />
      <TradeProposalsSection campaign={campaign} actingPlayerId={actingPlayerId} players={players} />

    </div>
  );
}