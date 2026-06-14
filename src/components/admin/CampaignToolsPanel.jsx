/**
 * CampaignToolsPanel — Admin utility for calling seeding/init functions on an existing campaign.
 * Shown in AdminTestMode page. Allows:
 *   - initDevelopment: create TerritoryDevelopment records for all owned territories
 *   - generateAll: generate one round of resources into territory storage
 */
import { useState } from 'react';
import { Loader2, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function ToolButton({ label, description, onRun, loading, result, error }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 bg-primary/10 text-primary text-[10px] font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Run
        </button>
      </div>
      {result && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border border-green-500/30 bg-green-500/10 text-[10px] text-green-400">
          <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
          <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}

export default function CampaignToolsPanel({ campaign }) {
  const [loadingInit, setLoadingInit] = useState(false);
  const [resultInit, setResultInit] = useState(null);
  const [errorInit, setErrorInit] = useState(null);

  const [loadingGen, setLoadingGen] = useState(false);
  const [resultGen, setResultGen] = useState(null);
  const [errorGen, setErrorGen] = useState(null);

  const [loadingInfluence, setLoadingInfluence] = useState(false);
  const [resultInfluence, setResultInfluence] = useState(null);
  const [errorInfluence, setErrorInfluence] = useState(null);

  const handleInitDev = async () => {
    setLoadingInit(true);
    setResultInit(null);
    setErrorInit(null);
    try {
      const res = await base44.functions.invoke('territoryDevelopment', {
        action: 'initDevelopment',
        campaign_id: campaign.id,
      });
      setResultInit(res.data);
    } catch (e) {
      setErrorInit(e?.response?.data?.error ?? 'Failed');
    } finally {
      setLoadingInit(false);
    }
  };

  const handleGenerateAll = async () => {
    setLoadingGen(true);
    setResultGen(null);
    setErrorGen(null);
    try {
      const res = await base44.functions.invoke('resourcePhase', {
        action: 'generateAll',
        campaign_id: campaign.id,
      });
      setResultGen(res.data);
    } catch (e) {
      setErrorGen(e?.response?.data?.error ?? 'Failed');
    } finally {
      setLoadingGen(false);
    }
  };

  const handleSeedInfluence = async () => {
    setLoadingInfluence(true);
    setResultInfluence(null);
    setErrorInfluence(null);
    try {
      const res = await base44.functions.invoke('planningPhase', {
        action: 'seedStartingInfluence',
        campaign_id: campaign.id,
      });
      setResultInfluence(res.data);
    } catch (e) {
      setErrorInfluence(e?.response?.data?.error ?? 'Failed');
    } finally {
      setLoadingInfluence(false);
    }
  };

  if (!campaign) return null;

  return (
    <div className="space-y-4">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground">
          Campaign Seeding Tools
        </h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Idempotent — safe to run multiple times.</p>
      </div>

      <ToolButton
        label="Init Territory Development"
        description="Create TerritoryDevelopment records for all owned territories. Run once after initial deploy."
        onRun={handleInitDev}
        loading={loadingInit}
        result={resultInit}
        error={errorInit}
      />

      <div className="border-t border-border/50" />

      <ToolButton
        label="Generate Resources (All Players)"
        description="Run one round of resource generation into territory storage for all players."
        onRun={handleGenerateAll}
        loading={loadingGen}
        result={resultGen}
        error={errorGen}
      />

      <div className="border-t border-border/50" />

      <ToolButton
        label="Seed Starting Influence"
        description="Grant 1 permanent + 1 spendable influence per starting territory for all players."
        onRun={handleSeedInfluence}
        loading={loadingInfluence}
        result={resultInfluence}
        error={errorInfluence}
      />
    </div>
  );
}