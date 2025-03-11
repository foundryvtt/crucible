/** @import * as PIXI from 'pixi.js' */

const colorRegex = /^#([0-9a-f]{1,2}){3,4}$/i
/**
 * @param {unknown} value
 * @returns {value is PIXI.ColorSource}
 */
function isColorSource(value) {
  if (
    value instanceof Float32Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray
  ) {
    return true
  }
  if (Array.isArray(value)) {
    return value.length === 4 || value.length === 3
  }
  if (typeof value === "string") {
    return colorRegex.test(value)
  }
  if (typeof value === "number" && value >= 0 && value <= 0xffffffff) {
    return true
  }
  // test for certain objects
  if (value === null || value === undefined || typeof value !== "object") {
    return false
  }
  if ("r" in value && "g" in value && "b" in value) {
    return true
  }
  if ("h" in value && "s" in value && ("l" in value || "v" in value)) {
    return true
  }
  return false
}
/**
 *
 * @typedef {Object} Params
 * @property { unknown } target
 * @property {string} property
 * @property {SetPropertyType} initialValue
 *
 * @param {Params} params
 * @returns {PropertyUpdateFunction}
 */
export function buildUpdateFunction({ target, property, initialValue }) {
  if (!(target instanceof Object)) {
    throw new Error("Setter target must an object")
  }
  const targetValue = target[property]
  if (targetValue instanceof PIXI.Point) {
    if (
      !(
        typeof initialValue === "object" &&
        "x" in initialValue &&
        "y" in initialValue
      )
    ) {
      throw new Error(
        "trying to set point data but value list does not contain x or y values",
      )
    }
    return (newValue) => {
      target[property].set(newValue.x, newValue.y)
    }
  } else if (targetValue instanceof PIXI.Color) {
    if (!isColorSource(initialValue)) {
      throw new Error(
        `Trying to animate color but initial value is incompatible. Expected a color source.`,
      )
    }
    return (newValue) => {
      // TODO: use
      target[property].setValue(newValue)
    }
  } else if (Array.isArray(targetValue)) {
    return (newValue) => {
      for (let i = 0; i < newValue.length; i++) {
        target[property][i] = newValue[i]
      }
    }
  } else if (typeof targetValue === "object") {
    return (newValue) => {
      for (const [key, value] of Object.entries(newValue)) {
        if (key in target[property]) {
          target[property][key] = value
        }
      }
    }
  } else {
    return (newValue) => {
      target[property] = newValue
    }
  }
}
/**
 * @typedef {number | string | string[] | number[] | boolean | PIXI.Point | PIXI.IPointData | PIXI.ColorSource} SetPropertyType
 *
 * @typedef {(value: any) => void} PropertyUpdateFunction
 */
