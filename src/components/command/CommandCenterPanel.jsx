/**
 * CommandCenterPanel — Sprint 5B.2
 *
 * Primary gameplay interface with unified Planning Phase lock-in bar.
 * During deploy phase: shows PlanningPhaseLockBar + ResourceStagingPanel.
 * Other phases: unchanged.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Shield, Coins, Feather, Settings } from 'lucide-react';

import { base44 } from '@/api/base44Client';

// Phase action panels
import DeployPanel from '@/components/phases/deploy/DeployPanel';
import AttackPanel from '@/components/phases/attack/AttackPanel';
import FortifyPanel from '@/components/phases/fortify/FortifyPanel';
import ResourcePhasePanel from '@/components/phases/resource/ResourcePhasePanel';
import ObjectivesPanel from '@/components/objectives/ObjectivesPanel';
import OperationsPanel from '@/components/operations/OperationsPanel';
import DiplomaticActionsPanel from '@/components/influence/DiplomaticActionsPanel';
import IntelligencePanel from '@/components/intelligence/IntelligencePanel';
import LogisticsPanel from '@/components/logistics/LogisticsPanel';
import ConflictQueuePanel from '@/components/command/ConflictQueuePanel';
import PhaseSummaryBar from '@/components/command/PhaseSummaryBar';
import PlanningPhaseLockBar from '@/components/command/PlanningPhaseLockBar';
import ResourceStagingPanel from '@/components/phases/resource/ResourceStagingPanel';
import AdminPlanningTab from '@/components/command/AdminPlanningTab';

// Setup panels
import FactionSelectionPanel from '@/components/setup/FactionSelectionPanel';
import TerritoryDraftPanel from '@/components/setup/TerritoryDraftPanel';
import InitialDeployPanel from '@/components/setup/InitialDeployPanel';

const SETUP_PHASES = new Set(['faction_selection', 'territory_draft', 'initial_deploy']);

const PLAYER_TABS = [
  { id: 'military',   label: 'Military',   icon: Shield  },
  { id: 'economic',   label: 'Economic',   icon: Coins   },
  { id: 'diplomatic', label: 'Diplomatic', icon: Feather },
];

const ADMIN_TAB = { id: 'admin', label: 'Admin', icon: Settings };

function PillarTab({ id, label, icon: Icon, isActive, onClick }) {
  const activeColor =
    id === 'military'   ? 'text-red-400 border-red-400 bg-red-500/5' :
    id === 'economic'   ? 'text-amber-400 border-amber-400 bg-amber-500/5' :
    id === 'diplomatic' ? 'text-purple-400 border-purple-400 bg-purple-500/5' :
                          'text-muted-foreground border-muted-foreground bg-muted/10';
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-display tracking-wider uppercase transition-all border-b-2 ${
        isActive ? activeColor : 'text-muted-foreground border-transparent hover:text-foreground'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}

export default function CommandCenterPanel({
  campaign,
  players,
  myPlayer,
  actionPlayer,
  gameProfile,
  stateById,
  mapDef,
  adjacencyMap,
  selectedTerritoryId,
  attackPreselectedTargetId,
  onClearSelection,
  onPhaseChanged,
  actingAsPlayerId,
  isAdmin,
}) {
  const [pillarTab, setPillarTab] = useState('military');
  const [planningStatus, setPlanningStatus] = useState(null);

  // Reset planningStatus when actingAsPlayerId changes so stale data isn't passed to child panels
  const prevActingRef = useRef(actingAsPlayerId);
  useEffect(() => {
    if (prevActingRef.current !== actingAsPlayerId) {
      prevActingRef.current = actingAsPlayerId;
      setPlanningStatus(null);
    }
  }, [actingAsPlayerId]);
  const phase = campaign?.current_phase;
  const isSetup = SETUP_PHASES.has(phase);
  const isBattle = phase === 'battle';
  const isDeploy = phase === 'deploy';

  // ── Setup phases: render directly, no pillar tabs ────────────────────────
  if (isSetup) {
    if (phase === 'faction_selection') {
      return (
        <FactionSelectionPanel
          campaign={campaign} players={players} myPlayer={myPlayer}
          gameProfile={gameProfile} onPhaseChanged={onPhaseChanged}
        />
      );
    }
    if (phase === 'territory_draft') {
      return (
        <TerritoryDraftPanel
          campaign={campaign} players={players} myPlayer={myPlayer}
          stateById={stateById} mapDef={mapDef}
          selectedTerritoryId={selectedTerritoryId}
          onClearSelection={onClearSelection} onPhaseChanged={onPhaseChanged}
        />
      );
    }
    if (phase === 'initial_deploy') {
      return (
        <InitialDeployPanel
          campaign={campaign} players={players} myPlayer={myPlayer}
          stateById={stateById} mapDef={mapDef} onPhaseChanged={onPhaseChanged}
        />
      );
    }
  }

  // ── Battle phase: unified conflict queue ─────────────────────────────────
  if (isBattle) {
    return (
      <div className="flex flex-col">
        <PhaseSummaryBar campaign={campaign} players={players} myPlayer={myPlayer} />
        <ConflictQueuePanel
          campaign={campaign} players={players} myPlayer={myPlayer}
          mapDef={mapDef} onPhaseChanged={onPhaseChanged}
          actingAsPlayerId={actingAsPlayerId} isAdmin={isAdmin}
        />
      </div>
    );
  }

  // ── Gameplay phases: pillar tabs ─────────────────────────────────────────
  const visibleTabs = isAdmin ? [...PLAYER_TABS, ADMIN_TAB] : PLAYER_TABS;

  return (
    <div className="flex flex-col">
      <PhaseSummaryBar campaign={campaign} players={players} myPlayer={myPlayer} />

      {/* Planning Phase lock-in bar — only during deploy phase */}
      {isDeploy && (
        <PlanningPhaseLockBar
          campaign={campaign}
          myPlayer={myPlayer}
          actingAsPlayerId={actingAsPlayerId}
          players={players}
          onLocked={onPhaseChanged}
          onStatusLoaded={setPlanningStatus}
        />
      )}

      {/* Pillar tabs — sticky inside the outer scroll container */}
      <div className="sticky top-0 z-10 flex border-b border-border bg-panel-header">
        {visibleTabs.map(t => (
          <PillarTab key={t.id} {...t} isActive={pillarTab === t.id} onClick={setPillarTab} />
        ))}
      </div>

      {/* Pillar content — flows naturally, outer sheet scrolls */}
      <div>
        {pillarTab === 'military' && <MilitaryContent
          campaign={campaign} players={players} myPlayer={myPlayer}
          actionPlayer={actionPlayer} stateById={stateById} mapDef={mapDef}
          adjacencyMap={adjacencyMap} selectedTerritoryId={selectedTerritoryId}
          attackPreselectedTargetId={attackPreselectedTargetId}
          onClearSelection={onClearSelection} onPhaseChanged={onPhaseChanged}
          actingAsPlayerId={actingAsPlayerId} isAdmin={isAdmin}
        />}
        {pillarTab === 'economic' && <EconomicContent
          campaign={campaign} players={players} myPlayer={myPlayer}
          stateById={stateById} mapDef={mapDef} onPhaseChanged={onPhaseChanged}
          actingAsPlayerId={actingAsPlayerId} isAdmin={isAdmin}
          planningStatus={planningStatus}
        />}
        {pillarTab === 'diplomatic' && <DiplomaticContent
          campaign={campaign} players={players} myPlayer={myPlayer}
          mapDef={mapDef} stateById={stateById} onPhaseChanged={onPhaseChanged}
          actingAsPlayerId={actingAsPlayerId} isAdmin={isAdmin}
          planningStatus={planningStatus}
        />}
        {pillarTab === 'admin' && isAdmin && <AdminContent
          campaign={campaign} players={players} myPlayer={myPlayer}
          onPhaseChanged={onPhaseChanged} isDeploy={isDeploy}
        />}
      </div>
    </div>
  );
}

