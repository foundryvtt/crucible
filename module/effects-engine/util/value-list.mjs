/** @import { EasingFunctionName, EasingFunction } from './easing.mjs' */
/** @import { VariableValue } from './variables.mjs' */

import { easingFunctions } from "./easing.mjs"
import { lerp } from "./interpolation.mjs"

/**
 * @typedef {number | Record<string, number> | number[]} InterpolatableValue
 * */

/**
 * @template {InterpolatableValue} T
 * @template {Boolean} [Resolved = false]
 *
 * @typedef {Object} ValueListItemConfig
 * @property {VariableValue<T, Resolved>} value
 * @property {VariableValue<number, Resolved>} time
 * */

/**
 * @template {InterpolatableValue} [T = InterpolatableValue]
 * @template {Boolean} [Resolved = false]
 *
 * @typedef {Object} ValueListConfig
 * @property {VariableValue<ValueListItemConfig<T, Resolved>[], Resolved>}  values
 * @property {VariableValue<EasingFunctionName | 'none', Resolved>} [easing]
 * */

/**
 * Holds a list of interpolatable values associated with a time, or more
 * generally speaking a progress value.
 * Provides a `getValue` method to get the interpolated value for a given time.
 *
 * Example:
 * ```javascript
 * const valueList = new ValueList({
 *   values: [
 *     { value: 0, time: 0 },
 *     { value: 1, time: 1 },
 *     { value: 10, time: 2 },
 *   ],
 * 	 easing: 'linear',
 * })
 * ```
 *
 * valueList.getValue(0.5) // => 0.5
 * valueList.getValue(1.5) // => 5.5
 * valueList.getValue(5) // => 10
 *
 *
 * @template {InterpolatableValue} Value
 */
export class ValueList {
  /** @type {ValueListConfig<Value, true> }*/
  #config

  /** @type {Float32Array} */
  #times

  /** @type {Value[]} */
  #values

  /** @type {boolean} */
  #interpolate = true

  /** @type {EasingFunction | undefined} */
  #easingFunction

  /** @type {(a: Value, b: Value, t: number) => Value} */
  #lerp

  /**
   * @param {ValueListConfig<Value, true>} config
   */
  constructor(config) {
    this.#config = config
    this.#interpolate = config.easing !== "none"
    if (config.easing !== "none") {
      this.#easingFunction = easingFunctions[config.easing ?? "linear"]
    }
    this.#times = new Float32Array(config.values.length)
    this.#values = new Array(config.values.length)
    for (let i = 0; i < config.values.length; i++) {
      this.#times[i] = config.values[i].time
      this.#values[i] = config.values[i].value
    }
    this.#lerp = this.#buildLerpFunction(this.#values[0])
  }
  /**
   * @returns {number}
   */
  get duration() {
    return this.#times.at(-1) ?? 0
  }
  /**
   * Returns the interpolated value for the given time
   *
   * @param {number} time
   * @returns {Value}
   */
  getValue(time) {
    if (this.#times.length === 0) {
      console.error(`Value list is empty`, this.#config)
    }
    if (time <= this.#times[0] || this.#times.length === 1) {
      return this.#values[0]
    }
    const lastTime = this.#times.at(-1) ?? 0
    if (time >= lastTime) {
      return this.#values.at(-1)
    }
    for (let i = 0; i < this.#times.length - 1; i++) {
      const currentTime = this.#times[i]
      const nextTime = this.#times[i + 1]
      if (time < currentTime || time >= nextTime) {
        continue
      }
      if (!this.#interpolate || !this.#easingFunction) {
        return this.#values[i]
      }
      const timeDiff = nextTime - currentTime
      const t = (time - currentTime) / timeDiff
      const currentValue = this.#values[i]
      const nextvalue = this.#values[i + 1]
      return this.#lerp(currentValue, nextvalue, this.#easingFunction(t))
    }
    console.error(
      "Could not find value for time",
      time,
      this.#times,
      this.#config,
    )
    return this.#values.at(-1)
  }
  /**
   * @returns {Value}
   */
  get firstValue() {
    return this.#values[0]
  }

  /**
   * Build interpolation function based on the type of the intial value
   *
   * @param {Value} value
   * @returns {(a: Value, b: Value, t: number) => Value}
   */
  #buildLerpFunction(value) {
    const identity = (a, b) => a ?? b
    if (value === null || value === undefined) {
      console.error(
        `No prototype value available for value interpolation`,
        this.#config,
      )
      return identity
    }
    if (typeof value === "number") {
      return (a, b, t) => lerp(a, b, t)
    } else if (Array.isArray(value)) {
      return (a, b, t) => {
        const result = new Array(a.length)
        for (let i = 0; i < a.length; i++) {
          result[i] = lerp(a[i], b[i], t)
        }
        return result
      }
    } else if (typeof value === "object") {
      return (a, b, t) => {
        const result = {}
        for (const key in a) {
          result[key] = lerp(a[key], b[key], t)
        }
        return result
      }
    }
    return identity
  }
}
