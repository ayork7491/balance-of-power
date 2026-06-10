/**
 * TradeOfferBuilder — Sprint 5B.12
 *
 * "You Offer" section of a trade proposal form.
 * Proposer picks ONLY their own source location — NOT the destination.
 * Destination is chosen by the receiver when they accept.
 *
 * - Resources: source territory (proposer-owned, has stock)
 * - Troops:    source territory (proposer-owned, has troops)
 * - Influence: source region    (proposer-owned, has balance)
 * - Peace:     no location needed
 */
import { useState } from 'react';
import { Plus, X as XIcon, AlertTriangle } from 'lucide-react';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];
const SEL_CLASS = 'flex-1 min-w-0 bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground';
const NUM_CLASS = 'w-14 bg-muted/20 border border-border rounded px-1 py-1 text-[10px] text-foreground disabled:opacity-30';

function buildResourceSourceMap(stateById, actingPlayerId, mapDef) {
  const map = {};
  RESOURCE_TYPES.forEach(r => { map[r] = []; });
  Object.values(stateById ?? {}).forEach(ts => {
    if (ts.owner_player_id !== actingPlayerId) return;
    const storage = ts.resource_storage ?? {};
    RESOURCE_TYPES.forEach(r => {
      const amt = storage[r] ?? 0;
      if (amt > 0) {
        const name = mapDef?.territories?.find(t => t.territory_id === ts.territory_id)?.name ?? ts.territory_id;
        map[r].push({ territory_id: ts.territory_id, name, available: amt });
      }
    });
  });
  return map;
}

