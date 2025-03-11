import {
  BloomDownsampleFilterPass,
  BloomUpsampleFilterPass,
} from "./bloom-passes.mjs"

/**
 * @import {IBaseTextureOptions}  from 'pixi.js'
 */

/**
 * @param {PIXI.UniformGroup} globalUniforms
 * @param {BloomStage} inputStage
 * @param {BloomStage} targetStage
 * @returns {void}
 */
function applyGlobalUniforms(globalUniforms, inputStage, targetStage) {
  const inputSize = globalUniforms.uniforms.inputSize
  inputSize[0] = inputStage.texture.width
  inputSize[1] = inputStage.texture.height
  inputSize[2] = inputStage.frame.width / inputStage.texture.width
  inputSize[3] = inputStage.frame.height / inputStage.texture.height
  const outputFrame = globalUniforms.uniforms.outputFrame
  outputFrame.copyFrom(targetStage.frame)
  globalUniforms.update()
}

const backupSourceFrame = new PIXI.Rectangle()

/**
 * HDR bloom effect immplementation. This could almost be a regular PIXI.js filter, were it not
 * for the fact that we need special textures to handle the effect.
 */
export class HdrBloomEffect {
  /** @type {BloomDownsampleFilterPass} */
  #downsamplerPass

  /** @type {BloomUpsampleFilterPass} */
  #upsamplerPass = new BloomUpsampleFilterPass()

  /** @type {BloomStage[]} */
  #bloomStages

  /**	@type {number} */
  #passes

  /**
   * @type {IBaseTextureOptions}
   */
  #textureOptions

  /**
   * @param {{ textureOptions: IBaseTextureOptions; passes?: number; threshold?: number; knee?: number }} options
   */
  constructor({ textureOptions, passes = 8, threshold = 1, knee = 0.2 }) {
    this.#passes = passes
    this.#textureOptions = textureOptions
    this.#downsamplerPass = new BloomDownsampleFilterPass({ threshold, knee })
    this.#bloomStages = Array.from({ length: this.#passes + 1 }, () => ({
      texture: null,
      frame: new PIXI.Rectangle(),
      texelSize: new Float32Array(2),
    }))
    this.legacy = false
  }

  /**
   * @param {PIXI.Renderer} renderer
   * @param {PIXI.RenderTexture} input
   * @param {PIXI.RenderTexture} output
   * @returns {void}
   */
  apply(renderer, input, output) {
    const filterSystem = renderer.filter
    backupSourceFrame.copyFrom(filterSystem.activeState.sourceFrame)
    const globalUniforms = filterSystem.globalUniforms
    const firstStage = this.#bloomStages[0]

    firstStage.texture = input
    firstStage.frame.copyFrom(input.frame)
    firstStage.texelSize[0] = 1 / firstStage.frame.width
    firstStage.texelSize[1] = 1 / firstStage.frame.height
    for (let i = 1; i < this.#passes + 1; i++) {
      const inputStage = this.#bloomStages[i - 1]
      const targetWidth = Math.max(
        Math.ceil(
          (inputStage.frame.width / 2) * inputStage.texture.resolution - 1e-6,
        ),
        1,
      )
      const targetHeight = Math.max(
        Math.ceil(
          (inputStage.frame.height / 2) * inputStage.texture.resolution - 1e-6,
        ),
        1,
      )
      let targetStage = this.#bloomStages[i]
      if (!targetStage.texture) {
        targetStage.texture = PIXI.RenderTexture.create({
          width: targetWidth,
          height: targetHeight,
          ...this.#textureOptions,
          multisample: PIXI.MSAA_QUALITY.NONE, // force no multisample
        })
      } else if (
        targetStage.texture.width !== targetWidth ||
        targetStage.texture.height !== targetHeight
      ) {
        targetStage.texture.resize(targetWidth, targetHeight, true)
      }
      targetStage.frame.width = targetWidth
      targetStage.frame.height = targetHeight
      targetStage.texelSize[0] = 1 / targetWidth
      targetStage.texelSize[1] = 1 / targetHeight
      applyGlobalUniforms(globalUniforms, inputStage, targetStage)
      const texelSize = this.#downsamplerPass.uniforms.uTexelSize
      texelSize[0] = targetStage.texelSize[0]
      texelSize[1] = targetStage.texelSize[1]
      this.#downsamplerPass.uniforms.uApplyLuminanceThreshold = i === 1
      filterSystem.applyFilter(
        this.#downsamplerPass,
        inputStage.texture,
        targetStage.texture,
        PIXI.CLEAR_MODES.CLEAR,
      )
    }
    this.#upsamplerPass.uniforms.uIsLastPass = false
    this.#upsamplerPass.blendMode = PIXI.BLEND_MODES.ADD
    for (let i = this.#passes; i > 0; i--) {
      const inputStage = this.#bloomStages[i]
      const targetStage = this.#bloomStages[i - 1]
      applyGlobalUniforms(globalUniforms, inputStage, targetStage)
      const texelSize = this.#upsamplerPass.uniforms.uTexelSize
      texelSize[0] = targetStage.texelSize[0]
      texelSize[1] = targetStage.texelSize[1]
      this.#upsamplerPass.uniforms.uToneMap = i === 1
      this.#upsamplerPass.uniforms.uSampleWeight = 1
      filterSystem.applyFilter(
        this.#upsamplerPass,
        inputStage.texture,
        targetStage.texture,
        PIXI.CLEAR_MODES.NO,
      )
    }
    applyGlobalUniforms(
      globalUniforms,
      this.#bloomStages[0],
      this.#bloomStages[0],
    )
    this.#upsamplerPass.blendMode = PIXI.BLEND_MODES.NORMAL
    this.#upsamplerPass.uniforms.uIsLastPass = true
    this.#upsamplerPass.uniforms.uSampleWeight = 1
    filterSystem.applyFilter(
      this.#upsamplerPass,
      input,
      output,
      PIXI.CLEAR_MODES.NO,
    )

    backupSourceFrame.copyTo(filterSystem.activeState.sourceFrame)
  }
  /**
   * @returns {void}
   */
  destroy() {
    for (const stage of this.#bloomStages) {
      stage.texture?.destroy(true)
    }
  }
}
/**
 * @typedef {Object} BloomStage
 * @property {PIXI.RenderTexture | null} texture
 * @property {PIXI.Rectangle} frame
 * @property {Float32Array} texelSize
 */
