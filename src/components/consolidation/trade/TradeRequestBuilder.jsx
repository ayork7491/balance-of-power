/**
 * TradeRequestBuilder — Sprint 5B.11
 *
 * "You Want" section of a trade proposal form.
 * Proposer specifies what they want from the receiver AND a destination location.
 * Receiver's inventory is NOT revealed — they choose their source location at acceptance.
 *
 * Required fields per asset type:
 *   Resources: amount + dest_territory (source chosen by receiver at accept)
 *   Troops:    amount + dest_territory (source chosen by receiver at accept)
 *   Influence: amount + dest_region    (source region chosen by receiver at accept)
 */
import { useState } from 'react';
import { Plus, X as XIcon } from 'lucide-react';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];

const SEL_CLASS = 'flex-1 bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground';

export default function TradeRequestBuilder({
  reqLines, setReqLines,
  reqTroops, setReqTroops,
  reqInfluence, setReqInfluence,
  reqPeace, setReqPeace,
  myTerritories = [],
  mapDef,
}) {
  const [addingResource, setAddingResource] = useState('');

  const handleAddResource = () => {
    if (!addingResource) return;
    setReqLines(prev => [...prev, { id: Date.now(), resource: addingResource, amount: 0, dest_territory: '' }]);
    setAddingResource('');
  };

  const allTerritories = (mapDef?.territories ?? []).map(t => ({
    territory_id: t.territory_id,
    name: t.name ?? t.territory_id,
  }));
  const allRegions = (mapDef?.regions ?? []).map(r => ({
    region_id: r.id ?? r.region_id,
    name: r.name ?? (r.id ?? r.region_id),
  }));

  return (
    <div className="space-y-2 border border-amber-500/20 rounded p-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-amber-400 font-display tracking-wider uppercase">You Want (optional)</p>
        <span className="text-[10px] text-muted-foreground italic">receiver's inventory not revealed</span>
      </div>

      {/* Resource request lines — amount + destination; receiver picks source */}
      {reqLines.length > 0 && (
        <div className="space-y-1.5">
          {reqLines.map(line => (
            <div key={line.id} className="border border-border/40 rounded p-1.5 space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-sm shrink-0">{RESOURCE_ICONS[line.resource]}</span>
                <span className="text-[10px] text-foreground font-semibold flex-1">{line.resource}</span>
                <button
                  onClick={() => setReqLines(prev => prev.filter(l => l.id !== line.id))}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Amount:</p>
                  <input
                    type="number" min={0} max={999}
                    value={line.amount}
                    onChange={e => setReqLines(prev => prev.map(l => l.id === line.id
                      ? { ...l, amount: Math.max(0, parseInt(e.target.value) || 0) }
                      : l
                    ))}
                    className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Deliver to:</p>
                  <select
                    value={line.dest_territory ?? ''}
                    onChange={e => setReqLines(prev => prev.map(l => l.id === line.id
                      ? { ...l, dest_territory: e.target.value }
                      : l
                    ))}
                    className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground"
                  >
                    <option value="">— your territory —</option>
                    {myTerritories.map(t => {
                      const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
                      return <option key={t.territory_id} value={t.territory_id}>{name}</option>;
                    })}
                  </select>
                </div>
              </div>
              {line.amount > 0 && !line.dest_territory && (
                <p className="text-[10px] text-amber-400">⚠ Choose your delivery territory</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add resource request */}
      <div className="flex gap-1">
        <select
          value={addingResource}
          onChange={e => setAddingResource(e.target.value)}
          className="flex-1 bg-muted/20 border border-border rounded px-1.5 py-1 text-[10px] text-foreground"
        >
          <option value="">+ Request resource…</option>
          {RESOURCE_TYPES.map(r => <option key={r} value={r}>{RESOURCE_ICONS[r]} {r}</option>)}
        </select>
        <button
          onClick={handleAddResource}
          disabled={!addingResource}
          className="px-2 py-1 rounded border border-amber-500/30 text-amber-400 text-[10px] disabled:opacity-30 hover:bg-amber-500/10 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Request troops */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground">Request troops:</p>
        <div className="grid grid-cols-2 gap-1">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Amount:</p>
            <input
              type="number" min={0} max={999}
              value={reqTroops.amount ?? 0}
              onChange={e => setReqTroops(prev => ({ ...prev, amount: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="w-full bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
              placeholder="0"
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Deliver to:</p>
            <select
              value={reqTroops.dest_territory ?? ''}
              onChange={e => setReqTroops(prev => ({ ...prev, dest_territory: e.target.value }))}
              className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground"
            >
              <option value="">— your territory —</option>
              {myTerritories.map(t => {
                const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
                return <option key={t.territory_id} value={t.territory_id}>{name}</option>;
              })}
            </select>
          </div>
        </div>
        {(reqTroops.amount ?? 0) > 0 && !reqTroops.dest_territory && (
          <p className="text-[10px] text-amber-400">⚠ Choose your delivery territory</p>
        )}
        {(reqTroops.amount ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground italic">Receiver will choose which territory to send from.</p>
        )}
      </div>

      {/* Request influence */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground">Request spendable influence:</p>
        <div className="grid grid-cols-2 gap-1">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Amount:</p>
            <input
              type="number" min={0} max={99}
              value={reqInfluence.amount ?? 0}
              onChange={e => setReqInfluence(prev => ({ ...prev, amount: Math.max(0, parseInt(e.target.value) || 0) }))}
              className="w-full bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
              placeholder="0"
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Receive in region:</p>
            <select
              value={reqInfluence.dest_region ?? ''}
              onChange={e => setReqInfluence(prev => ({ ...prev, dest_region: e.target.value }))}
              className="w-full bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground"
            >
              <option value="">— region —</option>
              {allRegions.map(r => (
                <option key={r.region_id} value={r.region_id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
        {(reqInfluence.amount ?? 0) > 0 && !reqInfluence.dest_region && (
          <p className="text-[10px] text-amber-400">⚠ Choose your destination region</p>
        )}
        {(reqInfluence.amount ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground italic">Receiver will choose which region to spend from.</p>
        )}
      </div>

      {/* Request peace treaty */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground">Request peace treaty (rounds):</p>
        <input
          type="number" min={0} max={20}
          value={reqPeace.duration}
          onChange={e => setReqPeace({ duration: Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-20 bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
          placeholder="0"
        />
      </div>
    </div>
  );
}