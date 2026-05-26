/**
 * ActiveCampaign — primary gameplay screen.
 * Refactored for maintainability: routers extracted, logic simplified.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import CampaignLayout from '@/components/layout/CampaignLayout';
import { PLAYER_COLORS } from '@/config/theme';
import MapRenderer from '@/components/map/MapRenderer';
import TerritoryDetailPanel from '@/components/map/TerritoryDetailPanel';
import RegionLegend from '@/components/map/RegionLegend';
import AttackArrowLayer from '@/components/phases/attack/AttackArrowLayer';

// Routers
import PhasePanelRouter from '@/components/campaigns/PhasePanelRouter';
import RightDockRouter from '@/components/campaigns/RightDockRouter';

// Hooks
import { useAttackReveals, useAttackPhase } from '@/features/campaigns/attack';
import { useAttackArrows } from '@/features/campaigns/attack/useAttackArrows.js';
import { useCampaign } from '@/features/campaigns';
import { useTerritoryState, getMap, buildAdjacencyMap } from '@/features/maps';
import { base44 } from '@/api/base44Client';

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ActiveCampaign() {
  const { id } = useParams();
  const [activeTab, setActiveTab]   = useState('map');
  const [selectedId, setSelectedId] = useState(null);
  const [myPlayerId, setMyPlayerId]   = useState(null);
  const [gameProfile, setGameProfile] = useState(null);
  const [currentPerspective, setCurrentPerspective] = useState(null); // null = admin view

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

  // Determine effective player for perspective (simulated or real)
  const effectivePlayer = useMemo(() => {
    if (currentPerspective) return currentPerspective; // simulated perspective
    return myPlayer; // admin view
  }, [currentPerspective, myPlayer]);

  // ── Panel routing (extracted) ──────────────────────────────────────────────

  const leftDockContent = (
    <PhasePanelRouter
      campaign={campaign}
      players={players}
      myPlayer={effectivePlayer} // Use effective player for perspective
      gameProfile={gameProfile}
      stateById={stateById}
      mapDef={mapDef}
      adjacencyMap={adjacencyMap}
      selectedTerritoryId={selectedId}
      onClearSelection={() => setSelectedId(null)}
      onPhaseChanged={handlePhaseChanged}
      currentPerspective={currentPerspective}
    />
  );

  const rightDockContent = (
    <RightDockRouter
      activeTab={activeTab}
      campaign={campaign}
      players={players}
      mapDef={mapDef}
    />
  );

  const displayCampaign = campaign ?? { name: 'Loading…', current_round: 0, current_phase: 'faction_selection', phase_deadline: null };
  const isAdmin = myPlayer?.is_admin;
  
  // Check if campaign has test players (for showing perspective selector)
  const hasTestPlayers = players?.some(p => p.is_test_player) === true;

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

  // Arrow layer (extracted logic)
  const arrowAttacks = useAttackArrows({
    phase,
    myPlayer,
    myStagedAttacks,
    attackReveals,
  });

  // Territory highlights (draft + attack) - uses effective player for perspective
  const highlightIds = useMemo(() => {
    if (phase !== 'territory_draft') return new Set();
    const setupOrder = campaign?.setup_order ?? [];
    const idx = campaign?.setup_current_index ?? 0;
    if (!effectivePlayer || setupOrder[idx] !== effectivePlayer.id) return new Set();
    if (!mapDef) return new Set();
    const claimed = new Set(Object.keys(stateById));
    return new Set(mapDef.territories.map(t => t.territory_id).filter(tid => !claimed.has(tid)));
  }, [phase, campaign, effectivePlayer, mapDef, stateById]);

  const attackableIds = useMemo(() => {
    if (phase !== 'attack' || !selectedId || !effectivePlayer || !mapDef) return new Set();
    const isOwn = stateById[selectedId]?.owner_player_id === effectivePlayer.id;
    if (!isOwn) return new Set();
    const neighbors = adjacencyMap[selectedId] ?? new Set();
    return new Set([...neighbors].filter(tid => stateById[tid]?.owner_player_id !== effectivePlayer.id));
  }, [phase, selectedId, effectivePlayer, mapDef, stateById, adjacencyMap]);

  return (
    <CampaignLayout
      campaign={displayCampaign}
      isTestMode={isAdmin || hasTestPlayers}
      players={players}
      currentPerspective={currentPerspective}
      onPerspectiveChange={setCurrentPerspective}
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
              myPlayerId={effectivePlayer?.id}
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
      <AnimatePresence>
        {(loadingCampaign || loadingState) && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="flex items-center gap-3 text-muted-foreground text-sm"
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
            >
              <motion.div
                className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="font-display text-xs tracking-widest uppercase">Loading campaign…</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CampaignLayout>
  );
}