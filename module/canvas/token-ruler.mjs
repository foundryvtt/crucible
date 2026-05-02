
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

    // Get measurement of prior subpath, if on new subpath
    state.priorCost ??= 0;
    state.priorDistance ??= 0;
    if ( state.priorSubpathId !== waypoint.subpathId ) {
      state.priorCost = waypoint.previous?.measurement.cost || 0;
      state.priorDistance = waypoint.previous?.measurement.distance || 0;
      state.priorSubpathId = waypoint.subpathId;
    }

    // Do not draw waypoint label for non-meaningful waypoints. Meaningful waypoints:
    // - Are the final waypoint of a subpath
    // - Change movement action
    // - Change elevation
    const isFinalOfSubpath = waypoint.next?.subpathId !== waypoint.subpathId;
    const sameAction = waypoint.previous?.action === waypoint.action;
    const sameElevation = waypoint.previous?.elevation === waypoint.elevation;
    if ( !isFinalOfSubpath && sameElevation && sameAction ) return;

    // Calculate cost of this subpath & set context appropriately - free movement will be included in
    // getMovementActionCost if the actor has not yet used their free movement, otherwise it will be applied
    // retroactively by comparing freeMovementId against the subpath ID
    const movement = actor.getMovementActionCost(waypoint.measurement.cost - state.priorCost);
    const freeMovementId = actor.system.status.freeMovementId;
    const deltaCost = movement.cost - ((freeMovementId && (freeMovementId === waypoint.subpathId)) ? 1 : 0);
    Object.assign(context.distance, {
      units: grid.units,
      total: (waypoint.measurement.distance - state.priorDistance).toNearest(0.01).toLocaleString(game.i18n.lang)
    });
    context.cost = {
      units: "A",
      delta: Number.isFinite(deltaCost) ? deltaCost : "Impossible",
      displayCost: isFinalOfSubpath
    };

    // Display elevation when it changes or when different from the level.elevation.bottom
    context.displayElevation = context.elevation && !context.elevation.hidden
      && (!sameElevation || context.elevation.total);
    return context;
  }

  /** @override */
  _getWaypointStyle(waypoint) {
    const style = super._getWaypointStyle(waypoint);

    // Modify size & shape of intermediate waypoints to slightly smaller diamonds
    if ( waypoint.previous && (waypoint.next?.subpathId === waypoint.subpathId) ) {
      style.radius /= 1.5;
      style.shape = "diamond";
    }
    return style;
  }
}
