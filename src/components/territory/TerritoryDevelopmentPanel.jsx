/**
 * TerritoryDevelopmentPanel — QA1 Territory Development System
 *
 * Shows territory development level, food investment, capital status,
 * and allows food investment and capital designation.
 *
 * Props:
 *   campaign, myPlayer, actingAsPlayerId, players, mapDef
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Star, TrendingUp, Wheat, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { RESOURCE_CONFIG } from '@/config/resourceConfig';

const LEVEL_LABELS = {
  1: 'Frontier',
  2: 'Settled',
  3: 'Established',
  4: 'Thriving',
  5: 'Prosperous',
};

const LEVEL_COLORS = {
  1: 'text-muted-foreground',
  2: 'text-amber-400',
  3: 'text-green-400',
  4: 'text-blue-400',
  5: 'text-purple-400',
};

function ResourceChip({ type }) {
  const cfg = RESOURCE_CONFIG[type] ?? { label: type, icon: '?', color: 'text-foreground' };
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-mono ${cfg.color}`}>
      {cfg.icon}
    </span>
  );
}

function ProgressBar({ progress, total, color = 'bg-amber-400' }) {
  const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;
  return (
    <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function TerritoryDevelopmentPanel({ campaign, myPlayer, actingAsPlayerId, players, mapDef }) {
  const actingPlayerId = actingAsPlayerId ?? myPlayer?.id;
  const round = campaign?.current_round ?? 1;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [investing, setInvesting] = useState({});
  const [settingCapital, setSettingCapital] = useState(false);
  const [foodInputs, setFoodInputs] = useState({});

  const load = useCallback(async () => {
    if (!campaign?.id || !actingPlayerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('territoryDevelopment', {
        action: 'getPlayerDevelopment',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
      });
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to load development data');
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, actingPlayerId]);

  useEffect(() => { load(); }, [load]);

  const getTerritoryName = (tid) =>
    mapDef?.territories?.find(t => t.territory_id === tid)?.name ?? tid;

  const handleInvestFood = async (territoryId) => {
    const amount = parseInt(foodInputs[territoryId] ?? 1);
    if (!amount || amount <= 0) return;
    setInvesting(prev => ({ ...prev, [territoryId]: true }));
    try {
      await base44.functions.invoke('territoryDevelopment', {
        action: 'investFood',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        territory_id: territoryId,
        food_amount: amount,
      });
      setFoodInputs(prev => ({ ...prev, [territoryId]: 1 }));
      await load();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to invest food');
    } finally {
      setInvesting(prev => ({ ...prev, [territoryId]: false }));
    }
  };

  const handleSetCapital = async (territoryId) => {
    setSettingCapital(true);
    try {
      await base44.functions.invoke('territoryDevelopment', {
        action: 'setCapital',
        campaign_id: campaign.id,
        acting_as_player_id: actingPlayerId,
        territory_id: territoryId,
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.error ?? 'Failed to set capital');
    } finally {
      setSettingCapital(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading territory development…
      </div>
    );
  }

  const territories = data?.territories ?? [];
  const foodAvailable = data?.food_available ?? 0;
  const capitalId = data?.capital_territory_id ?? null;

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] tracking-widest uppercase text-amber-400 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Territory Development
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Wheat className="w-3 h-3 text-green-400" /> {foodAvailable} food
          </span>
          <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!capitalId && territories.length > 0 && (
        <div className="px-2 py-2 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">
          ⚑ You haven't designated a capital. Select one below to focus your development.
        </div>
      )}

      {territories.length === 0 && (
        <p className="text-xs text-muted-foreground">No territories owned.</p>
      )}

      <div className="space-y-2">
        {territories.map(t => {
          const name = getTerritoryName(t.territory_id);
          const levelColor = LEVEL_COLORS[Math.min(t.development_level, 5)] ?? 'text-foreground';
          const levelLabel = LEVEL_LABELS[Math.min(t.development_level, 5)] ?? `Level ${t.development_level}`;
          const isCapital = t.is_capital;
          const foodInput = parseInt(foodInputs[t.territory_id] ?? 1);
          const canAfford = foodAvailable >= foodInput && foodInput > 0;
          const isInvesting = investing[t.territory_id] ?? false;

          return (
            <div
              key={t.territory_id}
              className={`rounded border p-2.5 space-y-1.5 ${isCapital ? 'border-amber-400/50 bg-amber-400/5' : 'border-border bg-muted/5'}`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isCapital && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span className="text-xs font-medium text-foreground truncate">{name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-mono font-bold ${levelColor}`}>
                    Lv.{t.development_level} {levelLabel}
                  </span>
                </div>
              </div>

              {/* Unlocked resources */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground">Resources:</span>
                {t.unlocked_resources.includes('primary') && t.primary_resource && (
                  <ResourceChip type={t.primary_resource} />
                )}
                {t.unlocked_resources.includes('secondary') && t.secondary_resource && (
                  <ResourceChip type={t.secondary_resource} />
                )}
                {t.unlocked_resources.includes('tertiary') && t.tertiary_resource && (
                  <ResourceChip type={t.tertiary_resource} />
                )}
                {t.secondary_resource && !t.unlocked_resources.includes('secondary') && (
                  <span className="text-[9px] text-muted-foreground/40 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> {RESOURCE_CONFIG[t.secondary_resource]?.icon}
                  </span>
                )}
                <span className="ml-auto text-[9px] text-muted-foreground">
                  {t.unlocked_slot_count} slot{t.unlocked_slot_count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Progress to Lv.{t.development_level + 1}</span>
                  <span className="font-mono">{t.development_progress}/{t.food_to_next_level} 🌾</span>
                </div>
                <ProgressBar
                  progress={t.development_progress}
                  total={t.food_to_next_level}
                  color={isCapital ? 'bg-amber-400' : 'bg-green-500'}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-0.5">
                {/* Invest food */}
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="number"
                    min="1"
                    max={foodAvailable}
                    value={foodInputs[t.territory_id] ?? 1}
                    onChange={e => setFoodInputs(prev => ({ ...prev, [t.territory_id]: e.target.value }))}
                    className="w-12 bg-muted/20 border border-border rounded px-1.5 py-1 text-xs text-foreground"
                  />
                  <button
                    onClick={() => handleInvestFood(t.territory_id)}
                    disabled={isInvesting || !canAfford || foodAvailable === 0}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-green-500/40 bg-green-500/10 text-green-400 text-[10px] font-display tracking-wider uppercase hover:brightness-110 disabled:opacity-40 transition-all"
                  >
                    {isInvesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wheat className="w-3 h-3" />}
                    Invest
                  </button>
                </div>

                {/* Set capital */}
                {!isCapital && (
                  <button
                    onClick={() => handleSetCapital(t.territory_id)}
                    disabled={settingCapital}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-amber-400/30 bg-amber-400/5 text-amber-400/70 text-[10px] hover:brightness-110 disabled:opacity-40 transition-all"
                    title="Set as Capital"
                  >
                    <Star className="w-3 h-3" />
                  </button>
                )}
                {isCapital && (
                  <span className="text-[9px] text-amber-400 font-mono shrink-0">★ Capital</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center italic">
        Invest food to develop territories. Higher levels unlock more resources and building slots.
      </p>
    </div>
  );
}