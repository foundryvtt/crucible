import { Behavior, BehaviorOrder } from "./behavior.mjs"
import { ValueList } from "../util/value-list.mjs"

/** @import { Path } from '../util/path.mjs' */
/** @import { BaseBehaviorConfig, BehaviorProps } from './behavior.mjs' */
/** @import { VariableValue } from '../util/variables.mjs' */
/** @import { ValueListConfig } from '../util/value-list.mjs' */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} SpeedConstantConfig
 * @property {'constant'} type
 * @property {VariableValue<number, Resolved>} value speed in pixels per second
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} SpeedLinearConfig
 * @property {'linear'} type
 * @property {VariableValue<number, Resolved>} initial initial speed in pixels per second
 * @property {VariableValue<number, Resolved>} acceleration acceleration in pixels per second squared
 * @property {VariableValue<number, Resolved>} [min] minimum speed in pixels per second
 * @property {VariableValue<number, Resolved>} [max] maximum speed in pixels per second
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {{type: 'custom'} & ValueListConfig<number, Resolved>} SpeedCustomConfig
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {number | SpeedConstantConfig<Resolved> | SpeedLinearConfig<Resolved> | SpeedCustomConfig<Resolved>} SpeedConfig
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} FollowPathConfig
 * @property {'followPath'} type
 * @property {VariableValue<string, Resolved>} path  // path id
 * @property {VariableValue<SpeedConfig<Resolved>, Resolved>} speed // speed in pixels per second
 * @property {VariableValue<number, Resolved>} [offsetStart] // offset from start of path in pixels
 * @property {VariableValue<number, Resolved>} [offsetEnd] // offset from end of path in pixels
 * @property {VariableValue<boolean, Resolved>} [applyRotation = true] // should the target follow the rotation of the path
 * @property {VariableValue<number, Resolved>} [rotationOffset] // rotation offset in radians. Only applicable if applyRotation is true
 */

/**
 * @template {boolean} [Resolved = false]
 * @typedef {BaseBehaviorConfig<Resolved> & FollowPathConfig<Resolved>} BehaviorFollowPathConfig
 */

/**
 * @extends {Behavior<BehaviorFollowPathConfig<true>>}
 */
export class FollowPathBehavior extends Behavior {
  /**
   * Late ordering to ensure that the target is updated after all other behaviors
   * that might set rotation or position
   *
   * @type {number}
   */
  order = BehaviorOrder.Late

  /** @type {Path} */
  path

  /** @type {number} */
  initialSpeed = 0

  /** @type {number} */
  initialDistance = 0

  /** @type {number} */
  currentSpeed = 0

  /** @type {number} */
  acceleration = 0

  /** @type {number} */
  minSpeed = 0

  /** @type {number} */
  maxSpeed = Number.MAX_SAFE_INTEGER

  /** @type {ValueList<number> | null} */
  speedList = null

  /** @type {number} */
  currentDistance = 0

  /** @type {number} */
  maxDistance = 0

  /** @type {boolean} */
  applyRotation = true

  /** @type {number} */
  rotationOffset = 0

  /**
   * @param {BehaviorProps<BehaviorFollowPathConfig<true>>} options
   */
  constructor(options) {
    super(options)
    const path = this.system.paths.get(this.config.path)
    if (!path) {
      throw new Error(
        `Path "${this.config.path}" not defined for behavior ${this.config}`,
      )
    }
    this.path = path
  }
  /**
   * @returns {void}
   */
  _init() {
    if (typeof this.config.speed === "number") {
      this.initialSpeed = this.config.speed
    } else if (this.config.speed.type === "constant") {
      this.initialSpeed = this.config.speed.value
    } else if (this.config.speed.type === "linear") {
      this.initialSpeed = this.config.speed.initial
      this.acceleration = this.config.speed.acceleration
    } else {
      this.speedList = new ValueList(this.config.speed)
    }
    this.initialDistance = this.config.offsetStart ?? 0
    this.maxDistance = this.path.pathDistance - (this.config.offsetEnd ?? 0)
    this.applyRotation = this.config.applyRotation ?? true
    this.rotationOffset = this.config.rotationOffset ?? 0
    this._reset()
  }
  /**
   * @returns {void}
   */
  _reset() {
    this.currentDistance = this.initialDistance
    this.currentSpeed = this.initialSpeed
    this.#updateTarget()
  }
  /**
   * @param {number} deltaTimeMs
   * @returns {void}
   */
  _update(deltaTimeMs) {
    // skip if we've reached the end of the path
    if (this.currentDistance >= this.maxDistance) {
      return
    }
    const deltaTimeSeconds = deltaTimeMs / 1000
    // assume linear acceleration. Adding 1/2 acc first, calculating new position, adding
    // rest of the acceleration later.
    const steppedAcceleration = this.#getSteppedAcceleration(deltaTimeMs)
    let newSpeed = this.currentSpeed + steppedAcceleration
    // clamping to max and min speeds respectively
    this.currentSpeed = Math.max(
      Math.min(newSpeed, this.maxSpeed),
      this.minSpeed,
    )
    this.currentDistance = Math.min(
      this.currentDistance + this.currentSpeed * deltaTimeSeconds,
      this.maxDistance,
    )
    // add the rest of the acceleration
    this.currentSpeed = Math.max(
      Math.min(newSpeed + steppedAcceleration, this.maxSpeed),
      this.minSpeed,
    )
    this.callTrigger(
      "distanceFraction",
      this.currentDistance / this.maxDistance,
    )
    this.callTrigger("distance", this.currentDistance)
    this.callTrigger(
      "distanceToEnd",
      this.path.pathDistance - this.currentDistance,
    )
    this.callTrigger("speed", this.currentSpeed)
    if (this.currentDistance >= this.maxDistance) {
      this.state = "stopped"
    }
    // get new point
    this.#updateTarget()
  }
  /**
   * @param {number} deltaTimeMs
   * @returns {number}
   */
  #getSteppedAcceleration(deltaTimeMs) {
    if (this.speedList) {
      const oldSpeed = this.currentSpeed
      const newSpeed = this.speedList.getValue(this.elapsedTimeMs)
      return (newSpeed - oldSpeed) * 0.5
    } else {
      // deltaTimeMs * 0.0005 == deltaTimeSeconds / 2
      return this.acceleration * deltaTimeMs * 0.0005
    }
  }
  /**
   * @returns {void}
   */
  #updateTarget() {
    const newPoint = this.path.pointAtDistance(this.currentDistance)
    this.target.position.copyFrom(newPoint)
    if (this.applyRotation) {
      this.target.rotation = newPoint.r + this.rotationOffset
    }
  }
}
/**
 * @typedef {Object} FollowPathTarget
 * @property {PIXI.Point} position
 * @property {number} rotation
 */
