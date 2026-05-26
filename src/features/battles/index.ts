/**
 * Feature: battles
 *
 * Owns: BattleCard generation, result submission, approval flow,
 *       auto-resolution, forfeit handling, battle scaling math.
 * Entities: BattleCard, BattleResultSubmission
 * Pages: /campaigns/:id/battles/:battleId, /campaigns/:id/battles/:battleId/result
 *
 * ARCHITECTURE CONSTRAINT — Battle Scaling:
 *   tabletopAverageBattleSize comes from the TabletopGameProfile entity (NOT hardcoded).
 *   Forward:  scaled_points = round((atk + def) * scalingFactor * avg_battle_points)
 *             Clamped to [minBattlePoints, maxBattlePoints] from config/gameplay.ts.
 *   Reverse:  app_troop_loss = round(tabletop_troop_loss / scalingFactor)
 *   Do not implement the engine here yet — see GAMEPLAY_DEFAULTS.BATTLE_SCALING in config.
 *
 * Future prompts will add: hooks/useBattleCards.ts, engine/battleScaling.ts,
 *   components/BattleCardView.tsx, services/battleService.ts, etc.
 * Do not add logic to this file yet.
 */
export {};