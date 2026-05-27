/**
 * PerspectiveSelector — Unified "Perspective" dropdown for admin test mode.
 *
 * Merges the old "View As" + "Act As" controls into one selector.
 * Selecting a perspective sets BOTH viewing and acting to the same player.
 *
 * Rules:
 *  - Only visible to campaign admins in test mode with available test players.
 *  - Normal players never see this; they always act as themselves.
 *  - Admins can select: self, or any test player in the campaign.
 *  - Selecting "self" resets both viewingAs and actingAs to null (self).
 */
import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, TestTube } from 'lucide-react';
import { useCampaignTestContext } from '@/features/adminTestMode/CampaignTestContext';

export default function PerspectiveSelector({ compact = false }) {
  const {
    isTestMode,
    isAdmin,
    availableActingAsPlayers,
    actingAsCampaignPlayerId,
    setViewingAsCampaignPlayerId,
    setActingAsCampaignPlayerId,
  } = useCampaignTestContext();

  // Only show to admins in test mode with test players available
  const testPlayers = useMemo(
    () => availableActingAsPlayers.filter(p => p.is_test_player),
    [availableActingAsPlayers]
  );

  if (!isAdmin || !isTestMode || testPlayers.length === 0) return null;

  const currentValue = actingAsCampaignPlayerId ?? 'self';

  const handleChange = (val) => {
    if (val === 'self') {
      setActingAsCampaignPlayerId(null);
      setViewingAsCampaignPlayerId(null);
    } else {
      setActingAsCampaignPlayerId(val);
      setViewingAsCampaignPlayerId(val);
    }
  };

  if (compact) {
    // Compact version for portrait top bar
    return (
      <div className="flex items-center gap-1 bg-status-pending/10 border border-status-pending/40 px-1.5 py-0.5 rounded">
        <TestTube className="w-3 h-3 text-status-pending shrink-0" />
        <Select value={currentValue} onValueChange={handleChange}>
          <SelectTrigger className="h-6 text-[10px] w-24 border-0 bg-transparent p-0 pl-0.5 focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self">
              <span className="flex items-center gap-1.5 text-xs">
                <User className="w-3 h-3" /> Self
              </span>
            </SelectItem>
            {testPlayers.map((player) => (
              <SelectItem key={player.id} value={player.id}>
                <span className="flex items-center gap-1.5 text-xs">
                  <TestTube className="w-3 h-3 text-status-pending" />
                  {player.display_name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Full version for landscape top bar
  return (
    <div className="flex items-center gap-1.5 bg-status-pending/10 border border-status-pending/40 px-2 py-1 rounded">
      <TestTube className="w-3.5 h-3.5 text-status-pending shrink-0" />
      <span className="text-[10px] text-status-pending uppercase tracking-wider hidden sm:inline">Perspective</span>
      <Select value={currentValue} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs w-32 sm:w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="self">
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3" /> My Player (Self)
            </span>
          </SelectItem>
          {testPlayers.map((player) => (
            <SelectItem key={player.id} value={player.id}>
              <span className="flex items-center gap-1.5">
                <TestTube className="w-3 h-3 text-status-pending" />
                {player.display_name} (Test)
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}