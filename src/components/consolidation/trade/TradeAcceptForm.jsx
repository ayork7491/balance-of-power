/**
 * TradeAcceptForm — Sprint 5B.11
 *
 * Shown when receiver clicks Accept on an incoming trade proposal.
 * Receiver privately chooses SOURCE locations for all requested assets.
 * Destination locations were pre-set by the proposer and are read from the proposal.
 *
 * Required receiver inputs per asset type:
 *   Resources: source territory (dest_territory pre-set by proposer)
 *   Troops:    source territory (dest_territory pre-set by proposer)
 *   Influence: source region    (dest_region pre-set by proposer)
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, X as XIcon, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };

export default function TradeAcceptForm({ proposal, campaign, actingPlayerId, stateById, mapDef, onAccepted, onCancel }) {
  const meta = proposal.effect_metadata ?? {};
  const requestAssets = meta.request ?? {};

  // Request assets: new shape — { resource: { amount, dest_territory } } or legacy { resource: amount }
  const reqResources = requestAssets.resources ?? {};
  const reqTroops    = requestAssets.troops    ?? {};
  const reqInfluence = requestAssets.influence ?? {};
  const reqPeace     = requestAssets.peace_treaty ?? {};

  // Normalise resource entries to { amount, dest_territory }
  const normReqResources = Object.entries(reqResources).reduce((acc, [r, v]) => {
    if (typeof v === 'object') acc[r] = v;
    else if (v > 0) acc[r] = { amount: v, dest_territory: '' };
    return acc;
  }, {});

  const hasReqResources = Object.values(normReqResources).some(v => (v.amount ?? v) > 0);
  const hasReqTroops    = (reqTroops.amount ?? 0) > 0;
  const hasReqInfluence = (reqInfluence.amount ?? 0) > 0;

  // Receiver's own assets (loaded fresh — never shared with proposer)
  const [myTerritories, setMyTerritories] = useState([]);
  const [myInfluence,   setMyInfluence]   = useState({});
  const [loading,       setLoading]       = useState(true);

  // Payment sources chosen by receiver
  // Resources: { [resource]: source_territory_id }
  const [resourceSources, setResourceSources] = useState({});
  // Troops: source_territory_id
  const [troopSource,     setTroopSource]     = useState('');
  // Influence: source_region_id
  const [influenceSource, setInfluenceSource] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  const loadMyAssets = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const regPools = await base44.entities.RegionalInfluencePool.filter({
        campaign_id: campaign.id, player_id: actingPlayerId,
      }).catch(() => []);
      const inf = {};
      regPools.forEach(p => { if (p.spendable_influence > 0) inf[p.region_id] = p.spendable_influence; });
      setMyInfluence(inf);

      const myT = Object.values(stateById ?? {}).filter(s => s.owner_player_id === actingPlayerId);
      setMyTerritories(myT);

      // Pre-select if only one option
      const initSources = {};
      Object.keys(normReqResources).forEach(r => {
        const opts = myT.filter(t => (t.resource_storage?.[r] ?? 0) > 0);
        if (opts.length === 1) initSources[r] = opts[0].territory_id;
      });
      setResourceSources(initSources);
    } catch { }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId, stateById]);

  useEffect(() => { loadMyAssets(); }, [loadMyAssets]);

  function getTerritoryName(tid) {
    return mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;
  }

  function territoriesWithResource(resource) {
    return myTerritories
      .filter(t => (t.resource_storage?.[resource] ?? 0) > 0)
      .map(t => ({ territory_id: t.territory_id, name: getTerritoryName(t.territory_id), available: t.resource_storage?.[resource] ?? 0 }));
  }

  function territoriesWithTroops() {
    return myTerritories
      .filter(t => (t.troop_count ?? 0) > 0)
      .map(t => ({ territory_id: t.territory_id, name: getTerritoryName(t.territory_id), troops: t.troop_count ?? 0 }));
  }

  function availableRegions() {
    return Object.entries(myInfluence).filter(([, v]) => v > 0);
  }

  function validate() {
    for (const [resource, v] of Object.entries(normReqResources)) {
      const amount = v.amount ?? 0;
      if (amount <= 0) continue;
      const src = resourceSources[resource];
      if (!src) return `Choose source territory for ${resource}.`;
      const ts = myTerritories.find(t => t.territory_id === src);
      const avail = ts?.resource_storage?.[resource] ?? 0;
      if (amount > avail) return `Not enough ${resource} at ${getTerritoryName(src)} (have ${avail}, need ${amount}).`;
    }
    if (hasReqTroops) {
      if (!troopSource) return 'Choose source territory for troops.';
      const ts = myTerritories.find(t => t.territory_id === troopSource);
      if (!ts || (ts.troop_count ?? 0) < (reqTroops.amount ?? 0)) return 'Not enough troops at selected territory.';
    }
    if (hasReqInfluence) {
      if (!influenceSource) return 'Choose source region for influence.';
      const have = myInfluence[influenceSource] ?? 0;
      if (have < (reqInfluence.amount ?? 0)) return `Not enough influence in ${influenceSource} (have ${have}, need ${reqInfluence.amount}).`;
    }
    return null;
  }

  const validationError = validate();

  const handleAccept = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError(null);

    // Build receiver_payment with explicit source + dest for all assets
    const payResources = {};
    for (const [resource, v] of Object.entries(normReqResources)) {
      const amount = v.amount ?? 0;
      if (amount <= 0) continue;
      const sourceTid = resourceSources[resource];
      const destTid   = v.dest_territory; // pre-set by proposer
      payResources[resource] = [{ source_territory: sourceTid, dest_territory: destTid, amount }];
    }

    const payTroops = hasReqTroops ? {
      source_territory: troopSource,
      dest_territory:   reqTroops.dest_territory ?? '',
      amount:           reqTroops.amount,
    } : null;

    const payInfluence = hasReqInfluence ? {
      source_region: influenceSource,
      dest_region:   reqInfluence.dest_region ?? '',
      amount:        reqInfluence.amount,
    } : null;

    try {
      await base44.functions.invoke('diplomaticPhase', {
        action: 'resolveTradeConsolidation',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        proposal_id: proposal.id,
        resolution: 'accept',
        receiver_payment: {
          resources: payResources,
          troops:    payTroops,
          influence: payInfluence,
        },
      });
      onAccepted();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to accept trade.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
      <Loader2 className="w-3 h-3 animate-spin" /> Loading your assets…
    </div>
  );

  const needsAnyChoice = hasReqResources || hasReqTroops || hasReqInfluence;

  return (
    <div className="mt-2 space-y-2 border border-green-500/20 bg-green-500/5 rounded p-2">
      <p className="text-[10px] text-green-400 font-display tracking-wider uppercase">Choose sources for requested assets</p>

      {!needsAnyChoice && reqPeace.duration > 0 && (
        <p className="text-[10px] text-muted-foreground italic">Only a peace treaty is requested — no assets to choose.</p>
      )}
      {!needsAnyChoice && !reqPeace.duration && (
        <p className="text-[10px] text-muted-foreground italic">Nothing requested — accept freely.</p>
      )}

      {/* Resource payments */}
      {Object.entries(normReqResources).map(([resource, v]) => {
        const amount = v.amount ?? 0;
        if (amount <= 0) return null;
        const destTid = v.dest_territory;
        const sources = territoriesWithResource(resource);
        const chosenSrc = resourceSources[resource] ?? '';
        const avail = myTerritories.find(t => t.territory_id === chosenSrc)?.resource_storage?.[resource] ?? 0;

        return (
          <div key={resource} className="space-y-1 border border-border/40 rounded p-1.5">
            <p className="text-[10px] text-foreground font-semibold">{RESOURCE_ICONS[resource]} Give {amount} {resource}</p>
            {destTid && (
              <p className="text-[10px] text-muted-foreground">→ Deliver to: <span className="text-foreground">{getTerritoryName(destTid)}</span></p>
            )}
            <p className="text-[10px] text-muted-foreground">Choose source territory:</p>
            {sources.length === 0
              ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No {resource} stored in any territory.</p>
              : <div className="flex gap-1 items-center">
                  <select
                    value={chosenSrc}
                    onChange={e => setResourceSources(prev => ({ ...prev, [resource]: e.target.value }))}
                    className="flex-1 bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                  >
                    <option value="">— select territory —</option>
                    {sources.map(s => <option key={s.territory_id} value={s.territory_id}>{s.name} ({s.available} avail)</option>)}
                  </select>
                  {chosenSrc && avail < amount && (
                    <span className="text-[10px] text-destructive shrink-0">need {amount}, have {avail}</span>
                  )}
                </div>
            }
          </div>
        );
      })}

      {/* Troops payment */}
      {hasReqTroops && (
        <div className="space-y-1 border border-border/40 rounded p-1.5">
          <p className="text-[10px] text-foreground font-semibold">⚔ Give {reqTroops.amount} troops</p>
          {reqTroops.dest_territory && (
            <p className="text-[10px] text-muted-foreground">→ Deliver to: <span className="text-foreground">{getTerritoryName(reqTroops.dest_territory)}</span></p>
          )}
          <p className="text-[10px] text-muted-foreground">Choose source territory:</p>
          {territoriesWithTroops().length === 0
            ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No troops available.</p>
            : <select
                value={troopSource}
                onChange={e => setTroopSource(e.target.value)}
                className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
              >
                <option value="">— select territory —</option>
                {territoriesWithTroops().map(t => (
                  <option key={t.territory_id} value={t.territory_id}>{t.name} ({t.troops} troops)</option>
                ))}
              </select>
          }
        </div>
      )}

      {/* Influence payment */}
      {hasReqInfluence && (
        <div className="space-y-1 border border-border/40 rounded p-1.5">
          <p className="text-[10px] text-foreground font-semibold">🌐 Give {reqInfluence.amount} spendable influence</p>
          {reqInfluence.dest_region && (
            <p className="text-[10px] text-muted-foreground">→ Credited to region: <span className="text-foreground">{reqInfluence.dest_region.replace(/_/g, ' ')}</span></p>
          )}
          <p className="text-[10px] text-muted-foreground">Choose source region:</p>
          {availableRegions().length === 0
            ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No spendable influence available.</p>
            : <select
                value={influenceSource}
                onChange={e => setInfluenceSource(e.target.value)}
                className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
              >
                <option value="">— select region —</option>
                {availableRegions().map(([region, avail]) => (
                  <option key={region} value={region}>{region.replace(/_/g, ' ')} ({avail} avail)</option>
                ))}
              </select>
          }
        </div>
      )}

      {error && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
      {validationError && !error && (
        <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{validationError}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleAccept}
          disabled={submitting || !!validationError}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 text-[10px] font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Confirm Accept
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded border border-border text-muted-foreground text-[10px] hover:text-foreground transition-colors"
        >
          <XIcon className="w-3 h-3 inline mr-0.5" /> Cancel
        </button>
      </div>
    </div>
  );
}