// ── Pillar content components ─────────────────────────────────────────────────

function MilitaryContent({ campaign, players, myPlayer, actionPlayer, stateById, mapDef, adjacencyMap,
  selectedTerritoryId, attackPreselectedTargetId, onClearSelection, onPhaseChanged, actingAsPlayerId, isAdmin }) {
  const phase = campaign?.current_phase;

  if (phase === 'deploy') {
    return <DeployPanel campaign={campaign} players={players} myPlayer={myPlayer}
      stateById={stateById} mapDef={mapDef} onPhaseChanged={onPhaseChanged} />;
  }
  if (phase === 'attack') {
    return <AttackPanel campaign={campaign} players={players} myPlayer={myPlayer}
      stateById={stateById} mapDef={mapDef} adjacencyMap={adjacencyMap}
      selectedTerritoryId={selectedTerritoryId}
      preselectedTargetId={attackPreselectedTargetId}
      onClearSelection={onClearSelection} onPhaseChanged={onPhaseChanged} />;
  }
  if (phase === 'fortify') {
    return <FortifyPanel campaign={campaign} players={players} myPlayer={myPlayer}
      stateById={stateById} mapDef={mapDef} adjacencyMap={adjacencyMap}
      selectedTerritoryId={selectedTerritoryId}
      onClearSelection={onClearSelection} onPhaseChanged={onPhaseChanged}
      isAdmin={isAdmin} />;
  }

  // Operations phase military ops are inside OperationsPanel
  return <OperationsPanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
    actingAsPlayerId={actingAsPlayerId} stateById={stateById} mapDef={mapDef} players={players} />;
}

