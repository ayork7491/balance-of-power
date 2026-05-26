/**
 * services/rules-engine/snapshots/phaseSnapshot.js
 *
 * Builds snapshot data objects for phase boundaries.
 * Does NOT persist — returns a plain object that the backend function writes to PhaseSnapshot.
 *
 * Spec: snapshots are immutable records of campaign state at phase start/end.
 * They support history, debugging, replay, and dispute resolution.
 */

/**
 * buildPhaseSnapshot
 * Constructs the full snapshot payload for a given phase boundary.
 *
 * @param {object} params
 * @param {string} params.campaignId
 * @param {number} params.round
 * @param {string} params.phase
 * @param {'phase_start'|'phase_end'} params.snapshotType
 * @param {TerritoryState[]} params.territoryStates
 * @param {CampaignPlayer[]} params.activePlayers
 * @param {object} params.deployIncomes  — map of player_id → DeployIncome data (optional)
 * @returns {object} — ready to pass to PhaseSnapshot.create()
 */
export function buildPhaseSnapshot({
  campaignId,
  round,
  phase,
  snapshotType,
  territoryStates,
  activePlayers,
  deployIncomes = {},
}) {
  const territory_states = territoryStates.map(ts => ({
    territory_id:    ts.territory_id,
    owner_player_id: ts.owner_player_id ?? null,
    troop_count:     ts.troop_count ?? 0,
  }));

  const player_standings = activePlayers.map(p => {
    const owned      = territoryStates.filter(ts => ts.owner_player_id === p.id);
    const troopTotal = owned.reduce((sum, ts) => sum + (ts.troop_count || 0), 0);
    const income     = deployIncomes[p.id] ?? null;
    return {
      player_id:      p.id,
      display_name:   p.display_name,
      territory_count: owned.length,
      troop_total:    troopTotal,
      deploy_income:  income?.total ?? null,
      is_eliminated:  p.is_eliminated ?? false,
    };
  });

  return {
    campaign_id:      campaignId,
    round,
    phase,
    snapshot_type:    snapshotType,
    territory_states,
    player_standings,
    deploy_incomes:   deployIncomes,
  };
}