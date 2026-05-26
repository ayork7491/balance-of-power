/**
 * ActiveCampaign — primary gameplay screen.
 *
 * Phase routing:
 *   faction_selection → FactionSelectionPanel (left) + SetupInfoPanel (right)
 *   territory_draft   → TerritoryDraftPanel (left) + SetupInfoPanel (right)
 *   initial_deploy    → InitialDeployPanel (left) + SetupInfoPanel (right)
 *   deploy/attack/… → Placeholder panels (future implementation)
 *
 * Map is always visible. Left dock changes based on current phase.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import CampaignLayout from '@/components/layout/CampaignLayout';
import MapRenderer from '@/components/map/MapRenderer';
import TerritoryDetailPanel from '@/components/map/TerritoryDetailPanel';
import RegionLegend from '@/components/map/RegionLegend';

// Setup phase panels
import FactionSelectionPanel from '@/components/setup/FactionSelectionPanel';
import TerritoryDraftPanel from '@/components/setup/TerritoryDraftPanel';
import InitialDeployPanel from '@/components/setup/InitialDeployPanel';
import SetupInfoPanel from '@/components/setup/SetupInfoPanel';

// Gameplay phase panels
import DeployPanel from '@/components/phases/deploy/DeployPanel';
import DeployInfoPanel from '@/components/phases/deploy/DeployInfoPanel';
import AttackPanel from '@/components/phases/attack/AttackPanel';
import AttackInfoPanel from '@/components/phases/attack/AttackInfoPanel';
import AttackArrowLayer from '@/components/phases/attack/AttackArrowLayer';
import BattlePanel from '@/components/phases/battle/BattlePanel';
import BattleInfoPanel from '@/components/phases/battle/BattleInfoPanel';
import FortifyPanel from '@/components/phases/fortify/FortifyPanel';
import FortifyInfoPanel from '@/components/phases/fortify/FortifyInfoPanel';
import { useAttackReveals, useAttackPhase } from '@/features/campaigns/attack';

import { useCampaign } from '@/features/campaigns';
import { useTerritoryState, getMap, buildAdjacencyMap } from '@/features/maps';
import { base44 } from '@/api/base44Client';

// ── Placeholder panels (for post-setup phases) ────────────────────────────────

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
      <p className="text-xs text-muted-foreground">Phase controls will appear here.</p>
      <div className="space-y-2 pt-2">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-16 bg-muted/50 rounded animate-pulse" />
      </div>
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
        {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />)}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SETUP_PHASES = new Set(['faction_selection', 'territory_draft', 'initial_deploy']);

export default function ActiveCampaign() {
  const { id } = useParams();
  const [activeTab, setActiveTab]   = useState('map');
  const [selectedId, setSelectedId] = useState(null);
  const [myPlayerId, setMyPlayerId]   = useState(null);
  const [gameProfile, setGameProfile] = useState(null);

  // Campaign + players
  const { campaign, players, loading: loadingCampaign, reload: reloadCampaign } = useCampaign(id);

  // Territory state (real-time)
  const mapId = campaign?.map_id ?? 'map_v1_standard';
  const { stateById, loading: loadingState, reload: reloadState } = useTerritoryState(id);

  // Static map definition
  const mapDef = useMemo(() => getMap(mapId), [mapId]);

  // Adjacency map
  const adjacencyMap = useMemo(
    () => mapDef ? buildAdjacencyMap(mapDef) : {},
    [mapDef]
  );

  // Resolve current user's player record
  useEffect(() => {
    base44.auth.me().then(u => setMyPlayerId(u?.id));
  }, []);

  const myPlayer = useMemo(
    () => myPlayerId ? players.find(p => p.user_id === myPlayerId) ?? null : null,
    [players, myPlayerId]
  );

  // Load game profile for faction names
  useEffect(() => {
    if (!campaign?.game_profile_id) return;
    base44.entities.TabletopGameProfile.filter({ id: campaign.game_profile_id })
      .then(r => setGameProfile(r[0] ?? null))
      .catch(() => {});
  }, [campaign?.game_profile_id]);

  // Re-fetch campaign + territory state when a setup action completes
  const handlePhaseChanged = useCallback(() => {
    reloadCampaign();
    reloadState();
  }, [reloadCampaign, reloadState]);

  // Selected territory details
  const selectedTerritory   = useMemo(
    () => mapDef?.territories.find(t => t.territory_id === selectedId) ?? null,
    [mapDef, selectedId]
  );
  const selectedTState      = selectedId ? (stateById[selectedId] ?? null) : null;
  const selectedRegion      = selectedTerritory
    ? (mapDef?.regions.find(r => r.id === selectedTerritory.region_id) ?? null) : null;
  const selectedContinent   = selectedTerritory
    ? (mapDef?.continents.find(c => c.id === selectedTerritory.continent_id) ?? null) : null;
  const adjacentTerritories = useMemo(() => {
    if (!selectedId || !mapDef) return [];
    const ids = adjacencyMap[selectedId] ?? new Set();
    return mapDef.territories.filter(t => ids.has(t.territory_id));
  }, [selectedId, mapDef, adjacencyMap]);

  const phase = campaign?.current_phase;
  const isSetupPhase = SETUP_PHASES.has(phase);

  // ── Panel routing ──────────────────────────────────────────────────────────

  const leftDockContent = useMemo(() => {
    if (!campaign || !myPlayer) return <PhasePanelPlaceholder campaign={campaign} />;

    if (phase === 'faction_selection') {
      return (
        <FactionSelectionPanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          gameProfile={gameProfile}
          onPhaseChanged={handlePhaseChanged}
        />
      );
    }

    if (phase === 'territory_draft') {
      return (
        <TerritoryDraftPanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          stateById={stateById}
          mapDef={mapDef}
          pendingPickId={selectedId}
          onClearPick={() => setSelectedId(null)}
          onPhaseChanged={handlePhaseChanged}
        />
      );
    }

    if (phase === 'initial_deploy') {
      return (
        <InitialDeployPanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          stateById={stateById}
          mapDef={mapDef}
          onPhaseChanged={handlePhaseChanged}
        />
      );
    }

    if (phase === 'deploy') {
      return (
        <DeployPanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          stateById={stateById}
          mapDef={mapDef}
          onPhaseChanged={handlePhaseChanged}
        />
      );
    }

    if (phase === 'attack') {
      return (
        <AttackPanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          stateById={stateById}
          mapDef={mapDef}
          adjacencyMap={adjacencyMap}
          selectedTerritoryId={selectedId}
          onClearSelection={() => setSelectedId(null)}
          onPhaseChanged={handlePhaseChanged}
        />
      );
    }

    if (phase === 'battle') {
      return (
        <BattlePanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          mapDef={mapDef}
          onPhaseChanged={handlePhaseChanged}
        />
      );
    }

    if (phase === 'fortify') {
      return (
        <FortifyPanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          stateById={stateById}
          mapDef={mapDef}
          adjacencyMap={adjacencyMap}
          selectedTerritoryId={selectedId}
          onClearSelection={() => setSelectedId(null)}
          onPhaseChanged={handlePhaseChanged}
        />
      );
    }

    return <PhasePanelPlaceholder campaign={campaign} />;
  }, [campaign, players, myPlayer, gameProfile, phase, stateById, mapDef, selectedId, handlePhaseChanged]);

  const rightDockContent = useMemo(() => {
    if (isSetupPhase) {
      return <SetupInfoPanel campaign={campaign} players={players} />;
    }
    if (phase === 'deploy') {
      return <DeployInfoPanel campaign={campaign} players={players} />;
    }
    if (phase === 'attack') {
      return <AttackInfoPanel campaign={campaign} players={players} mapDef={mapDef} />;
    }
    if (phase === 'battle') {
      return <BattleInfoPanel campaign={campaign} players={players} />;
    }
    if (phase === 'fortify') {
      return <FortifyInfoPanel campaign={campaign} players={players} />;
    }
    return <InfoPanelPlaceholder activeTab={activeTab} />;
  }, [isSetupPhase, phase, campaign, players, activeTab]);

  const displayCampaign = campaign ?? { name: 'Loading…', current_round: 0, current_phase: 'faction_selection', phase_deadline: null };

  // In territory_draft, highlight unclaimed territories when it's my turn
  const highlightIds = useMemo(() => {
    if (phase !== 'territory_draft') return new Set();
    const setupOrder = campaign?.setup_order ?? [];
    const idx = campaign?.setup_current_index ?? 0;
    if (!myPlayer || setupOrder[idx] !== myPlayer.id) return new Set();
    if (!mapDef) return new Set();
    const claimed = new Set(Object.keys(stateById));
    return new Set(mapDef.territories.map(t => t.territory_id).filter(tid => !claimed.has(tid)));
  }, [phase, campaign, myPlayer, mapDef, stateById]);

  // In attack phase, highlight attackable (adjacent enemy/neutral) territories when own territory selected
  const attackableIds = useMemo(() => {
    if (phase !== 'attack' || !selectedId || !myPlayer || !mapDef) return new Set();
    const isOwn = stateById[selectedId]?.owner_player_id === myPlayer.id;
    if (!isOwn) return new Set();
    const neighbors = adjacencyMap[selectedId] ?? new Set();
    return new Set([...neighbors].filter(tid => stateById[tid]?.owner_player_id !== myPlayer.id));
  }, [phase, selectedId, myPlayer, mapDef, stateById, adjacencyMap]);

  // Own staged attacks — only loaded during attack phase, only own player (user-scoped)
  const { attacks: myStagedAttacks } = useAttackPhase({
    campaign: phase === 'attack' ? campaign : null,
    myPlayer,
  });

  // Attack reveals — loaded after attack phase ends (post-reveal)
  const { reveals: attackReveals } = useAttackReveals({
    campaignId: id,
    round: campaign?.current_round ?? 1,
    enabled: !!id && phase !== 'attack',
  });

  // Arrow layer:
  //   - During attack phase: show OWN staged attacks as dashed arrows (player_id = myPlayer.id)
  //     Other players' attacks are NEVER fetched or shown.
  //   - After reveal (battle/fortify/etc): show all AttackReveal records as solid arrows.
  const arrowAttacks = useMemo(() => {
    if (phase === 'attack') {
      if (!myPlayer || myStagedAttacks.length === 0) return [];
      // Inject player_id so ArrowLayer can color them correctly
      return myStagedAttacks.map(a => ({ ...a, player_id: myPlayer.id }));
    }
    return attackReveals;
  }, [phase, myPlayer, myStagedAttacks, attackReveals]);

  return (
    <CampaignLayout
      campaign={displayCampaign}
      leftDockContent={leftDockContent}
      rightDockContent={rightDockContent}
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
            highlightIds={highlightIds}
            attackableIds={attackableIds}
            onSelect={setSelectedId}
            arrowLayer={arrowAttacks.length > 0 ? (
              <AttackArrowLayer
                attacks={arrowAttacks}
                mapDef={mapDef}
                players={players}
                myPlayerId={myPlayer?.id}
                viewBox={`0 0 ${mapDef.width} ${mapDef.height}`}
                revealed={phase !== 'attack'}
              />
            ) : null}
          />

          <RegionLegend regions={mapDef.regions} />

          {/* Only show territory detail panel outside of draft phase (draft uses left dock) */}
          {phase !== 'territory_draft' && (
            <TerritoryDetailPanel
              territory={selectedTerritory}
              tState={selectedTState}
              players={players}
              regionDef={selectedRegion}
              continentDef={selectedContinent}
              adjacentTerritories={adjacentTerritories}
              onClose={() => setSelectedId(null)}
            />
          )}
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