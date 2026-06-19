/**
 * DiplomaticConsolidationPanel — Sprint 5B.9
 *
 * Sections:
 *   1. Trade Proposals (top, not collapsible) — territory-stored resources, hidden-info safe
 *   2. Objective Hand (collapsible)
 *   3. Active Effects (collapsible)
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Feather, ChevronDown, ChevronRight, Star, ShieldCheck,
  Send, Inbox, Plus, Check, X as XIcon, AlertTriangle, Users2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TradeOfferBuilder from './trade/TradeOfferBuilder';
import TradeRequestBuilder from './trade/TradeRequestBuilder';
import TradeAcceptForm from './trade/TradeAcceptForm';
import IntelligencePanel from '@/components/intelligence/IntelligencePanel';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];

function getPlayerName(players, id) {
  return players?.find(p => p.id === id)?.display_name ?? id;
}

// ── Asset Summary (read-only display on a proposal card) ──────────────────────

function AssetSummary({ assets, label }) {
  const resources = assets?.resources ?? {};
  const influence = assets?.influence ?? {};
  const troops    = assets?.troops ?? {};
  const peace     = assets?.peace_treaty ?? {};

  const lines = [];
  Object.entries(resources).filter(([,v]) => v > 0).forEach(([r, v]) => lines.push(
    <span key={r} className="text-foreground">{RESOURCE_ICONS[r]} {v}</span>
  ));
  Object.entries(influence).filter(([, v]) => (typeof v === 'object' ? (v.amount ?? 0) : (v ?? 0)) > 0).forEach(([region, v]) => {
    const amt = typeof v === 'object' ? (v.amount ?? v) : v;
    lines.push(<span key={region} className="text-purple-400">🌐 {region.replace(/_/g,' ')} +{amt}</span>);
  });
  if ((troops.amount ?? 0) > 0) lines.push(<span key="troops" className="text-red-400">⚔ {troops.amount} troops</span>);
  if ((peace.duration ?? 0) > 0) lines.push(<span key="peace" className="text-cyan-400">🕊 Peace {peace.duration}R</span>);

  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      {lines.length === 0
        ? <span className="text-[10px] text-muted-foreground italic">nothing</span>
        : <div className="flex flex-wrap gap-1.5 text-[10px]">{lines}</div>
      }
    </div>
  );
}

// ── Proposal Card ─────────────────────────────────────────────────────────────

function ProposalCard({ proposal, isIncoming, actingPlayerId, players, campaign, stateById, mapDef, onAction }) {
  const meta          = proposal.effect_metadata ?? {};
  const offerAssets   = meta.offer   ?? {};
  const requestAssets = meta.request ?? {};
  const counterpart   = isIncoming ? getPlayerName(players, proposal.player_id) : getPlayerName(players, proposal.target_player_id);
  const isPending     = proposal.status === 'pending';

  const [declining,     setDeclining]     = useState(false);
  const [declineError,  setDeclineError]  = useState(null);
  const [showAcceptForm, setShowAcceptForm] = useState(false);

  const statusColors = { pending: 'text-amber-400', active: 'text-green-400', expired: 'text-muted-foreground', cancelled: 'text-destructive' };

  const handleDecline = async () => {
    setDeclining(true);
    setDeclineError(null);
    try {
      await base44.functions.invoke('diplomaticPhase', {
        action: 'resolveTradeConsolidation',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        proposal_id: proposal.id,
        resolution: 'decline',
      });
      onAction();
    } catch (e) {
      setDeclineError(e?.response?.data?.error ?? 'Failed to decline.');
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="rounded border border-border bg-muted/10 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          {isIncoming ? `From: ${counterpart}` : `To: ${counterpart}`}
          {proposal.round && <span className="text-[10px] text-muted-foreground ml-1">R{proposal.round}</span>}
        </span>
        <span className={`text-[10px] capitalize ${statusColors[proposal.status] ?? 'text-muted-foreground'}`}>{proposal.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AssetSummary assets={offerAssets}   label={isIncoming ? 'They offer:' : 'You offer:'} />
        <AssetSummary assets={requestAssets} label={isIncoming ? 'They want:' : 'You want:'} />
      </div>

      {declineError && <p className="text-[10px] text-destructive">{declineError}</p>}

      {/* Incoming pending: Accept / Decline */}
      {isIncoming && isPending && !showAcceptForm && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => setShowAcceptForm(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 text-[10px] font-display tracking-wider uppercase hover:brightness-110 transition-all"
          >
            <Check className="w-3 h-3" /> Accept
          </button>
          <button
            onClick={handleDecline}
            disabled={declining}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-destructive text-[10px] font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
          >
            {declining ? <Loader2 className="w-3 h-3 animate-spin" /> : <XIcon className="w-3 h-3" />} Decline
          </button>
        </div>
      )}

      {/* Accept form — receiver chooses payment sources */}
      {isIncoming && isPending && showAcceptForm && (
        <TradeAcceptForm
          proposal={proposal}
          campaign={campaign}
          actingPlayerId={actingPlayerId}
          stateById={stateById}
          mapDef={mapDef}
          onAccepted={() => { setShowAcceptForm(false); onAction(); }}
          onCancel={() => setShowAcceptForm(false)}
        />
      )}
    </div>
  );
}

