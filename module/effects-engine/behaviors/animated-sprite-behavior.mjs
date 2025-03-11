import { Behavior } from "./behavior.mjs"

/** @import { BehaviorProps, BaseBehaviorConfig } from './behavior.mjs' */
/** @import { VariableValue } from '../util/variables.mjs' */

/**
 * @param {PIXI.Texture[] | PIXI.FrameObject[]} objects
 * @param {number} defaultFrameTime
 * @returns {{ duration: number; textures: PIXI.Texture[]; frameStartTimes: Float32Array; }}
 */
function createFrameData(objects, defaultFrameTime) {
  const textures = new Array(objects.length)
  const frameTimes = new Float32Array(objects.length)
  if (objects[0] instanceof PIXI.Texture) {
    for (let i = 0; i < objects.length; i++) {
      textures[i] = objects[i]
      frameTimes[i] = defaultFrameTime
    }
  } else {
    for (let i = 0; i < objects.length; i++) {
      const frameObject = objects[i]
      textures[i] = frameObject.texture
      frameTimes[i] = frameObject.time ?? defaultFrameTime
    }
  }
  let accumulatedTime = 0
  const frameStartTimes = new Float32Array(objects.length + 1)
  for (let i = 0; i < frameTimes.length; i++) {
    const time = frameTimes[i]
    frameStartTimes[i] = accumulatedTime
    accumulatedTime += time
  }
  frameStartTimes[frameStartTimes.length - 1] = accumulatedTime
  return { duration: accumulatedTime, textures, frameStartTimes }
}

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} SpritesheetAnimationConfig
 * @property {'spritesheetAnimation'} type
 * @property {VariableValue<string, Resolved>} animation
 * @property {VariableValue<number, Resolved>} [animationSpeed]
 * @property {VariableValue<boolean, Resolved>} [loop]
 * @property {VariableValue<number, Resolved>} [loopCount]
 * @property {VariableValue<number, Resolved>} [loopDelay]
 * @property {VariableValue<number, Resolved>} [loopStart]
 * @property {VariableValue<number, Resolved>} [loopEnd]
 * @property {VariableValue<number, Resolved>} [start]
 * @property {VariableValue<number, Resolved>} [end]
 * @property {VariableValue<number, Resolved>} [defaultFrameTime]
 */

/**
 * @template {boolean} [Resolved = false]
 * @typedef {BaseBehaviorConfig<Resolved> & SpritesheetAnimationConfig<Resolved>} BehaviorSpritesheetAnimationConfig
 */

/**
 * Behavior to animate a sprite using a spritesheet.
 * This is heaviliy inspired by the pixi.js AnimatedSprite class
 * but extended to allow for delays between loops, maximal loop counts,
 * custom start and end frames with separate control for looping frames.
 *
 * @extends Behavior<BehaviorSpritesheetAnimationConfig<true>>
 */
export class AnimatedSpritesheetBehavior extends Behavior {
  /** @default false */
  #triggerLoop = false

  /** @default false */
  #triggerLoopCount = false

  /** @default false */
  #triggerComplete = false

  /** @default false */
  #triggerFrameChange = false

  /** @type {PIXI.Texture[]} */
  #textures

  /** @type {Float32Array} */
  #frameStartTimes

  /** @type {number} */
  #totalDuration

  /** @type {number} */
  #animationSpeed

  /** @type {number} */
  #defaultFrameTime

  /** @type {boolean} */
  #loop

  /** @type {number} */
  #loopCount

  /** @type {number} */
  #loopDelay

  /** @type {number} */
  #startMs

  /** @type {number} */
  #endMs

  /** @type {number} */
  #loopStartMs

  /** @type {number} */
  #loopEndMs

  /** @type {number} */
  #currentTimeMs

  /** @type {number} */
  #currentFrame

  /** @type {number} */
  #currentLoop

  /**
   * @param {BehaviorProps<BehaviorSpritesheetAnimationConfig<true>>} options
   */
  constructor(options) {
    super(options)
  }