function ResourceOfferLine({ resourceType, sources, line, onUpdate, onRemove }) {
  const selectedSource = sources.find(s => s.territory_id === line.source_territory);
  const max = selectedSource?.available ?? 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap border border-border/40 rounded p-1.5">
      <span className="text-sm shrink-0">{RESOURCE_ICONS[resourceType]}</span>
      <span className="text-[10px] text-foreground font-semibold">{resourceType}</span>
      <select
        value={line.source_territory}
        onChange={e => onUpdate({ ...line, source_territory: e.target.value, amount: 0 })}
        className={SEL_CLASS}
      >
        <option value="">— from territory —</option>
        {sources.map(s => (
          <option key={s.territory_id} value={s.territory_id}>{s.name} ({s.available})</option>
        ))}
      </select>
      <input
        type="number" min={0} max={max}
        value={line.amount}
        disabled={!line.source_territory}
        onChange={e => onUpdate({ ...line, amount: Math.min(max, Math.max(0, parseInt(e.target.value) || 0)) })}
        className={NUM_CLASS}
      />
      {line.source_territory && <span className="text-[10px] text-muted-foreground shrink-0">/{max}</span>}
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function TradeOfferBuilder({
  stateById, mapDef, actingPlayerId, myInfluence, myTerritoryTroops,
  offerLines, setOfferLines,
  offerInfluence, setOfferInfluence,
  offerTroops, setOfferTroops,
  offerPeace, setOfferPeace,
}) {
  const [addingResource, setAddingResource] = useState('');
  const resourceSourceMap = buildResourceSourceMap(stateById, actingPlayerId, mapDef);
  const availableRegions  = Object.entries(myInfluence ?? {}).filter(([, v]) => v > 0);
  const troopTerritories  = Object.entries(myTerritoryTroops ?? {}).filter(([, t]) => t > 0);

  const handleAddResource = () => {
    if (!addingResource) return;
    setOfferLines(prev => [...prev, { id: Date.now(), resource: addingResource, source_territory: '', amount: 0 }]);
    setAddingResource('');
  };

  const handleUpdateLine = (id, updated) => setOfferLines(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l));
  const handleRemoveLine = (id) => setOfferLines(prev => prev.filter(l => l.id !== id));

  const lineErrors = offerLines.filter(l => {
    if (!l.source_territory || l.amount <= 0) return false;
    const src = resourceSourceMap[l.resource]?.find(s => s.territory_id === l.source_territory);
    return !src || l.amount > src.available;
  });

  return (
    <div className="space-y-2 border border-green-500/20 rounded p-2">
      <p className="text-[10px] text-green-400 font-display tracking-wider uppercase">You Offer</p>
      <p className="text-[10px] text-muted-foreground italic">Receiver will choose where to receive each asset.</p>

      {/* Resource lines */}
      {offerLines.length > 0 && (
        <div className="space-y-1.5">
          {offerLines.map(line => (
            <ResourceOfferLine
              key={line.id}
              resourceType={line.resource}
              sources={resourceSourceMap[line.resource] ?? []}
              line={line}
              onUpdate={updated => handleUpdateLine(line.id, updated)}
              onRemove={() => handleRemoveLine(line.id)}
            />
          ))}
        </div>
      )}

      {/* Add resource */}
      <div className="flex gap-1 items-center">
        <select
          value={addingResource}
          onChange={e => setAddingResource(e.target.value)}
          className="flex-1 bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
        >
          <option value="">+ Add resource…</option>
          {RESOURCE_TYPES.filter(r => (resourceSourceMap[r] ?? []).length > 0).map(r => (
            <option key={r} value={r}>{RESOURCE_ICONS[r]} {r}</option>
          ))}
        </select>
        <button
          onClick={handleAddResource}
          disabled={!addingResource}
          className="px-2 py-1 rounded border border-green-500/30 text-green-400 text-[10px] disabled:opacity-30 hover:bg-green-500/10 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {RESOURCE_TYPES.every(r => (resourceSourceMap[r] ?? []).length === 0) && (
        <p className="text-[10px] text-muted-foreground italic">No stored resources available to offer.</p>
      )}

      {/* Influence — proposer picks source region only */}
      {availableRegions.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground">Spendable Influence (from your regions):</p>
          <div className="space-y-1">
            {availableRegions.map(([region, avail]) => {
              const amt = offerInfluence[region] ?? 0;
              return (
                <div key={region} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-purple-400 flex-1 truncate">{region.replace(/_/g, ' ')}</span>
                  <input
                    type="number" min={0} max={avail}
                    value={amt}
                    onChange={e => setOfferInfluence(prev => ({
                      ...prev,
                      [region]: Math.min(avail, Math.max(0, parseInt(e.target.value) || 0)),
                    }))}
                    className="w-12 bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground shrink-0"
                  />
                  <span className="text-[10px] text-muted-foreground shrink-0">/{avail}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Troops — proposer picks source territory only */}
      {troopTerritories.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground">Troops (from your territory):</p>
          <div className="flex gap-1">
            <select
              value={offerTroops.source_territory ?? ''}
              onChange={e => setOfferTroops(prev => ({ ...prev, source_territory: e.target.value, amount: 0 }))}
              className={SEL_CLASS}
            >
              <option value="">— none —</option>
              {troopTerritories.map(([tid, t]) => {
                const name = mapDef?.territories?.find(td => td.territory_id === tid)?.name ?? tid;
                return <option key={tid} value={tid}>{name} ({t} troops)</option>;
              })}
            </select>
            <input
              type="number" min={0} max={myTerritoryTroops?.[offerTroops.source_territory] ?? 0}
              value={offerTroops.amount ?? 0}
              disabled={!offerTroops.source_territory}
              onChange={e => setOfferTroops(prev => ({ ...prev, amount: Math.max(0, parseInt(e.target.value) || 0) }))}
              className={NUM_CLASS}
              placeholder="0"
            />
          </div>
        </div>
      )}

      {/* Peace treaty */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground">Peace Treaty (rounds):</p>
        <input
          type="number" min={0} max={20}
          value={offerPeace.duration}
          onChange={e => setOfferPeace({ duration: Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-20 bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
          placeholder="0"
        />
        {offerPeace.duration > 0 && (
          <p className="text-[10px] text-cyan-400">Creates a Non-Aggression Pact for {offerPeace.duration} rounds if accepted.</p>
        )}
      </div>

      {lineErrors.length > 0 && (
        <p className="text-[10px] text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Some resource amounts exceed available storage.
        </p>
      )}
    </div>
  );
}