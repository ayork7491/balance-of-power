/**
 * TradeAcceptForm — Sprint 5B.12
 *
 * Ownership boundary rules:
 *   Receiver gives (requested assets)  → receiver picks SOURCE from their own territories/regions
 *   Receiver receives (offered assets)  → receiver picks DESTINATION from their own territories/regions
 *
 * Proposer's stored data:
 *   offer.*    → source_territory / source_region set by proposer (not shown to receiver as editable)
 *   request.*  → dest_territory / dest_region set by proposer (not shown to receiver as editable)
 *
 * Receiver's choices:
 *   For each requested asset  → source selector (receiver-owned only)
 *   For each offered asset    → destination selector (receiver-owned only)
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, X as XIcon, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };

export default function TradeAcceptForm({ proposal, campaign, actingPlayerId, stateById, mapDef, onAccepted, onCancel }) {
  const meta          = proposal.effect_metadata ?? {};
  const offerAssets   = meta.offer   ?? {};
  const requestAssets = meta.request ?? {};

  // ── Requested assets (receiver GIVES these — picks source) ───────────────
  const reqResources = requestAssets.resources ?? {};
  const reqTroops    = requestAssets.troops    ?? {};
  const reqInfluence = requestAssets.influence ?? {};
  const reqPeace     = requestAssets.peace_treaty ?? {};

  // Normalise resource request entries to { amount, dest_territory }
  // dest_territory was set by proposer — receiver just confirms source
  const normReqResources = Object.entries(reqResources).reduce((acc, [r, v]) => {
    if (typeof v === 'object' && (v.amount ?? 0) > 0) acc[r] = v;
    else if (typeof v === 'number' && v > 0) acc[r] = { amount: v, dest_territory: '' };
    return acc;
  }, {});

  // ── Offered assets (receiver RECEIVES these — picks destination) ──────────
  const offResources = offerAssets.resources ?? {}; // { resource: [{ source_territory, amount }] }
  const offTroops    = offerAssets.troops    ?? {};  // { source_territory, amount }
  const offInfluence = offerAssets.influence ?? {};  // { region: amount } (number, not object)

  const hasReqResources = Object.values(normReqResources).some(v => (v.amount ?? 0) > 0);
  const hasReqTroops    = (reqTroops.amount ?? 0) > 0;
  const hasReqInfluence = (reqInfluence.amount ?? 0) > 0;
  const hasOffResources = Object.entries(offResources).some(([, lines]) => (Array.isArray(lines) ? lines : [lines]).some(l => (l?.amount ?? 0) > 0));
  const hasOffTroops    = (offTroops.amount ?? 0) > 0;
  const hasOffInfluence = Object.values(offInfluence).some(v => (typeof v === 'object' ? (v.amount ?? 0) : (v ?? 0)) > 0);

  // Receiver's own assets
  const [myTerritories, setMyTerritories] = useState([]);
  const [myInfluence,   setMyInfluence]   = useState({});
  const [loading,       setLoading]       = useState(true);

  // Sources (for what receiver gives — requested assets)
  const [resourceSources,  setResourceSources]  = useState({}); // { resource: territory_id }
  const [troopSource,      setTroopSource]      = useState('');
  const [influenceSource,  setInfluenceSource]  = useState('');

  // Destinations (for what receiver receives — offered assets)
  const [resourceDests,    setResourceDests]    = useState({}); // { resource: territory_id }
  const [troopDest,        setTroopDest]        = useState('');
  const [influenceDests,   setInfluenceDests]   = useState({}); // { region: territory_id or region_id }

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

      // Auto-select single-option sources
      const initSources = {};
      Object.keys(normReqResources).forEach(r => {
        const opts = myT.filter(t => (t.resource_storage?.[r] ?? 0) > 0);
        if (opts.length === 1) initSources[r] = opts[0].territory_id;
      });
      setResourceSources(initSources);

      // Auto-select single-option destinations for received resources
      const initDests = {};
      Object.keys(offResources).forEach(r => {
        if (myT.length === 1) initDests[r] = myT[0].territory_id;
      });
      setResourceDests(initDests);
    } catch { }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId, stateById]);

  useEffect(() => { loadMyAssets(); }, [loadMyAssets]);

  function getTerritoryName(tid) {
    return mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;
  }

  function getRegionName(rid) {
    const r = mapDef?.regions?.find(r => (r.id ?? r.region_id) === rid);
    return r?.name ?? rid?.replace(/_/g, ' ') ?? rid;
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

  function myAllTerritories() {
    return myTerritories.map(t => ({ territory_id: t.territory_id, name: getTerritoryName(t.territory_id) }));
  }

  function myAllRegions() {
    // All regions where receiver already has presence OR all map regions they could receive into
    return (mapDef?.regions ?? []).map(r => ({ region_id: r.id ?? r.region_id, name: r.name ?? (r.id ?? r.region_id) }));
  }

  function validate() {
    // Validate sources (what receiver gives)
    for (const [resource, v] of Object.entries(normReqResources)) {
      const amount = v.amount ?? 0;
      if (amount <= 0) continue;
      const src = resourceSources[resource];
      if (!src) return `Choose source territory for ${resource}.`;
      const ts = myTerritories.find(t => t.territory_id === src);
      if ((ts?.resource_storage?.[resource] ?? 0) < amount) return `Not enough ${resource} at ${getTerritoryName(src)}.`;
    }
    if (hasReqTroops) {
      if (!troopSource) return 'Choose source territory for troops.';
      const ts = myTerritories.find(t => t.territory_id === troopSource);
      if (!ts || (ts.troop_count ?? 0) < (reqTroops.amount ?? 0)) return 'Not enough troops at selected territory.';
    }
    if (hasReqInfluence) {
      if (!influenceSource) return 'Choose source region for influence.';
      if ((myInfluence[influenceSource] ?? 0) < (reqInfluence.amount ?? 0)) return `Not enough influence in ${getRegionName(influenceSource)}.`;
    }

    // Validate destinations (what receiver receives)
    for (const resource of Object.keys(offResources)) {
      const lines = Array.isArray(offResources[resource]) ? offResources[resource] : [offResources[resource]];
      const totalOffered = lines.reduce((s, l) => s + (l?.amount ?? 0), 0);
      if (totalOffered <= 0) continue;
      if (!resourceDests[resource]) return `Choose destination territory to receive ${resource}.`;
      if (!myTerritories.find(t => t.territory_id === resourceDests[resource])) return `Destination for ${resource} must be your territory.`;
    }
    if (hasOffTroops && !troopDest) return 'Choose destination territory to receive troops.';
    if (hasOffTroops && !myTerritories.find(t => t.territory_id === troopDest)) return 'Destination for troops must be your territory.';
    for (const [region] of Object.entries(offInfluence)) {
      const amt = typeof offInfluence[region] === 'object' ? (offInfluence[region]?.amount ?? 0) : (offInfluence[region] ?? 0);
      if (amt <= 0) continue;
      if (!influenceDests[region]) return `Choose destination region to receive influence from ${getRegionName(region)}.`;
    }

    return null;
  }

  const validationError = validate();

  const handleAccept = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError(null);

    // ── receiver_payment: what receiver gives (requested assets) ─────────
    const payResources = {};
    for (const [resource, v] of Object.entries(normReqResources)) {
      const amount = v.amount ?? 0;
      if (amount <= 0) continue;
      payResources[resource] = [{
        source_territory: resourceSources[resource],
        dest_territory:   v.dest_territory ?? '',   // proposer set this
        amount,
      }];
    }

    const payTroops = hasReqTroops ? {
      source_territory: troopSource,
      dest_territory:   reqTroops.dest_territory ?? '',  // proposer set this
      amount:           reqTroops.amount,
    } : null;

    const payInfluence = hasReqInfluence ? {
      source_region: influenceSource,
      dest_region:   reqInfluence.dest_region ?? '',  // proposer set this
      amount:        reqInfluence.amount,
    } : null;

    // ── receiver_destinations: where receiver wants offered assets delivered ─
    // Backend combines proposer's source + receiver's destination for offer side
    const receiverDestResources = {};
    for (const [resource, lines] of Object.entries(offResources)) {
      const arr = Array.isArray(lines) ? lines : [lines];
      const total = arr.reduce((s, l) => s + (l?.amount ?? 0), 0);
      if (total <= 0) continue;
      receiverDestResources[resource] = resourceDests[resource] ?? '';
    }

    const receiverDestTroops = hasOffTroops ? troopDest : null;

    const receiverDestInfluence = {};
    for (const [region] of Object.entries(offInfluence)) {
      const amt = typeof offInfluence[region] === 'object' ? (offInfluence[region]?.amount ?? 0) : (offInfluence[region] ?? 0);
      if (amt <= 0) continue;
      receiverDestInfluence[region] = influenceDests[region] ?? '';
    }

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
        receiver_destinations: {
          resources:  receiverDestResources,
          troops:     receiverDestTroops,
          influence:  receiverDestInfluence,
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

  const allMyTerr = myAllTerritories();
  const allMyReg  = myAllRegions();

  return (
    <div className="mt-2 space-y-3 border border-green-500/20 bg-green-500/5 rounded p-2">

      {/* ── Section 1: What receiver gives (requested assets) ─────────────── */}
      {(hasReqResources || hasReqTroops || hasReqInfluence) && (
        <div className="space-y-2">
          <p className="text-[10px] text-amber-400 font-display tracking-wider uppercase">You Give — Choose Sources</p>

          {Object.entries(normReqResources).map(([resource, v]) => {
            const amount = v.amount ?? 0;
            if (amount <= 0) return null;
            const sources = territoriesWithResource(resource);
            const chosenSrc = resourceSources[resource] ?? '';
            const avail = myTerritories.find(t => t.territory_id === chosenSrc)?.resource_storage?.[resource] ?? 0;
            return (
              <div key={resource} className="space-y-1 border border-border/40 rounded p-1.5">
                <p className="text-[10px] text-foreground font-semibold">{RESOURCE_ICONS[resource]} Give {amount} {resource}</p>
                {sources.length === 0
                  ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No {resource} available.</p>
                  : <div className="flex gap-1 items-center">
                      <select
                        value={chosenSrc}
                        onChange={e => setResourceSources(prev => ({ ...prev, [resource]: e.target.value }))}
                        className="flex-1 bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                      >
                        <option value="">— your source territory —</option>
                        {sources.map(s => <option key={s.territory_id} value={s.territory_id}>{s.name} ({s.available})</option>)}
                      </select>
                      {chosenSrc && avail < amount && (
                        <span className="text-[10px] text-destructive shrink-0">need {amount}</span>
                      )}
                    </div>
                }
              </div>
            );
          })}

          {hasReqTroops && (
            <div className="space-y-1 border border-border/40 rounded p-1.5">
              <p className="text-[10px] text-foreground font-semibold">⚔ Give {reqTroops.amount} troops</p>
              {territoriesWithTroops().length === 0
                ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No troops available.</p>
                : <select
                    value={troopSource}
                    onChange={e => setTroopSource(e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                  >
                    <option value="">— your source territory —</option>
                    {territoriesWithTroops().map(t => (
                      <option key={t.territory_id} value={t.territory_id}>{t.name} ({t.troops} troops)</option>
                    ))}
                  </select>
              }
            </div>
          )}

          {hasReqInfluence && (
            <div className="space-y-1 border border-border/40 rounded p-1.5">
              <p className="text-[10px] text-foreground font-semibold">🌐 Give {reqInfluence.amount} influence</p>
              {Object.keys(myInfluence).length === 0
                ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No spendable influence available.</p>
                : <select
                    value={influenceSource}
                    onChange={e => setInfluenceSource(e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                  >
                    <option value="">— your source region —</option>
                    {Object.entries(myInfluence).filter(([, v]) => v > 0).map(([region, avail]) => (
                      <option key={region} value={region}>{getRegionName(region)} ({avail} avail)</option>
                    ))}
                  </select>
              }
            </div>
          )}
        </div>
      )}

      {/* ── Section 2: What receiver receives (offered assets) ──────────────── */}
      {(hasOffResources || hasOffTroops || hasOffInfluence) && (
        <div className="space-y-2">
          <p className="text-[10px] text-green-400 font-display tracking-wider uppercase">You Receive — Choose Destinations</p>

          {Object.entries(offResources).map(([resource, lines]) => {
            const arr = Array.isArray(lines) ? lines : [lines];
            const total = arr.reduce((s, l) => s + (l?.amount ?? 0), 0);
            if (total <= 0) return null;
            return (
              <div key={resource} className="space-y-1 border border-border/40 rounded p-1.5">
                <p className="text-[10px] text-foreground font-semibold">{RESOURCE_ICONS[resource]} Receive {total} {resource}</p>
                {allMyTerr.length === 0
                  ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No territories to receive into.</p>
                  : <select
                      value={resourceDests[resource] ?? ''}
                      onChange={e => setResourceDests(prev => ({ ...prev, [resource]: e.target.value }))}
                      className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                    >
                      <option value="">— your destination territory —</option>
                      {allMyTerr.map(t => <option key={t.territory_id} value={t.territory_id}>{t.name}</option>)}
                    </select>
                }
              </div>
            );
          })}

          {hasOffTroops && (
            <div className="space-y-1 border border-border/40 rounded p-1.5">
              <p className="text-[10px] text-foreground font-semibold">⚔ Receive {offTroops.amount} troops</p>
              {allMyTerr.length === 0
                ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No territories to receive into.</p>
                : <select
                    value={troopDest}
                    onChange={e => setTroopDest(e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                  >
                    <option value="">— your destination territory —</option>
                    {allMyTerr.map(t => <option key={t.territory_id} value={t.territory_id}>{t.name}</option>)}
                  </select>
              }
            </div>
          )}

          {Object.entries(offInfluence).map(([region]) => {
            const amt = typeof offInfluence[region] === 'object' ? (offInfluence[region]?.amount ?? 0) : (offInfluence[region] ?? 0);
            if (amt <= 0) return null;
            return (
              <div key={region} className="space-y-1 border border-border/40 rounded p-1.5">
                <p className="text-[10px] text-foreground font-semibold">🌐 Receive {amt} influence</p>
                <select
                  value={influenceDests[region] ?? ''}
                  onChange={e => setInfluenceDests(prev => ({ ...prev, [region]: e.target.value }))}
                  className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                >
                  <option value="">— your destination region —</option>
                  {allMyReg.map(r => <option key={r.region_id} value={r.region_id}>{r.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {(!hasReqResources && !hasReqTroops && !hasReqInfluence && !hasOffResources && !hasOffTroops && !hasOffInfluence) && (
        <p className="text-[10px] text-muted-foreground italic">
          {reqPeace.duration > 0 ? 'Only a peace treaty — no assets to choose.' : 'No assets in this trade.'}
        </p>
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