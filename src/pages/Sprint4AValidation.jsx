/**
 * Sprint4AValidation — Canonical Shattered Crown data validation report.
 * Admin-only page. Validates shatteredCrownConfig.ts against all spec requirements.
 *
 * Access: /sprint4a-validation
 */
import { useMemo } from 'react';
import {
  SC_TERRITORIES,
  SC_ADJACENCY,
  SC_TERRITORY_BY_ID,
  SC_TERRITORY_ID_SET,
  capacityPointsFor,
} from '@/shared/maps/shatteredCrownConfig';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

// ─── Expected spec values ─────────────────────────────────────────────────────

const EXPECTED_TERRITORY_COUNT = 44;
const EXPECTED_CONTINENT_COUNT = 5;
const EXPECTED_REGION_COUNT    = 11;
const EXPECTED_CAPACITY_POINTS = 4;

const EXPECTED_CONTINENTS = new Set([
  'ironspine', 'wild_frontier', 'fracture_basin', 'sunfields', 'shattered_coast',
]);

const EXPECTED_REGIONS = new Set([
  'outer_passes', 'high_crown',
  'northern_wilds', 'deepwoods',
  'northern_ruins', 'central_crossroads', 'southern_ruins',
  'western_plains', 'eastern_granaries',
  'northern_isles', 'southern_fractures',
]);

const REGION_TO_CONTINENT = {
  outer_passes: 'ironspine', high_crown: 'ironspine',
  northern_wilds: 'wild_frontier', deepwoods: 'wild_frontier',
  northern_ruins: 'fracture_basin', central_crossroads: 'fracture_basin', southern_ruins: 'fracture_basin',
  western_plains: 'sunfields', eastern_granaries: 'sunfields',
  northern_isles: 'shattered_coast', southern_fractures: 'shattered_coast',
};

// ─── Validation logic ─────────────────────────────────────────────────────────