function AdminContent({ campaign, players, myPlayer, onPhaseChanged, isDeploy }) {
  const [advancing, setAdvancing] = useState(false);

  const handleProcessEnd = async () => {
    setAdvancing(true);
    try {
      await base44.functions.invoke('deployPhase', {
        action: 'processPhaseEnd',
        campaign_id: campaign.id,
      });
      onPhaseChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setAdvancing(false);
    }
  };

  if (!isDeploy) {
    return (
      <div className="p-3 text-xs text-muted-foreground italic">
        Admin controls for this phase are available in the phase summary bar.
      </div>
    );
  }

  return (
    <AdminPlanningTab
      campaign={campaign}
      players={players}
      advancing={advancing}
      onProcessEnd={handleProcessEnd}
      onStartDeploy={onPhaseChanged}
    />
  );
}

function EconomicContent({ campaign, players, myPlayer, stateById, mapDef, onPhaseChanged, actingAsPlayerId, isAdmin, planningStatus }) {
  const phase = campaign?.current_phase;
  const isDeploy = phase === 'deploy';
  return (
    <div className="space-y-0">
      {/* Deploy (Planning) phase: staging-only, no logistics */}
      {isDeploy && (
        <ResourceStagingPanel
          campaign={campaign}
          myPlayer={myPlayer}
          mapDef={mapDef}
          actingAsPlayerId={actingAsPlayerId}
          planningStatus={planningStatus}
        />
      )}
      {/* Non-deploy phase: full resource panel + logistics */}
      {!isDeploy && (
        <>
          <ResourcePhasePanel campaign={campaign} myPlayer={myPlayer} mapDef={mapDef} isAdmin={isAdmin} />
          <div className="border-t border-border">
            <LogisticsPanel campaign={campaign} myPlayer={myPlayer} mapDef={mapDef} />
          </div>
        </>
      )}
      {/* Operations-phase economic ops */}
      {(phase === 'attack' || phase === 'fortify') && (
        <div className="border-t border-border">
          <OperationsPanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
            actingAsPlayerId={actingAsPlayerId} stateById={stateById} mapDef={mapDef} players={players} />
        </div>
      )}
    </div>
  );
}

function DiplomaticContent({ campaign, players, myPlayer, mapDef, stateById, onPhaseChanged, actingAsPlayerId, isAdmin, planningStatus }) {
  const phase = campaign?.current_phase;
  const isDeploy = phase === 'deploy';
  return (
    <div className="space-y-0">
      {/* Objectives always shown */}
      <ObjectivesPanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
        actingAsPlayerId={actingAsPlayerId} stateById={stateById ?? {}} players={players}
        planningStatus={planningStatus}
      />
      {/* Intelligence + Diplomatic actions only outside Planning Phase */}
      {!isDeploy && (
        <>
          <div className="border-t border-border">
            <IntelligencePanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
              actingAsPlayerId={actingAsPlayerId} mapDef={mapDef} players={players} stateById={stateById ?? {}} />
          </div>
          <div className="border-t border-border">
            <DiplomaticActionsPanel campaign={campaign} myPlayer={myPlayer} players={players}
              mapDef={mapDef} actingAsPlayerId={actingAsPlayerId} stateById={stateById ?? {}} />
          </div>
        </>
      )}
    </div>
  );
}