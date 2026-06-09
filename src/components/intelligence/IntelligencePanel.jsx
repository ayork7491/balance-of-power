/**
 * IntelligencePanel — Sprint 4M
 * Intelligence actions and report viewer for the Influence tab.
 * Driven by the Influence Action Framework (influenceActionFramework.js).
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, ChevronRight, ChevronDown, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { INTELLIGENCE_ACTIONS } from '@/config/influenceActionFramework';
import IntelligenceActionForm from './IntelligenceActionForm';
import IntelligenceReportCard from './IntelligenceReportCard';

export default function IntelligencePanel({
  campaign,
  myPlayer,
  isAdmin,
  actingAsPlayerId,
  mapDef,
  players,
  stateById = {},
}) {
  const [intelState, setIntelState] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [reportsExpanded, setReportsExpanded] = useState(true);
  const [expandedReportId, setExpandedReportId] = useState(null);

  const campaignId = campaign?.id;
  const actingPlayer = actingAsPlayerId
    ? players?.find(p => p.id === actingAsPlayerId) ?? myPlayer
    : myPlayer;

  const load = useCallback(async () => {
    if (!campaignId || !actingPlayer?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [stateRes, reportsRes] = await Promise.all([
        base44.functions.invoke('intelligencePhase', {
          action: 'getIntelligenceState',
          campaign_id: campaignId,
          acting_as_player_id: actingPlayer.id,
        }),
        base44.functions.invoke('intelligencePhase', {
          action: 'getReports',
          campaign_id: campaignId,
          acting_as_player_id: actingPlayer.id,
        }),
      ]);
      setIntelState(stateRes.data);
      setReports(reportsRes.data?.reports ?? []);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to load intelligence state.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, actingPlayer?.id]);

  useEffect(() => { load(); }, [load]);

  const handleActionSuccess = (result) => {
    setActiveAction(null);
    // Expand the new report immediately
    if (result?.report_id) setExpandedReportId(result.report_id);
    load();
  };

  const regionPools = intelState?.region_pools ?? {};
  const totalSpendable = intelState?.total_spendable_influence ?? 0;

  return (
    <div className="px-3 pt-3 pb-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <Eye className="w-3 h-3" /> Intelligence
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading && !intelState ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Influence summary */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span>Total Spendable: <span className="text-cyan-400 font-mono font-semibold">{totalSpendable}</span></span>
            {Object.entries(regionPools).filter(([, v]) => v > 0).map(([r, v]) => (
              <span key={r} className="text-[10px]">
                {r.replace(/_/g, ' ')}: <span className="text-foreground font-mono">{v}</span>
              </span>
            ))}
          </div>

          {/* Intelligence Actions */}
          <div className="rounded border border-cyan-500/30 bg-cyan-500/5">
            <button
              onClick={() => setActionsExpanded(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="font-display text-xs tracking-wider uppercase font-semibold text-cyan-400 flex items-center gap-1.5">
                🔭 Intel Actions
              </span>
              {actionsExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>

            {actionsExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {INTELLIGENCE_ACTIONS.map(action => {
                  if (activeAction === action.action_id) {
                    return (
                      <IntelligenceActionForm
                        key={action.action_id}
                        action={action}
                        campaignId={campaignId}
                        actingPlayer={actingPlayer}
                        regionPools={regionPools}
                        mapDef={mapDef}
                        stateById={stateById}
                        onSuccess={handleActionSuccess}
                        onCancel={() => setActiveAction(null)}
                      />
                    );
                  }

                  const canAfford = Object.values(regionPools).some(amt => amt >= action.cost);

                  return (
                    <div key={action.action_id}
                      className={`flex items-start justify-between gap-2 px-2 py-2 rounded border border-border bg-muted/10`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{action.icon}</span>
                          <p className="text-xs font-semibold text-foreground">{action.name}</p>
                          <span className="text-[10px] text-cyan-400 font-mono">{action.cost} inf</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{action.description}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          Reveals: {action.reveals?.join(' · ')}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveAction(action.action_id)}
                        disabled={!canAfford}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded border border-cyan-500/40 text-cyan-400 text-[10px] font-display tracking-wider uppercase hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <Eye className="w-2.5 h-2.5" /> Scout
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reports */}
          <div className="rounded border border-border bg-muted/5">
            <button
              onClick={() => setReportsExpanded(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="font-display text-xs tracking-wider uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                📋 Intel Reports ({reports.length})
              </span>
              {reportsExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>

            {reportsExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {reports.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">
                    No intelligence reports yet. Use an Intel Action to gather information.
                  </p>
                ) : (
                  reports.map(report => (
                    <IntelligenceReportCard
                      key={report.id}
                      report={report}
                      players={players}
                      mapDef={mapDef}
                      expanded={expandedReportId === report.id}
                      onToggle={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}