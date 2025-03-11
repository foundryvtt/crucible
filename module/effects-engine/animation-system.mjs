import { BloomRoot } from "./bloom-effect/_module.mjs"
import {
  ComponentContainer,
  ComponentRoot,
  ComponentSprite,
} from "./components/_module.mjs"
import { ListenerSystem } from "./systems/_module.mjs"
import {
  Path,
  resolveVariables,
  rotationBetweenPoints,
} from "./util/_module.mjs"

/**
 * @import {Component, ComponentConfig} from './components/component.mjs'
 * @import {PathConfig} from './util/path.mjs'
 * @import {VariableValue} from './util/variables.mjs'
 * @import {IPointData} from 'pixi.js'
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} RawAnimationConfig
 * @property {string} name
 * @property {Record<string, unknown>} [variables]
 * @property {ComponentConfig<Resolved>[]} components
 * @property {Record<string, PathConfig<Resolved>>} [paths]
 * @property {VariableValue<number, Resolved>} [sortLayer]
 */

/** @typedef {RawAnimationConfig<true>} ResolvedAnimationConfig */

/**
 * @typedef {Object} ExternalAnimationContext
 * @property {IPointData} source
 * @property {IPointData} [target]
 * @property {number} [scale]
 * @property {Record<string, unknown>} [variables]
 */

/**
 * @typedef {Record<string, unknown> & {
 *   source: IPointData;
 *   originalSource: IPointData;
 *   target?: IPointData;
 *   originalTarget?: IPointData;
 *   distance: number;
 * }} VariablesRecord
 */

export const COMPONENTS = {
  container: ComponentContainer,
  sprite: ComponentSprite,
}

export class AnimationSystem extends BloomRoot {
  /**
   * @type {number}
   */
  sortLayer = 700

  /** @type {PIXI.Ticker} */
  #ticker = PIXI.Ticker.shared

  /** @type {Promise<void>} */
  #endPromise

  /** @type {(value?: any) => void} */
  #resolveEndPromise

  /** @type {ResolvedAnimationConfig} */
  config

  /** @type {ExternalAnimationContext} */
  externalContext

  /** @type {VariablesRecord} */
  variables

  /** @type {Map<string, Path>} */
  paths = new Map()

  /** @type {Map<string, Component<any>>} */
  componentsMap = new Map()

  /** @type {Component<any>[]} */
  allComponents = []

  /** @type {Set<string>} */
  preloadAssetUrls = new Set()

  /** @type {Map<string, any>} */
  assets = new Map()

  /** @type {ListenerSystem} */
  listenerSystem = new ListenerSystem()

  /** @type {number} */
  startTime = 0