// ── Create Trade Form ─────────────────────────────────────────────────────────

function CreateTradeForm({ campaign, actingPlayerId, players, stateById, mapDef, myInfluence, myTerritoryTroops, onCreated, onCancel }) {
  const [targetPlayer,   setTargetPlayer]   = useState('');
  // Offer — each resource line: { id, resource, source_territory, amount }
  const [offerLines,     setOfferLines]     = useState([]);
  // Influence offer: { region: amount } (number — receiver picks dest region)
  const [offerInfluence, setOfferInfluence] = useState({});
  // Troops offer: { source_territory, amount } (receiver picks dest territory)
  const [offerTroops,    setOfferTroops]    = useState({ source_territory: '', amount: 0 });
  const [offerPeace,     setOfferPeace]     = useState({ duration: 0 });
  // Request — each resource line: { id, resource, amount, dest_territory }
  const [reqLines,       setReqLines]       = useState([]);
  // Troops request: { amount, dest_territory }
  const [reqTroops,      setReqTroops]      = useState({ amount: 0, dest_territory: '' });
  // Influence request: { amount, dest_region }
  const [reqInfluence,   setReqInfluence]   = useState({ amount: 0, dest_region: '' });
  const [reqPeace,       setReqPeace]       = useState({ duration: 0 });

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  const otherPlayers  = (players ?? []).filter(p => p.id !== actingPlayerId && !p.is_eliminated);
  const myTerritories = Object.values(stateById ?? {}).filter(s => s.owner_player_id === actingPlayerId);

  // ── Inline validation — enables/disables submit button ──────────────────
  const offerLinesOk   = offerLines.every(l => !l.source_territory || l.amount > 0);
  const reqLinesOk     = reqLines.every(l => l.amount <= 0 || !!l.dest_territory);
  const reqTroopsOk    = (reqTroops.amount ?? 0) <= 0 || !!reqTroops.dest_territory;
  const reqInfluenceOk = (reqInfluence.amount ?? 0) <= 0 || !!reqInfluence.dest_region;
  const canPropose     = offerLinesOk && reqLinesOk && reqTroopsOk && reqInfluenceOk;

  const handleSubmit = async () => {
    if (!targetPlayer) { setError('Select a target player.'); return; }

    // Build offer resources: { resource: [{ source_territory, amount }] }
    // dest_territory NOT included — receiver chooses at acceptance
    const offerResources = {};
    for (const line of offerLines) {
      if (!line.source_territory || line.amount <= 0) continue;
      const ts = Object.values(stateById ?? {}).find(s => s.territory_id === line.source_territory && s.owner_player_id === actingPlayerId);
      if ((ts?.resource_storage?.[line.resource] ?? 0) < line.amount) { setError(`Not enough ${line.resource} at ${line.source_territory}.`); return; }
      if (!offerResources[line.resource]) offerResources[line.resource] = [];
      offerResources[line.resource].push({ source_territory: line.source_territory, amount: line.amount });
    }

    // Offer influence: { region: amount } — receiver picks dest region
    const offerInfluenceFinal = {};
    for (const [region, amt] of Object.entries(offerInfluence)) {
      if ((amt ?? 0) > 0) offerInfluenceFinal[region] = amt;
    }

    const hasOffer = Object.keys(offerResources).length > 0
      || Object.keys(offerInfluenceFinal).length > 0
      || (offerTroops.source_territory && offerTroops.amount > 0)
      || offerPeace.duration > 0;
    if (!hasOffer) { setError('Add at least one offered asset.'); return; }

    // Build request: { resource: { amount, dest_territory } } — receiver picks source
    const reqResourcesMap = {};
    for (const line of reqLines) {
      if (line.amount > 0) {
        if (!line.dest_territory) { setError(`Choose a delivery territory for requested ${line.resource}.`); return; }
        reqResourcesMap[line.resource] = { amount: line.amount, dest_territory: line.dest_territory };
      }
    }
    if ((reqTroops.amount ?? 0) > 0 && !reqTroops.dest_territory) {
      setError('Choose a delivery territory for requested troops.'); return;
    }
    if ((reqInfluence.amount ?? 0) > 0 && !reqInfluence.dest_region) {
      setError('Choose a destination region for requested influence.'); return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('diplomaticPhase', {
        action: 'proposeTradeConsolidation',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        target_player_id: targetPlayer,
        offer: {
          resources:    offerResources,
          influence:    offerInfluenceFinal,
          // troops: source_territory + amount only; receiver picks dest
          troops:       offerTroops.source_territory && offerTroops.amount > 0 ? { source_territory: offerTroops.source_territory, amount: offerTroops.amount } : null,
          peace_treaty: offerPeace.duration > 0 ? offerPeace : null,
        },
        request: {
          resources:    reqResourcesMap,
          troops:       reqTroops.amount > 0 ? reqTroops : null,
          influence:    reqInfluence.amount > 0 ? reqInfluence : null,
          peace_treaty: reqPeace.duration > 0 ? reqPeace : null,
        },
      });
      onCreated();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to propose trade.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 border border-primary/20 bg-primary/5 rounded p-3">
      <p className="font-display text-[10px] tracking-widest uppercase text-primary">New Trade Proposal</p>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Propose to:</label>
        <select
          value={targetPlayer}
          onChange={e => setTargetPlayer(e.target.value)}
          className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">— select player —</option>
          {otherPlayers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
      </div>

      <TradeOfferBuilder
        stateById={stateById}
        mapDef={mapDef}
        actingPlayerId={actingPlayerId}
        myInfluence={myInfluence}
        myTerritoryTroops={myTerritoryTroops}
        offerLines={offerLines}         setOfferLines={setOfferLines}
        offerInfluence={offerInfluence} setOfferInfluence={setOfferInfluence}
        offerTroops={offerTroops}       setOfferTroops={setOfferTroops}
        offerPeace={offerPeace}         setOfferPeace={setOfferPeace}
      />

      <TradeRequestBuilder
        reqLines={reqLines}             setReqLines={setReqLines}
        reqTroops={reqTroops}           setReqTroops={setReqTroops}
        reqInfluence={reqInfluence}     setReqInfluence={setReqInfluence}
        reqPeace={reqPeace}             setReqPeace={setReqPeace}
        myTerritories={myTerritories}
        mapDef={mapDef}
      />

      {error && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !targetPlayer || !canPropose}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border border-primary/40 bg-primary/10 text-primary text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send Proposal
        </button>
        <button onClick={onCancel} className="px-3 py-2 rounded border border-border text-muted-foreground text-xs hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Trade Proposals Section ───────────────────────────────────────────────────

function TradeProposalsSection({ campaign, actingPlayerId, players, stateById, mapDef }) {
  const [activeTab,  setActiveTab]  = useState('incoming');
  const [outgoing,   setOutgoing]   = useState([]);
  const [incoming,   setIncoming]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [myInfluence,      setMyInfluence]      = useState({});
  const [myTerritoryTroops,setMyTerritoryTroops]= useState({});

  const loadPlayerAssets = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    try {
      const regPools = await base44.entities.RegionalInfluencePool.filter({ campaign_id: campaign.id, player_id: actingPlayerId }).catch(() => []);
      const inf = {};
      regPools.forEach(p => { if (p.spendable_influence > 0) inf[p.region_id] = p.spendable_influence; });
      setMyInfluence(inf);
      const troops = {};
      Object.values(stateById ?? {}).filter(s => s.owner_player_id === actingPlayerId && s.troop_count > 0)
        .forEach(s => { troops[s.territory_id] = s.troop_count; });
      setMyTerritoryTroops(troops);
    } catch { }
  }, [campaign?.id, actingPlayerId, stateById]);

  const loadProposals = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const [sent, received] = await Promise.all([
        base44.entities.DiplomaticAction.filter({ campaign_id: campaign.id, player_id: actingPlayerId, action_type: 'trade_proposal' }).catch(() => []),
        base44.entities.DiplomaticAction.filter({ campaign_id: campaign.id, target_player_id: actingPlayerId, action_type: 'trade_proposal' }).catch(() => []),
      ]);
      setOutgoing(sent ?? []);
      setIncoming(received ?? []);
    } catch { }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { loadProposals(); loadPlayerAssets(); }, [loadProposals, loadPlayerAssets]);

  const pendingIncoming = incoming.filter(p => p.status === 'pending');

  return (
    <div className="rounded border border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-primary/20">
        <span className="font-display text-xs tracking-wider uppercase font-semibold text-primary flex items-center gap-1.5">
          <Users2 className="w-3.5 h-3.5" /> Trade Proposals
          {pendingIncoming.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono">{pendingIncoming.length}</span>
          )}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setShowCreate(v => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-display tracking-wider uppercase transition-colors ${
              showCreate ? 'bg-primary text-primary-foreground' : 'border border-primary/40 text-primary hover:bg-primary/10'
            }`}
          >
            <Plus className="w-3 h-3" /> Propose
          </button>
          <button onClick={() => { loadProposals(); loadPlayerAssets(); }} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-3 py-3 space-y-3">
        {showCreate && (
          <CreateTradeForm
            campaign={campaign}
            actingPlayerId={actingPlayerId}
            players={players}
            stateById={stateById}
            mapDef={mapDef}
            myInfluence={myInfluence}
            myTerritoryTroops={myTerritoryTroops}
            onCreated={() => { setShowCreate(false); loadProposals(); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        <div className="flex gap-1">
          {[
            { id: 'incoming', icon: Inbox, label: `Incoming (${incoming.length})` },
            { id: 'outgoing', icon: Send,  label: `Outgoing (${outgoing.length})` },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-display tracking-wider uppercase transition-colors ${
                activeTab === id ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>

        {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>}

        {activeTab === 'incoming' && !loading && (
          incoming.length === 0
            ? <p className="text-xs text-muted-foreground italic">No incoming proposals.</p>
            : <div className="space-y-2">
                {incoming.map(p => (
                  <ProposalCard key={p.id} proposal={p} isIncoming={true}
                    actingPlayerId={actingPlayerId} players={players}
                    campaign={campaign} stateById={stateById} mapDef={mapDef}
                    onAction={() => { loadProposals(); loadPlayerAssets(); }}
                  />
                ))}
              </div>
        )}

        {activeTab === 'outgoing' && !loading && (
          outgoing.length === 0
            ? <p className="text-xs text-muted-foreground italic">No outgoing proposals.</p>
            : <div className="space-y-2">
                {outgoing.map(p => (
                  <ProposalCard key={p.id} proposal={p} isIncoming={false}
                    actingPlayerId={actingPlayerId} players={players}
                    campaign={campaign} stateById={stateById} mapDef={mapDef}
                    onAction={() => { loadProposals(); loadPlayerAssets(); }}
                  />
                ))}
              </div>
        )}
      </div>
    </div>
  );
}

// ── Objective Hand ────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  diplomatic:  { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
};

function ObjectiveHandSection({ campaign, actingPlayerId }) {
  const [expanded, setExpanded] = useState(false);
  const [hand, setHand] = useState([]);
  const [defs, setDefs] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const ledger = await base44.entities.PlayerInfluenceLedger.filter({ campaign_id: campaign.id, player_id: actingPlayerId });
      const cards = ledger[0]?.objective_cards_json ?? {};
      const held = cards.held ?? [];
      const completed = (cards.completed ?? []).map(c => c.card_id ?? c);
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
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="font-display text-xs tracking-wider uppercase font-semibold text-purple-400 flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5" /> Objective Hand ({hand.length})
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
          ) : hand.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No objectives in hand.</p>
          ) : hand.map(({ id, completed }) => {
            const def = defs[id];
            const colors = CATEGORY_COLORS.diplomatic;
            return (
              <div key={id} className={`rounded border ${colors.border} ${colors.bg} px-3 py-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${colors.text} truncate`}>{def?.title ?? id}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{def?.description ?? '—'}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {def?.influence_reward > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-purple-400 font-mono"><Star className="w-2.5 h-2.5" /> {def.influence_reward}</span>
                    )}
                    {completed && <span className="text-[10px] text-green-400">✓ Done</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground italic">Draw and discard objectives during Planning Phase.</p>
        </div>
      )}
    </div>
  );
}

// ── Active Effects ────────────────────────────────────────────────────────────

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
  const [expanded, setExpanded] = useState(false);
  const [effects, setEffects] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const data = await base44.entities.DiplomaticAction.filter({ campaign_id: campaign.id, player_id: actingPlayerId, status: 'active' });
      setEffects(data ?? []);
    } catch { setEffects([]); }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { if (expanded) load(); }, [expanded, load]);

  return (
    <div className="rounded border border-cyan-500/30 bg-cyan-500/5">
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="font-display text-xs tracking-wider uppercase font-semibold text-cyan-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Active Effects ({effects.length})
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
          ) : effects.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active diplomatic effects.</p>
          ) : effects.map(e => {
            const cfg = ACTION_LABELS[e.action_type] ?? { label: e.action_type, icon: '🎯', color: 'text-foreground', border: 'border-border', bg: 'bg-muted/10' };
            return (
              <div key={e.id} className={`rounded border ${cfg.border} ${cfg.bg} px-3 py-2`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{cfg.icon}</span>
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {e.expires_round && <span className="text-[10px] text-muted-foreground shrink-0">Expires R{e.expires_round}</span>}
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  {e.target_player_id && <span>→ {getPlayerName(players, e.target_player_id)}</span>}
                  {e.region_id && e.region_id !== 'trade' && <span>Region: {e.region_id.replace(/_/g, ' ')}</span>}
                  {e.influence_spent > 0 && <span>Cost: {e.influence_spent} inf</span>}
                </div>
              </div>
            );
          })}
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
      <TradeProposalsSection campaign={campaign} actingPlayerId={actingPlayerId} players={players} stateById={stateById} mapDef={mapDef} />
      <ObjectiveHandSection campaign={campaign} actingPlayerId={actingPlayerId} />
      <ActiveEffectsSection campaign={campaign} actingPlayerId={actingPlayerId} players={players} />
      {/* Intelligence — reports and actions accessible during Consolidation phase */}
      <div className="border-t border-border pt-1">
        <IntelligencePanel
          campaign={campaign}
          myPlayer={myPlayer}
          isAdmin={myPlayer?.is_admin}
          actingAsPlayerId={actingAsPlayerId}
          mapDef={mapDef}
          players={players}
          stateById={stateById ?? {}}
        />
      </div>
    </div>
  );
}