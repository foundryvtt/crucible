/**
 * Programmatic movement planning utilities for Crucible actions.
 * @module canvas/movement
 */

import CrucibleMovementPolygon from "./movement-polygon.mjs";

/**
 * @import {ElevatedPoint, Point} from "@common/_types.mjs";
 * @import {TokenMovementWaypoint, TokenPosition} from "@common/documents/_types.mjs";
 * @import {default as Ray} from "@client/canvas/geometry/shapes/ray.mjs";
 * @import {default as CrucibleAction, CrucibleActionMovement} from "@crucible/models/action.mjs";
 */

/* -------------------------------------------- */

/**
 * Compose a planned movement for a token using pre-computed waypoints.
 * The plan is declared via `TokenDocument#move(... {planned: true})`; the move promise resolves only when
 * `TokenDocument#startMovement` is later invoked. The caller records the returned plan as an action event.
 *
 * @example
 * ```js
 * const plan = planMovement(token, [{x: 3000, y: 4000, elevation: 10, action: "climb"}]);
 * action.recordEvent({type: "movement", target: actor, movement: plan.id})
 * ```
 *
 * @param {TokenDocument} token              The token to be moved
 * @param {TokenMovementWaypoint[]} waypoints  Pre-computed waypoints describing the movement path
 * @returns {CrucibleActionMovement|null}    Movement record `{id, origin, waypoints, cost}`, or null on invalid input
 */
export function planMovement(token, waypoints) {
  if ( !token || !waypoints?.length ) return null;
  const id = foundry.utils.randomID();
  const origin = _tokenPosition(token);
  const tokenObject = token.object;
  const {cost} = tokenObject
    ? tokenObject.measureMovementPath([origin, ...waypoints])
    : token.measureMovementPath([origin, ...waypoints]);
  token.move(waypoints, {id, planned: true}).catch(err => console.error(err));
  return {id, origin, waypoints, cost};
}

/* -------------------------------------------- */

/**
 * Force a token to move along a defined Ray vector, clamped by walls and snapped in 3D with walk-back safety.
 * Ray endpoints may include elevation; a 2D ray defaults to the token's current elevation.
 * @param {TokenDocument} token             The token being forcibly moved
 * @param {Ray} ray                         Desired vector and distance of forced movement
 * @param {object} [options]
 * @param {boolean} [options.collision=true]  Constrain by movement-blocking walls
 * @param {boolean} [options.snap=true]       Snap the destination to the grid (with walk-back safety)
 * @param {string} [options.action="push"]    Movement-action label applied to the resulting waypoint
 * @param {boolean} [options.tokenCollision]  Treat other tokens as obstacles, enforcing collision with their hitbox
 * @returns {CrucibleActionMovement|null}   Movement record, or null if no displacement was possible
 */
export function planForcedMovement(token, ray, {collision=true, snap=true, action="push", tokenCollision}={}) {
  if ( !token || !ray ) return null;
  if ( (ray.dx === 0) && (ray.dy === 0) ) return null;
  const tokenObject = token.object;
  if ( !tokenObject ) return null;
  const waypoint = _resolveForcedDestination(tokenObject, ray, {collision, snap, action, tokenCollision});
  if ( !waypoint ) return null;
  return planMovement(token, [waypoint]);
}

/* -------------------------------------------- */

/**
 * Plan a forced movement that displaces a token directly away from or toward an origin point.
 * A positive `distanceFeet` pushes the token away from `fromPoint`; a negative value pulls it toward `fromPoint`.
 * @param {Point} fromPoint               The origin point to push away from or pull toward
 * @param {Token} targetToken             The token object being displaced
 * @param {number} distanceFeet           Signed displacement distance in feet; positive pushes, negative pulls
 * @param {object} [options]
 * @param {number} [options.minGap=0]     Minimum center-to-center distance from the origin to preserve when pulling
 * @param {boolean} [options.tokenCollision]  Treat other tokens as obstacles, enforcing collision with their hitbox
 * @returns {CrucibleActionMovement|null} Movement record, or null if no displacement was possible
 */
export function planPushMovement(fromPoint, targetToken, distanceFeet, {minGap=0, tokenCollision}={}) {
  if ( !targetToken || !distanceFeet ) return null;
  const r0 = new foundry.canvas.geometry.Ray(fromPoint, targetToken.center);
  if ( r0.distance === 0 ) return null;
  let distancePx = distanceFeet * canvas.dimensions.distancePixels;
  if ( distancePx < 0 ) { // Clamp a pull so the token stops short of the origin rather than overshooting it
    distancePx = Math.max(distancePx, minGap - r0.distance);
    if ( distancePx >= 0 ) return null;
  }
  const ray = new foundry.canvas.geometry.Ray(targetToken.center, r0.project(1 + (distancePx / r0.distance)));
  return planForcedMovement(targetToken.document, ray, {tokenCollision});
}

/* -------------------------------------------- */
/*  Subsidiary Helpers                          */
/* -------------------------------------------- */

/**
 * Build the TokenPosition record for a token's current source state, used as the `origin` field of a
 * {@link CrucibleActionMovement}.
 * @param {TokenDocument} token
 * @returns {TokenPosition}
 */
function _tokenPosition(token) {
  const {x, y, elevation, width, height, depth, shape, level} = token;
  return {x, y, elevation, width, height, depth, shape, level};
}

/* -------------------------------------------- */

