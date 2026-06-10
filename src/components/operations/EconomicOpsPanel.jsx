/**
 * EconomicOpsPanel — Sprint 5B.5
 *
 * Economic tab content during Operations Phase.
 * Shows construction project staging only.
 * No activation controls, no logistics, no static ops list.
 *
 * Props:
 *   campaign
 *   myPlayer
 *   actingAsPlayerId
 *   players
 *   mapDef
 *   stateById
 *   operationsStatus    — from OperationsPhaseHeader
 *   onStaged            — called after staging changes
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, HardHat, X, CheckCircle2, Hammer } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Building definitions for the construction selector
const BUILDING_OPTIONS = [
  // Military
  { type: 'barracks',       label: 'Barracks',        pillar: 'military',   icon: '🏰', description: 'Increases troop training capacity.' },
  { type: 'war_council',    label: 'War Council',      pillar: 'military',   icon: '⚔️', description: 'Grants +1 attack declaration per round.' },
  { type: 'logistics_corps',label: 'Logistics Corps',  pillar: 'military',   icon: '🚩', description: 'Extends fortification range.' },
  // Economic
  { type: 'marketplace',    label: 'Marketplace',      pillar: 'economic',   icon: '🏪', description: 'Increases resource activation limit.' },
  { type: 'resource_hub',   label: 'Resource Hub',     pillar: 'economic',   icon: '🏭', description: 'Enables supply route connections.' },
  { type: 'warehouse',      label: 'Warehouse',        pillar: 'economic',   icon: '📦', description: 'Protects stored resources from raids.' },
  // Diplomatic
  { type: 'embassy',        label: 'Embassy',          pillar: 'diplomatic', icon: '🏛️', description: 'Grants +1 spendable influence per round.' },
  { type: 'monument',       label: 'Monument',         pillar: 'diplomatic', icon: '🗿', description: 'Increases permanent influence in territory.' },
];

const PILLAR_COLORS = {
  military:   { text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10' },
  economic:   { text: 'text-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10' },
  diplomatic: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
};

export default function EconomicOpsPanel({ campaign, myPlayer, actingAsPlayerId, players, mapDef, stateById, operationsStatus, onStaged }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const actingPlayer = actingAsPlayerId ? players?.find(p => p.id === actingAsPlayerId) ?? myPlayer : myPlayer;

  const [staging, setStaging] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removeError, setRemoveError] = useState(null);

  const isLocked = operationsStatus?.economic?.is_locked || operationsStatus?.operations_locked;

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('operationsLockPhase', {
        action: 'getOperationsStatus',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      });
      setStaging(res.data?.economic ?? null);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load economic ops state');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { load(); }, [load]);

  // Sync from parent status
  useEffect(() => {
    if (operationsStatus?.economic) setStaging(operationsStatus.economic);
  }, [operationsStatus?.economic]);

  const myTerritories = Object.values(stateById).filter(s => s.owner_player_id === actingPlayerId);
  const stagedProjects = staging?.staged ?? [];
  const atLimit = stagedProjects.length >= (staging?.projects_limit ?? 1);

  const handleStage = async () => {
    if (!selectedBuilding || !selectedTerritory) return;
    setSubmitting(true);
    setError(null);
    try {
      await base44.functions.invoke('operationsLockPhase', {
        action: 'stageEconomic',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        building_type: selectedBuilding,
        territory_id: selectedTerritory,
      });
      setSelectedBuilding(null);
      setSelectedTerritory('');
      await load();
      onStaged?.();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to stage project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (index) => {
    setRemoveError(null);
    try {
      await base44.functions.invoke('operationsLockPhase', {
        action: 'removeStaged',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        pillar: 'economic',
        index,
      });
      await load();
      onStaged?.();
    } catch (e) {
      setRemoveError(e?.response?.data?.error ?? 'Failed to remove project');
    }
  };

  const selectedBuildingDef = BUILDING_OPTIONS.find(b => b.type === selectedBuilding);

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
          <HardHat className="w-3.5 h-3.5" /> Construction Projects
          {isLocked && <span className="ml-1 text-green-400">(locked)</span>}
        </p>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {removeError && <p className="text-xs text-destructive">{removeError}</p>}

      {loading && !staging ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Capacity */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-display tracking-wide uppercase">Capacity</span>
            <span className={`font-mono font-bold ${atLimit ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {stagedProjects.length} / {staging?.projects_limit ?? 1}
            </span>
          </div>

          {/* Resources available */}
          {staging?.resources && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span>Gold <span className="text-amber-400 font-mono">{staging.resources.gold ?? 0}</span></span>
              <span>Iron <span className="text-foreground font-mono">{staging.resources.iron ?? 0}</span></span>
              <span>Timber <span className="text-foreground font-mono">{staging.resources.timber ?? 0}</span></span>
              <span>Stone <span className="text-foreground font-mono">{staging.resources.stone ?? 0}</span></span>
            </div>
          )}

          {/* Staged projects */}
          {stagedProjects.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Staged Projects</p>
              {stagedProjects.map((proj, i) => {
                const def = BUILDING_OPTIONS.find(b => b.type === proj.building_type);
                const colors = PILLAR_COLORS[def?.pillar ?? 'economic'];
                const tname = mapDef?.territories?.find(t => t.territory_id === proj.territory_id)?.name ?? proj.territory_id;
                return (
                  <div key={i} className={`flex items-center gap-2 px-2 py-2 rounded border ${colors.border} ${colors.bg}`}>
                    <span className="text-base">{def?.icon ?? '🏗️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${colors.text}`}>{def?.label ?? proj.building_type}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{tname}</p>
                    </div>
                    {!isLocked && (
                      <button onClick={() => handleRemove(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isLocked && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {isLocked && (
            <div className="flex items-center gap-1.5 text-[10px] text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              Construction committed. Buildings enter 'planned' status.
            </div>
          )}

          {/* Building selector */}
          {!isLocked && !atLimit && (
            <div className="space-y-2 pt-1 border-t border-border">
              <p className="text-[10px] font-display tracking-wider uppercase text-muted-foreground">Stage a Construction Project</p>

              {/* Building type grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {BUILDING_OPTIONS.map(b => {
                  const colors = PILLAR_COLORS[b.pillar];
                  const isSelected = selectedBuilding === b.type;
                  return (
                    <button
                      key={b.type}
                      onClick={() => setSelectedBuilding(isSelected ? null : b.type)}
                      className={`flex items-center gap-2 px-2 py-2 rounded border text-left transition-all ${
                        isSelected ? `${colors.border} ${colors.bg}` : 'border-border bg-muted/10 hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="text-sm shrink-0">{b.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-semibold ${isSelected ? colors.text : 'text-foreground'} truncate`}>{b.label}</p>
                        <p className="text-[9px] text-muted-foreground capitalize">{b.pillar}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedBuildingDef && (
                <p className="text-[10px] text-muted-foreground italic">{selectedBuildingDef.description}</p>
              )}

              {/* Territory selector */}
              {selectedBuilding && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Select territory:</p>
                  <select
                    value={selectedTerritory}
                    onChange={e => setSelectedTerritory(e.target.value)}
                    className="w-full bg-muted/20 border border-border rounded px-2 py-1.5 text-xs text-foreground"
                  >
                    <option value="">— choose territory —</option>
                    {myTerritories.map(t => {
                      const name = mapDef?.territories?.find(td => td.territory_id === t.territory_id)?.name ?? t.territory_id;
                      return <option key={t.territory_id} value={t.territory_id}>{name}</option>;
                    })}
                  </select>
                </div>
              )}

              <button
                onClick={handleStage}
                disabled={!selectedBuilding || !selectedTerritory || submitting}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 text-xs font-display tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hammer className="w-3.5 h-3.5" />}
                Stage Project
              </button>
            </div>
          )}

          {!isLocked && atLimit && (
            <p className="text-[10px] text-muted-foreground text-center italic">
              Construction capacity reached for this round. Remove a project to change selection.
            </p>
          )}

          {myTerritories.length === 0 && (
            <p className="text-xs text-muted-foreground">You own no territories.</p>
          )}
        </>
      )}
    </div>
  );
}