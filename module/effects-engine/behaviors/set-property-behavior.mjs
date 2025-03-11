import { buildUpdateFunction } from "../util/setter.mjs"
import { Behavior } from "./behavior.mjs"

/** @import { PropertyUpdateFunction, SetPropertyType } from '../util/setter.mjs' */
/** @import { VariableValue } from '../util/variables.mjs' */
/** @import { BehaviorProps, BaseBehaviorConfig } from './behavior.mjs' */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} SetPropertyConfig
 * @property {'set'} type
 * @property {string} key
 * @property {VariableValue<number, Resolved>} value
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {BaseBehaviorConfig<Resolved> & SetPropertyConfig<Resolved>} BehaviorSetPropertyConfig
 */

/**
 * @extends Behavior<BehaviorSetPropertyConfig<true>>
 */
export class SetPropertyBehavior extends Behavior {
  /** @type {string} */
  key

  /** @type {SetPropertyType} */
  value

  /**
   * update target function. Generated based on type to excessive avoid branching
   *
   * @type {PropertyUpdateFunction}
   */
  #updateTarget

  /**
   * Simplified version of animate property behavior that sets a property to singular value
   * Mainly usefull in conjunction with triggers and handlers to set a property to a value
   * based on some event
   *
   * @param {BehaviorProps<BehaviorSetPropertyConfig<true>>} options
   */
  constructor(options) {
    super(options)
    this.key = options.config.key
    this.value = options.config.value
  }
  /**
   * @override
   */
  _init() {
    try {
      this.#updateTarget ??= buildUpdateFunction({
        target: this.target,
        property: this.key,
        initialValue: this.value,
      })
    } catch (error) {
      console.error(error)
      this.#updateTarget = () => {}
    }
  }

  /**
   * @param {number} _deltaTimeMs
   */
  _update(_deltaTimeMs) {
    this.#updateTarget(this.value)
    this.state = "stopped"
  }
}
