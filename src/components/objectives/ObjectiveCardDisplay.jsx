/**
 * ObjectiveCardDisplay — renders a single objective card face.
 * Used in both active-hand and completed/discarded lists.
 *
 * Props:
 *   cardDef      — SecretObjectiveCard definition object
 *   variant      — 'active' | 'completed' | 'discarded' | 'choice'
 *   completedEntry — { completed_round, reward_amount, placement_territory_id } (completed only)
 *   selected     — boolean (for choice variant)
 *   onSelect     — () => void (for choice variant)
 *   onComplete   — () => void (active only — opens completion flow)
 */
import { Check, Trophy, Trash2, Eye, EyeOff } from 'lucide-react';
import { OBJECTIVE_CATEGORY_CONFIG, OBJECTIVE_TIER_REWARDS, TIER_LABELS } from '@/config/objectiveDefinitions';

export default function ObjectiveCardDisplay({
  cardDef,
  variant = 'active',
  completedEntry = null,
  selected = false,
  onSelect,
  onComplete,
}) {
  if (!cardDef) return null;

  const catCfg = OBJECTIVE_CATEGORY_CONFIG[cardDef.category] ?? OBJECTIVE_CATEGORY_CONFIG.military;
  const reward = OBJECTIVE_TIER_REWARDS[cardDef.tier] ?? 3;
  const tierLabel = TIER_LABELS[cardDef.tier] ?? 'I';

  const isChoice = variant === 'choice';
  const isCompleted = variant === 'completed';
  const isDiscarded = variant === 'discarded';

  return (
    <div
      className={[
        'rounded border p-3 transition-all duration-150',
        catCfg.bg, catCfg.border,
        isChoice && 'cursor-pointer hover:brightness-125',
        isChoice && selected && 'ring-2 ring-primary brightness-125',
        isDiscarded && 'opacity-50',
      ].filter(Boolean).join(' ')}
      onClick={isChoice && onSelect ? onSelect : undefined}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{catCfg.icon}</span>
          <span className={`font-display text-sm font-semibold tracking-wide truncate ${catCfg.color}`}>
            {cardDef.title}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Tier badge */}
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${catCfg.badgeClass}`}>
            T{tierLabel}
          </span>
          {/* State icon */}
          {isCompleted && <Trophy className="w-3.5 h-3.5 text-primary" />}
          {isDiscarded && <Trash2 className="w-3 h-3 text-muted-foreground" />}
          {isChoice && selected && <Check className="w-3.5 h-3.5 text-primary" />}
        </div>
      </div>

      {/* Description — hidden for active (secret), shown for completed/discarded/choice */}
      {(isCompleted || isDiscarded || isChoice) ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{cardDef.description}</p>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="w-3 h-3" />
          <span className="italic">Secret — complete to reveal</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[10px] text-muted-foreground/60 capitalize">{catCfg.label}</span>
        <div className="flex items-center gap-2">
          {isCompleted && completedEntry && (
            <span className="text-[10px] text-muted-foreground">
              Round {completedEntry.completed_round}
              {completedEntry.placement_territory_id && ` · ${completedEntry.placement_territory_id}`}
            </span>
          )}
          <span className={`text-[11px] font-mono font-bold ${catCfg.color}`}>
            +{reward} <span className="text-muted-foreground font-normal">influence</span>
          </span>
        </div>
      </div>

      {/* Complete button for active variant */}
      {variant === 'active' && onComplete && (
        <button
          onClick={onComplete}
          className="mt-2 w-full text-[10px] font-display tracking-wider uppercase px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
        >
          <Eye className="w-3 h-3" /> Mark Complete
        </button>
      )}
    </div>
  );
}