/**
 * usePhaseViewState — Unified phase view state hook (Atomic Architecture)
 *
 * Replaces:
 *   - useTerritoryState (TerritoryState.filter + subscribe)
 *   - useInfluenceState (separate influencePhase call)
 *   - useIntelReports   (separate intelligencePhase call)
 *   - loadTerritoryBuildings (separate entity reads in ActiveCampaign)
 *
 * Single getPhaseViewState call returns all filtered data the client needs.
 * No live subscription. Reloads on:
 *   - campaign open
 *   - phase change
 *   - round change
 *   - acting-as player change
 *   - explicit reload() call (after lock-in / phase transition)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Debounce delay (ms) for acting-as player switches to prevent thundering-herd
// API calls when an admin rapidly cycles through player perspectives.
const ACTING_AS_DEBOUNCE_MS = 400;

export function usePhaseViewState({
  campaignId,
  actingAsPlayerId = null,
  phase,
  round,
  enabled = true,
}) {
  // Debounced acting-as player ID — only updates after the user stops switching
  const [debouncedActingAsPlayerId, setDebouncedActingAsPlayerId] = useState(actingAsPlayerId);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedActingAsPlayerId(actingAsPlayerId);
    }, ACTING_AS_DEBOUNCE_MS);
    return () => clearTimeout(debounceTimerRef.current);
  }, [actingAsPlayerId]);
  const [stateById, setStateById]                     = useState({}); // { [territory_id]: TerritoryState }
  const [influenceByTerritory, setInfluenceByTerritory] = useState({});
  const [influenceByRegion, setInfluenceByRegion]       = useState({});
  const [intelReportByTerritory, setIntelReportByTerritory] = useState({});
  const [devRecordsByTerritoryId, setDevRecordsByTerritoryId] = useState({});
  const [territoryBuildingsById, setTerritoryBuildingsById] = useState({});
  const [allSupplyRoutes, setAllSupplyRoutes]           = useState([]);
  const [spreadThreshold, setSpreadThreshold]           = useState(10);
  const [loading, setLoading]                           = useState(true);
  const [error, setError]                               = useState(null);

  // Track last loaded key to avoid redundant fetches
  const lastLoadKey = useRef(null);

  const load = useCallback(async () => {
    if (!campaignId || !enabled) return;
    setLoading(true);
    setError(null);
    const loadStart = performance.now();
    console.log('[usePhaseViewState] fetch triggered', { campaignId, actingAsPlayerId: debouncedActingAsPlayerId, phase, round, ts: new Date().toISOString() });
    try {
      const res = await base44.functions.invoke('getPhaseViewState', {
        campaign_id: campaignId,
        acting_as_player_id: debouncedActingAsPlayerId ?? undefined,
      });
      const data = res.data ?? {};

      // Territory state — keyed by territory_id
      const keyed = {};
      for (const t of (data.territories ?? [])) keyed[t.territory_id] = t;
      setStateById(keyed);

      setInfluenceByTerritory(data.influence_by_territory ?? {});
      setInfluenceByRegion(data.influence_by_region ?? {});
      setIntelReportByTerritory(data.intel_reports ?? {});
      setSpreadThreshold(data.spread_threshold ?? 10);

      setDevRecordsByTerritoryId(data.dev_records ?? {});
      setTerritoryBuildingsById(data.buildings_by_territory ?? {});
      setAllSupplyRoutes(data.supply_routes ?? []);
      const elapsed = Math.round(performance.now() - loadStart);
      const territoryCount = (data.territories ?? []).length;
      console.log(`[usePhaseViewState] loaded in ${elapsed}ms — ${territoryCount} territories`);
    } catch (err) {
      console.error('[usePhaseViewState] load failed:', err?.message);
      setError('Failed to load phase view state.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, debouncedActingAsPlayerId, enabled]);

  // Reload whenever campaign, phase, round, or acting-as player changes
  useEffect(() => {
    const key = `${campaignId}|${debouncedActingAsPlayerId}|${phase}|${round}`;
    if (key === lastLoadKey.current) return;
    lastLoadKey.current = key;
    load();
  }, [campaignId, debouncedActingAsPlayerId, phase, round, load]);

  return {
    // Territory state (compatible with existing stateById consumers)
    stateById,
    // Influence
    influenceByTerritory,
    influenceByRegion,
    spreadThreshold,
    // Intel
    intelReportByTerritory,
    // Buildings / dev / supply routes
    devRecordsByTerritoryId,
    territoryBuildingsById,
    allSupplyRoutes,
    // Meta
    loading,
    error,
    reload: load,
  };
}