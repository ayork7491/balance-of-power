/**
 * TradeRequestBuilder — Sprint 5B.9
 *
 * "You Want" section of a trade proposal form.
 * Proposer specifies what they want from the receiver — WITHOUT seeing receiver inventory.
 * Receiver will choose payment source at acceptance time.
 */
import { useState } from 'react';
import { Plus, X as XIcon } from 'lucide-react';

const RESOURCE_ICONS = { gold: '🟡', iron: '⚙️', timber: '🪵', stone: '🪨', food: '🌾' };
const RESOURCE_TYPES = ['gold', 'iron', 'timber', 'stone', 'food'];

export default function TradeRequestBuilder({
  reqLines, setReqLines,
  reqTroops, setReqTroops,
  reqInfluence, setReqInfluence,
  reqPeace, setReqPeace,
}) {
  const [addingResource, setAddingResource] = useState('');

  const handleAddResource = () => {
    if (!addingResource) return;
    setReqLines(prev => [...prev, { id: Date.now(), resource: addingResource, amount: 0 }]);
    setAddingResource('');
  };

  return (
    <div className="space-y-2 border border-amber-500/20 rounded p-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-amber-400 font-display tracking-wider uppercase">You Want (optional)</p>
        <span className="text-[10px] text-muted-foreground italic">receiver's inventory not revealed</span>
      </div>

      {/* Resource request lines — no source territory, proposer just states amounts */}
      {reqLines.length > 0 && (
        <div className="space-y-1.5">
          {reqLines.map(line => (
            <div key={line.id} className="flex items-center gap-1.5">
              <span className="text-sm shrink-0">{RESOURCE_ICONS[line.resource]}</span>
              <span className="text-[10px] text-foreground flex-1">{line.resource}</span>
              <input
                type="number" min={0} max={999}
                value={line.amount}
                onChange={e => setReqLines(prev => prev.map(l => l.id === line.id
                  ? { ...l, amount: Math.max(0, parseInt(e.target.value) || 0) }
                  : l
                ))}
                className="w-16 bg-muted/20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground"
              />
              <button onClick={() => setReqLines(prev => prev.filter(l => l.id !== line.id))} className="text-muted-foreground hover:text-destructive transition-colors">
                <XIcon className="w-3 h-3" />
              </button>
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
        <input
          type="number" min={0} max={999}
          value={reqTroops.amount ?? 0}
          onChange={e => setReqTroops({ amount: Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-20 bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
          placeholder="0"
        />
        {(reqTroops.amount ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground italic">Receiver will choose which territory to send from.</p>
        )}
      </div>

      {/* Request influence */}
      <div className="space-y-1 pt-1 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground">Request spendable influence:</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={reqInfluence.region ?? ''}
            onChange={e => setReqInfluence(prev => ({ ...prev, region: e.target.value }))}
            className="flex-1 bg-muted/20 border border-border rounded px-2 py-1 text-[10px] text-foreground"
            placeholder="region id (optional)"
          />
          <input
            type="number" min={0} max={99}
            value={reqInfluence.amount ?? 0}
            onChange={e => setReqInfluence(prev => ({ ...prev, amount: Math.max(0, parseInt(e.target.value) || 0) }))}
            className="w-14 bg-muted/20 border border-border rounded px-1 py-1 text-[10px] text-foreground"
            placeholder="0"
          />
        </div>
        {(reqInfluence.amount ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground italic">Receiver will choose region to spend from.</p>
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