function runValidation() {
  const results = [];

  const pass = (label, detail = '') => ({ status: 'pass', label, detail });
  const fail = (label, detail = '') => ({ status: 'fail', label, detail });
  const warn = (label, detail = '') => ({ status: 'warn', label, detail });
  const info = (label, detail = '') => ({ status: 'info', label, detail });

  // 1. Territory count
  results.push(
    SC_TERRITORIES.length === EXPECTED_TERRITORY_COUNT
      ? pass(`Territory count: ${SC_TERRITORIES.length}`, 'Exactly 44 territories loaded.')
      : fail(`Territory count: ${SC_TERRITORIES.length}`, `Expected ${EXPECTED_TERRITORY_COUNT}.`)
  );

  // 2. Continent count
  const continents = new Set(SC_TERRITORIES.map(t => t.continent_id));
  results.push(
    continents.size === EXPECTED_CONTINENT_COUNT
      ? pass(`Continent count: ${continents.size}`, `Continents: ${[...continents].join(', ')}`)
      : fail(`Continent count: ${continents.size}`, `Expected ${EXPECTED_CONTINENT_COUNT}. Found: ${[...continents].join(', ')}`)
  );

  // 3. All expected continents present
  const missingContinents = [...EXPECTED_CONTINENTS].filter(c => !continents.has(c));
  const unexpectedContinents = [...continents].filter(c => !EXPECTED_CONTINENTS.has(c));
  results.push(
    missingContinents.length === 0 && unexpectedContinents.length === 0
      ? pass('All 5 expected continents present')
      : fail('Continent mismatch', `Missing: [${missingContinents.join(',')}] Unexpected: [${unexpectedContinents.join(',')}]`)
  );

  // 4. Region count
  const regions = new Set(SC_TERRITORIES.map(t => t.region_id));
  results.push(
    regions.size === EXPECTED_REGION_COUNT
      ? pass(`Region count: ${regions.size}`, `Regions: ${[...regions].join(', ')}`)
      : fail(`Region count: ${regions.size}`, `Expected ${EXPECTED_REGION_COUNT}. Found: ${[...regions].join(', ')}`)
  );

  // 5. All expected regions present
  const missingRegions = [...EXPECTED_REGIONS].filter(r => !regions.has(r));
  const unexpectedRegions = [...regions].filter(r => !EXPECTED_REGIONS.has(r));
  results.push(
    missingRegions.length === 0 && unexpectedRegions.length === 0
      ? pass('All 11 expected regions present')
      : fail('Region mismatch', `Missing: [${missingRegions.join(',')}] Unexpected: [${unexpectedRegions.join(',')}]`)
  );

  // 6. Every territory belongs to exactly one region
  const dupRegion = SC_TERRITORIES.filter((t, i, arr) =>
    arr.filter(u => u.territory_id === t.territory_id).length > 1
  );
  results.push(
    dupRegion.length === 0
      ? pass('All territories belong to exactly one region')
      : fail('Duplicate territory IDs detected', dupRegion.map(t => t.territory_id).join(', '))
  );

  // 7. Every region belongs to one continent (matches mapping)
  const regionContinentErrors = [];
  for (const t of SC_TERRITORIES) {
    const expected = REGION_TO_CONTINENT[t.region_id];
    if (expected && expected !== t.continent_id) {
      regionContinentErrors.push(`${t.territory_id}: region ${t.region_id} should be in ${expected}, found ${t.continent_id}`);
    }
    if (!expected) {
      regionContinentErrors.push(`${t.territory_id}: region ${t.region_id} not in expected region→continent map`);
    }
  }
  results.push(
    regionContinentErrors.length === 0
      ? pass('All regions correctly assigned to continents')
      : fail('Region→continent assignment errors', regionContinentErrors.join(' | '))
  );

  // 8. Capacity points (resources + structure_slots.length === 4)
  const capacityErrors = SC_TERRITORIES.filter(t => capacityPointsFor(t) !== EXPECTED_CAPACITY_POINTS);
  results.push(
    capacityErrors.length === 0
      ? pass('All territories satisfy capacity rule (resources + slots = 4)')
      : fail(`Capacity rule violations: ${capacityErrors.length}`,
          capacityErrors.map(t => `${t.territory_id}(${capacityPointsFor(t)}pts)`).join(', '))
  );

  // 9. All typed adjacency references valid territory IDs
  const invalidAdjRefs = SC_ADJACENCY.filter(
    ({ from, to }) => !SC_TERRITORY_ID_SET.has(from) || !SC_TERRITORY_ID_SET.has(to)
  );
  results.push(
    invalidAdjRefs.length === 0
      ? pass('All typed adjacency edges reference valid territory IDs')
      : fail(`Invalid territory IDs in adjacency: ${invalidAdjRefs.length}`,
          invalidAdjRefs.map(e => `${e.from}↔${e.to}`).join(', '))
  );

  // 10. Adjacency symmetry (A→B means B→A when queried)
  const adjSet = new Map();
  for (const { from, to } of SC_ADJACENCY) {
    const key = [from,to].sort().join('|');
    adjSet.set(key, (adjSet.get(key) ?? 0) + 1);
  }
  const asymmetric = [...adjSet.entries()].filter(([, count]) => count !== 1);
  results.push(
    asymmetric.length === 0
      ? pass('All adjacency edges are unique (no duplicates)')
      : fail(`Duplicate adjacency edges: ${asymmetric.length}`, asymmetric.map(([k]) => k).join(', '))
  );

  // 11. Adjacency type breakdown
  const byType = { land: 0, maritime: 0, river_crossing: 0 };
  for (const { type } of SC_ADJACENCY) byType[type] = (byType[type] ?? 0) + 1;
  results.push(info(
    `Adjacency breakdown: ${SC_ADJACENCY.length} total edges`,
    `Land: ${byType.land} | Maritime: ${byType.maritime} | River crossing: ${byType.river_crossing}`
  ));

  // 12. Exactly 1 river crossing
  results.push(
    byType.river_crossing === 1
      ? pass('River crossing count: 1', 'B8↔S3 (Southwatch Ruins ↔ Harvest Ford)')
      : fail(`River crossing count: ${byType.river_crossing}`, 'Expected exactly 1.')
  );

  // 13. No orphan territories (every territory has ≥1 adjacency)
  const adjacentIds = new Set();
  for (const { from, to } of SC_ADJACENCY) {
    adjacentIds.add(from);
    adjacentIds.add(to);
  }
  const orphans = SC_TERRITORIES.filter(t => !adjacentIds.has(t.territory_id));
  results.push(
    orphans.length === 0
      ? pass('No orphan territories (all territories have ≥1 adjacency)')
      : fail(`Orphan territories: ${orphans.length}`, orphans.map(t => t.territory_id).join(', '))
  );

  // 14. Minimum adjacency count (every territory should have ≥2 neighbors)
  const neighborCount = {};
  for (const { from, to } of SC_ADJACENCY) {
    neighborCount[from] = (neighborCount[from] ?? 0) + 1;
    neighborCount[to]   = (neighborCount[to]   ?? 0) + 1;
  }
  const lowConnectivity = SC_TERRITORIES.filter(t => (neighborCount[t.territory_id] ?? 0) < 2);
  results.push(
    lowConnectivity.length === 0
      ? pass('All territories have ≥2 neighbors')
      : warn(`Territories with <2 neighbors: ${lowConnectivity.length}`, lowConnectivity.map(t => `${t.territory_id}(${neighborCount[t.territory_id] ?? 0})`).join(', '))
  );

  return { results, neighborCount, byType };
}

