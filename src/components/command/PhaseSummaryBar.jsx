/**
 * PhaseSummaryBar — Sprint 5B
 * Shows current round, phase name, and a brief description at the top of Command Center.
 */
import { Shield, Swords, Trophy, Package, GitBranch, RefreshCw } from 'lucide-react';

const PHASE_CONFIG = {
  faction_selection: { label: 'Faction Selection', icon: Shield,    color: 'text-purple-400', desc: 'Choose your faction for this campaign.' },
  territory_draft:   { label: 'Territory Draft',   icon: Shield,    color: 'text-blue-400',   desc: 'Draft starting territories in snake order.' },
  initial_deploy:    { label: 'Initial Deploy',     icon: Shield,    color: 'text-blue-400',   desc: 'Place your starting troops.' },
  deploy:            { label: 'Planning Phase',     icon: Package,   color: 'text-amber-400',  desc: 'Deploy troops, activate resources, and plan operations.' },
  attack:            { label: 'Operations Phase',   icon: Swords,    color: 'text-red-400',    desc: 'Declare attacks and execute military, economic, and diplomatic operations.' },
  battle:            { label: 'Conflict Phase',     icon: Swords,    color: 'text-red-500',    desc: 'Resolve all battle cards on the tabletop. Vote on preferences.' },
  fortify:           { label: 'Consolidation Phase',icon: GitBranch, color: 'text-green-400',  desc: 'Move troops, build structures, and check victory conditions.' },
  complete:          { label: 'Campaign Complete',  icon: Trophy,    color: 'text-primary',    desc: 'The campaign has ended.' },
};

export default function PhaseSummaryBar({ campaign, myPlayer }) {
  const phase = campaign?.current_phase ?? 'deploy';
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.deploy;
  const Icon = cfg.icon;
  const round = campaign?.current_round ?? 1;

  return (
    <div className="shrink-0 px-3 py-2.5 border-b border-border bg-panel-header flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color} bg-muted/20`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`font-display text-sm font-bold tracking-wide ${cfg.color}`}>{cfg.label}</span>
          <span className="text-[10px] text-muted-foreground font-mono">Round {round}</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight truncate">{cfg.desc}</p>
      </div>
    </div>
  );
}