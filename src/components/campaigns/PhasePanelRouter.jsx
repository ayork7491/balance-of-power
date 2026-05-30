/**
 * PhasePanelRouter — Routes to correct phase panel component.
 * Extracted from ActiveCampaign.jsx for maintainability.
 */
import { useMemo } from 'react';

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
import BattlePanel from '@/components/phases/battle/BattlePanel';
import BattleInfoPanel from '@/components/phases/battle/BattleInfoPanel';
import FortifyPanel from '@/components/phases/fortify/FortifyPanel';
import FortifyInfoPanel from '@/components/phases/fortify/FortifyInfoPanel';

// Placeholders
import PhasePanelPlaceholder from './PhasePanelPlaceholder';
import InfoPanelPlaceholder from './InfoPanelPlaceholder';

export default function PhasePanelRouter({
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
  currentPerspective,
  actingAsPlayerId,
}) {
  return useMemo(() => {
    if (!campaign || !myPlayer) {
      return <PhasePanelPlaceholder campaign={campaign} />;
    }

    const { current_phase: phase } = campaign;

    if (phase === 'faction_selection') {
      return (
        <FactionSelectionPanel
          campaign={campaign}
          players={players}
          myPlayer={myPlayer}
          gameProfile={gameProfile}
          onPhaseChanged={onPhaseChanged}
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
          selectedTerritoryId={selectedTerritoryId}
          onClearSelection={onClearSelection}
          onPhaseChanged={onPhaseChanged}
          currentPerspective={currentPerspective}
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
          onPhaseChanged={onPhaseChanged}
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
          onPhaseChanged={onPhaseChanged}
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
          selectedTerritoryId={selectedTerritoryId}
          preselectedTargetId={attackPreselectedTargetId}
          onClearSelection={onClearSelection}
          onPhaseChanged={onPhaseChanged}
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
          onPhaseChanged={onPhaseChanged}
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
          selectedTerritoryId={selectedTerritoryId}
          onClearSelection={onClearSelection}
          onPhaseChanged={onPhaseChanged}
          isAdmin={myPlayer?.is_admin ?? false}
        />
      );
    }

    return <PhasePanelPlaceholder campaign={campaign} />;
  }, [
    campaign,
    players,
    myPlayer,
    gameProfile,
    stateById,
    mapDef,
    adjacencyMap,
    selectedTerritoryId,
    attackPreselectedTargetId,
    onClearSelection,
    onPhaseChanged,
  ]);
}