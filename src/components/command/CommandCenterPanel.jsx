/**
 * CommandCenterPanel — Sprint 5B
 *
 * The primary gameplay interface. Shows:
 *   - Phase summary (round, phase, description)
 *   - For non-battle phases: Military / Economic / Diplomatic pillar tabs
 *   - For battle phase: unified conflict queue (ConflictQueuePanel)
 *
 * Reuses existing panels — no business logic duplicated.
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
  const phase = campaign?.current_phase;
  const isSetup = SETUP_PHASES.has(phase);
  const isBattle = phase === 'battle';

  // ── Setup phases: render directly, no pillar tabs ────────────────────────
  if (isSetup) {
    if (phase === 'faction_selection') {
      return (
        <div className="overflow-y-auto">
          <FactionSelectionPanel
            campaign={campaign} players={players} myPlayer={myPlayer}
            gameProfile={gameProfile} onPhaseChanged={onPhaseChanged}
          />
        </div>
      );
    }
    if (phase === 'territory_draft') {
      return (
        <div className="overflow-y-auto">
          <TerritoryDraftPanel
            campaign={campaign} players={players} myPlayer={myPlayer}
            stateById={stateById} mapDef={mapDef}
            selectedTerritoryId={selectedTerritoryId}
            onClearSelection={onClearSelection} onPhaseChanged={onPhaseChanged}
          />
        </div>
      );
    }
    if (phase === 'initial_deploy') {
      return (
        <div className="overflow-y-auto">
          <InitialDeployPanel
            campaign={campaign} players={players} myPlayer={myPlayer}
            stateById={stateById} mapDef={mapDef} onPhaseChanged={onPhaseChanged}
          />
        </div>
      );
    }
  }

  // ── Battle phase: unified conflict queue ─────────────────────────────────
  if (isBattle) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <PhaseSummaryBar campaign={campaign} players={players} myPlayer={myPlayer} />
        <div className="flex-1 overflow-y-auto">
          <ConflictQueuePanel
            campaign={campaign} players={players} myPlayer={myPlayer}
            mapDef={mapDef} onPhaseChanged={onPhaseChanged}
            actingAsPlayerId={actingAsPlayerId} isAdmin={isAdmin}
          />
        </div>
      </div>
    );
  }

  // ── Gameplay phases: pillar tabs ─────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PhaseSummaryBar campaign={campaign} players={players} myPlayer={myPlayer} />

      {/* Pillar tabs */}
      <div className="shrink-0 flex border-b border-border bg-panel-header">
        {PILLAR_TABS.map(t => (
          <PillarTab key={t.id} {...t} isActive={pillarTab === t.id} onClick={setPillarTab} />
        ))}
      </div>

      {/* Pillar content */}
      <div className="flex-1 overflow-y-auto dock-scroll">
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
        />}
        {pillarTab === 'diplomatic' && <DiplomaticContent
          campaign={campaign} players={players} myPlayer={myPlayer}
          mapDef={mapDef} stateById={stateById} onPhaseChanged={onPhaseChanged}
          actingAsPlayerId={actingAsPlayerId} isAdmin={isAdmin}
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

function EconomicContent({ campaign, players, myPlayer, stateById, mapDef, onPhaseChanged, actingAsPlayerId, isAdmin }) {
  const phase = campaign?.current_phase;
  return (
    <div className="space-y-0">
      {/* Resource activation always available in deploy phase */}
      {phase === 'deploy' && (
        <ResourcePhasePanel campaign={campaign} myPlayer={myPlayer} mapDef={mapDef} isAdmin={isAdmin} />
      )}
      {/* Logistics — supply routes, hubs */}
      <LogisticsPanel campaign={campaign} myPlayer={myPlayer} mapDef={mapDef} />
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

function DiplomaticContent({ campaign, players, myPlayer, mapDef, stateById, onPhaseChanged, actingAsPlayerId, isAdmin }) {
  return (
    <div className="space-y-0">
      {/* Intelligence actions */}
      <IntelligencePanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
        actingAsPlayerId={actingAsPlayerId} mapDef={mapDef} players={players} stateById={stateById ?? {}} />
      <div className="border-t border-border">
        <ObjectivesPanel campaign={campaign} myPlayer={myPlayer} isAdmin={isAdmin}
          actingAsPlayerId={actingAsPlayerId} stateById={stateById ?? {}} players={players} />
      </div>
      <div className="border-t border-border">
        <DiplomaticActionsPanel campaign={campaign} myPlayer={myPlayer} players={players}
          mapDef={mapDef} actingAsPlayerId={actingAsPlayerId} stateById={stateById ?? {}} />
      </div>
    </div>
  );
}