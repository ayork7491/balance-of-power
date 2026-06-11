/**
 * PhaseAuditExport — Sprint 5F
 *
 * Admin-only Phase Audit Bundle export control.
 * Rendered inside the Admin tab across all phases.
 *
 * Features:
 *   - Round + phase selectors (default: current round/phase)
 *   - Generate bundle button
 *   - Download link after generation
 *   - Error display
 */
import { useState } from 'react';
import { Download, FileJson, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ALL_PHASES = [
  { value: 'deploy',            label: 'Planning (Deploy)' },
  { value: 'attack',           label: 'Operations (Attack)' },
  { value: 'battle',           label: 'Conflict (Battle)' },
  { value: 'fortify',          label: 'Consolidation (Fortify)' },
  { value: 'faction_selection',label: 'Faction Selection' },
  { value: 'territory_draft',  label: 'Territory Draft' },
  { value: 'initial_deploy',   label: 'Initial Deploy' },
];

const PHASE_SHORT = {
  deploy: 'planning',
  attack: 'operations',
  battle: 'conflict',
  fortify: 'consolidation',
  faction_selection: 'faction_selection',
  territory_draft: 'territory_draft',
  initial_deploy: 'initial_deploy',
};

export default function PhaseAuditExport({ campaign }) {
  const currentRound = campaign?.current_round ?? 1;
  const currentPhase = campaign?.current_phase ?? 'deploy';

  const [round, setRound] = useState(currentRound);
  const [phase, setPhase] = useState(currentPhase);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [filename, setFilename] = useState(null);
  const [warnings, setWarnings] = useState(0);
  const [bundleStatus, setBundleStatus] = useState(null);

  const maxRound = currentRound;

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setDownloadUrl(null);
    setFilename(null);

    try {
      const res = await base44.functions.invoke('exportPhaseAudit', {
        action: 'generateBundle',
        campaign_id: campaign.id,
        round: Number(round),
        phase,
      });

      const bundle = res.data?.bundle;
      if (!bundle) throw new Error('No bundle returned from server.');

      const phaseLabel = PHASE_SHORT[phase] ?? phase;
      const fname = `bop_phase_audit_round_${round}_${phaseLabel}.json`;

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);

      setDownloadUrl(url);
      setFilename(fname);
      setWarnings(bundle.validation_warnings?.length ?? 0);
      setBundleStatus(bundle.metadata?.bundle_status ?? 'completed');
    } catch (e) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  const isCurrentPhase = Number(round) === currentRound && phase === currentPhase;

  // Build round options
  const roundOptions = [];
  for (let r = 1; r <= maxRound; r++) roundOptions.push(r);

  return (
    <div className="rounded border border-border bg-muted/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/10 border-b border-border">
        <FileJson className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="font-display text-[10px] tracking-widest uppercase text-accent">
          Export Phase Audit Bundle
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-display tracking-wider uppercase">Round</label>
            <select
              value={round}
              onChange={e => { setRound(e.target.value); setDownloadUrl(null); }}
              className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
            >
              {roundOptions.map(r => (
                <option key={r} value={r}>Round {r}{r === currentRound ? ' (current)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-display tracking-wider uppercase">Phase</label>
            <select
              value={phase}
              onChange={e => { setPhase(e.target.value); setDownloadUrl(null); }}
              className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
            >
              {ALL_PHASES.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}{p.value === currentPhase && Number(round) === currentRound ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* In-progress hint */}
        {isCurrentPhase && (
          <p className="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            Active phase — bundle will be marked <span className="font-mono">in_progress</span>; after-snapshot reflects live state.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-2 py-2 rounded border border-destructive/40 bg-destructive/10 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-accent/40 bg-accent/10 text-accent text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
            : <><FileJson className="w-3.5 h-3.5" /> Generate Bundle</>
          }
        </button>

        {/* Download link */}
        {downloadUrl && filename && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-2 rounded border border-green-500/30 bg-green-500/10 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">
                Bundle ready
                {bundleStatus === 'in_progress' && <span className="ml-1 text-amber-400">(in progress)</span>}
              </span>
              {warnings > 0 && (
                <span className="text-amber-400 font-mono">{warnings} warning{warnings !== 1 ? 's' : ''}</span>
              )}
            </div>

            <a
              href={downloadUrl}
              download={filename}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              {filename}
            </a>

            <p className="text-[10px] text-muted-foreground text-center">
              JSON · Round {round} · {ALL_PHASES.find(p => p.value === phase)?.label ?? phase}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}