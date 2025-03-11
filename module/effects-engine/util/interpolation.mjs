/** @import { IPointData } from 'pixi.js' */

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}
const PI2 = Math.PI * 2
/**
 * interpolate between 2 rotations given in radians r1 and r2
 * Simple interpolation does not work for rotations because of the wrap around at 0
 * (when interpolating between 5 and 355 degrees, it should go through 0, not 180)
 *
 * @param {number} r1
 * @param {number} r2
 * @param {number} t
 * @returns {number}
 */
export function lerpRotation(r1, r2, t) {
  const diff = Math.abs(r2 - r1)
  if (diff > Math.PI) {
    // need to add one rotation to the smaller value to get smalled possible movement
    if (r2 > r1) {
      r1 += PI2
    } else {
      r2 += PI2
    }
  }
  const value = lerp(r1, r2, t)
  // wrap if needed or return early if not
  if (value >= 0 && value <= PI2) {
    return value
  }
  return value % PI2
}

/**
 * Given a line described by two points, return the angle between it and
 * a horizontal line through the first point.
 *
 * @param {IPointData} p1 First point
 * @param {IPointData} p2 Second Point
 * @returns {number}
 */
export function rotationBetweenPoints(p1, p2) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.atan2(dy, dx)
}
