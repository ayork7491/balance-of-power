/**
 * features/campaigns/useCampaigns.js
 *
 * Hook for all Campaign + CampaignPlayer + CampaignInvite operations.
 * Pages import this hook — never call base44 entities directly from pages.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { DEFAULT_CAMPAIGN_SETTINGS } from './types';

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Campaign List Hook ───────────────────────────────────────────────────────

export function useMyCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [players, setPlayers] = useState([]); // my CampaignPlayer records
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      // All CampaignPlayer records for me
      const myPlayerRecords = await base44.entities.CampaignPlayer.filter({ user_id: user.id });
      setPlayers(myPlayerRecords);
      if (myPlayerRecords.length === 0) { setCampaigns([]); setLoading(false); return; }
      // Load the campaigns themselves
      const campaignIds = [...new Set(myPlayerRecords.map(p => p.campaign_id))];
      const all = await Promise.all(
        campaignIds.map(id => base44.entities.Campaign.filter({ id }).then(r => r[0]).catch(() => null))
      );
      setCampaigns(all.filter(Boolean).sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)));
    } catch {
      setError('Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { campaigns, players, loading, error, reload: load };
}

// ─── Single Campaign Hook ─────────────────────────────────────────────────────

export function useCampaign(campaignId) {
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const [user, campaignData, campaignPlayers, campaignInvites] = await Promise.all([
        base44.auth.me(),
        base44.entities.Campaign.filter({ id: campaignId }).then(r => r[0] ?? null),
        base44.entities.CampaignPlayer.filter({ campaign_id: campaignId }),
        base44.entities.CampaignInvite.filter({ campaign_id: campaignId }),
      ]);
      setCampaign(campaignData);
      setPlayers(campaignPlayers);
      setInvites(campaignInvites);
      setMyPlayer(campaignPlayers.find(p => p.user_id === user.id) ?? null);
    } catch {
      setError('Failed to load campaign data.');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to real-time updates for players
  useEffect(() => {
    if (!campaignId) return;
    const unsub = base44.entities.CampaignPlayer.subscribe(async (event) => {
      if (event.data?.campaign_id !== campaignId) return;
      setPlayers(prev => {
        if (event.type === 'create') return [...prev, event.data];
        if (event.type === 'update') return prev.map(p => p.id === event.id ? event.data : p);
        if (event.type === 'delete') return prev.filter(p => p.id !== event.id);
        return prev;
      });
    });
    return unsub;
  }, [campaignId]);

  return { campaign, players, invites, myPlayer, loading, error, reload: load };
}

// ─── Campaign Creation ────────────────────────────────────────────────────────

export async function createCampaign(formData) {
  const user = await base44.auth.me();
  const invite_code = generateInviteCode();

  const campaign = await base44.entities.Campaign.create({
    name: formData.name.trim(),
    description: formData.description.trim(),
    admin_user_id: user.id,
    status: 'lobby',
    game_profile_id: formData.game_profile_id,
    game_profile_name: formData.game_profile_name,
    map_id: formData.map_id || 'map_v1_standard',
    invite_code,
    current_round: 0,
    settings: { ...DEFAULT_CAMPAIGN_SETTINGS, ...formData.settings },
  });

  // Add creator as admin player
  const displayName = user.display_name || user.full_name || 'Commander';
  await base44.entities.CampaignPlayer.create({
    campaign_id: campaign.id,
    user_id: user.id,
    display_name: displayName,
    color: user.default_color || 'crimson',
    is_admin: true,
    is_ready: false,
    troop_count: 0,
    is_eliminated: false,
  });

  // Send invites for any emails provided
  for (const email of (formData.invitee_emails || [])) {
    if (!email.trim()) continue;
    await base44.entities.CampaignInvite.create({
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      invited_by_user_id: user.id,
      invited_by_name: displayName,
      invitee_email: email.trim().toLowerCase(),
      type: 'invite',
      status: 'pending',
    });
  }

  return campaign;
}

// ─── Invite Management ────────────────────────────────────────────────────────

export async function sendInvite({ campaignId, campaignName, inviteeEmail }) {
  const user = await base44.auth.me();
  const displayName = user.display_name || user.full_name || 'Commander';
  return base44.entities.CampaignInvite.create({
    campaign_id: campaignId,
    campaign_name: campaignName,
    invited_by_user_id: user.id,
    invited_by_name: displayName,
    invitee_email: inviteeEmail.trim().toLowerCase(),
    type: 'invite',
    status: 'pending',
  });
}

export async function cancelInvite(inviteId) {
  return base44.entities.CampaignInvite.update(inviteId, { status: 'cancelled' });
}

export async function respondToInvite(inviteId, accept) {
  return base44.entities.CampaignInvite.update(inviteId, {
    status: accept ? 'accepted' : 'declined',
  });
}

export async function approveJoinRequest(invite, playerSetup) {
  // Create CampaignPlayer record
  await base44.entities.CampaignPlayer.create({
    campaign_id: invite.campaign_id,
    user_id: invite.invitee_user_id,
    display_name: playerSetup.display_name,
    color: playerSetup.color,
    faction_name: playerSetup.faction_name || null,
    is_admin: false,
    is_ready: false,
    troop_count: 0,
    is_eliminated: false,
  });
  await base44.entities.CampaignInvite.update(invite.id, { status: 'accepted' });
}

export async function denyJoinRequest(inviteId) {
  return base44.entities.CampaignInvite.update(inviteId, { status: 'declined' });
}

// ─── Join via Invite Code ─────────────────────────────────────────────────────

export async function requestToJoinByCode(inviteCode, message = '') {
  const user = await base44.auth.me();
  // Find campaign with this invite code
  const results = await base44.entities.Campaign.filter({ invite_code: inviteCode.toUpperCase() });
  const campaign = results[0];
  if (!campaign) throw new Error('Campaign not found. Check the invite code and try again.');
  if (campaign.status !== 'lobby') throw new Error('This campaign has already started and is not accepting new players.');

  // Check not already a player
  const existing = await base44.entities.CampaignPlayer.filter({ campaign_id: campaign.id, user_id: user.id });
  if (existing.length > 0) throw new Error('You are already a player in this campaign.');

  // Check for existing pending request
  const existingReq = await base44.entities.CampaignInvite.filter({
    campaign_id: campaign.id,
    invitee_user_id: user.id,
    type: 'join_request',
    status: 'pending',
  });
  if (existingReq.length > 0) throw new Error('You already have a pending join request for this campaign.');

  await base44.entities.CampaignInvite.create({
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    invited_by_user_id: user.id,
    invited_by_name: user.display_name || user.full_name || 'Unknown',
    invitee_user_id: user.id,
    invitee_email: user.email,
    type: 'join_request',
    status: 'pending',
    message,
  });

  return campaign;
}

// ─── Accept Invite & Join ─────────────────────────────────────────────────────

export async function acceptInviteAndJoin(invite, playerSetup) {
  const user = await base44.auth.me();
  await base44.entities.CampaignPlayer.create({
    campaign_id: invite.campaign_id,
    user_id: user.id,
    display_name: playerSetup.display_name,
    color: playerSetup.color,
    faction_name: playerSetup.faction_name || null,
    is_admin: false,
    is_ready: false,
    troop_count: 0,
    is_eliminated: false,
  });
  await base44.entities.CampaignInvite.update(invite.id, { status: 'accepted' });
}

// ─── Lobby Actions ────────────────────────────────────────────────────────────

export async function setPlayerReady(playerId, isReady) {
  return base44.entities.CampaignPlayer.update(playerId, { is_ready: isReady });
}

export async function updatePlayerSetup(playerId, { display_name, color, faction_name }) {
  return base44.entities.CampaignPlayer.update(playerId, { display_name, color, faction_name });
}

export async function startCampaign(campaignId) {
  return base44.entities.Campaign.update(campaignId, {
    status: 'active',
    current_round: 1,
    current_phase: 'draft',
  });
}

export async function kickPlayer(playerId) {
  return base44.entities.CampaignPlayer.delete(playerId);
}

// ─── Pending Invites for Current User ────────────────────────────────────────

export function useMyInvites() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      const data = await base44.entities.CampaignInvite.filter({
        invitee_user_id: user.id,
        status: 'pending',
        type: 'invite',
      });
      // Also check by email
      const byEmail = await base44.entities.CampaignInvite.filter({
        invitee_email: user.email,
        status: 'pending',
        type: 'invite',
      });
      // Deduplicate
      const all = [...data];
      for (const inv of byEmail) {
        if (!all.find(i => i.id === inv.id)) all.push(inv);
      }
      setInvites(all);
    } catch {
      setError('Failed to load invites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { invites, loading, error, reload: load };
}