  _init() {
    if (!(this.parent.texture instanceof PIXI.Spritesheet)) {
      throw new Error(
        "AnimatedSpritesheetBehavior requires a sprite target and a spritesheet texture",
      )
    }
    const animationObjects =
      this.parent.texture.animations[this.config.animation]
    if (!animationObjects) {
      console.error(
        `Could not find animation ${this.config.animation} in spritesheet`,
      )
    }
    const {
      animationSpeed = 1,
      loop,
      loopCount,
      loopStart,
      loopEnd,
      start,
      end,
      loopDelay = 0,
      defaultFrameTime,
    } = this.config
    this.#animationSpeed = animationSpeed
    this.#defaultFrameTime = defaultFrameTime ?? (1 / 30) * 1000
    this.#loop = loop || (loopCount != null && loopCount > 0)
    this.#loopCount = loopCount ?? Infinity
    this.#loopDelay = loopDelay
    const { duration, textures, frameStartTimes } = createFrameData(
      animationObjects,
      this.#defaultFrameTime,
    )
    this.#textures = textures
    this.#frameStartTimes = frameStartTimes
    this.#totalDuration = duration
    this.#startMs =
      start != null ? start : this.#loop && loopStart != null ? loopStart : 0
    this.#endMs =
      end != null
        ? end
        : this.#loop && loopEnd != null
        ? loopEnd
        : this.#totalDuration
    this.#loopStartMs = loopStart ?? this.#startMs
    this.#loopEndMs = loopEnd ?? this.#endMs
    // start at the end if animation is reversed
    this.#currentLoop = 0
    this.#currentTimeMs = this.#currentStartTime
    this.#currentFrame = this.#frameNumberForTime(this.#currentTimeMs)
    this.#setTargetFrame(this.#currentFrame)
    if (this.config.triggers) {
      this.#triggerLoop = this.config.triggers.some(
        (trigger) => trigger.value === "loop",
      )
      this.#triggerLoopCount = this.config.triggers.some(
        (trigger) => trigger.name === "loopCount",
      )
      this.#triggerComplete = this.config.triggers.some(
        (trigger) => trigger.value === "completed",
      )
      this.#triggerFrameChange = this.config.triggers.some(
        (trigger) => trigger.name === "frameChange",
      )
    }
  }

  /**
   * @returns {void}
   */
  _start() {}

  /**
   * @returns {void}
   */
  _reset() {
    this.#loopCount = 0
    this.#currentTimeMs = this.#currentStartTime
    this.#currentFrame = this.#frameNumberForTime(this.#currentTimeMs)
  }

  /**
   * @returns {boolean}
   */
  get #hasNextLoop() {
    return this.#loop && this.#currentLoop < this.#loopCount
  }

  /**
   * Time in ms at which this loop ends
   *
   * @returns {number}
   */
  get #currentEndTime() {
    if (this.#animationSpeed >= 0) {
      return this.#hasNextLoop ? this.#loopEndMs : this.#endMs
    }
    return this.#hasNextLoop ? this.#loopStartMs : this.#startMs
  }

  /**
   * Time at which this loop starts
   *
   * @returns {number}
   */
  get #currentStartTime() {
    if (this.#animationSpeed >= 0) {
      return this.#loopCount === 0 ? this.#startMs : this.#loopStartMs
    }
    return this.#loopCount === 0 ? this.#endMs : this.#loopEndMs
  }

  /**
   * Time in ms of the current loop, clamped to the loops start and end time
   * @returns {number}
   */
  get #clampedCurrentTime() {
    return Math.max(
      Math.min(this.#currentTimeMs, this.#currentEndTime),
      this.#currentStartTime,
    )
  }

  /**
   * Get the frame number for a given time in ms
   * TODO: This could be optimized by using a binary search
   * and/or starting from the current frame.
   *
   * @param {number} time
   * @returns {number}
   */
  #frameNumberForTime(time) {
    if (time < 0) {
      return 0
    } else if (time >= this.#totalDuration) {
      return this.#textures.length - 1
    }
    const currentIdx = this.#currentFrame ?? 0
    const frameCount = this.#frameStartTimes.length
    for (let i = 0; i < frameCount; i++) {
      let idx = i + currentIdx
      if (idx >= frameCount) {
        idx -= frameCount
      }
      const currentFrameTime = this.#frameStartTimes[idx]
      const nextFrameTime = this.#frameStartTimes[idx + 1]
      if (time >= currentFrameTime && time < nextFrameTime) {
        return Math.max(idx - 1, 0)
      }
    }
    return 0
  }

  /**
   * @param {number} _deltaTimeMs
   */
  _update(_deltaTimeMs) {
    const deltaTimeMs = PIXI.Ticker.shared.deltaMS
    const elapsedMs = this.#animationSpeed * deltaTimeMs
    this.#currentTimeMs += elapsedMs
    const sign = Math.sign(elapsedMs)
    if (this.#loop) {
      let endTime
      while (true) {
        endTime = this.#currentEndTime + this.#loopDelay * sign
        if (this.#currentTimeMs * sign <= endTime * sign) {
          break
        }
        if (this.#currentLoop >= this.#loopCount) {
          break
        }
        this.#currentLoop += 1
        this.#currentTimeMs =
          this.#currentTimeMs - endTime + this.#currentStartTime
      }
    }
    const nextFrame = this.#frameNumberForTime(this.#clampedCurrentTime)
    const previousFrame = this.#currentFrame
    this.#currentFrame = nextFrame
    this.#setTargetFrame(this.#currentFrame)
    if (
      !this.#hasNextLoop &&
      ((sign > 0 && this.#currentTimeMs > this.#currentEndTime) ||
        (sign < 0 && this.#currentTimeMs >= this.#currentStartTime))
    ) {
      this.stop()
      this.#handleComplete()
    } else if (
      this.#currentFrame !== previousFrame &&
      this.#loop &&
      ((sign > 0 && this.#currentFrame < previousFrame) ||
        (sign < 0 && this.#currentFrame > previousFrame))
    ) {
      this.#handleLoop(this.#currentLoop)
    }
  }

  /**
   * Set the frame for the behavior target
   *
   * @param {number} frame
   * @returns {void}
   */
  #setTargetFrame(frame) {
    this.target.texture = this.#textures[frame]
    this.#handleFrameChange(frame)
  }

  /**
   * Signal a new loop being started.
   * Calls triggers for loop and loopCount
   *
   * @param {number} loopCount
   * @returns {void}
   */
  #handleLoop(loopCount) {
    if (this.#triggerLoop) {
      this.callTrigger("event", "loop")
    }
    if (this.#triggerLoopCount) {
      this.callTrigger("loopCount", loopCount)
    }
  }

  /**
   * Signal the animation has completed.
   *
   * @returns {void}
   */
  #handleComplete() {
    if (this.#triggerComplete) {
      this.callTrigger("event", "completed")
    }
  }

  /**
   * Signal a new frame has been set.
   *
   * @param {number} currentFrame
   * @returns {void}
   */
  #handleFrameChange(currentFrame) {
    if (this.#triggerFrameChange) {
      this.callTrigger("frame", currentFrame)
    }
  }
}
