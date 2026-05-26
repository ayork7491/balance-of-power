/**
 * useCampaignActions — Campaign action hooks (ready, start, kick, cleanup).
 * Extracted from CampaignLobby for reusability and separation of concerns.
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPlayerReady, startCampaign, kickPlayer, cleanupCampaign } from './index';

export function useCampaignActions(campaign, players, myPlayer, reload) {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState(null);
  const [starting, setStarting] = useState(false);

  // Toggle ready status
  const handleToggleReady = useCallback(async () => {
    if (!myPlayer) return;
    setActionError(null);
    try {
      await setPlayerReady(myPlayer.id, !myPlayer.is_ready);
    } catch {
      setActionError('Failed to update ready status.');
    }
  }, [myPlayer]);

  // Start campaign
  const handleStart = useCallback(async (userId) => {
    setActionError(null);
    setStarting(true);
    try {
      await startCampaign(campaign.id, userId, players);
      navigate(`/campaigns/${campaign.id}`);
    } catch (err) {
      setActionError(err.message || 'Failed to start campaign. Please try again.');
      setStarting(false);
    }
  }, [campaign, players, navigate]);

  // Kick player
  const handleKick = useCallback(async (player) => {
    if (!confirm(`Remove ${player.display_name} from the campaign?`)) return;
    setActionError(null);
    try {
      await kickPlayer(player.id);
      reload();
    } catch {
      setActionError('Failed to remove player.');
    }
  }, [reload]);

  // Cleanup campaign (delete/archive)
  const handleCleanup = useCallback(async (userId, cleanupType = 'delete') => {
    setActionError(null);
    try {
      await cleanupCampaign(campaign.id, userId, cleanupType);
      navigate('/');
    } catch (err) {
      setActionError(err.message || 'Failed to cleanup campaign.');
    }
  }, [campaign, navigate]);

  return {
    actionError,
    setActionError,
    starting,
    handleToggleReady,
    handleStart,
    handleKick,
    handleCleanup,
  };
}

export function useCampaignStartValidation(campaign, players, userId) {
  const isAdmin = campaign?.admin_user_id === userId;
  const readyCount = players.filter(p => p.is_ready).length;
  const canStart = isAdmin && players.length >= 2 && players.every(p => p.is_ready);

  const startMessage = !canStart
    ? players.length < 2
      ? 'At least 2 players needed to start.'
      : 'All players must be ready before starting.'
    : 'All players are ready. The campaign can be started.';

  return {
    isAdmin,
    readyCount,
    canStart,
    startMessage,
  };
}