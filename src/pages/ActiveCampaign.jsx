/**
 * ActiveCampaign — primary gameplay screen.
 * Wires the schema-driven MapRenderer with live TerritoryState,
 * CampaignPlayer data, territory selection, and detail panel.
 */
import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import CampaignLayout from '@/components/layout/CampaignLayout';
import MapRenderer from '@/components/map/MapRenderer';
import TerritoryDetailPanel from '@/components/map/TerritoryDetailPanel';
import RegionLegend from '@/components/map/RegionLegend';
import { useCampaign } from '@/features/campaigns';
import { useTerritoryState, getMap, buildAdjacencyMap } from '@/features/maps';

// ── Placeholder dock panels (to be replaced in future prompts) ────────────────

function PhasePanelPlaceholder({ campaign }) {
  const phase = campaign?.current_phase ?? 'deploy';
  const round = campaign?.current_round ?? 1;
  return (
    <div className="p-4 space-y-3">
      <div className="panel-header -mx-4 -mt-4 px-4 pt-3 pb-2 mb-4">
        <p className="font-display text-xs tracking-widest uppercase text-status-pending capitalize">
          Round {round} — {phase} Phase
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Phase action panel — deploy, attack, fortify controls will appear here.</p>
      <div className="space-y-2 pt-2">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-16 bg-muted/50 rounded animate-pulse" />
      </div>
      <button disabled className="w-full mt-4 px-4 py-2 rounded border border-primary/30 text-primary/40 text-xs font-display tracking-wider uppercase cursor-not-allowed">
        Lock Decisions
      </button>
    </div>
  );
}

function InfoPanelPlaceholder({ activeTab }) {
  const content = {
    leaderboard:  { label: 'Standings',   desc: 'Player rankings, territory counts, troop totals.' },
    territories:  { label: 'Territories', desc: 'Full territory list sortable by owner, troops, region.' },
    history:      { label: 'History',     desc: 'Phase snapshots, decision logs, battle history.' },
    battles:      { label: 'Battles',     desc: 'Active battle cards, pending approvals, results.' },
  };
  const info = content[activeTab] ?? content.leaderboard;
  return (
    <div className="p-4">
      <p className="font-display text-xs tracking-widest uppercase text-muted-foreground mb-2">{info.label}</p>
      <p className="text-xs text-muted-foreground">{info.desc}</p>
      <div className="space-y-2 mt-4">
        {[1,2,3].map(i => <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />)}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ActiveCampaign() {
  const { id } = useParams();
  const [activeTab, setActiveTab]  = useState('map');
  const [selectedId, setSelectedId] = useState(null);

  // Campaign + players (real data)
  const { campaign, players, loading: loadingCampaign } = useCampaign(id);

  // Territory state (real data, real-time)
  const mapId = campaign?.map_id ?? 'map_v1_standard';
  const { stateById, loading: loadingState } = useTerritoryState(id);

  // Static map definition (schema)
  const mapDef = useMemo(() => getMap(mapId), [mapId]);

  // Adjacency map for detail panel
  const adjacencyMap = useMemo(
    () => mapDef ? buildAdjacencyMap(mapDef) : {},
    [mapDef]
  );

  // Selected territory details
  const selectedTerritory = useMemo(
    () => mapDef?.territories.find(t => t.territory_id === selectedId) ?? null,
    [mapDef, selectedId]
  );
  const selectedTState    = selectedId ? (stateById[selectedId] ?? null) : null;
  const selectedRegion    = selectedTerritory
    ? (mapDef?.regions.find(r => r.id === selectedTerritory.region_id) ?? null)
    : null;
  const selectedContinent = selectedTerritory
    ? (mapDef?.continents.find(c => c.id === selectedTerritory.continent_id) ?? null)
    : null;
  const adjacentTerritories = useMemo(() => {
    if (!selectedId || !mapDef) return [];
    const ids = adjacencyMap[selectedId] ?? new Set();
    return mapDef.territories.filter(t => ids.has(t.territory_id));
  }, [selectedId, mapDef, adjacencyMap]);

  // Fallback campaign data while loading
  const displayCampaign = campaign ?? { name: 'Loading…', current_round: 0, current_phase: 'deploy', phase_deadline: null };

  return (
    <CampaignLayout
      campaign={displayCampaign}
      leftDockContent={<PhasePanelPlaceholder campaign={campaign} />}
      rightDockContent={<InfoPanelPlaceholder activeTab={activeTab} />}
      defaultTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Map area */}
      {mapDef && (
        <>
          <MapRenderer
            mapDef={mapDef}
            stateById={stateById}
            players={players}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <RegionLegend regions={mapDef.regions} />

          <TerritoryDetailPanel
            territory={selectedTerritory}
            tState={selectedTState}
            players={players}
            regionDef={selectedRegion}
            continentDef={selectedContinent}
            adjacentTerritories={adjacentTerritories}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}

      {/* Loading overlay */}
      {(loadingCampaign || loadingState) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-30">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading campaign…
          </div>
        </div>
      )}
    </CampaignLayout>
  );
}