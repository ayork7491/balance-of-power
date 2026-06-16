/**
 * DiplomaticActionForm — Sprint 4H
 *
 * Rendered inline inside DiplomaticActionsPanel when an action is selected.
 * Shows region selector (for spending) + action-specific target selectors.
 */
import { useState, useMemo, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { PLAYER_COLORS } from '@/config/theme';
import { base44 } from '@/api/base44Client';

const REGION_LABELS = {
  outer_passes:       'Outer Passes',
  high_crown:         'High Crown',
  northern_wilds:     'Northern Wilds',
  deepwoods:          'Deepwoods',
  northern_ruins:     'Northern Ruins',
  central_crossroads: 'Central Crossroads',
  southern_ruins:     'Southern Ruins',
  western_plains:     'Western Plains',
  eastern_granaries:  'Eastern Granaries',
  northern_isles:     'Northern Isles',
  southern_fractures: 'Southern Fractures',
};

const SC_TERRITORY_REGION = {
  I8:'outer_passes', I4:'outer_passes', I6:'outer_passes', I7:'outer_passes',
  I1:'high_crown',   I2:'high_crown',   I3:'high_crown',   I5:'high_crown',
  W1:'northern_wilds',W2:'northern_wilds',W3:'northern_wilds',W4:'northern_wilds',W5:'northern_wilds',
  W6:'deepwoods',    W7:'deepwoods',    W8:'deepwoods',    W9:'deepwoods',
  B1:'northern_ruins',B3:'northern_ruins',B2:'northern_ruins',B4:'northern_ruins',
  B5:'central_crossroads',B6:'central_crossroads',B7:'central_crossroads',
  B8:'southern_ruins',B9:'southern_ruins',B10:'southern_ruins',
  S1:'western_plains',S4:'western_plains',S7:'western_plains',S2:'western_plains',
  S5:'eastern_granaries',S8:'eastern_granaries',S3:'eastern_granaries',
  S6:'eastern_granaries',S9:'eastern_granaries',
  C1:'northern_isles',C2:'northern_isles',C3:'northern_isles',C4:'northern_isles',
  C5:'southern_fractures',C6:'southern_fractures',C7:'southern_fractures',C8:'southern_fractures',
};

function getPlayerColor(players, playerId) {
  const p = players?.find(pl => pl.id === playerId);
  return PLAYER_COLORS.find(c => c.id === p?.color)?.hex ?? '#888';
}

export default function DiplomaticActionForm({
  actionType,
  cost,
  regionPools,
  players,
  myPlayer,
  mapDef,
  stateById,
  campaign,
  onSubmit,
  onCancel,
}) {
  const [selectedRegion, setSelectedRegion] = useState('');
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [targetPlayerBId, setTargetPlayerBId] = useState('');
  const [targetTerritoryId, setTargetTerritoryId] = useState('');
  const [targetSupplyRouteId, setTargetSupplyRouteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [supplyRoutes, setSupplyRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Load supply routes when merchant_convoy is selected
  useEffect(() => {
    if (actionType !== 'merchant_convoy' || !campaign?.id) return;
    setLoadingRoutes(true);
    base44.entities.SupplyRoute.filter({ campaign_id: campaign.id })
      .then(routes => setSupplyRoutes(routes.filter(r => r.route_status === 'active')))
      .catch(() => setSupplyRoutes([]))
      .finally(() => setLoadingRoutes(false));
  }, [actionType, campaign?.id]);

  // Regions with enough influence for this action cost
  const affordableRegions = useMemo(() => {
    return Object.entries(regionPools)
      .filter(([, v]) => v >= cost)
      .sort(([, a], [, b]) => b - a)
      .map(([regionId, amount]) => ({ regionId, amount }));
  }, [regionPools, cost]);

  // All regions the player has any influence in (for display even if insufficient)
  const allRegions = useMemo(() => {
    return Object.entries(regionPools)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([regionId, amount]) => ({ regionId, amount }));
  }, [regionPools]);

  // Other players (exclude self)
  const otherPlayers = useMemo(
    () => (players ?? []).filter(p => p.id !== myPlayer?.id && !p.is_eliminated),
    [players, myPlayer]
  );

  // For influence_network: ALL territories (spread goes to adjacent regardless of region)
  // For broker_peace: territories in selected region
  const territoriesInRegion = useMemo(() => {
    if (!selectedRegion || !mapDef) return [];
    if (actionType === 'influence_network') {
      return [...mapDef.territories].sort((a, b) => a.name.localeCompare(b.name));
    }
    return mapDef.territories
      .filter(t => SC_TERRITORY_REGION[t.territory_id] === selectedRegion)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedRegion, mapDef, actionType]);

  const validate = () => {
    if (!selectedRegion) return 'Select a region to spend influence from.';
    const poolAmt = regionPools[selectedRegion] ?? 0;
    if (poolAmt < cost) return `Not enough influence in this region. Have ${poolAmt}, need ${cost}.`;

    if (actionType === 'influence_network' && !targetTerritoryId) return 'Select a target territory.';
    if (actionType === 'merchant_convoy' && !targetSupplyRouteId) return 'Enter a supply route ID.';
    if (actionType === 'non_aggression_pact' && !targetPlayerId) return 'Select a target player.';
    if (actionType === 'broker_peace' && !targetTerritoryId) return 'Select a target territory.';
    if (actionType === 'coalition_warfare' && !targetPlayerId) return 'Select a target player.';
    if (actionType === 'power_broker') {
      if (!targetPlayerId) return 'Select Player A.';
      if (!targetPlayerBId) return 'Select Player B.';
      if (targetPlayerId === targetPlayerBId) return 'Player A and Player B must be different.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        action_type: actionType,
        region_id: selectedRegion,
        target_territory_id: targetTerritoryId || undefined,
        target_player_id: targetPlayerId || undefined,
        target_player_b_id: targetPlayerBId || undefined,
        target_supply_route_id: targetSupplyRouteId || undefined,
      });
    } catch (e) {
      setLocalError(e?.response?.data?.error ?? e?.message ?? 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasAffordableRegions = affordableRegions.length > 0;

  return (
    <div className="px-3 py-2.5 space-y-3 bg-muted/10 border-t border-border">

      {!hasAffordableRegions && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          Not enough influence in any region. Need {cost} 🕊 in at least one region.
        </div>
      )}

      {/* Region selector */}
      <div>
        <label className="text-[10px] font-display tracking-wider uppercase text-muted-foreground block mb-1">
          Spend from Region
        </label>
        <select
          value={selectedRegion}
          onChange={e => { setSelectedRegion(e.target.value); setTargetTerritoryId(''); }}
          className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
        >
          <option value="">— Select region —</option>
          {allRegions.map(({ regionId, amount }) => (
            <option key={regionId} value={regionId} disabled={amount < cost}>
              {REGION_LABELS[regionId] ?? regionId} ({amount} 🕊){amount < cost ? ' — insufficient' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Target: territory (influence_network, broker_peace) */}
      {(actionType === 'influence_network' || actionType === 'broker_peace') && selectedRegion && (
        <div>
          <label className="text-[10px] font-display tracking-wider uppercase text-muted-foreground block mb-1">
            {actionType === 'influence_network' ? 'Source Territory (adjacent territories gain +1 Perm. Influence)' : 'Protected Territory (negate battle generation)'}
          </label>
          <select
            value={targetTerritoryId}
            onChange={e => setTargetTerritoryId(e.target.value)}
            className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
          >
            <option value="">— Select territory —</option>
            {territoriesInRegion.map(t => (
              <option key={t.territory_id} value={t.territory_id}>{t.name} ({t.territory_id})</option>
            ))}
          </select>
          {actionType === 'influence_network' && territoriesInRegion.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">No territories in this region.</p>
          )}
        </div>
      )}

      {/* Target: territory (coalition_warfare — optional) */}
      {actionType === 'coalition_warfare' && selectedRegion && (
        <div>
          <label className="text-[10px] font-display tracking-wider uppercase text-muted-foreground block mb-1">
            Battle Territory (optional)
          </label>
          <select
            value={targetTerritoryId}
            onChange={e => setTargetTerritoryId(e.target.value)}
            className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
          >
            <option value="">— Any battle —</option>
            {territoriesInRegion.map(t => (
              <option key={t.territory_id} value={t.territory_id}>{t.name} ({t.territory_id})</option>
            ))}
          </select>
        </div>
      )}

      {/* Target: single player */}
      {['non_aggression_pact', 'coalition_warfare'].includes(actionType) && (
        <div>
          <label className="text-[10px] font-display tracking-wider uppercase text-muted-foreground block mb-1">
            {actionType === 'non_aggression_pact' ? 'Target Player (cannot attack you for 1 round)' : 'Coerced Player (must contribute troops)'}
          </label>
          <div className="space-y-1">
            {otherPlayers.map(p => {
              const color = getPlayerColor(players, p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setTargetPlayerId(p.id === targetPlayerId ? '' : p.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-xs transition-colors ${
                    targetPlayerId === p.id
                      ? 'border-status-info/60 bg-status-info/10 text-foreground'
                      : 'border-border bg-muted/5 text-foreground hover:bg-muted/20'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {p.display_name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Target: two players (power_broker) */}
      {actionType === 'power_broker' && (
        <>
          <div>
            <label className="text-[10px] font-display tracking-wider uppercase text-muted-foreground block mb-1">
              Player A (pact participant)
            </label>
            <div className="space-y-1">
              {otherPlayers.map(p => {
                const color = getPlayerColor(players, p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setTargetPlayerId(p.id === targetPlayerId ? '' : p.id)}
                    disabled={p.id === targetPlayerBId}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-xs transition-colors disabled:opacity-40 ${
                      targetPlayerId === p.id
                        ? 'border-status-info/60 bg-status-info/10 text-foreground'
                        : 'border-border bg-muted/5 text-foreground hover:bg-muted/20'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {p.display_name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-display tracking-wider uppercase text-muted-foreground block mb-1">
              Player B (pact participant)
            </label>
            <div className="space-y-1">
              {otherPlayers.map(p => {
                const color = getPlayerColor(players, p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setTargetPlayerBId(p.id === targetPlayerBId ? '' : p.id)}
                    disabled={p.id === targetPlayerId}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-xs transition-colors disabled:opacity-40 ${
                      targetPlayerBId === p.id
                        ? 'border-status-info/60 bg-status-info/10 text-foreground'
                        : 'border-border bg-muted/5 text-foreground hover:bg-muted/20'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {p.display_name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Supply route selector (merchant_convoy) */}
      {actionType === 'merchant_convoy' && (
        <div>
          <label className="text-[10px] font-display tracking-wider uppercase text-muted-foreground block mb-1">
            Supply Route to Protect
          </label>
          {loadingRoutes ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading supply routes…
            </div>
          ) : supplyRoutes.length === 0 ? (
            <div className="flex items-start gap-1.5 text-xs text-destructive px-2 py-1.5 rounded border border-destructive/30 bg-destructive/10">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              No active supply routes exist. Establish a supply route first before using Merchant Convoy.
            </div>
          ) : (
            <>
              <select
                value={targetSupplyRouteId}
                onChange={e => setTargetSupplyRouteId(e.target.value)}
                className="w-full text-xs bg-input border border-border rounded px-2 py-1.5 text-foreground"
              >
                <option value="">— select supply route —</option>
                {supplyRoutes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.hub_territory_id} → {r.source_territory_id} ({r.resource_type})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">The selected route will be protected from disruption this round.</p>
            </>
          )}
        </div>
      )}

      {/* War rations — no extra target needed */}
      {actionType === 'war_rations' && selectedRegion && (
        <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-2 space-y-1">
          <p className="text-[10px] text-amber-400 font-semibold">Preventative Effect — Current Round</p>
          <p className="text-[10px] text-muted-foreground">
            Prevents development decay and food upkeep loss for your faction this round.
            Your capital's development progress will not degrade if food investment falls short.
          </p>
          <p className="text-[10px] text-muted-foreground">
            Expires end of round {campaign?.current_round ?? '?'}. Affects your player only.
          </p>
        </div>
      )}

      {localError && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {localError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !hasAffordableRegions}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded bg-status-info/20 border border-status-info/40 text-status-info hover:bg-status-info/30 disabled:opacity-40 transition-colors font-medium"
        >
          {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
          Spend {cost} 🕊
        </button>
      </div>
    </div>
  );
}