/**
 * Resolve a forced-movement destination into a single snapped, wall-constrained waypoint.
 * @param {Token} tokenObject
 * @param {Ray} ray
 * @param {{collision: boolean, snap: boolean, action: string, tokenCollision: boolean}} options
 * @returns {TokenMovementWaypoint|null}
 */
function _resolveForcedDestination(tokenObject, ray, {collision, snap, action, tokenCollision}) {
  const gridSize = canvas.grid.size;
  const halfW = (tokenObject.document.width * gridSize) / 2;
  const halfH = (tokenObject.document.height * gridSize) / 2;
  const originElevation = ray.A.elevation ?? tokenObject.document.elevation;
  const destinationElevation = ray.B.elevation ?? originElevation;

  // Constrain center to the first wall or token collision along the ray when requested
  const destinationCenter = _constrainCenterToWalls(tokenObject, ray, originElevation, destinationElevation,
    collision, tokenCollision);
  if ( !destinationCenter ) return null;

  // Convert center -> top-left (preserving elevation), then snap in 3D with walk-back safety if requested
  let topLeft = {x: destinationCenter.x - halfW, y: destinationCenter.y - halfH,
    elevation: destinationCenter.elevation};
  if ( snap ) {
    topLeft = _snapTopLeftSafely(tokenObject, ray, topLeft, halfW, halfH, originElevation, collision, tokenCollision);
    if ( !topLeft ) return null;
  }

  // No-op if the resolved top-left and elevation match the token's current pose
  const originTopLeft = {x: Math.round(ray.A.x - halfW), y: Math.round(ray.A.y - halfH)};
  if ( (Math.round(topLeft.x) === originTopLeft.x) && (Math.round(topLeft.y) === originTopLeft.y)
    && (topLeft.elevation === originElevation) ) return null;

  const waypoint = {x: topLeft.x, y: topLeft.y, elevation: topLeft.elevation, action};
  if ( snap ) waypoint.snapped = true;
  return waypoint;
}

/* -------------------------------------------- */

/**
 * Constrain the displacement endpoint by walking up to the first wall collision along the ray.
 * @param {Token} tokenObject
 * @param {Ray} ray
 * @param {number} originElevation
 * @param {number} destinationElevation
 * @param {boolean} collision
 * @param {boolean} tokenCollision
 * @returns {ElevatedPoint|null} Constrained destination center, or null on zero-length ray
 */
function _constrainCenterToWalls(tokenObject, ray, originElevation, destinationElevation, collision, tokenCollision) {
  const destination = {x: ray.B.x, y: ray.B.y, elevation: destinationElevation};
  if ( !collision ) return destination;
  const len = Math.hypot(ray.dx, ray.dy);
  if ( len === 0 ) return null;
  const origin = {x: ray.A.x, y: ray.A.y, elevation: originElevation};
  const level = tokenObject.scene.levels.get(tokenObject.document._source.level);
  const collisionVertex = CrucibleMovementPolygon.testCollision(origin, destination,
    {type: "move", mode: "closest", level, excludeToken: tokenObject, tokenCollision});
  if ( !collisionVertex ) return destination;
  const dist = Math.hypot(collisionVertex.x - ray.A.x, collisionVertex.y - ray.A.y);
  const safeDist = Math.max(0, dist - 1);
  return {
    x: ray.A.x + ((ray.dx / len) * safeDist),
    y: ray.A.y + ((ray.dy / len) * safeDist),
    elevation: destinationElevation
  };
}

/* -------------------------------------------- */

/**
 * Snap an ElevatedPoint top-left to the grid; if the snapped cell would place the token's center on the far
 * side of an intervening wall, walk back along the inverse ray direction until collision-safe.
 * @param {Token} tokenObject
 * @param {Ray} ray
 * @param {ElevatedPoint} topLeft
 * @param {number} halfW
 * @param {number} halfH
 * @param {number} originElevation
 * @param {boolean} collision
 * @param {boolean} tokenCollision
 * @returns {ElevatedPoint|null}  Snapped top-left, or null if no safe cell was found
 */
function _snapTopLeftSafely(tokenObject, ray, topLeft, halfW, halfH, originElevation, collision, tokenCollision) {
  const gridSize = canvas.grid.size;
  const SNAP_MODE = CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX;
  let snapped = canvas.grid.getSnappedPoint(topLeft, {mode: SNAP_MODE});
  if ( !collision ) return snapped;

  const len = Math.hypot(ray.dx, ray.dy);
  if ( len === 0 ) return snapped;
  const ux = ray.dx / len;
  const uy = ray.dy / len;
  const origin = {x: ray.A.x, y: ray.A.y, elevation: originElevation};
  const level = tokenObject.scene.levels.get(tokenObject.document._source.level);

  while ( CrucibleMovementPolygon.testCollision(origin,
    {x: snapped.x + halfW, y: snapped.y + halfH, elevation: snapped.elevation},
    {type: "move", mode: "any", level, excludeToken: tokenObject, tokenCollision}) ) {
    const stepped = {x: snapped.x - (ux * gridSize), y: snapped.y - (uy * gridSize), elevation: snapped.elevation};
    snapped = canvas.grid.getSnappedPoint(stepped, {mode: SNAP_MODE});
    const distFromOrigin = Math.hypot((snapped.x + halfW) - ray.A.x, (snapped.y + halfH) - ray.A.y);
    if ( distFromOrigin < (gridSize / 2) ) return null;
  }
  return snapped;
}
