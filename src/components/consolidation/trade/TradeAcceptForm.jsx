/**
 * TradeAcceptForm — Sprint 5B.9
 *
 * Shown when receiver clicks Accept on an incoming trade proposal.
 * Receiver privately chooses sources for all requested (hidden) assets.
 * Only the receiver sees their own inventory; nothing is leaked to proposer.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, X as XIcon, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];

export default function TradeAcceptForm({ proposal, campaign, actingPlayerId, stateById, mapDef, onAccepted, onCancel }) {
  const meta = proposal.effect_metadata ?? {};
  const requestAssets = meta.request ?? {};

  const reqResources = requestAssets.resources ?? {}; // { resource: amount }
  const reqTroops = requestAssets.troops ?? {};       // { amount }
  const reqInfluence = requestAssets.influence ?? {}; // { amount, region? }
  const reqPeace = requestAssets.peace_treaty ?? {};

  const hasReqResources = Object.values(reqResources).some(v => v > 0);
  const hasReqTroops    = (reqTroops.amount ?? 0) > 0;
  const hasReqInfluence = (reqInfluence.amount ?? 0) > 0;

  // Receiver's own assets
  const [myTerritories, setMyTerritories] = useState([]);
  const [myInfluence, setMyInfluence] = useState({});
  const [loading, setLoading] = useState(true);

  // Payment choices
  // Resources: array of { resource, territory_id, amount }
  const [resourcePayments, setResourcePayments] = useState([]);
  const [troopPayment, setTroopPayment] = useState({ territory_id: '', amount: reqTroops.amount ?? 0 });
  const [influencePayment, setInfluencePayment] = useState({ region: '', amount: reqInfluence.amount ?? 0 });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadMyAssets = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    try {
      const [regPools] = await Promise.all([
        base44.entities.RegionalInfluencePool.filter({ campaign_id: campaign.id, player_id: actingPlayerId }).catch(() => []),
      ]);
      const inf = {};
      regPools.forEach(p => { if (p.spendable_influence > 0) inf[p.region_id] = p.spendable_influence; });
      setMyInfluence(inf);

      // Build territory list with storage from stateById
      const myT = Object.values(stateById ?? {}).filter(s => s.owner_player_id === actingPlayerId);
      setMyTerritories(myT);

      // Pre-populate resource payment rows
      const rows = Object.entries(reqResources)
        .filter(([, v]) => v > 0)
        .map(([r, amount]) => ({ id: r, resource: r, amount, territory_id: '' }));
      setResourcePayments(rows);
    } catch { }
    finally { setLoading(false); }
  }, [campaign?.id, actingPlayerId, stateById]);

  useEffect(() => { loadMyAssets(); }, [loadMyAssets]);

  // Available amount per resource per territory
  function getAvailableAt(territoryId, resource) {
    const ts = myTerritories.find(t => t.territory_id === territoryId);
    return ts?.resource_storage?.[resource] ?? 0;
  }

  // Territories that have any of the needed resource
  function territoriesWithResource(resource) {
    return myTerritories
      .filter(t => (t.resource_storage?.[resource] ?? 0) > 0)
      .map(t => {
        const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
        return { territory_id: t.territory_id, name, available: t.resource_storage?.[resource] ?? 0 };
      });
  }

  function territoriesWithTroops() {
    return myTerritories
      .filter(t => (t.troop_count ?? 0) > 0)
      .map(t => {
        const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
        return { territory_id: t.territory_id, name, troops: t.troop_count ?? 0 };
      });
  }

  function availableRegions() {
    return Object.entries(myInfluence).filter(([, v]) => v > 0);
  }

  // Validate completeness
  function validate() {
    for (const row of resourcePayments) {
      if (!row.territory_id) return `Choose source territory for ${row.resource}.`;
      const avail = getAvailableAt(row.territory_id, row.resource);
      if (row.amount > avail) return `Not enough ${row.resource} at selected territory (have ${avail}, need ${row.amount}).`;
    }
    if (hasReqTroops) {
      if (!troopPayment.territory_id) return 'Choose source territory for troops.';
      const ts = myTerritories.find(t => t.territory_id === troopPayment.territory_id);
      if (!ts || (ts.troop_count ?? 0) < troopPayment.amount) return `Not enough troops at selected territory.`;
    }
    if (hasReqInfluence) {
      if (!influencePayment.region) return 'Choose source region for influence.';
      const have = myInfluence[influencePayment.region] ?? 0;
      if (have < influencePayment.amount) return `Not enough influence in ${influencePayment.region} (have ${have}, need ${influencePayment.amount}).`;
    }
    return null;
  }

  const validationError = validate();

  const handleAccept = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('diplomaticPhase', {
        action: 'resolveTradeConsolidation',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        proposal_id: proposal.id,
        resolution: 'accept',
        receiver_payment: {
          resources: resourcePayments.reduce((acc, r) => {
            acc[r.resource] = acc[r.resource] ?? [];
            acc[r.resource].push({ territory_id: r.territory_id, amount: r.amount });
            return acc;
          }, {}),
          troops: hasReqTroops ? troopPayment : null,
          influence: hasReqInfluence ? influencePayment : null,
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
      <p className="text-[10px] text-green-400 font-display tracking-wider uppercase">Choose payment sources</p>

      {!needsAnyChoice && reqPeace.duration > 0 && (
        <p className="text-[10px] text-muted-foreground italic">Only a peace treaty is requested — no assets to choose.</p>
      )}
      {!needsAnyChoice && !reqPeace.duration && (
        <p className="text-[10px] text-muted-foreground italic">Nothing requested — accept freely.</p>
      )}

      {/* Resource payments */}
      {resourcePayments.map((row, idx) => {
        const sources = territoriesWithResource(row.resource);
        const avail = row.territory_id ? getAvailableAt(row.territory_id, row.resource) : 0;
        return (
          <div key={row.id} className="space-y-1">
            <p className="text-[10px] text-foreground">{RESOURCE_ICONS[row.resource]} Give {row.amount} {row.resource} from:</p>
            {sources.length === 0
              ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No {row.resource} stored in any territory.</p>
              : <div className="flex gap-1">
                  <select
                    value={row.territory_id}
                    onChange={e => setResourcePayments(prev => prev.map((r, i) => i === idx ? { ...r, territory_id: e.target.value } : r))}
                    className="flex-1 bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
                  >
                    <option value="">— select territory —</option>
                    {sources.map(s => <option key={s.territory_id} value={s.territory_id}>{s.name} ({s.available} avail)</option>)}
                  </select>
                  {row.territory_id && avail < row.amount && (
                    <span className="text-[10px] text-destructive self-center shrink-0">need {row.amount}, have {avail}</span>
                  )}
                </div>
            }
          </div>
        );
      })}

      {/* Troops payment */}
      {hasReqTroops && (
        <div className="space-y-1">
          <p className="text-[10px] text-foreground">⚔ Give {reqTroops.amount} troops from:</p>
          {territoriesWithTroops().length === 0
            ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No troops available.</p>
            : <select
                value={troopPayment.territory_id}
                onChange={e => setTroopPayment(prev => ({ ...prev, territory_id: e.target.value }))}
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
        <div className="space-y-1">
          <p className="text-[10px] text-foreground">🌐 Give {reqInfluence.amount} spendable influence from:</p>
          {availableRegions().length === 0
            ? <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No spendable influence available.</p>
            : <select
                value={influencePayment.region}
                onChange={e => setInfluencePayment(prev => ({ ...prev, region: e.target.value }))}
                className="w-full bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
              >
                <option value="">— select region —</option>
                {availableRegions().map(([region, avail]) => (
                  <option key={region} value={region}>{region.replace(/_/g,' ')} ({avail} avail)</option>
                ))}
              </select>
          }
        </div>
      )}

      {error && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}

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
          Cancel
        </button>
      </div>
    </div>
  );
}