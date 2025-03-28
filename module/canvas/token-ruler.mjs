
export default class CrucibleTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {

  /** @override */
  static WAYPOINT_TEMPLATE = "systems/crucible/templates/hud/token-ruler-waypoint-label.hbs";

  /** @override */
  _prepareWaypointData(waypoints) {
    const waypointData = [];
    let hasElevation = false;
    for ( const waypoint of waypoints ) {
      const {index, elevation, explicit, next, previous, ray, teleport} = waypoint;
      if ( !previous || (!explicit && next && !teleport) ) continue;

      // Prepare data structure
      const data = {
        action: CONFIG.Token.movement.actions[waypoint.action],
        cssClass: [
          waypoint.hidden ? "secret" : "",
          waypoint.next ? "" : "last"
        ].filterJoin(" "),
        secret: waypoint.hidden,
        units: canvas.grid.units,
        costUnits: "AP",
        uiScale: canvas.dimensions.uiScale,
        waypoint
      };

      // Label Position
      const deltaElevation = elevation - previous.elevation;
      if ( (ray.distance === 0) && (deltaElevation === 0) ) continue;
      data.position = {x: ray.B.x, y: ray.B.y + (next ? 0 : 0.5 * this.token.h) + (16 * canvas.dimensions.uiScale)};

      // Segment Distance
      data.totalDistance = waypoint.measurement.distance.toNearest(0.01).toLocaleString(game.i18n.lang);
      if ( index >= 2 ) data.deltaDistance =  waypoint.measurement.backward.distance.toNearest(0.01).signedString();

      // Segment Cost
      const stride = this.token.actor?.system.movement.stride ?? 10;
      const cost = waypoint.measurement.cost / stride;
      const deltaCost = waypoint.cost / stride;
      data.totalCost = Number.isFinite(cost) ? cost.toNearest(0.001).toLocaleString(game.i18n.lang) : "∞";
      if ( index >= 2 ) data.deltaCost = Number.isFinite(deltaCost) ? deltaCost.toNearest(0.001).signedString() : "∞";

      // Elevation
      if ( elevation !== 0 ) hasElevation = true;
      data.hasElevation = hasElevation;
      if ( data.hasElevation ) {
        data.elevationIcon = "fa-arrows-up-down";
        data.totalElevation = elevation;
        if ( deltaElevation !== 0 ) data.deltaElevation = deltaElevation.signedString();
      }
      waypointData.push(data);
    }
    return waypointData;
  }
}
