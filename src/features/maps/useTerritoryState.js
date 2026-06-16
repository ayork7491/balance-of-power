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
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Phases where sensitive data (troop counts, resource storage) is hidden for non-owners.
const HIDDEN_INFO_PHASES = new Set(['attack', 'battle', 'fortify', 'deploy']);

/**
 * Apply the privacy gate to a territory state record.
 * If the territory is not owned by myPlayerId and we are in a hidden-info phase,
 * mask troop_count and resource_storage so the raw numbers never reach the UI.
 */
function applyPrivacyGate(record, myPlayerId, phase) {
  if (!record) return record;
  // Always show own territories in full.
  if (record.owner_player_id && record.owner_player_id === myPlayerId) return record;
  // Only mask during active gameplay phases.
  if (!phase || !HIDDEN_INFO_PHASES.has(phase)) return record;
  return {
    ...record,
    troop_count: null,       // null = hidden (UI renders '???' )
    resource_storage: null,  // null = hidden
    _hidden: true,
  };
}

export function useTerritoryState(campaignId, myPlayerId, phase) {
  const [stateById, setStateById] = useState({}); // { [territory_id]: TerritoryState }
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const records = await base44.entities.TerritoryState.filter({ campaign_id: campaignId });
      const keyed = {};
      for (const r of records) keyed[r.territory_id] = applyPrivacyGate(r, myPlayerId, phase);
      setStateById(keyed);
    } catch {
      setError('Failed to load territory state.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, myPlayerId, phase]);

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
        return { ...prev, [tid]: applyPrivacyGate(event.data, myPlayerId, phase) };
      });
    });
    return unsub;
  }, [campaignId, myPlayerId, phase]);

  return { stateById, loading, error, reload: load };
}