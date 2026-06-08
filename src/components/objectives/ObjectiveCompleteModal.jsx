/**
 * ObjectiveCompleteModal — dialog for marking an objective complete.
 * Requires player to select a placement territory (for influence reward).
 *
 * Props:
 *   cardDef           — SecretObjectiveCard definition
 *   campaignId
 *   actingPlayer
 *   stateById         — TerritoryState indexed by territory_id (for territory picker)
 *   players           — CampaignPlayer[]
 *   onCompleted       — called after success
 *   onClose
 */
import { useState } from 'react';
import { Trophy, MapPin, AlertCircle, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { OBJECTIVE_CATEGORY_CONFIG, OBJECTIVE_TIER_REWARDS } from '@/config/objectiveDefinitions';

export default function ObjectiveCompleteModal({
  cardDef,
  campaignId,
  actingPlayer,
  stateById,
  onCompleted,
  onClose,
}) {
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!cardDef) return null;

  const catCfg = OBJECTIVE_CATEGORY_CONFIG[cardDef.category] ?? OBJECTIVE_CATEGORY_CONFIG.military;
  const reward = OBJECTIVE_TIER_REWARDS[cardDef.tier] ?? 3;

  // Owned territories for placement picker
  const ownedTerritories = Object.entries(stateById ?? {})
    .filter(([, s]) => s.owner_player_id === actingPlayer?.id)
    .map(([tid]) => tid)
    .sort();

  const needsPlacement = cardDef.placement_rule !== 'none';

  const handleConfirm = async () => {
    if (needsPlacement && !selectedTerritory) {
      setError('Select a territory to receive the influence reward.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await base44.functions.invoke('objectivePhase', {
        action: 'completeObjective',
        campaign_id: campaignId,
        acting_as_player_id: actingPlayer?.id,
        card_id: cardDef.card_id,
        placement_territory_id: selectedTerritory || undefined,
      });
      onCompleted?.();
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Failed to complete objective.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="panel w-full max-w-sm shadow-2xl animate-fade-in">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-display text-sm tracking-wider">Complete Objective</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Card summary */}
          <div className={`rounded border p-3 ${catCfg.bg} ${catCfg.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{catCfg.icon}</span>
              <span className={`font-display text-sm font-semibold ${catCfg.color}`}>{cardDef.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">{cardDef.description}</p>
            <p className={`text-xs font-mono font-bold mt-2 ${catCfg.color}`}>
              +{reward} influence reward
            </p>
          </div>

          {/* Territory picker */}
          {needsPlacement && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>Select territory to receive influence reward</span>
              </div>
              <select
                value={selectedTerritory}
                onChange={e => setSelectedTerritory(e.target.value)}
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">— choose territory —</option>
                {ownedTerritories.map(tid => (
                  <option key={tid} value={tid}>{tid}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Placement rule: <span className="text-foreground">{cardDef.placement_rule ?? 'player_choice'}</span>
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || (needsPlacement && !selectedTerritory)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-xs font-display tracking-wider uppercase disabled:opacity-40 hover:brightness-110 transition-all"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
              Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}