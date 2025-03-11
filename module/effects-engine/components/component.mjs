import { BehaviorSystem } from "../systems/behavior-system.mjs"
import {
  applyPointData,
  resolveIndividualOrUniformValue,
} from "../util/config.mjs"

/**
 *  @import { ColorSource } from "pixi.js"
 *  @import { IndividualOrUniformValue } from "../util/config.mjs"
 *  @import { VariableValue } from "../util/variables.mjs"
 *  @import { AnimationSystem } from "../animation-system.mjs"
 *  @import { BehaviorConfig } from "../behaviors/behavior.mjs"
 *  @import { ComponentSpriteConfig } from "./component-sprite.mjs"
 *  @import { ComponentContainerConfig } from "./component-container.mjs"
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} BaseComponentConfig
 * @property {string} type
 * @property {string} [name]
 * @property {VariableValue<ColorSource, Resolved>} [tint]
 * @property {VariableValue<number, Resolved>} [alpha]
 * @property {VariableValue<IndividualOrUniformValue, Resolved>} [position]
 * @property {VariableValue<IndividualOrUniformValue, Resolved>} [scale]
 * @property {VariableValue<IndividualOrUniformValue, Resolved>} [anchor]
 * @property {VariableValue<IndividualOrUniformValue, Resolved>} [pivot]
 * @property {BehaviorConfig[]} [behaviors]
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {ComponentSpriteConfig<Resolved> | ComponentContainerConfig<Resolved>} ComponentConfig
 */

/**
 * @template {BaseComponentConfig<true>} Config
 *
 * @typedef {Object} ComponentProps
 * @property {Config} config
 * @property {AnimationSystem} system
 * @property {Component<any>} [parent]
 */

/**
 * Componenet System Base Class. Override to impelement custom components.
 *
 * Custom Components also need to update the COMPONENTS object to include the new component.
 *
 * @template {BaseComponentConfig<true>} [Config = BaseComponentConfig<true>]
 */
export class Component {
  /** @type {Config} */
  config

  /** @type {Component<any> | undefined} */
  parent

  /** @type {AnimationSystem} */
  system

  /** @type {BehaviorSystem | undefined} */
  behaviors

  /** @type {PIXI.DisplayObject | undefined} */
  target

  /** @type {string} */
  id

  /** @param {ComponentProps<Config>} params */
  constructor({ config, system, parent }) {
    this.config = config
    this.system = system
    this.parent = parent
    this.id = config.name ?? foundry.utils.randomID()
    if ("behaviors" in config && config.behaviors) {
      this.behaviors = new BehaviorSystem(system, config.behaviors, this)
    }
  }

  /** @type {PIXI.DisplayObject | undefined} */
  get behaviorTarget() {
    return this.target
  }

  /**
   * Prepare data not dependent on parent element or loaded resources
   */
  prepare() {}

  /**
   * creates AND ASSIGNES the pixi display object to this instances component property
   *
   * this function is called at the end of the constructor
   * */
  createComponent() {
    throw new Error("createComponent must be implemented")
  }

  /**
   * Activates this component.
   */
  activate() {
    this.createComponent()
    this.applyComponentConfig()
    this.addToParent()
    this.behaviors?.init()
  }

  /** @param {number} deltaTimeMs */
  runBehaviors(deltaTimeMs) {
    this.behaviors?.runBehaviorUpdates(deltaTimeMs)
  }

  addToParent() {
    if (!this.target || !this.parent?.target) {
      return
    }
    const parent = this.parent.target
    if ("addChild" in parent && typeof parent.addChild === "function") {
      parent.addChild(this.target)
    }
  }

  destroy() {
    this.target?.destroy()
    this.behaviors?.destroy()
  }

  /**
   * apply common component config
   */
  applyComponentConfig() {
    if (!this.target) {
      return
    }
    if (this.config.name) {
      this.target.name = this.config.name
    }
    if ("pivot" in this.target) {
      applyPointData(
        this.target.pivot,
        resolveIndividualOrUniformValue(this.config.pivot),
      )
    }

    if ("anchor" in this.target) {
      applyPointData(
        this.target.anchor,
        resolveIndividualOrUniformValue(this.config.anchor),
      )
    }

    if ("scale" in this.target) {
      applyPointData(
        this.target.scale,
        resolveIndividualOrUniformValue(this.config.scale),
      )
    }

    if ("position" in this.target) {
      applyPointData(
        this.target.position,
        resolveIndividualOrUniformValue(this.config.position),
      )
    }

    if ("alpha" in this.target) {
      this.target.alpha = this.config.alpha ?? 1
    }

    if (
      "_tintColor" in this.target &&
      this.target._tintColor instanceof PIXI.Color &&
      this.config.tint != null
    ) {
      this.target._tintColor.setValue(this.config.tint)
    }
  }
}
