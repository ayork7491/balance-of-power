/**
 * IntelligenceReportCard — displays a single IntelligenceReport snapshot.
 * Used in IntelligencePanel report list and report detail view.
 */
import { Clock, AlertTriangle } from 'lucide-react';

const REPORT_TYPE_CONFIG = {
  recon_territory: {
    label: 'Recon Territory',
    icon: '🔭',
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
  },
  audit_stockpile: {
    label: 'Audit Stockpile',
    icon: '📦',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
  },
  investigate_influence: {
    label: 'Investigate Influence',
    icon: '🕵️',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
  },
};

const RESOURCE_ICONS = { gold: '💰', iron: '⚙️', timber: '🌲', stone: '🪨', food: '🌾' };

function ReconData({ data }) {
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-28">Troop Count</span>
        <span className="text-foreground font-mono font-semibold">{data.troop_count ?? '—'}</span>
      </div>
      {data.structures?.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-28">Structures</span>
          <span className="text-foreground">{data.structures.join(', ')}</span>
        </div>
      )}
      {data.active_buildings?.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-28">Buildings</span>
          <div className="flex flex-wrap gap-1">
            {data.active_buildings.map((b, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-muted/20 text-[10px] text-foreground">
                {b.building_type.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
      {data.active_supply_routes?.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-28">Supply Routes</span>
          <span className="text-foreground">{data.active_supply_routes.length} active</span>
        </div>
      )}
    </div>
  );
}

function AuditData({ data }) {
  const storage = data.territory_storage ?? {};
  const hasStorage = Object.values(storage).some(v => v > 0);
  return (
    <div className="space-y-1.5 text-xs">
      {Object.entries({ gold: data.owner_gold, iron: data.owner_iron, timber: data.owner_timber, stone: data.owner_stone, food: data.owner_food })
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([res, amt]) => (
          <div key={res} className="flex items-center gap-2">
            <span className="text-muted-foreground w-28 capitalize">{RESOURCE_ICONS[res]} {res} (ledger)</span>
            <span className="text-foreground font-mono font-semibold">{amt}</span>
          </div>
        ))
      }
      {hasStorage && (
        <div className="pt-1 border-t border-border">
          <p className="text-[10px] text-muted-foreground mb-1">Territory Storage</p>
          {Object.entries(storage).filter(([, v]) => v > 0).map(([res, amt]) => (
            <div key={res} className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 capitalize">{RESOURCE_ICONS[res]} {res}</span>
              <span className="text-foreground font-mono">{amt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfluenceData({ data, players }) {
  const getPlayerName = (id) => players?.find(p => p.id === id)?.display_name ?? id ?? '—';

  return (
    <div className="space-y-2 text-xs">
      {data.permanent_influence?.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Permanent Influence</p>
          {data.permanent_influence.map((ti, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 truncate">{getPlayerName(ti.player_id)}</span>
              <span className="text-foreground font-mono">{ti.influence_amount}</span>
            </div>
          ))}
        </div>
      )}
      {data.spendable_influence?.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Spendable Influence</p>
          {data.spendable_influence.map((rp, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 truncate">{getPlayerName(rp.player_id)}</span>
              <span className="text-foreground font-mono">{rp.spendable_influence}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntelligenceReportCard({ report, players, mapDef, expanded = false, onToggle }) {
  if (!report) return null;

  const cfg = REPORT_TYPE_CONFIG[report.report_type] ?? {
    label: report.report_type,
    icon: '📋',
    color: 'text-muted-foreground',
    border: 'border-border',
    bg: 'bg-muted/5',
  };

  const territoryName = report.target_territory_id
    ? (mapDef?.territories?.find(t => t.territory_id === report.target_territory_id)?.name ?? report.target_territory_id)
    : null;
  const regionLabel = report.target_region_id
    ? report.target_region_id.replace(/_/g, ' ')
    : null;
  const targetLabel = territoryName ?? regionLabel ?? 'Unknown target';

  const data = report.report_data ?? {};

  return (
    <div className={`rounded border ${cfg.border} ${cfg.bg}`}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm">{cfg.icon}</span>
            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-foreground">{targetLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-2.5 h-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Round {report.generated_round}</span>
            {report.generated_phase && (
              <span className="text-[10px] text-muted-foreground">· {report.generated_phase}</span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Detail — shown when expanded */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50">
          {/* Staleness warning */}
          <div className="flex items-start gap-1.5 pt-2 text-[10px] text-amber-400/80">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>Information may be outdated. Reports represent conditions when gathered.</span>
          </div>

          {/* Data by type */}
          {report.report_type === 'recon_territory' && <ReconData data={data} />}
          {report.report_type === 'audit_stockpile' && <AuditData data={data} />}
          {report.report_type === 'investigate_influence' && <InfluenceData data={data} players={players} />}
        </div>
      )}
    </div>
  );
}