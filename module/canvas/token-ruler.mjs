
export default class CrucibleTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {

  /** @override */
  static WAYPOINT_LABEL_TEMPLATE = "systems/crucible/templates/hud/token-ruler-waypoint-label.hbs";

  /* -------------------------------------------- */

  /** @override */
  _getWaypointLabelContext(waypoint, state) {
    const context = super._getWaypointLabelContext(waypoint, state);
    const actor = this.token.actor;
    if ( !context || !actor ) return context;
    const grid = canvas.scene?.grid;
    if ( !grid || (grid.distance !== 1) || (grid.units !== "ft") ) return;

    // Recover prior cost (potentially across chains)
    state.priorCost ??= actor.getMovementActionCost(waypoint.previous?.measurement.cost || 0).cost;

    // Measure new segment
    const movement = actor.getMovementActionCost(waypoint.measurement.cost);
    const deltaCost =  movement.cost - state.priorCost;
    state.priorCost = movement.cost;

    context.distance.units = grid.units;
    context.cost = {units: "A", delta: deltaCost};
    context.cost.total = Number.isFinite(movement.cost) ? movement.cost : "Impossible";
    context.cost.showTotal = !waypoint.next;
    context.displayElevation = context.elevation && !context.elevation.hidden;
    return context;
  }
}
