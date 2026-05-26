/**
 * InfoPanelPlaceholder — Placeholder for info panel tabs.
 */

export default function InfoPanelPlaceholder({ activeTab }) {
  const content = {
    leaderboard:  { label: 'Standings',   desc: 'Player rankings, territory counts, troop totals.' },
    territories:  { label: 'Territories', desc: 'Full territory list sortable by owner, troops, region.' },
    history:      { label: 'History',     desc: 'Phase snapshots, decision logs, battle history.' },
    battles:      { label: 'Battles',     desc: 'Active battle cards, pending approvals, results.' },
  };
  
  const info = content[activeTab] ?? content.leaderboard;
  
  return (
    <div className="p-4">
      <p className="font-display text-xs tracking-widest uppercase text-muted-foreground mb-2">
        {info.label}
      </p>
      <p className="text-xs text-muted-foreground">{info.desc}</p>
      <div className="space-y-2 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}