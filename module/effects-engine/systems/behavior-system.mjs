import { AnimatePropertyBehavior } from "../behaviors/animate-property-behavior.mjs"
import { AnimatedSpritesheetBehavior } from "../behaviors/animated-sprite-behavior.mjs"
import { Behavior } from "../behaviors/behavior.mjs"
import { FollowPathBehavior } from "../behaviors/follow-path-behavior.mjs"
import { SetPropertyBehavior } from "../behaviors/set-property-behavior.mjs"

/**
 *  @import { AnimationSystem } from '../animation-system.mjs'
 *  @import { BehaviorConfig } from '../behaviors/behavior.mjs'
 *  @import { ComponentConfig, Component } from '../components/component.mjs'
 */

/**
 * @template [T=any]
 * @typedef {Object} BehaviorTarget
 * @property {T} behaviorTarget
 * @property {ComponentConfig<true>} config
 */

/**
 * Mapping of behavior types to their respective behavior classes.
 */
export const BEHAVIORS = {
  followPath: FollowPathBehavior,
  spritesheetAnimation: AnimatedSpritesheetBehavior,
  animate: AnimatePropertyBehavior,
  set: SetPropertyBehavior,
}

export class BehaviorSystem {
  /** @type {BehaviorTarget} */
  target

  /** @type {AnimationSystem} */
  system

  /** @type {Behavior[]} */
  behaviors = []

  /** @type {Set<string>} */
  preloadUrls = new Set()

  /**
   * @param {AnimationSystem} system
   * @param {BehaviorConfig<true>[]} behaviorConfigs
   * @param {BehaviorTarget} component
   */
  constructor(system, behaviorConfigs, component) {
    this.system = system
    this.target = component
    this.#initializeBehaviors(behaviorConfigs)
  }

  init() {
    for (const behavior of this.behaviors) {
      behavior.init()
    }
  }

  reset() {
    for (const behavior of this.behaviors) {
      behavior.reset()
    }
  }
  /**
   * @param {number} deltaTimeMs
   */
  runBehaviorUpdates(deltaTimeMs) {
    for (const behavior of this.behaviors) {
      behavior.update(deltaTimeMs)
    }
  }
  /**
   * @param {BehaviorConfig<true>[]} behaviorConfigs
   * @returns {void}
   */
  #initializeBehaviors(behaviorConfigs) {
    for (const config of behaviorConfigs) {
      const behaviorConstructor = BEHAVIORS[config.type]
      if (!behaviorConstructor) {
        throw new Error(`cannot find behavior "${config.type}"`)
      }
      const behavior = new behaviorConstructor({
        config,
        system: this.system,
        target: this.target,
      })
      this.#addBehavior(behavior)
    }
  }
  /**
   * @param {Behavior} behavior
   * @returns {void}
   */
  #addBehavior(behavior) {
    let idx = this.behaviors.findIndex((b) => b.order > behavior.order)
    if (idx === -1) {
      idx = this.behaviors.length
    }
    this.behaviors.splice(idx, 0, behavior)
  }
  /**
   * @returns {void}
   */
  destroy() {
    for (const behavior of this.behaviors) {
      behavior.destroy()
    }
    this.behaviors = null
  }
}
