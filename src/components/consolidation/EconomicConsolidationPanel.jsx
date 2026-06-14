/**
 * EconomicConsolidationPanel — Sprint 5B.8
 *
 * Economic tab content during Consolidation Phase.
 *
 * Supply Caravans:
 *   - Move stored resources between any two territories
 *   - Do NOT require a Supply Route or established logistics route
 *   - May move through territories not owned by the caravan owner
 *   - Show safety preview: safe (all-friendly path) vs unsafe (triggers Escort battle card)
 *
 * No territory activation, no resource generation planning (Planning Phase only).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw, Coins, Package, Truck, Plus, X, ArrowRight, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getAdjacentTerritories } from '@/services/maps/mapAdjacency';
import { useConsolidationStagingStore } from '@/features/campaigns/consolidation/useConsolidationStagingStore';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];

// ── BFS: find shortest path between two territories through ANY territory ─────
function findPath(originId, destId, adjacencyMap) {
  if (originId === destId) return [originId];
  const visited = new Set([originId]);
  const queue = [[originId, [originId]]];
  while (queue.length > 0) {
    const [current, path] = queue.shift();
    const neighbors = adjacencyMap[current] ? Array.from(adjacencyMap[current]) : getAdjacentTerritories(current);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const newPath = [...path, neighbor];
        if (neighbor === destId) return newPath;
        visited.add(neighbor);
        queue.push([neighbor, newPath]);
      }
    }
  }
  return null; // no path (disconnected)
}

// ── Route Safety Analysis ─────────────────────────────────────────────────────
function analyzeRoute(path, stateById, actingPlayerId, players) {
  if (!path || path.length === 0) return { safe: false, enemyTerritories: [], hostilePlayers: [] };

  // Exclude origin and destination from traversal analysis
  const traversed = path.slice(1, -1);
  const enemyTerritories = [];
  const hostilePlayerIds = new Set();

  for (const tid of traversed) {
    const state = stateById[tid];
    if (state?.owner_player_id && state.owner_player_id !== actingPlayerId) {
      enemyTerritories.push(tid);
      hostilePlayerIds.add(state.owner_player_id);
    }
  }

  const hostilePlayers = [...hostilePlayerIds].map(pid =>
    players?.find(p => p.id === pid)?.display_name ?? pid
  );

  return {
    safe: enemyTerritories.length === 0,
    enemyTerritories,
    hostilePlayers,
  };
}

// ── Staged Caravan Row ────────────────────────────────────────────────────────
function StagedCaravanRow({ caravan, mapDef, onRemove }) {
  const originName = mapDef?.territories?.find(t => t.territory_id === caravan.origin)?.name ?? caravan.origin;
  const destName   = mapDef?.territories?.find(t => t.territory_id === caravan.destination)?.name ?? caravan.destination;
  const hasContents = Object.entries(caravan.contents ?? {}).some(([, v]) => v > 0);

  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-foreground truncate">{originName}</span>
          <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-xs text-foreground truncate">{destName}</span>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {hasContents
          ? Object.entries(caravan.contents).filter(([, v]) => v > 0).map(([r, v]) => (
            <span key={r}>{RESOURCE_ICONS[r]} {v} {r}</span>
          ))
          : <span className="italic">No resources selected</span>
        }
      </div>
      {caravan.safe !== undefined && (
        <div className={`flex items-center gap-1 text-[10px] ${caravan.safe ? 'text-green-400' : 'text-amber-400'}`}>
          {caravan.safe
            ? <><CheckCircle2 className="w-3 h-3" /> Safe — no escort needed</>
            : <><AlertTriangle className="w-3 h-3" /> Unsafe — Escort battle card will be generated</>
          }
        </div>
      )}
    </div>
  );
}

// ── New Caravan Form ──────────────────────────────────────────────────────────
function NewCaravanForm({ campaign, actingPlayerId, mapDef, stateById, players, adjacencyMap, onStage, onCancel }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [contents, setContents] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // All territories the acting player owns (have stored resources at origin)
  const myTerritories = useMemo(() =>
    Object.values(stateById).filter(s => s.owner_player_id === actingPlayerId),
    [stateById, actingPlayerId]
  );

  const originState = origin ? stateById[origin] : null;
  const originStorage = originState?.resource_storage ?? {};

  // Route analysis
  const routeAnalysis = useMemo(() => {
    if (!origin || !destination) return null;
    const adj = adjacencyMap ?? {};
    const path = findPath(origin, destination, adj);
    if (!path) return { noPath: true };
    const analysis = analyzeRoute(path, stateById, actingPlayerId, players);
    return { ...analysis, path, noPath: false };
  }, [origin, destination, adjacencyMap, stateById, actingPlayerId, players]);

  // Any territory on the map is a valid destination (except origin)
  const allTerritories = mapDef?.territories ?? [];

  const getResourceMax = (r) => Math.max(0, (originStorage[r] ?? 0));

  const handleContentsChange = (r, val) => {
    const max = getResourceMax(r);
    setContents(prev => ({ ...prev, [r]: Math.min(max, Math.max(0, parseInt(val) || 0)) }));
  };

  const hasContents = Object.values(contents).some(v => v > 0);

  const handleSubmit = async () => {
    if (!origin || !destination) { setError('Select origin and destination.'); return; }
    if (!hasContents) { setError('Select resources to move.'); return; }
    if (routeAnalysis?.noPath) { setError('No route exists between these territories.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('fortifyPhase', {
        action: 'stageCaravan',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        origin_territory_id: origin,
        destination_territory_id: destination,
        shipment_contents: contents,
      });
      onStage();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to stage caravan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
      <p className="font-display text-[10px] tracking-widest uppercase text-amber-400">New Supply Caravan</p>

      {/* Origin */}
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Origin territory (must own):</label>
        <select
          value={origin}
          onChange={e => { setOrigin(e.target.value); setContents({}); setDestination(''); }}
          className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">— select origin —</option>
          {myTerritories.map(s => {
            const def = mapDef?.territories?.find(t => t.territory_id === s.territory_id);
            const storage = s.resource_storage ?? {};
            const hasResources = Object.values(storage).some(v => v > 0);
            return (
              <option key={s.territory_id} value={s.territory_id}>
                {def?.name ?? s.territory_id}{hasResources ? '' : ' (no stored resources)'}
              </option>
            );
          })}
        </select>
      </div>

      {/* Available resources at origin */}
      {origin && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">Available at origin:</p>
          <div className="flex flex-wrap gap-2 text-[10px] text-foreground">
            {RESOURCE_TYPES.map(r => (
              <span key={r} className={originStorage[r] > 0 ? 'text-foreground' : 'text-muted-foreground/40'}>
                {RESOURCE_ICONS[r]} {originStorage[r] ?? 0}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resource selection */}
      {origin && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">Shipment contents:</p>
          <div className="grid grid-cols-3 gap-1">
            {RESOURCE_TYPES.map(r => (
              <div key={r} className="flex items-center gap-1">
                <span className="text-[10px] shrink-0">{RESOURCE_ICONS[r]}</span>
                <input
                  type="number" min={0} max={getResourceMax(r)}
                  value={contents[r] ?? 0}
                  onChange={e => handleContentsChange(r, e.target.value)}
                  disabled={getResourceMax(r) === 0}
                  className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground disabled:opacity-30"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Destination */}
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Destination territory:</label>
        <select
          value={destination}
          onChange={e => setDestination(e.target.value)}
          className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">— select destination —</option>
          {allTerritories.filter(t => t.territory_id !== origin).map(t => (
            <option key={t.territory_id} value={t.territory_id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Route safety preview */}
      {routeAnalysis && !routeAnalysis.noPath && (
        <div className={`rounded border px-3 py-2 text-[10px] space-y-1 ${
          routeAnalysis.safe
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          <div className={`flex items-center gap-1.5 font-semibold ${routeAnalysis.safe ? 'text-green-400' : 'text-amber-400'}`}>
            {routeAnalysis.safe
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Safe Route</>
              : <><AlertTriangle className="w-3.5 h-3.5" /> Unsafe Route</>
            }
          </div>
          {routeAnalysis.safe ? (
            <p className="text-muted-foreground">All territories along the route are friendly. No battle card will be generated.</p>
          ) : (
            <>
              <p className="text-muted-foreground">Route crosses non-friendly territory. A <span className="text-amber-400 font-semibold">Supply Caravan Escort</span> battle card will be generated.</p>
              <p className="text-muted-foreground">Hostile players: <span className="text-foreground">{routeAnalysis.hostilePlayers.join(', ')}</span></p>
              <p className="text-muted-foreground">You (caravan owner) will be the <span className="text-foreground">defender</span>.</p>
              <p className="text-muted-foreground">Shipment is at risk.</p>
            </>
          )}
        </div>
      )}
      {routeAnalysis?.noPath && (
        <p className="text-[10px] text-destructive">No route exists between these territories.</p>
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !origin || !destination || !hasContents}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
          Stage Caravan
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

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function EconomicConsolidationPanel({ campaign, myPlayer, actingAsPlayerId, mapDef, players, stateById }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 1;

  const stagingStore = useConsolidationStagingStore({ campaignId: campaign?.id, playerId: actingPlayerId, round });

  const [caravans, setCaravans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Build adjacency map from stateById keys for path-finding
  const adjacencyMap = useMemo(() => {
    // Use the utility function lazily — just pass null and let findPath use getAdjacentTerritories directly
    return null;
  }, []);

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'getCaravans',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      }).catch(() => ({ data: { caravans: [] } }));
      setCaravans(res?.data?.caravans ?? []);
    } catch {
      setError('Failed to load caravans.');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { load(); }, [load]);

  // Determine lock status
  const [isLocked, setIsLocked] = useState(false);
  useEffect(() => {
    if (!campaign?.id || !actingPlayerId) return;
    const round = campaign?.current_round ?? 1;
    base44.entities.PhaseDecision.filter({
      campaign_id: campaign.id,
      player_id: actingPlayerId,
      phase: 'fortify',
      round,
    }).then(d => setIsLocked(d[0]?.is_locked ?? false)).catch(() => {});
  }, [campaign?.id, actingPlayerId, campaign?.current_round]);

  const handleRemoveCaravan = async (caravanId) => {
    try {
      await base44.functions.invoke('fortifyPhase', {
        action: 'removeCaravan',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        caravan_id: caravanId,
      });
      // Re-fetch and mirror to localStorage
      const res = await base44.functions.invoke('fortifyPhase', {
        action: 'getCaravans',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      }).catch(() => ({ data: { caravans: [] } }));
      const updated = res?.data?.caravans ?? [];
      setCaravans(updated);
      stagingStore.setEconomicStaging(updated);
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to remove caravan.');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <p className="font-display text-xs tracking-widest uppercase text-amber-400">Supply Caravans</p>
        </div>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Move stored resources between any territories. No supply route required.
        If the route passes through non-friendly territory, a Supply Caravan Escort battle card is generated.
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Staged caravans */}
          {caravans.length === 0 && !showNewForm && (
            <div className="py-4 text-center">
              <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No supply caravans staged.</p>
            </div>
          )}

          {caravans.length > 0 && (
            <div className="space-y-2">
              {caravans.map((c, i) => (
                <StagedCaravanRow
                  key={c.id ?? i}
                  caravan={c}
                  mapDef={mapDef}
                  onRemove={() => handleRemoveCaravan(c.id)}
                />
              ))}
            </div>
          )}

          {/* New caravan form */}
          {showNewForm && !isLocked && (
            <NewCaravanForm
              campaign={campaign}
              actingPlayerId={actingPlayerId}
              mapDef={mapDef}
              stateById={stateById ?? {}}
              players={players ?? []}
              adjacencyMap={adjacencyMap}
              onStage={async () => {
                setShowNewForm(false);
                await load();
                // Mirror to localStorage after load
                const updatedCaravans = await base44.functions.invoke('fortifyPhase', {
                  action: 'getCaravans',
                  campaign_id: campaign.id,
                  acting_as_player_id: actingPlayerId,
                }).then(r => r?.data?.caravans ?? []).catch(() => []);
                stagingStore.setEconomicStaging(updatedCaravans);
                window.dispatchEvent(new Event('storage'));
              }}
              onCancel={() => setShowNewForm(false)}
            />
          )}

          {/* Add caravan button */}
          {!isLocked && !showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-amber-500/40 bg-amber-500/5 text-amber-400 text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Supply Caravan
            </button>
          )}

          {isLocked && (
            <div className="p-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">
              ✓ Economic phase locked in.
            </div>
          )}
        </>
      )}
    </div>
  );
}