import { ValueList } from "../util/value-list.mjs"
import { Behavior } from "./behavior.mjs"
import { buildUpdateFunction } from "../util/setter.mjs"

/** @import * as PIXI from 'pixi.js'; */
/** @import { BehaviorProps, BaseBehaviorConfig } from './behavior.mjs'; */
/** @import { PropertyUpdateFunction } from '../util/setter.mjs'; */
/** @import { VariableValue } from '../util/variables.mjs'; */
/** @import { ValueListConfig, InterpolatableValue } from '../util/value-list.mjs'; */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {
    {type: 'animate', key: string} &
    ValueListConfig<InterpolatableValue, Resolved> & 
    BaseBehaviorConfig<Resolved>
  } BehaviorAnimatePropertyConfig
 */

/**
 * @extends {Behavior<BehaviorAnimatePropertyConfig<true>>}
 */
export class AnimatePropertyBehavior extends Behavior {
  /** @type {string} */
  key

  /** @type {ValueList<any>} */
  valueList

  /**
   * update target function. Generated based on type to excessive avoid branching
   *
   * @type {PropertyUpdateFunction}
   */
  #updateTarget

  /**
   * Animate a property of the target object
   * TODO: repeat, delay, pingpong?
   *
   * @param {BehaviorProps<BehaviorAnimatePropertyConfig<true>>} options
   */
  constructor(options) {
    super(options)
    this.key = options.config.key
    this.valueList = new ValueList(options.config)
  }

  /**
   * @override
   */
  _init() {
    try {
      this.#updateTarget ??= buildUpdateFunction({
        target: this.target,
        property: this.key,
        initialValue: this.valueList.firstValue,
      })
    } catch (error) {
      console.error(error)
      this.#updateTarget = () => {}
    }
  }

  /**
   * @override
   *
   * @param {number} _deltaTimeMs
   */
  _update(_deltaTimeMs) {
    const newValue = this.valueList.getValue(this.elapsedTimeMs)
    this.#updateTarget(newValue)
    if (this.elapsedTimeMs >= this.valueList.duration) {
      this.state = "stopped"
    }
  }
}
