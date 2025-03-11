import { ComponentShader } from "./component-shader.mjs"
import { HdrColor } from "./hdr-color.mjs"

const ComponentMeshBlendModesMap = {
  [PIXI.BLEND_MODES.NORMAL]: 1,
  [PIXI.BLEND_MODES.ADD]: 0,
}

/**
 * Simple extension of the foundry SpriteMesh to support batched
 * rendering with mixed ADDITIVE and NORMAL blend modes and
 * HDR Color support for tinting the sprite.
 *
 * @extends {SpriteMesh}
 */
export class ComponentMesh extends SpriteMesh {
  /** @type {number} */
  _mode = ComponentMeshBlendModesMap[PIXI.BLEND_MODES.NORMAL]

  #cachedTint = new Float32Array(4)

  /**
   *
   * @param {PIXI.Texture} texture
   */
  constructor(texture) {
    super(texture, ComponentShader)
    this._tintColor = new HdrColor(0xffffff)
    this.alphaMode = PIXI.ALPHA_MODES.PREMULTIPLIED_ALPHA
    this._blendMode = PIXI.BLEND_MODES.NORMAL
  }

  /** @param {PIXI.BLEND_MODES} value */
  set blendMode(value) {
    console.warn("Only NORMAL blend mode is supported for component meshes")
  }

  /**
   * The blend mode applied to the SpriteMesh.
   * @type {PIXI.BLEND_MODES}
   * @defaultValue PIXI.BLEND_MODES.NORMAL
   */
  set mode(value) {
    if (value !== PIXI.BLEND_MODES.NORMAL && value !== PIXI.BLEND_MODES.ADD) {
      console.warn(`Invalid blend mode: ${value}. Defaulting to NORMAL.`)
      value = PIXI.BLEND_MODES.NORMAL
    }
    // normal / add blend mode batch shader
    this._mode = ComponentMeshBlendModesMap[value]
  }

  get mode() {
    return this._mode
  }

  /**
   * @override
   */
  _updateBatchData() {
    super._updateBatchData()
    this._batchData._tintRGB = this.#cachedTint
    this._batchData.mode = this.mode
    HdrColor.shared
      .setValue(this._tintColor.components)
      .premultiply(this.worldAlpha, this.alphaMode > 0)
      .toArray(this._batchData._tintRGB)
  }
}

/**
 * @typedef {Object} ComponentMeshBatchData
 * @property {Float32Array} _tintRGB
 * @property {PIXI.Texture} _texture
 * @property {number[]} indices
 * @property {number[]} uvs
 * @property {number} blendMode
 * @property {0 | 1} mode
 * @property {number[]} vertexData
 * @property {number} worldAlpha
 * @property {ComponentMesh} object
 */
