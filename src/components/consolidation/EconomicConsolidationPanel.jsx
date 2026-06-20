/**
 * EconomicConsolidationPanel — fully local-first (Atomic Architecture).
 *
 * All caravan staging is LOCAL ONLY — no server writes during staging.
 * ConsolidationPhaseHeader submits the atomic lock payload (caravans included).
 *
 * Route safety is computed client-side via BFS for immediate feedback.
 */
import { useState, useMemo } from 'react';
import { Coins, Package, Truck, Plus, X, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getAdjacentTerritories } from '@/services/maps/mapAdjacency';
import { useConsolidationStagingStore } from '@/features/campaigns/consolidation/useConsolidationStagingStore';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];

// BFS path-finder (any territory traversal)
function findPath(originId, destId, adjacencyMap) {
  if (originId === destId) return [originId];
  const visited = new Set([originId]);
  const queue = [[originId, [originId]]];
  while (queue.length > 0) {
    const [current, path] = queue.shift();
    const neighbors = adjacencyMap[current]
      ? Array.from(adjacencyMap[current])
      : getAdjacentTerritories(current);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const newPath = [...path, neighbor];
        if (neighbor === destId) return newPath;
        visited.add(neighbor);
        queue.push([neighbor, newPath]);
      }
    }
  }
  return null;
}

function analyzeRoute(path, stateById, actingPlayerId, players) {
  if (!path || path.length === 0) return { safe: false, enemyTerritories: [], hostilePlayers: [] };
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
  return { safe: enemyTerritories.length === 0, enemyTerritories, hostilePlayers };
}