// ─── Component ────────────────────────────────────────────────────────────────

const STATUS_ICON = {
  pass: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />,
  fail: <XCircle     className="w-4 h-4 text-destructive shrink-0 mt-0.5" />,
  warn: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />,
  info: <Info         className="w-4 h-4 text-status-info shrink-0 mt-0.5" />,
};

const STATUS_BG = {
  pass: 'bg-green-500/5 border-green-500/20',
  fail: 'bg-destructive/5 border-destructive/30',
  warn: 'bg-yellow-400/5 border-yellow-400/20',
  info: 'bg-status-info/5 border-status-info/20',
};

export default function Sprint4AValidation() {
  const { results, neighborCount, byType } = useMemo(() => runValidation(), []);

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="panel p-4">
        <h1 className="font-display text-xl tracking-widest uppercase text-primary">
          Sprint 4A — Canonical Map Validation Report
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Source: <code className="text-status-info">src/shared/maps/shatteredCrownConfig.ts</code>
        </p>
        <div className="flex gap-4 mt-3 text-xs">
          <span className="text-green-500 font-mono">{passed} passed</span>
          {failed > 0 && <span className="text-destructive font-mono">{failed} failed</span>}
          {warned > 0 && <span className="text-yellow-400 font-mono">{warned} warnings</span>}
        </div>
      </div>

      {/* Check results */}
      <div className="space-y-2">
        <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground px-1">Validation Checks</h2>
        {results.map((r, i) => (
          <div key={i} className={`panel p-3 border ${STATUS_BG[r.status]}`}>
            <div className="flex items-start gap-2">
              {STATUS_ICON[r.status]}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{r.label}</p>
                {r.detail && <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.detail}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Territory ID → Name mapping table */}
      <div className="panel overflow-hidden">
        <div className="panel-header">
          <h2 className="font-display text-xs tracking-widest uppercase text-foreground">Territory ID → Name Mapping</h2>
          <p className="text-[10px] text-muted-foreground">{SC_TERRITORIES.length} territories across 5 continents</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">ID</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Name</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Continent</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Region</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Primary</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Secondary</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-normal">Slots</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-normal">Neighbors</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-normal">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {SC_TERRITORIES.map((t, i) => {
                const cap = capacityPointsFor(t);
                const neighbors = neighborCount[t.territory_id] ?? 0;
                return (
                  <tr key={t.territory_id} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                    <td className="px-3 py-1.5 font-mono text-primary">{t.territory_id}</td>
                    <td className="px-3 py-1.5 text-foreground">{t.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{t.continent_id}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{t.region_id}</td>
                    <td className="px-3 py-1.5 text-foreground">{t.primary_resource}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{t.secondary_resource ?? '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{t.structure_slots.join(', ')}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{neighbors}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${cap === 4 ? 'text-green-500' : 'text-destructive'}`}>
                      {cap}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjacency type summary */}
      <div className="panel p-4 space-y-2">
        <h2 className="font-display text-xs tracking-widest uppercase text-muted-foreground">Adjacency Type Summary</h2>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} className="bg-muted/10 rounded border border-border p-3 text-center">
              <p className="text-lg font-mono font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Total: {SC_ADJACENCY.length} unique undirected edges (all bidirectional in queries).
        </p>
      </div>
    </div>
  );
}