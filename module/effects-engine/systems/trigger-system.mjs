/**
 *  @import { ListenerSystem } from './listener-system.mjs'
 *  @import { VariableValue } from '../util/variables.mjs'
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} EventTriggerConfig
 * @property {string} name
 * @property {string} key
 * @property {VariableValue<TriggerValue, Resolved>} value
 * @property {VariableValue<Comparator, Resolved>} [cmp='eq']
 * @property {VariableValue<number, Resolved>} [limit]
 * @property {VariableValue<number, Resolved>} [delay]
 */

/**
 * @typedef {'eq' | 'gt' | 'gte' | 'lt' | 'lte'} Comparator
 */
/**
 * @typedef {number | string | boolean} TriggerValue
 */

/**
 * @param {EventTriggerConfig<true>} triggerConfig
 * @param {ListenerSystem} listenerSystem
 * @returns {ComparatorTrigger}
 */
function buildComparatorTrigger(triggerConfig, listenerSystem) {
  /** @type {(a: TriggerValue, b: TriggerValue) => boolean} */
  let cmp
  if (triggerConfig.cmp === "gt") {
    cmp = (a, b) => a > b
  } else if (triggerConfig.cmp === "gte") {
    cmp = (a, b) => a >= b
  } else if (triggerConfig.cmp === "lt") {
    cmp = (a, b) => a < b
  } else if (triggerConfig.cmp === "lte") {
    cmp = (a, b) => a <= b
  } else {
    cmp = (a, b) => a === b
  }
  const { value, delay, name } = triggerConfig
  const trigger = {
    limit: triggerConfig.limit ?? 0,
    count: 0,
    /** @param {TriggerValue} compareValue */
    triggerFunction: (compareValue) => {
      if (
        (!trigger.limit || trigger.count < trigger.limit) &&
        cmp(compareValue, value)
      ) {
        listenerSystem.trigger(name, delay)
        trigger.count += 1
      }
    },
  }
  return trigger
}

export class TriggerSystem {
  /** @type {ListenerSystem} */
  #listener

  /** @type {Map<string, ComparatorTrigger[]>} */
  #trigger = new Map()

  /** @type {EventTriggerConfig<true>[]} */
  #triggerConfig

  /**
   * @param {ListenerSystem} listener
   * @param {EventTriggerConfig<true>[]} [triggerConfig]
   */
  constructor(listener, triggerConfig) {
    this.#listener = listener
    this.#triggerConfig = triggerConfig ?? []
    this.setupTriggers()
  }
  /**
   * @returns {void}
   */
  setupTriggers() {
    for (const trigger of this.#triggerConfig) {
      const triggers = this.#trigger.get(trigger.key) ?? []
      triggers.push(buildComparatorTrigger(trigger, this.#listener))
      this.#trigger.set(trigger.key, triggers)
    }
  }
  /**
   * @returns {void}
   */
  reset() {
    for (const triggers of this.#trigger.values()) {
      for (const trigger of triggers) {
        trigger.count = 0
      }
    }
  }
  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {void}
   */
  callTrigger(key, value) {
    const triggers = this.#trigger.get(key) ?? []
    for (const trigger of triggers) {
      trigger.triggerFunction(value)
    }
  }
}
/**
 * @typedef {Object} ComparatorTrigger
 * @property {number} limit
 * @property {number} count
 * @property {(value: number | string) => void} triggerFunction
 */
