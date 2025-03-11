/** @import {VariableValue} from '../util/variables.mjs' */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} EventHandler
 * @property {string} event
 * @property {string} action
 * @property {VariableValue<any[], Resolved>} [arguments]
 * @property {VariableValue<number, Resolved>} [limit]
 */

export class ListenerSystem {
  /** @type {Set<ReturnType<setTimeout>>} */
  #timeouts = new Set()

  /** @type {Map<any, any>} */
  #listenersForEvent = new Map()

  /**
   * @param {ListenerTarget} target
   * @param {EventHandler} handler
   * @returns {void}
   */
  add(target, handler) {
    const fn = target[handler.action]
    if (typeof fn !== "function") {
      return
    }
    const limit = handler.limit ?? 0
    const metadata = {
      fn,
      arguments: handler.arguments ?? [],
      limit: limit,
      count: 0,
    }
    let listeners = this.#listenersForEvent.get(handler.event)
    if (!listeners) {
      listeners = new Map()
      this.#listenersForEvent.set(handler.event, listeners)
    }
    listeners.set(target, metadata)
  }

  /**
   * @param {ListenerTarget} target
   * @param {string} event
   * @returns {void}
   */
  remove(target, event) {
    const handlers = this.#listenersForEvent.get(event)
    handlers?.delete(target)
  }

  /**
   * @param {ListenerTarget} target
   * @param {string} event
   * @returns {void}
   */
  reset(target, event) {
    const handlers = this.#listenersForEvent.get(event)
    const data = handlers?.get(target)
    if (data) {
      data.count = 0
    }
  }

  /**
   * @param {string} event
   * @param {number} [delay=0]
   * @returns {void}
   */
  trigger(event, delay = 0) {
    if (delay > 0) {
      const timeout = setTimeout(() => {
        this.#timeouts.delete(timeout)
        this.trigger(event)
      }, delay)
      this.#timeouts.add(timeout)
      return
    }
    const listeners = this.#listenersForEvent.get(event)
    if (!listeners) {
      return
    }
    for (const [target, data] of listeners.entries()) {
      if (data.limit && data.count >= data.limit) {
        return
      }
      data.count += 1
      data.fn.apply(target, data.arguments)
    }
  }

  /**
   * @returns {void}
   */
  destroy() {
    for (const timeout of this.#timeouts) {
      clearTimeout(timeout)
    }
    this.#timeouts.clear()
    this.#listenersForEvent.clear()
  }
}

/** @typedef {(...args: any[]) => void} ListenerFn */
/** @typedef {unknown} ListenerTarget */
/**
 * @typedef {Object} ListenerData
 * @property {ListenerFn} fn
 * @property {number} limit
 * @property {number} count
 * @property {any[]} arguments
 */
