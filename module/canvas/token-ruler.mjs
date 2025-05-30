
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

    // Segment Cost
    const stride = actor?.system.movement.stride ?? 8;
    const totalCost = Math.ceil(waypoint.measurement.cost / stride);
    context.distance.units = grid.units;
    context.cost = {total: totalCost, units: "A"};

    // Deduct Free Move
    if ( actor.system.hasFreeMove ) context.cost.total -= 1;

    // Configure whether to display elevation
    context.displayElevation = context.elevation && !context.elevation.hidden;
    return context;
  }
}
