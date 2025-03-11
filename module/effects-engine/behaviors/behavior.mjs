import { TriggerSystem } from "../systems/trigger-system.mjs"
import { AnimationSystem } from "../animation-system.mjs"

/** @import * as PIXI from 'pixi.js' */
/** @import { VariableValue } from '../util/variables.mjs' */
/** @import { EventTriggerConfig } from '../systems/trigger-system.mjs' */
/** @import { BehaviorAnimatePropertyConfig } from './animate-property-behavior.mjs' */
/** @import { BehaviorSetPropertyConfig } from './set-property-behavior.mjs' */
/** @import { BehaviorSpritesheetAnimationConfig } from './animated-sprite-behavior.mjs' */
/** @import { BehaviorFollowPathConfig } from './follow-path-behavior.mjs' */

export const BehaviorOrder = {
  Early: 10,
  Normal: 20,
  Late: 20,
}

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {
     | BehaviorAnimatePropertyConfig<Resolved> 
     | BehaviorSetPropertyConfig<Resolved>
     | BehaviorSpritesheetAnimationConfig<Resolved>
     | BehaviorFollowPathConfig<Resolved>
   } BehaviorConfig
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} BaseBehaviorConfig
 * @property {VariableValue<BehaviorStartValue, Resolved>} [startTime]
 * @property {EventTriggerConfig<Resolved>[]} [triggers]
 * @property {EventHandlerConfig<Resolved>[]} [handlers]
 */

/**
 * @template {BaseBehaviorConfig<true>} [Config=BaseBehaviorConfig<true>]
 *
 * @typedef {Object} BehaviorProps
 * @property {BehaviorParent} target
 * @property {AnimationSystem} system
 * @property {Config} config
 */

/**
 * @template {BaseBehaviorConfig<true>} [Config=BaseBehaviorConfig<true>]
 */
export class Behavior {
  /** @type {BehaviorParent} */
  #parent

  /** @type {TriggerSystem} */
  #triggers

  /** @type {Set<string>} */
  #registeredHandlers = new Set()

  /** @type {BehaviorState} */
  #state = "stopped"

  /** @type {number} */
  #elapsedTimeMs = 0

  /** @type {AnimationSystem} */
  system

  /** @type {Config} */
  config

  /** @type {number} */
  startDelay = 0

  /**
   * order in which this behavior is initialized and updated.
   * Lower numbers are handled earlier.
   * @type {number}
   */
  order = BehaviorOrder.Normal

  /**
   * Base class for the behavior system. A Behavior is a single unit of animation, for example
   * setting or animating property values of the target component, playing a spritesheet animation,
   * or following a path.
   *
   * Behaviors are initialized and updated by the BehaviorSystem, and can be started, stopped, or restarted
   * based on triggers and event handlers.
   *
   * Subclasses should override probably at least the `_init` and `_update` metohods to
   * initialize the behavior data and update the target object respectively.
   * See follow-path-behavior.mjs for an example of a more complex behavior.
   *
   * For custom behaviors, BEHAVIORS config also has to be updated to include the new behavior
   *
   * Notable missing behaviors are:
   *  * Object trails (if those are even implemented as behavior...)
   *  * Mesh deformation based on rope structures. Similar to object
   *    trails or follow path probably
   *  * Particle behavior... Maybe this should be its own system though.
   *
   * @param {BehaviorProps<Config>} props
   */
  constructor({ target, system, config }) {
    this.#parent = target
    this.system = system
    this.config = config
    this.#triggers = new TriggerSystem(system.listenerSystem, config.triggers)
  }

  /** @type {unknown} */
  get target() {
    return this.#parent.behaviorTarget
  }

  /** @type {BehaviorParent} */
  get parent() {
    return this.#parent
  }

  /** @type {number} */
  get elapsedTimeMs() {
    return this.#elapsedTimeMs
  }

  get state() {
    return this.#state
  }

  /** @param {BehaviorState} value */
  set state(value) {
    // trigger state change event if registered
    if (this.#state !== value) {
      this.callTrigger("state", value)
    }
    this.#state = value
  }

  // Initialize or reset behavior target
  init() {
    this.#setupHandlers()
    this.#setStartTime()
    this._init()
  }

  // Initialize or reset behavior target
  _init() {}

  reset() {
    this.#triggers.reset()
    this.#elapsedTimeMs = 0
    this.#setStartTime()
    this.#refreshState()
    this._reset()
    this.update(0)
  }

  // custom reset logic
  _reset() {}

  /**
   * @param {string} key
   * @param {unknown} value
   */
  callTrigger(key, value) {
    this.#triggers.callTrigger(key, value)
  }

  /**
   * @param {EventHandlerConfig<true>} handler
   */
  registerEventHandler(handler) {
    this.system.listenerSystem.add(this, handler)
    this.#registeredHandlers.add(handler.event)
  }

  start() {
    if (this.state === "running") {
      return
    }
    this.startDelay = 0
    this.#refreshState()
    this._start()
  }

  /**
   * custom handler for start. Called when the behavior is started
   */
  _start() {}

  restart() {
    this.reset()
    this.start()
  }

  stop() {
    this.state = "stopped"
    this._stop()
  }

  _stop() {}

  #refreshState() {
    if (this.#elapsedTimeMs > 0) {
      return
    }
    this.state = this.startDelay === 0 ? "running" : "waiting"
  }

  #setupHandlers() {
    for (const handler of this.config.handlers ?? []) {
      this.registerEventHandler(handler)
    }
  }

  #setStartTime() {
    const startTime = this.config.startTime
    if (startTime === null || startTime === undefined || startTime === 0) {
      this.startDelay = 0
    } else if (typeof startTime === "number") {
      this.startDelay = startTime
    } else {
      this.startDelay = -1
      this.registerEventHandler({ event: startTime.event, action: "restart" })
    }
  }

  /** @param {number} deltaTimeMs */
  update(deltaTimeMs) {
    if (this.startDelay === -1) {
      return
    }
    this.startDelay = Math.max(this.startDelay - deltaTimeMs, 0)
    this.#refreshState()

    if (this.state !== "running") {
      return
    }
    this._update(deltaTimeMs)
    this.#elapsedTimeMs += deltaTimeMs
    this.callTrigger("elapsedTimeMs", this.elapsedTimeMs)
  }

  /**
   * Update function called each animation tick
   *
   * @param {number} deltaTimeMs time in seconds since the last update
   */
  _update(deltaTimeMs) {
    // Implement in subclass
  }

  destroy() {
    this.#parent = null
    this.system = null
    this.config = null
    for (const event of this.#registeredHandlers) {
      this.system.listenerSystem.remove(this, event)
    }
  }
}

/**
 * @typedef {'waiting' | 'running' | 'paused' | 'stopped'} BehaviorState
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} EventHandlerConfig
 * @property {string} event
 * @property {string} action
 * @property {VariableValue<any[], Resolved>} [arguments]
 * @property {VariableValue<number, Resolved>} [limit]
 */

/**
 * @typedef {number | { event: string }} BehaviorStartValue
 */

/**
 * @typedef {Object} BehaviorParent
 * @property {unknown} behaviorTarget
 * @property {PIXI.Spritesheet | PIXI.Texture | undefined} [texture]
 */
