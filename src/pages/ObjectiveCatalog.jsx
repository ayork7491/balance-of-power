/**
 * ObjectiveCatalog — Sprint 4J admin/debug view of all objective definitions.
 * Shows category, tier, reward, automation level, placement rule, and description.
 * Includes a "Seed to Database" button for populating SecretObjectiveCard records.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Filter, Database, CheckCircle2, Loader2 } from 'lucide-react';
import {
  OBJECTIVE_CATALOG,
  OBJECTIVE_CATEGORY_CONFIG,
  OBJECTIVES_BY_CATEGORY,
  CATEGORY_ORDER,
  OBJECTIVE_TIER_REWARDS,
  TIER_LABELS,
  AUTOMATION_LEVEL_CONFIG,
} from '@/config/objectiveDefinitions';
import { base44 } from '@/api/base44Client';

// ── Sub-components ────────────────────────────────────────────────────────────

function TierBadge({ tier }) {
  const colors = {
    1: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    2: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    3: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    4: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold ${colors[tier] ?? colors[1]}`}>
      T{TIER_LABELS[tier]}
    </span>
  );
}

function AutoBadge({ level }) {
  const cfg = AUTOMATION_LEVEL_CONFIG[level] ?? AUTOMATION_LEVEL_CONFIG.manual;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}

function PlacementBadge({ rule }) {
  const labels = {
    captured_territory: 'Captured',
    structure_territory: 'Structure',
    primary_contributing_territory: 'Primary',
    chosen_territory: 'Player Choice',
    affected_region: 'Affected Region',
  };
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted/40 text-muted-foreground border-border">
      📍 {labels[rule] ?? rule}
    </span>
  );
}

function ObjectiveRow({ obj }) {
  const catCfg = OBJECTIVE_CATEGORY_CONFIG[obj.category] ?? OBJECTIVE_CATEGORY_CONFIG.military;
  const reward = OBJECTIVE_TIER_REWARDS[obj.tier] ?? 3;

  return (
    <div className={`rounded border p-3 ${catCfg.bg} ${catCfg.border} space-y-1.5`}>
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-base shrink-0">{catCfg.icon}</span>
          <div className="min-w-0">
            <p className={`text-sm font-display font-semibold tracking-wide ${catCfg.color} truncate`}>
              {obj.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{obj.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
          <div className="flex items-center gap-1">
            <TierBadge tier={obj.tier} />
          </div>
          <span className="text-[11px] text-primary font-mono font-bold">+{reward} inf</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 pt-0.5">
        <AutoBadge level={obj.automation_level} />
        <PlacementBadge rule={obj.placement_rule} />
        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted/20 text-muted-foreground border-border font-mono">
          {obj.card_id}
        </span>
      </div>
    </div>
  );
}

function CategorySection({ category, objectives, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const catCfg = OBJECTIVE_CATEGORY_CONFIG[category];

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-panel-header hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{catCfg.icon}</span>
          <span className={`font-display font-semibold tracking-wider text-sm ${catCfg.color}`}>
            {catCfg.label}
          </span>
          <span className="text-xs text-muted-foreground">({objectives.length})</span>
        </div>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-panel-bg">
          {objectives.map(obj => (
            <ObjectiveRow key={obj.card_id} obj={obj} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function CatalogStats({ filtered }) {
  const byAuto = filtered.reduce((acc, o) => {
    acc[o.automation_level] = (acc[o.automation_level] ?? 0) + 1;
    return acc;
  }, {});
  const byTier = filtered.reduce((acc, o) => {
    acc[o.tier] = (acc[o.tier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span>Total: <span className="text-foreground font-mono">{filtered.length}</span></span>
      {['automatic', 'assisted', 'manual'].map(lvl => (
        <span key={lvl}>
          <span className={AUTOMATION_LEVEL_CONFIG[lvl].color}>{AUTOMATION_LEVEL_CONFIG[lvl].label}</span>:{' '}
          <span className="text-foreground font-mono">{byAuto[lvl] ?? 0}</span>
        </span>
      ))}
      {[1, 2, 3, 4].map(t => (
        <span key={t}>T{TIER_LABELS[t]}: <span className="text-foreground font-mono">{byTier[t] ?? 0}</span></span>
      ))}
    </div>
  );
}

// ── Seed tool ─────────────────────────────────────────────────────────────────

function SeedTool({ campaignId }) {
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const handleSeed = async () => {
    if (!campaignId) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await base44.functions.invoke('objectivePhase', {
        action: 'seedCatalog',
        campaign_id: campaignId,
        catalog: OBJECTIVE_CATALOG,
      });
      setSeedResult({ success: true, message: res.data?.message ?? 'Seeded successfully.' });
    } catch (err) {
      setSeedResult({ success: false, message: err?.response?.data?.error ?? 'Seed failed.' });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        type="text"
        placeholder="Campaign ID (required)"
        value={campaignId ?? ''}
        readOnly
        className="text-xs px-2 py-1.5 rounded border border-border bg-input text-muted-foreground font-mono w-56"
      />
      <button
        onClick={handleSeed}
        disabled={seeding || !campaignId}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
      >
        {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
        Seed to Database
      </button>
      {seedResult && (
        <span className={`text-xs flex items-center gap-1 ${seedResult.success ? 'text-green-400' : 'text-destructive'}`}>
          {seedResult.success && <CheckCircle2 className="w-3 h-3" />}
          {seedResult.message}
        </span>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ObjectiveCatalog() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [filterAuto, setFilterAuto] = useState('all');
  const [seedCampaignId, setSeedCampaignId] = useState('');

  // Filter logic
  const filtered = OBJECTIVE_CATALOG.filter(obj => {
    if (filterCategory !== 'all' && obj.category !== filterCategory) return false;
    if (filterTier !== 'all' && String(obj.tier) !== filterTier) return false;
    if (filterAuto !== 'all' && obj.automation_level !== filterAuto) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        obj.title.toLowerCase().includes(q) ||
        obj.description.toLowerCase().includes(q) ||
        obj.card_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group filtered by category for display
  const filteredByCategory = {};
  for (const obj of filtered) {
    if (!filteredByCategory[obj.category]) filteredByCategory[obj.category] = [];
    filteredByCategory[obj.category].push(obj);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-panel-header border-b border-border px-4 py-2.5 flex items-center gap-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display text-sm font-bold tracking-widest uppercase text-foreground">
          Objective Catalog
        </h1>
        <span className="text-xs text-muted-foreground font-mono">Sprint 4J</span>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {OBJECTIVE_CATALOG.length} objectives
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* Filters */}
        <div className="panel p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search objectives…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded border border-border bg-input text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
              >
                <option value="all">All Categories</option>
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>{OBJECTIVE_CATEGORY_CONFIG[cat].label}</option>
                ))}
              </select>

              <select
                value={filterTier}
                onChange={e => setFilterTier(e.target.value)}
                className="text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
              >
                <option value="all">All Tiers</option>
                {[1, 2, 3, 4].map(t => (
                  <option key={t} value={String(t)}>Tier {TIER_LABELS[t]} (+{OBJECTIVE_TIER_REWARDS[t]})</option>
                ))}
              </select>

              <select
                value={filterAuto}
                onChange={e => setFilterAuto(e.target.value)}
                className="text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground"
              >
                <option value="all">All Automation</option>
                <option value="automatic">Automatic</option>
                <option value="assisted">Assisted</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <CatalogStats filtered={filtered} />
        </div>

        {/* Seed tool */}
        <div className="panel p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">
            Seed to Campaign
          </p>
          <p className="text-xs text-muted-foreground">
            Populate the SecretObjectiveCard database with all catalog entries. Idempotent — safe to run multiple times.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Paste Campaign ID…"
              value={seedCampaignId}
              onChange={e => setSeedCampaignId(e.target.value)}
              className="text-xs px-2 py-1.5 rounded border border-border bg-input text-foreground font-mono w-72 placeholder:text-muted-foreground"
            />
            <SeedTool campaignId={seedCampaignId} />
          </div>
        </div>

        {/* Catalog */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No objectives match your filters.</div>
        ) : (
          <div className="space-y-3">
            {CATEGORY_ORDER
              .filter(cat => filteredByCategory[cat]?.length > 0)
              .map((cat, i) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  objectives={filteredByCategory[cat]}
                  defaultOpen={i === 0}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}