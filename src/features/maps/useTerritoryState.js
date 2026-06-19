/**
 * features/maps/useTerritoryState.js
 *
 * Loads and subscribes to TerritoryState records for a campaign.
 * Returns a keyed map: { [territory_id]: TerritoryState }
 *
 * Canonical identifier: territory_id (matches TerritoryDefinition.territory_id)
 *
 * TerritoryState is SEPARATE from the static map schema (mapData.ts).
 *   Schema = shape/position/adjacency/resources (static, per map definition)
 *   State  = owner/troops/structures (dynamic, per campaign instance)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

// Phases where sensitive data (troop counts, resource storage) is hidden for non-owners.
// 'initial_deploy' is included so troop counts never flash visible during game start.
const HIDDEN_INFO_PHASES = new Set(['attack', 'battle', 'fortify', 'deploy', 'initial_deploy']);

/**
 * Apply the privacy gate to a territory state record.
 * myCampaignPlayerIds is a Set of CampaignPlayer.id values for the current user.
 */
function applyPrivacyGate(record, myCampaignPlayerIds, phase) {
  if (!record) return record;
  // Always show own territories in full.
  if (record.owner_player_id && myCampaignPlayerIds.has(record.owner_player_id)) return record;
  // Mask during all active gameplay phases — including null phase for safety during transitions.
  // If phase is unknown/null but record has an owner, mask it defensively.
  if (phase && !HIDDEN_INFO_PHASES.has(phase)) return record;
  return {
    ...record,
    troop_count: null,       // null = hidden (UI renders '???' )
    resource_storage: null,  // null = hidden
    _hidden: true,
  };
}

// myPlayerId here is the CampaignPlayer.id (not the auth user id).
// Pass null to disable masking (e.g. during setup phases or when player is unknown).
export function useTerritoryState(campaignId, myPlayerId, phase) {
  const [stateById, setStateById] = useState({}); // { [territory_id]: TerritoryState }
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Build a Set of CampaignPlayer IDs that belong to myPlayerId.
  // myPlayerId is the CampaignPlayer.id passed in from ActiveCampaign.
  const myPlayerIdSet = useMemo(() => new Set(myPlayerId ? [myPlayerId] : []), [myPlayerId]);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const records = await base44.entities.TerritoryState.filter({ campaign_id: campaignId });
      const keyed = {};
      for (const r of records) keyed[r.territory_id] = applyPrivacyGate(r, myPlayerIdSet, phase);
      setStateById(keyed);
    } catch {
      setError('Failed to load territory state.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, myPlayerIdSet, phase]);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription
  useEffect(() => {
    if (!campaignId) return;
    const unsub = base44.entities.TerritoryState.subscribe((event) => {
      if (event.data?.campaign_id !== campaignId) return;
      setStateById(prev => {
        const tid = event.data?.territory_id;
        if (!tid) return prev;
        if (event.type === 'delete') {
          const next = { ...prev };
          delete next[tid];
          return next;
        }
        return { ...prev, [tid]: applyPrivacyGate(event.data, myPlayerIdSet, phase) };
      });
    });
    return unsub;
  }, [campaignId, myPlayerId, phase]);

  return { stateById, loading, error, reload: load };
}