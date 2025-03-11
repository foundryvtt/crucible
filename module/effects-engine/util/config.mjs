/**
 * @import { IPoint } from 'pixi.js'
 */

/**
 * @typedef {[number, number] | [null, number] | [number, null] | null | undefined} PointData
 * @typedef {{ x: number } | { y: number } | { x: number; y: number } | number} IndividualOrUniformValue
 */

/**
 *
 * Resolve a config point value (could be an object with x and y properties, a number, or null)
 * into an array of 2 numbers representing the x and y values.
 *
 * @param {IndividualOrUniformValue} [config]
 * @returns {PointData}
 */
export function resolveIndividualOrUniformValue(config) {
  if (config == null) {
    return null
  } else if (typeof config === "number") {
    return [config, config]
  } else if ("x" in config && "y" in config) {
    return [config.x, config.y]
  } else if ("x" in config) {
    return [config.x, null]
  } else {
    return [null, config.y]
  }
}

/**
 *
 * Apply point data to a PIXI.Point instance.
 *
 * @param {IPoint | undefined} point
 * @param {PointData} data
 * @returns
 */
export function applyPointData(point, data) {
  if (!data || !point) {
    return
  }
  const [x, y] = data
  if (x === null) {
    point.y = y
  } else if (y === null) {
    point.x = x
  } else {
    point.set(x, y)
  }
}
