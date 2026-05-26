/**
 * RightDockRouter — Routes to correct right dock content.
 * Extracted from ActiveCampaign.jsx for maintainability.
 */
import { useMemo } from 'react';

// Info panels
import SetupInfoPanel from '@/components/setup/SetupInfoPanel';
import DeployInfoPanel from '@/components/phases/deploy/DeployInfoPanel';
import AttackInfoPanel from '@/components/phases/attack/AttackInfoPanel';
import BattleInfoPanel from '@/components/phases/battle/BattleInfoPanel';
import FortifyInfoPanel from '@/components/phases/fortify/FortifyInfoPanel';

// History and leaderboard
import LeaderboardPanel from '@/components/campaigns/LeaderboardPanel';
import HistoryLogPanel from '@/components/campaigns/HistoryLogPanel';
import InfoPanelPlaceholder from './InfoPanelPlaceholder';

const SETUP_PHASES = new Set(['faction_selection', 'territory_draft', 'initial_deploy']);
const GAMEPLAY_PHASES = new Set(['deploy', 'attack', 'battle', 'fortify']);

export default function RightDockRouter({
  activeTab,
  campaign,
  players,
  mapDef,
}) {
  return useMemo(() => {
    const phase = campaign?.current_phase;
    const isSetupPhase = SETUP_PHASES.has(phase);

    // During setup phases, always show setup info
    if (isSetupPhase) {
      return <SetupInfoPanel campaign={campaign} players={players} />;
    }

    // During gameplay phases, show phase-specific info
    if (GAMEPLAY_PHASES.has(phase)) {
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
    }

    // Otherwise use tab-based routing
    switch (activeTab) {
      case 'leaderboard':
        return <LeaderboardPanel campaign={campaign} players={players} />;
      case 'history':
        return <HistoryLogPanel campaign={campaign} players={players} />;
      default:
        return <InfoPanelPlaceholder activeTab={activeTab} />;
    }
  }, [activeTab, campaign, players, mapDef]);
}