  /**
   * @param {RawAnimationConfig} config
   * @param {ExternalAnimationContext} context
   */
  constructor(config, context) {
    super()
    this.variables = this.mergeVariables(config, context)
    this.config = resolveVariables(config, this.variables)
    this.externalContext = context
    const { promise: endPromise, resolve: resolveEndPromise } =
      Promise.withResolvers()
    this.#endPromise = endPromise
    this.#resolveEndPromise = resolveEndPromise
  }
  /**
   * @returns {Promise<void>}
   */
  async initialize() {
    this.#initializePaths(this.config.paths)
    this.initializeComponents(this.config.components, new ComponentRoot(this))
    await this.#preloadAssets()
    this.#activateComponents()
    this.updateRotation()
    this.updatePosition()

    // TODO: we should switch to a generic "properties" object for any properties to be set
    // on components and the container
    if (this.config.sortLayer != null) {
      this.sortLayer = this.config.sortLayer
    }
  }
  /**
   * @returns {Promise<void>}
   */
  async start() {
    // TODO: endcondition?
    this.startTime = PIXI.Ticker.shared.lastTime
    this.#ticker.add(this.#update, this, PIXI.UPDATE_PRIORITY.HIGH)
    this.#runBehaviorUpdates(0)
    return this.#endPromise
  }
  // TODO other end conditions like soft-end
  /**
   * @returns {Promise<void>}
   */
  async stop() {
    this.destroy()
    return this.#endPromise
  }
  /**
   * @param {PIXI.IDestroyOptions | boolean} [options]
   * @returns {void}
   */
  destroy(options) {
    super.destroy(options)
    this.listenerSystem.destroy()
    this.#ticker.remove(this.#update, this)
    this.assets.clear()
    this.paths.clear()
    this.componentsMap.clear()
    this.allComponents.splice(0, this.allComponents.length)
    this.config = null
    this.externalContext = null
    this.#resolveEndPromise()
  }
  /**
   * @param {string} url
   * @returns {void}
   */
  addAsset(url) {
    this.preloadAssetUrls.add(url)
  }
  /**
   * @returns {Promise<void>}
   */
  async #preloadAssets() {
    const assetMap = await PIXI.Assets.load(Array.from(this.preloadAssetUrls))
    for (const [key, asset] of Object.entries(assetMap)) {
      if (asset instanceof PIXI.Texture || asset instanceof PIXI.Spritesheet) {
        asset.baseTexture.alphaMode = PIXI.ALPHA_MODES.PREMULTIPLIED_ALPHA
      }
      this.assets.set(key, asset)
    }
  }
  /**
   * @returns {void}
   */
  #update() {
    this.#runBehaviorUpdates(this.#ticker.deltaMS)
  }

  /**
   * @param {number} deltaTimeMs
   */
  #runBehaviorUpdates(deltaTimeMs) {
    for (const component of this.allComponents) {
      component.runBehaviors(deltaTimeMs)
    }
  }

  /**
   * @returns {void}
   */
  updateRotation() {
    const { source, target } = this.externalContext
    if (!target) {
      return
    }
    this.rotation = rotationBetweenPoints(source, target)
  }
  /**
   * @returns {void}
   */
  updatePosition() {
    const { source } = this.externalContext
    this.position.copyFrom(source)
  }
  /**
   * @param {Record<string, PathConfig<true>>} [pathsConfig]
   */
  #initializePaths(pathsConfig) {
    if (!pathsConfig) {
      return
    }
    for (const [pathName, path] of Object.entries(pathsConfig)) {
      const pathConfig = path
      let start = this.variables.source
      let end = this.variables.target
      if (pathConfig !== "linear") {
        start = pathConfig.start ?? start
        end = pathConfig.end ?? end
      }
      if (!start) {
        throw new Error(
          `source cannot be found for path ${JSON.stringify(pathConfig)}`,
        )
      }
      if (!end) {
        throw new Error(
          `target cannot be found for path ${JSON.stringify(pathConfig)}`,
        )
      }
      this.paths.set(pathName, new Path({ config: pathConfig, start, end }))
    }
  }
  /**
   * @param {RawAnimationConfig} config
   * @param {ExternalAnimationContext} context
   * @returns {VariablesRecord}
   */
  mergeVariables(config, context) {
    const distance = context.target
      ? Math.sqrt(
          Math.pow(context.target.x - context.source.x, 2) +
            Math.pow(context.target.y - context.source.y, 2),
        )
      : 0
    const normalizedSource = { x: 0, y: 0 }
    const normalizedTarget = { x: distance, y: 0 }
    return {
      ...config.variables,
      ...context.variables,
      source: normalizedSource,
      target: normalizedTarget,
      originalSource: context.source,
      originalTarget: context.target,
      distance,
    }
  }
  /**
   * @param {ComponentConfig<true>[]} componentConfig
   * @param {Component<any>} parent
   * @returns {void}
   */
  initializeComponents(componentConfig, parent) {
    for (const config of componentConfig) {
      this.initializeComponent(config, parent)
    }
  }
  /**
   * @param {ComponentConfig<true>} componentConfig
   * @param {Component<any>} parent
   * @returns {void}
   */
  initializeComponent(componentConfig, parent) {
    const componentConstructor = COMPONENTS[componentConfig.type]
    if (!componentConstructor) {
      throw new Error(`cannot find component "${componentConfig.type}"`)
    }
    const component = new componentConstructor({
      config: componentConfig,
      system: this,
      parent,
    })
    component.prepare()
    this.allComponents.push(component)
    this.componentsMap.set(component.id, component)
  }
  /**
   * @returns {void}
   */
  #activateComponents() {
    for (const component of this.allComponents) {
      component.activate()
    }
  }
}
