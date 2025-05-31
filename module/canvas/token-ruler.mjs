
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

    const movement = actor.getMovementActionCost(waypoint.measurement.cost);
    context.distance.units = grid.units;
    context.cost = Number.isFinite(movement.cost) ? {total: movement.cost, units: "A"} : {total: "Impossible"};
    context.displayElevation = context.elevation && !context.elevation.hidden;
    return context;
  }
}
