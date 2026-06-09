/**
 * CommandCenterPanel — Sprint 5B.2
 *
 * Primary gameplay interface with unified Planning Phase lock-in bar.
 * During deploy phase: shows PlanningPhaseLockBar + ResourceStagingPanel.
 * Other phases: unchanged.
 */
import { useState, useMemo } from 'react';
import { Shield, Coins, Feather, Swords, ChevronRight, Clock } from 'lucide-react';

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

// Setup panels
import FactionSelectionPanel from '@/components/setup/FactionSelectionPanel';
import TerritoryDraftPanel from '@/components/setup/TerritoryDraftPanel';
import InitialDeployPanel from '@/components/setup/InitialDeployPanel';

const SETUP_PHASES = new Set(['faction_selection', 'territory_draft', 'initial_deploy']);

const PILLAR_TABS = [
  { id: 'military',   label: 'Military',   icon: Shield  },
  { id: 'economic',   label: 'Economic',   icon: Coins   },
  { id: 'diplomatic', label: 'Diplomatic', icon: Feather },
];

function PillarTab({ id, label, icon: Icon, isActive, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-display tracking-wider uppercase transition-all border-b-2 ${
        isActive
          ? id === 'military'   ? 'text-red-400 border-red-400 bg-red-500/5'
          : id === 'economic'   ? 'text-amber-400 border-amber-400 bg-amber-500/5'
          : 'text-purple-400 border-purple-400 bg-purple-500/5'
          : 'text-muted-foreground border-transparent hover:text-foreground'
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
  return (
    <div className="flex flex-col">
      <PhaseSummaryBar campaign={campaign} players={players} myPlayer={myPlayer} />

      {/* Planning Phase lock-in bar — only during deploy phase */}
      {isDeploy && (
        <PlanningPhaseLockBar
          campaign={campaign}
          myPlayer={myPlayer}
          actingAsPlayerId={actingAsPlayerId}
          onLocked={onPhaseChanged}
          onStatusLoaded={setPlanningStatus}
        />
      )}

      {/* Pillar tabs — sticky inside the outer scroll container */}
      <div className="sticky top-0 z-10 flex border-b border-border bg-panel-header">
        {PILLAR_TABS.map(t => (
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

function EconomicContent({ campaign, players, myPlayer, stateById, mapDef, onPhaseChanged, actingAsPlayerId, isAdmin, planningStatus }) {
  const phase = campaign?.current_phase;
  return (
    <div className="space-y-0">
      {/* Deploy phase: staging-mode resource panel */}
      {phase === 'deploy' && (
        <ResourceStagingPanel
          campaign={campaign}
          myPlayer={myPlayer}
          mapDef={mapDef}
          actingAsPlayerId={actingAsPlayerId}
          planningStatus={planningStatus}
        />
      )}
      {/* Non-deploy phase: original resource panel */}
      {phase !== 'deploy' && (
        <ResourcePhasePanel campaign={campaign} myPlayer={myPlayer} mapDef={mapDef} isAdmin={isAdmin} />
      )}
      {/* Logistics — supply routes, hubs */}
      <div className={phase === 'deploy' ? 'border-t border-border' : ''}>
        <LogisticsPanel campaign={campaign} myPlayer={myPlayer} mapDef={mapDef} />
      </div>
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
  return (
    <div className="space-y-0">
      {/* Intelligence actions */}
      <IntelligencePanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
        actingAsPlayerId={actingAsPlayerId} mapDef={mapDef} players={players} stateById={stateById ?? {}} />
      <div className="border-t border-border">
        <ObjectivesPanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
          actingAsPlayerId={actingAsPlayerId} stateById={stateById ?? {}} players={players}
          planningStatus={planningStatus}
        />
      </div>
      <div className="border-t border-border">
        <DiplomaticActionsPanel campaign={campaign} myPlayer={myPlayer} players={players}
          mapDef={mapDef} actingAsPlayerId={actingAsPlayerId} stateById={stateById ?? {}} />
      </div>
    </div>
  );
}