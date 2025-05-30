
export default class CrucibleTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {

  /** @override */
  static WAYPOINT_LABEL_TEMPLATE = "systems/crucible/templates/hud/token-ruler-waypoint-label.hbs";

  /* -------------------------------------------- */

  /** @override */
  _getWaypointLabelContext(waypoint, state) {
    const context = super._getWaypointLabelContext(waypoint, state);
    if ( !context || !this.token.actor ) return context;
    const grid = canvas.scene?.grid;
    if ( !grid || (grid.distance !== 1) || (grid.units !== "ft") ) return;

    // Segment Cost
    // TODO needs to incorporate free movement or other movement cost modifiers
    const stride = this.token.actor?.system.movement.stride ?? 8;
    const totalCost = Math.ceil(waypoint.measurement.cost / stride);
    context.distance.units = grid.units;
    context.cost = {total: totalCost, units: "A"};
    return context;
  }
}
