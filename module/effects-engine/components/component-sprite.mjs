import { ComponentMesh } from "../_module.mjs"
import { Component } from "./component.mjs"

/** @import { ComponentProps, BaseComponentConfig } from './component.mjs' */
/** @import { VariableValue } from '../util/variables.mjs' */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} TextureSourceSpritesheet
 * @property {'spritesheet'} type
 * @property {VariableValue<string, Resolved>} src src of the spritesheet. NOTE! All spritesheets MUST be in pre-multiplied alpha format
 * @property {VariableValue<string, Resolved>} [frame]
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {VariableValue<string, Resolved> | TextureSourceSpritesheet<Resolved>} TextureSource
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} SpriteConfig
 * @property {'sprite'} type
 * @property {TextureSource<Resolved>} texture Texture to use. NOTE! All textures MUST be in premultiplied alpha format
 * @property {VariableValue<string, Resolved>} [namedFrame]
 * @property {VariableValue<0 | 1, Resolved>} [mode]
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {SpriteConfig<Resolved> & BaseComponentConfig<Resolved>} ComponentSpriteConfig
 */

/**
 * @extends {Component<ComponentSpriteConfig<true>>}
 */
export class ComponentSprite extends Component {
  /** @type {string} */
  textureUrl

  /** @type {PIXI.Texture | PIXI.Spritesheet | undefined} */
  texture

  /** @type {string | undefined} */
  namedFrame

  /**
   * @param {ComponentProps<ComponentSpriteConfig<true>>} config
   */
  constructor(config) {
    super(config)
    // this.spriteAnimation = this.config.spriteAnimation;
    this.namedFrame = this.config.namedFrame
    this.textureUrl = this.#getTextureUrl()
    this.system.addAsset(this.textureUrl)
  }

  /**
   * @returns {void}
   */
  prepare() {}

  /**
   * @returns {void}
   */
  createComponent() {
    this.texture = this.system.assets.get(this.textureUrl)
    if (!this.texture) {
      throw new Error(
        `Could not load texture for sprite ${this.id}. ${JSON.stringify(
          this.config,
        )}`,
      )
    }

    let texture = PIXI.Texture.EMPTY

    if (this.texture instanceof PIXI.Texture) {
      texture = this.texture
    } else if (this.texture instanceof PIXI.Spritesheet && this.namedFrame) {
      texture = this.texture.textures[this.namedFrame]
    }

    this.target = new ComponentMesh(texture)
  }

  /**
   * @returns {string}
   */
  #getTextureUrl() {
    const texture = this.config.texture
    let url
    if (typeof texture === "string") {
      url = texture
    } else {
      url = texture.src
      if ("frame" in texture && !this.namedFrame) {
        this.namedFrame = texture.frame
      }
    }
    return url
  }

  /** @override */
  applyComponentConfig() {
    super.applyComponentConfig()
    if (!this.target) {
      return
    }
    if (
      "mode" in this.target &&
      typeof this.target.mode === "number" &&
      this.config.mode != null
    ) {
      this.target.mode = this.config.mode
    }
  }
}
