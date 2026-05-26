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
import { CampaignTestModeProvider, useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';
import { base44 } from '@/api/base44Client';

// ── Main Page ─────────────────────────────────────────────────────────────────

function ActiveCampaignContent() {
  const { id } = useParams();
  const [activeTab, setActiveTab]   = useState('map');
  const [myPlayerId, setMyPlayerId]   = useState(null);
  const [gameProfile, setGameProfile] = useState(null);
  
  // Use centralized test context (includes selectedTerritoryId)
  const { 
    viewingAsCampaignPlayerId,
    actingAsCampaignPlayerId,
    selectedTerritoryId,
    viewingAsPlayer,
    actingAsPlayer,
    setViewingAsCampaignPlayerId,
    setActingAsCampaignPlayerId,
    setSelectedTerritoryId,
    isTestMode,
    isSimulatedPerspective,
    availableActingAsPlayers,
  } = useCampaignTestContext();

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

  // Selected territory details (using centralized selectedTerritoryId)
  const selectedTerritory   = useMemo(
    () => mapDef?.territories.find(t => t.territory_id === selectedTerritoryId) ?? null,
    [mapDef, selectedTerritoryId]
  );
  const selectedTState      = selectedTerritoryId ? (stateById[selectedTerritoryId] ?? null) : null;
  const selectedRegion      = selectedTerritory
    ? (mapDef?.regions.find(r => r.id === selectedTerritory.region_id) ?? null) : null;
  const selectedContinent   = selectedTerritory
    ? (mapDef?.continents.find(c => c.id === selectedTerritory.continent_id) ?? null) : null;
  const adjacentTerritories = useMemo(() => {
    if (!selectedTerritoryId || !mapDef) return [];
    const ids = adjacencyMap[selectedTerritoryId] ?? new Set();
    return mapDef.territories.filter(t => ids.has(t.territory_id));
  }, [selectedTerritoryId, mapDef, adjacencyMap]);

  const phase = campaign?.current_phase;
  const isArchived = campaign?.status === 'archived';

  // Determine effective player for VIEWING perspective (simulated or real)
  const effectivePlayer = useMemo(() => {
    if (viewingAsPlayer) return viewingAsPlayer; // simulated perspective
    return myPlayer; // admin view
  }, [viewingAsPlayer, myPlayer]);

  // Determine effective player for ACTIONS (acting-as delegation)
  const actionPlayer = useMemo(() => {
    if (actingAsPlayer) return actingAsPlayer; // delegated to test player
    return myPlayer; // own player
  }, [actingAsPlayer, myPlayer]);

  // ── Panel routing (extracted) ──────────────────────────────────────────────

  const leftDockContent = (
    isArchived ? (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">This campaign is archived. Phase controls are disabled.</p>
      </div>
    ) : (
      <PhasePanelRouter
        campaign={campaign}
        players={players}
        myPlayer={effectivePlayer}
        actionPlayer={actionPlayer}
        gameProfile={gameProfile}
        stateById={stateById}
        mapDef={mapDef}
        adjacencyMap={adjacencyMap}
        selectedTerritoryId={selectedTerritoryId}
        onClearSelection={() => setSelectedTerritoryId(null)}
        onPhaseChanged={handlePhaseChanged}
        currentPerspective={viewingAsPlayer}
        actingAsPlayerId={actingAsCampaignPlayerId}
      />
    )
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
    if (phase !== 'attack' || !selectedTerritoryId || !effectivePlayer || !mapDef) return new Set();
    const isOwn = stateById[selectedTerritoryId]?.owner_player_id === effectivePlayer.id;
    if (!isOwn) return new Set();
    const neighbors = adjacencyMap[selectedTerritoryId] ?? new Set();
    return new Set([...neighbors].filter(tid => stateById[tid]?.owner_player_id !== effectivePlayer.id));
  }, [phase, selectedTerritoryId, effectivePlayer, mapDef, stateById, adjacencyMap]);

  return (
    <>
      {/* Archived campaign banner */}
      {isArchived && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 bg-destructive/20 border-b border-destructive/40 px-4 py-2 text-center"
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-xs text-destructive font-display tracking-wider uppercase">
            This campaign is archived and cannot be modified.
          </p>
        </motion.div>
      )}

      <CampaignLayout
        campaign={displayCampaign}
        isTestMode={isTestMode && !isArchived}
        players={players}
        isAdmin={isAdmin}
        currentPerspective={viewingAsPlayer}
        onPerspectiveChange={setViewingAsCampaignPlayerId}
        actingAsPlayerId={actingAsCampaignPlayerId}
        onActingAsChange={setActingAsCampaignPlayerId}
        availableActingAsPlayers={availableActingAsPlayers}
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
          selectedId={selectedTerritoryId} // Use centralized state
          highlightIds={highlightIds}
          attackableIds={attackableIds}
          onSelect={setSelectedTerritoryId} // Update centralized state
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

          {/* RegionLegend moved to RightDockRouter to keep map viewport clear */}

          {/* Only show territory detail panel outside of draft phase (draft uses left dock) */}
          {phase !== 'territory_draft' && selectedTerritory && (
            <TerritoryDetailPanel
              territory={selectedTerritory}
              tState={selectedTState}
              players={players}
              regionDef={selectedRegion}
              continentDef={selectedContinent}
              adjacentTerritories={adjacentTerritories}
              onClose={() => setSelectedTerritoryId(null)}
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
    </>
  );
}

// Wrap with provider for centralized test mode state
export default function ActiveCampaign() {
  const { campaign, players, myPlayer, loading } = useCampaignData();
  const isAdmin = myPlayer?.is_admin;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading campaign...</div>
      </div>
    );
  }

  return (
    <CampaignTestModeProvider campaign={campaign} players={players} isAdmin={isAdmin}>
      <ActiveCampaignContent />
    </CampaignTestModeProvider>
  );
}

// Helper hook to load campaign data
function useCampaignData() {
  const { id } = useParams();
  const [myPlayerId, setMyPlayerId] = useState(null);
  const { campaign, players, loading: loadingCampaign } = useCampaign(id);
  
  useEffect(() => {
    base44.auth.me().then(u => setMyPlayerId(u?.id));
  }, []);

  const myPlayer = useMemo(
    () => myPlayerId ? players.find(p => p.user_id === myPlayerId) ?? null : null,
    [players, myPlayerId]
  );

  return {
    campaign,
    players,
    myPlayer,
    loading: loadingCampaign,
  };
}