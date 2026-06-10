/**
 * DiplomaticConsolidationPanel — Sprint 5B.8
 *
 * Diplomatic tab content during Consolidation Phase.
 *
 * Section order (trade is PRIMARY):
 *   1. Trade Proposals (top, uncollapsed)
 *   2. Active Objective Hand
 *   3. Active Diplomatic Effects
 *
 * Trade Proposal features:
 *   - Resources (gold/iron/timber/stone/food)
 *   - Spendable Influence (by region)
 *   - Troops (from a territory)
 *   - Peace Treaty (with duration)
 *   - Affordability validation on propose AND accept
 *   - Accept / Decline buttons for incoming proposals
 *   - Acting-as mode aware
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw, Feather, ChevronDown, ChevronRight, Star, ShieldCheck,
  Send, Inbox, Plus, Check, X as XIcon, AlertTriangle, Sword, Coins, Users2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPlayerName(players, id) {
  return players?.find(p => p.id === id)?.display_name ?? id;
}

// ── Trade Proposals Section ───────────────────────────────────────────────────

function ResourceEditor({ label, state, setState, maxByResource }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground">{label}:</p>
      <div className="grid grid-cols-3 gap-1">
        {RESOURCE_TYPES.map(r => {
          const max = maxByResource?.[r] ?? 99;
          return (
            <div key={r} className="flex items-center gap-1">
              <span className="text-[10px] shrink-0">{RESOURCE_ICONS[r]}</span>
              <input
                type="number" min={0} max={max}
                value={state[r] ?? 0}
                onChange={e => setState(prev => ({ ...prev, [r]: Math.min(max, Math.max(0, parseInt(e.target.value) || 0)) }))}
                disabled={max === 0}
                className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground disabled:opacity-30"
              />
              {maxByResource && <span className="text-[10px] text-muted-foreground shrink-0">/{max}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssetSummary({ resources, influence, troops, peaceTreaty, players, isOffer, label }) {
  const hasResources = Object.values(resources ?? {}).some(v => v > 0);
  const hasInfluence = Object.values(influence ?? {}).some(v => v > 0);
  const hasTroops    = troops?.territory_id && (troops?.amount ?? 0) > 0;
  const hasPeace     = peaceTreaty?.duration > 0;
  const hasAnything  = hasResources || hasInfluence || hasTroops || hasPeace;

  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      {!hasAnything
        ? <span className="text-[10px] text-muted-foreground italic">nothing</span>
        : <div className="flex flex-wrap gap-1.5 text-[10px]">
            {hasResources && Object.entries(resources).filter(([,v]) => v > 0).map(([r, v]) => (
              <span key={r} className="text-foreground">{RESOURCE_ICONS[r]}{v}</span>
            ))}
            {hasInfluence && Object.entries(influence).filter(([,v]) => v > 0).map(([region, v]) => (
              <span key={region} className="text-purple-400">🌐 {region.replace(/_/g,' ')} +{v}</span>
            ))}
            {hasTroops && (
              <span className="text-red-400">⚔ {troops.amount} troops</span>
            )}
            {hasPeace && (
              <span className="text-cyan-400">🕊 Peace {peaceTreaty.duration}R</span>
            )}
          </div>
      }
    </div>
  );
}

function ProposalCard({ proposal, isIncoming, actingPlayerId, players, onAction, myLedger, myResources }) {
  const meta = proposal.effect_metadata ?? {};
  const offerAssets   = meta.offer   ?? {};
  const requestAssets = meta.request ?? {};
  const fromName   = isIncoming ? getPlayerName(players, proposal.player_id) : getPlayerName(players, proposal.target_player_id);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState(null);

  const statusColors = {
    pending:   'text-amber-400',
    active:    'text-green-400',
    expired:   'text-muted-foreground',
    cancelled: 'text-destructive',
  };

  const handleAction = async (action) => {
    setActioning(true);
    setActionError(null);
    try {
      await onAction(proposal.id, action);
    } catch (e) {
      setActionError(e?.response?.data?.error ?? `Failed to ${action} trade.`);
    } finally {
      setActioning(false);
    }
  };

  // Affordability check for accepting: recipient must have what they're giving (offerAssets from proposer's side = what proposer offers; acceptor gives requestAssets)
  const acceptorGives = requestAssets;
  const acceptorResources = acceptorGives.resources ?? {};
  const canAffordAccept = RESOURCE_TYPES.every(r => (myResources?.[r] ?? 0) >= (acceptorResources[r] ?? 0));

  const isPending  = proposal.status === 'pending';
  const canAct     = isIncoming && isPending;

  return (
    <div className="rounded border border-border bg-muted/10 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          {isIncoming ? `From: ${fromName}` : `To: ${fromName}`}
          {proposal.round && <span className="text-[10px] text-muted-foreground ml-1">R{proposal.round}</span>}
        </span>
        <span className={`text-[10px] capitalize ${statusColors[proposal.status] ?? 'text-muted-foreground'}`}>
          {proposal.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AssetSummary
          resources={offerAssets.resources ?? {}}
          influence={offerAssets.influence ?? {}}
          troops={offerAssets.troops}
          peaceTreaty={offerAssets.peace_treaty}
          players={players}
          label={isIncoming ? 'They offer:' : 'You offer:'}
        />
        <AssetSummary
          resources={requestAssets.resources ?? {}}
          influence={requestAssets.influence ?? {}}
          troops={requestAssets.troops}
          peaceTreaty={requestAssets.peace_treaty}
          players={players}
          label={isIncoming ? 'They want:' : 'You want:'}
        />
      </div>

      {actionError && <p className="text-[10px] text-destructive">{actionError}</p>}

      {canAct && (
        <div className="flex gap-2 mt-1">
          {!canAffordAccept && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3" /> You lack the required assets to accept.
            </p>
          )}
          <button
            onClick={() => handleAction('accept')}
            disabled={actioning || !canAffordAccept}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 text-[10px] font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
          >
            {actioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Accept
          </button>
          <button
            onClick={() => handleAction('decline')}
            disabled={actioning}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-destructive/40 bg-destructive/10 text-destructive text-[10px] font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
          >
            {actioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <XIcon className="w-3 h-3" />} Decline
          </button>
        </div>
      )}
    </div>
  );
}

// ── Create Trade Form ─────────────────────────────────────────────────────────

function CreateTradeForm({ campaign, actingPlayerId, players, myResources, myInfluence, myTerritoryTroops, onCreated, onCancel }) {
  const [targetPlayer, setTargetPlayer] = useState('');

  // Offer state
  const [offerResources,   setOfferResources]   = useState({});
  const [offerInfluence,   setOfferInfluence]   = useState({});
  const [offerTroops,      setOfferTroops]      = useState({ territory_id: '', amount: 0 });
  const [offerPeace,       setOfferPeace]       = useState({ duration: 0 });

  // Request state
  const [reqResources,     setReqResources]     = useState({});
  const [reqInfluence,     setReqInfluence]     = useState({});
  const [reqTroops,        setReqTroops]        = useState({ territory_id: '', amount: 0 });
  const [reqPeace,         setReqPeace]         = useState({ duration: 0 });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const otherPlayers = (players ?? []).filter(p => p.id !== actingPlayerId && !p.is_eliminated);

  // Affordability check for the offer side
  const offerAffordable = RESOURCE_TYPES.every(r => (myResources?.[r] ?? 0) >= (offerResources[r] ?? 0));
  const offerInfluenceAffordable = Object.entries(offerInfluence).every(([region, v]) => (myInfluence?.[region] ?? 0) >= v);
  const offerTroopsAffordable = !offerTroops.territory_id || (myTerritoryTroops?.[offerTroops.territory_id] ?? 0) >= (offerTroops.amount ?? 0);
  const canPropose = offerAffordable && offerInfluenceAffordable && offerTroopsAffordable;

  const availableRegions = Object.keys(myInfluence ?? {}).filter(r => (myInfluence[r] ?? 0) > 0);

  const handleSubmit = async () => {
    if (!targetPlayer) { setError('Select a target player.'); return; }
    if (!canPropose) { setError('You cannot offer assets you do not have.'); return; }

    const hasOffer = Object.values(offerResources).some(v => v > 0)
      || Object.values(offerInfluence).some(v => v > 0)
      || (offerTroops.territory_id && offerTroops.amount > 0)
      || offerPeace.duration > 0;

    if (!hasOffer) { setError('Add at least one offered asset.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('diplomaticPhase', {
        action: 'proposeTradeConsolidation',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        target_player_id: targetPlayer,
        offer: {
          resources:   offerResources,
          influence:   offerInfluence,
          troops:      offerTroops.territory_id ? offerTroops : null,
          peace_treaty:offerPeace.duration > 0 ? offerPeace : null,
        },
        request: {
          resources:   reqResources,
          influence:   reqInfluence,
          troops:      reqTroops.territory_id ? reqTroops : null,
          peace_treaty:reqPeace.duration > 0 ? reqPeace : null,
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

      {/* Your resources */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground font-semibold">Your available assets:</p>
        <div className="flex flex-wrap gap-2 text-[10px] text-foreground">
          {RESOURCE_TYPES.map(r => (
            <span key={r} className={(myResources?.[r] ?? 0) > 0 ? 'text-foreground' : 'text-muted-foreground/40'}>
              {RESOURCE_ICONS[r]} {myResources?.[r] ?? 0}
            </span>
          ))}
          {availableRegions.map(region => (
            <span key={region} className="text-purple-400">🌐 {region.replace(/_/g,' ')} {myInfluence[region]}</span>
          ))}
        </div>
      </div>

      {/* Offer */}
      <div className="space-y-2 border border-green-500/20 rounded p-2">
        <p className="text-[10px] text-green-400 font-display tracking-wider uppercase">You Offer</p>
        <ResourceEditor label="Resources" state={offerResources} setState={setOfferResources} maxByResource={myResources} />

        {availableRegions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Spendable Influence:</p>
            <div className="grid grid-cols-2 gap-1">
              {availableRegions.map(region => (
                <div key={region} className="flex items-center gap-1">
                  <span className="text-[10px] text-purple-400 truncate shrink">{region.replace(/_/g,' ')}</span>
                  <input
                    type="number" min={0} max={myInfluence[region] ?? 0}
                    value={offerInfluence[region] ?? 0}
                    onChange={e => setOfferInfluence(prev => ({ ...prev, [region]: Math.min(myInfluence[region], Math.max(0, parseInt(e.target.value) || 0)) }))}
                    className="w-12 bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(myTerritoryTroops ?? {}).length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Troops (from territory):</p>
            <div className="flex gap-1">
              <select
                value={offerTroops.territory_id}
                onChange={e => setOfferTroops(prev => ({ ...prev, territory_id: e.target.value }))}
                className="flex-1 bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
              >
                <option value="">— none —</option>
                {Object.entries(myTerritoryTroops).filter(([,t]) => t > 0).map(([tid, t]) => (
                  <option key={tid} value={tid}>{tid} ({t} troops)</option>
                ))}
              </select>
              <input
                type="number" min={0} max={myTerritoryTroops?.[offerTroops.territory_id] ?? 0}
                value={offerTroops.amount ?? 0}
                onChange={e => setOfferTroops(prev => ({ ...prev, amount: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-14 bg-muted/20 border border-border rounded px-1 py-1 text-[10px] text-foreground"
                placeholder="amt"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">Peace Treaty (rounds):</p>
          <input
            type="number" min={0} max={20}
            value={offerPeace.duration}
            onChange={e => setOfferPeace({ duration: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-20 bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
            placeholder="0"
          />
          {offerPeace.duration > 0 && <p className="text-[10px] text-cyan-400">Creates a Non-Aggression Pact for {offerPeace.duration} rounds if accepted.</p>}
        </div>

        {!offerAffordable && (
          <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> You don't have enough resources to offer.</p>
        )}
      </div>

      {/* Request */}
      <div className="space-y-2 border border-amber-500/20 rounded p-2">
        <p className="text-[10px] text-amber-400 font-display tracking-wider uppercase">You Want (optional)</p>
        <ResourceEditor label="Resources" state={reqResources} setState={setReqResources} />
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">Peace Treaty (rounds):</p>
          <input
            type="number" min={0} max={20}
            value={reqPeace.duration}
            onChange={e => setReqPeace({ duration: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-20 bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
            placeholder="0"
          />
        </div>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !targetPlayer || !canPropose}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border border-primary/40 bg-primary/10 text-primary text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send Proposal
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded border border-border text-muted-foreground text-xs hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Trade Proposals Main Section ──────────────────────────────────────────────

function TradeProposalsSection({ campaign, actingPlayerId, players, stateById, mapDef }) {
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'outgoing' | 'create'
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // My resource state
  const [myResources, setMyResources] = useState({});
  const [myInfluence, setMyInfluence] = useState({});
  const [myTerritoryTroops, setMyTerritoryTroops] = useState({});

  const loadPlayerAssets = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    try {
      const [ledger, regPools] = await Promise.all([
        base44.entities.PlayerResourceLedger.filter({ campaign_id: campaign.id, player_id: actingPlayerId }).catch(() => []),
        base44.entities.RegionalInfluencePool.filter({ campaign_id: campaign.id, player_id: actingPlayerId }).catch(() => []),
      ]);
      const lr = ledger[0] ?? {};
      setMyResources({ gold: lr.gold ?? 0, iron: lr.iron ?? 0, timber: lr.timber ?? 0, stone: lr.stone ?? 0, food: lr.food ?? 0 });
      const inf = {};
      regPools.forEach(p => { if (p.spendable_influence > 0) inf[p.region_id] = p.spendable_influence; });
      setMyInfluence(inf);

      // Troop count per territory
      const myTerritories = Object.values(stateById ?? {}).filter(s => s.owner_player_id === actingPlayerId);
      const troops = {};
      myTerritories.forEach(s => { if (s.troop_count > 0) troops[s.territory_id] = s.troop_count; });
      setMyTerritoryTroops(troops);
    } catch { }
  }, [campaign?.id, actingPlayerId, stateById]);

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

  useEffect(() => {
    loadProposals();
    loadPlayerAssets();
  }, [loadProposals, loadPlayerAssets]);

  const handleTradeAction = async (proposalId, action) => {
    await base44.functions.invoke('diplomaticPhase', {
      action: 'resolveTradeConsolidation',
      campaign_id: campaign.id,
      acting_as_player_id: actingPlayerId,
      proposal_id: proposalId,
      resolution: action, // 'accept' | 'decline'
    });
    await loadProposals();
    await loadPlayerAssets();
  };

  const pendingIncoming = incoming.filter(p => p.status === 'pending');

  return (
    <div className="rounded border border-primary/30 bg-primary/5">
      {/* Header — always visible, NOT collapsible */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-primary/20">
        <span className="font-display text-xs tracking-wider uppercase font-semibold text-primary flex items-center gap-1.5">
          <Users2 className="w-3.5 h-3.5" /> Trade Proposals
          {pendingIncoming.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono">
              {pendingIncoming.length}
            </span>
          )}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => { setShowCreate(v => !v); setActiveTab('incoming'); }}
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
        {/* Create form */}
        {showCreate && (
          <CreateTradeForm
            campaign={campaign}
            actingPlayerId={actingPlayerId}
            players={players}
            myResources={myResources}
            myInfluence={myInfluence}
            myTerritoryTroops={myTerritoryTroops}
            onCreated={() => { setShowCreate(false); loadProposals(); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1">
          {[
            { id: 'incoming', icon: Inbox,  label: `Incoming (${incoming.length})` },
            { id: 'outgoing', icon: Send,   label: `Outgoing (${outgoing.length})` },
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
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    isIncoming={true}
                    actingPlayerId={actingPlayerId}
                    players={players}
                    onAction={handleTradeAction}
                    myResources={myResources}
                  />
                ))}
              </div>
        )}

        {activeTab === 'outgoing' && !loading && (
          outgoing.length === 0
            ? <p className="text-xs text-muted-foreground italic">No outgoing proposals.</p>
            : <div className="space-y-2">
                {outgoing.map(p => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    isIncoming={false}
                    actingPlayerId={actingPlayerId}
                    players={players}
                    onAction={handleTradeAction}
                    myResources={myResources}
                  />
                ))}
              </div>
        )}
      </div>
    </div>
  );
}

// ── Objective Hand Section ────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  military:    { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400' },
  economic:    { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400' },
  diplomatic:  { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  territorial: { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400' },
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
          ) : hand.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No objectives in hand.</p>
          ) : (
            hand.map(({ id, completed }) => {
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
                        <span className="flex items-center gap-0.5 text-[10px] text-purple-400 font-mono">
                          <Star className="w-2.5 h-2.5" /> {def.influence_reward}
                        </span>
                      )}
                      {completed && <span className="text-[10px] text-green-400">✓ Done</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <p className="text-[10px] text-muted-foreground italic">Draw and discard objectives during Planning Phase.</p>
        </div>
      )}
    </div>
  );
}

// ── Active Effects Section ────────────────────────────────────────────────────

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
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>
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
                    {e.expires_round && <span className="text-[10px] text-muted-foreground shrink-0">Expires R{e.expires_round}</span>}
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                    {e.target_player_id && <span>→ {getPlayerName(players, e.target_player_id)}</span>}
                    {e.target_player_b_id && <span>& {getPlayerName(players, e.target_player_b_id)}</span>}
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

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function DiplomaticConsolidationPanel({ campaign, myPlayer, actingAsPlayerId, players, mapDef, stateById }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Feather className="w-3.5 h-3.5 text-purple-400" />
        <p className="font-display text-xs tracking-widest uppercase text-purple-400">Diplomatic</p>
      </div>

      {/* 1. Trade Proposals — primary, top, not collapsible */}
      <TradeProposalsSection
        campaign={campaign}
        actingPlayerId={actingPlayerId}
        players={players}
        stateById={stateById}
        mapDef={mapDef}
      />

      {/* 2. Objective Hand — collapsible */}
      <ObjectiveHandSection campaign={campaign} actingPlayerId={actingPlayerId} />

      {/* 3. Active Effects — collapsible */}
      <ActiveEffectsSection campaign={campaign} actingPlayerId={actingPlayerId} players={players} />
    </div>
  );
}