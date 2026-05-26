/**
 * Feature: phases
 *
 * Owns: Phase decision collection, decision locking, phase advancement engine,
 *       draft/deploy/attack/fortify action panels, phase state resolution.
 * Entities: PhaseDecision, PhaseSnapshot
 *
 * ARCHITECTURE CONSTRAINT:
 *   Hidden information: PhaseDecision records must NEVER be exposed to
 *   other players before is_locked = true. Enforcement happens at the
 *   data-access/query-filter layer, not just UI visibility.
 *
 * ARCHITECTURE CONSTRAINT:
 *   Phase advancement logic (troop math, attack validation, territory transfer,
 *   troop income calculation) must live here or in a future /engine/ module —
 *   never inside UI components or pages.
 *
 * Future prompts will add: hooks/usePhaseDecision.ts, components/PhasePanel.tsx,
 *   engine/phaseEngine.ts, etc.
 * Do not add logic to this file yet.
 */
export {};