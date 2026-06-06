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

// Region legend (moved out of map viewport)
import RegionLegend from '@/components/map/RegionLegend';

// Resource panels (Sprint 3B)
import ResourcePhasePanel from '@/components/phases/resource/ResourcePhasePanel';
import ResourceDebugPanel from '@/components/phases/resource/ResourceDebugPanel';

const SETUP_PHASES = new Set(['faction_selection', 'territory_draft', 'initial_deploy']);
const GAMEPLAY_PHASES = new Set(['deploy', 'attack', 'battle', 'fortify']);

export default function RightDockRouter({
  activeTab,
  campaign,
  players,
  mapDef,
  myPlayer,
  isAdmin,
}) {
  return useMemo(() => {
    const phase = campaign?.current_phase;
    const isSetupPhase = SETUP_PHASES.has(phase);

    return (
      <div className="flex flex-col h-full">
        {/* Tab-based content - tabs ALWAYS control what's shown */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'resources' ? (
            <div className="h-full overflow-y-auto">
              <ResourcePhasePanel
                campaign={campaign}
                myPlayer={myPlayer}
                mapDef={mapDef}
                isAdmin={isAdmin}
              />
              {isAdmin && (
                <div className="border-t border-border mt-2">
                  <ResourceDebugPanel campaign={campaign} />
                </div>
              )}
            </div>
          ) : activeTab === 'leaderboard' ? (
            <>
              <LeaderboardPanel campaign={campaign} players={players} />
              {/* Region bonuses surfaced here for portrait access */}
              {mapDef?.regions?.length > 0 && (
                <div className="mt-2 border-t border-border bg-muted/20">
                  <RegionLegend regions={mapDef.regions} />
                </div>
              )}
            </>
          ) : activeTab === 'history' ? (
            <HistoryLogPanel campaign={campaign} players={players} />
          ) : activeTab === 'territories' ? (
            <>
              <InfoPanelPlaceholder 
                title="Territories"
                description="Territory overview coming soon"
                icon="Grid3x3"
              />
              {/* Region bonuses also shown here in portrait mode */}
              {mapDef?.regions?.length > 0 && (
                <div className="mt-2 border-t border-border bg-muted/20">
                  <RegionLegend regions={mapDef.regions} />
                </div>
              )}
            </>
          ) : activeTab === 'battles' ? (
            <InfoPanelPlaceholder 
              title="Battles"
              description="Battle history coming soon"
              icon="Swords"
            />
          ) : activeTab === 'phase' ? (
            // Phase info based on current phase
            isSetupPhase ? (
              <SetupInfoPanel campaign={campaign} players={players} />
            ) : GAMEPLAY_PHASES.has(phase) ? (
              phase === 'deploy' ? (
                <DeployInfoPanel campaign={campaign} players={players} />
              ) : phase === 'attack' ? (
                <AttackInfoPanel campaign={campaign} players={players} mapDef={mapDef} />
              ) : phase === 'battle' ? (
                <BattleInfoPanel campaign={campaign} players={players} />
              ) : phase === 'fortify' ? (
                <FortifyInfoPanel campaign={campaign} players={players} />
              ) : (
                <InfoPanelPlaceholder activeTab="phase" />
              )
            ) : (
              <InfoPanelPlaceholder activeTab="phase" />
            )
          ) : (
            // Default to phase info or placeholder
            isSetupPhase ? (
              <SetupInfoPanel campaign={campaign} players={players} />
            ) : GAMEPLAY_PHASES.has(phase) ? (
              phase === 'deploy' ? (
                <DeployInfoPanel campaign={campaign} players={players} />
              ) : phase === 'attack' ? (
                <AttackInfoPanel campaign={campaign} players={players} mapDef={mapDef} />
              ) : phase === 'battle' ? (
                <BattleInfoPanel campaign={campaign} players={players} />
              ) : phase === 'fortify' ? (
                <FortifyInfoPanel campaign={campaign} players={players} />
              ) : (
                <InfoPanelPlaceholder activeTab={activeTab} />
              )
            ) : (
              <InfoPanelPlaceholder activeTab={activeTab} />
            )
          )}
        </div>
      </div>
    );
  }, [activeTab, campaign, players, mapDef]);
}