function StagedCaravanRow({ caravan, mapDef, onRemove, isLocked }) {
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
        {!isLocked && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
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

function NewCaravanForm({ actingPlayerId, mapDef, stateById, players, onStage, onCancel }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [contents, setContents] = useState({});
  const [error, setError] = useState(null);

  const myTerritories = useMemo(() =>
    Object.values(stateById).filter(s => s.owner_player_id === actingPlayerId),
    [stateById, actingPlayerId]
  );
  const originState = origin ? stateById[origin] : null;
  const originStorage = originState?.resource_storage ?? {};

  const routeAnalysis = useMemo(() => {
    if (!origin || !destination) return null;
    const path = findPath(origin, destination, {});
    if (!path) return { noPath: true };
    return { ...analyzeRoute(path, stateById, actingPlayerId, players), path, noPath: false };
  }, [origin, destination, stateById, actingPlayerId, players]);

  const ownedTerritories = mapDef?.territories?.filter(t =>
    t.territory_id !== origin && stateById[t.territory_id]?.owner_player_id === actingPlayerId
  ) ?? [];

  const handleContentsChange = (r, val) => {
    const max = Math.max(0, originStorage[r] ?? 0);
    setContents(prev => ({ ...prev, [r]: Math.min(max, Math.max(0, parseInt(val) || 0)) }));
  };
  const hasContents = Object.values(contents).some(v => v > 0);

  const handleStage = () => {
    if (!origin || !destination) { setError('Select origin and destination.'); return; }
    if (!hasContents) { setError('Select resources to move.'); return; }
    if (routeAnalysis?.noPath) { setError('No route exists between these territories.'); return; }
    setError(null);
    onStage({
      id: `caravan_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      origin,
      destination,
      contents: { ...contents },
      path: routeAnalysis?.path ?? [],
      safe: routeAnalysis?.safe ?? true,
      enemy_territories: routeAnalysis?.enemyTerritories ?? [],
    });
  };

  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
      <p className="font-display text-[10px] tracking-widest uppercase text-amber-400">New Supply Caravan</p>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Origin territory (must own):</label>
        <select value={origin} onChange={e => { setOrigin(e.target.value); setContents({}); setDestination(''); }}
          className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground">
          <option value="">— select origin —</option>
          {myTerritories.map(s => {
            const def = mapDef?.territories?.find(t => t.territory_id === s.territory_id);
            return (
              <option key={s.territory_id} value={s.territory_id}>
                {def?.name ?? s.territory_id}
              </option>
            );
          })}
        </select>
      </div>

      {origin && (
        <>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Available at origin:</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              {RESOURCE_TYPES.map(r => (
                <span key={r} className={originStorage[r] > 0 ? 'text-foreground' : 'text-muted-foreground/40'}>
                  {RESOURCE_ICONS[r]} {originStorage[r] ?? 0}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Shipment contents:</p>
            <div className="grid grid-cols-3 gap-1">
              {RESOURCE_TYPES.map(r => (
                <div key={r} className="flex items-center gap-1">
                  <span className="text-[10px] shrink-0">{RESOURCE_ICONS[r]}</span>
                  <input type="number" min={0} max={originStorage[r] ?? 0}
                    value={contents[r] ?? 0}
                    onChange={e => handleContentsChange(r, e.target.value)}
                    disabled={(originStorage[r] ?? 0) === 0}
                    className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground disabled:opacity-30"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Destination territory:</label>
        <select value={destination} onChange={e => setDestination(e.target.value)}
          className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground">
          <option value="">— select destination (owned) —</option>
          {ownedTerritories.map(t => <option key={t.territory_id} value={t.territory_id}>{t.name}</option>)}
        </select>
      </div>

      {routeAnalysis && !routeAnalysis.noPath && (
        <div className={`rounded border px-3 py-2 text-[10px] space-y-1 ${
          routeAnalysis.safe ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          <div className={`flex items-center gap-1.5 font-semibold ${routeAnalysis.safe ? 'text-green-400' : 'text-amber-400'}`}>
            {routeAnalysis.safe
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Safe Route</>
              : <><AlertTriangle className="w-3.5 h-3.5" /> Unsafe Route</>
            }
          </div>
          {!routeAnalysis.safe && (
            <p className="text-muted-foreground">Route crosses non-friendly territory — Escort battle card will be generated.</p>
          )}
        </div>
      )}
      {routeAnalysis?.noPath && (
        <p className="text-[10px] text-destructive">No route exists between these territories.</p>
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button onClick={handleStage} disabled={!origin || !destination || !hasContents}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all">
          <Truck className="w-3.5 h-3.5" /> Stage Caravan
        </button>
        <button onClick={onCancel}
          className="px-3 py-2 rounded border border-border text-muted-foreground text-xs hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function EconomicConsolidationPanel({ campaign, myPlayer, actingAsPlayerId, mapDef, players, stateById }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 1;

  const stagingStore = useConsolidationStagingStore({ campaignId: campaign?.id, playerId: actingPlayerId, round });

  // Pure local state — initialized from localStorage
  const [caravans, setCaravans] = useState(() => stagingStore.getEconomicStaging());
  const [showNewForm, setShowNewForm] = useState(false);

  // isLocked is passed from parent (ConsolidationPhaseHeader) via CommandCenterPanel
  // We infer it from props if available — default to not locked
  const isLocked = false; // Header controls lock; this panel is always unlocked while staging

  const handleAddCaravan = (caravan) => {
    const updated = [...caravans, caravan];
    setCaravans(updated);
    stagingStore.setEconomicStaging(updated);
    window.dispatchEvent(new Event('storage'));
    setShowNewForm(false);
  };

  const handleRemoveCaravan = (caravanId) => {
    const updated = caravans.filter(c => c.id !== caravanId);
    setCaravans(updated);
    stagingStore.setEconomicStaging(updated);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <p className="font-display text-xs tracking-widest uppercase text-amber-400">Supply Caravans</p>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Move stored resources between any territories. No supply route required.
        If the route passes through non-friendly territory, a Supply Caravan Escort battle card is generated.
      </p>

      {caravans.length === 0 && !showNewForm && (
        <div className="py-4 text-center">
          <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">No supply caravans staged.</p>
        </div>
      )}

      {caravans.length > 0 && (
        <div className="space-y-2">
          {caravans.map((c) => (
            <StagedCaravanRow
              key={c.id}
              caravan={c}
              mapDef={mapDef}
              isLocked={isLocked}
              onRemove={() => handleRemoveCaravan(c.id)}
            />
          ))}
        </div>
      )}

      {showNewForm && (
        <NewCaravanForm
          actingPlayerId={actingPlayerId}
          mapDef={mapDef}
          stateById={stateById ?? {}}
          players={players ?? []}
          onStage={handleAddCaravan}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {!showNewForm && (
        <button onClick={() => setShowNewForm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-amber-500/40 bg-amber-500/5 text-amber-400 text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Supply Caravan
        </button>
      )}
    </div>
  );
}