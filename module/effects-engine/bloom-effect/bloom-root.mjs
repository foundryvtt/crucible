/**
 * TODO: this should ideally be integrated into the main canvas group
 */

import { HdrBloomEffect } from "./hdr-bloom-effect.mjs"

/**
 * @import {IBaseTextureOptions} from 'pixi.js'
 */

/**
 * Root container for HDR bloom effects.
 * Integrating this directly into the pixi.js filter system would be complicated
 * as we have to make sure to ALWAYS generate our own hdr capable textures for the filter,
 * which is not guaranteed by the pixi.js filter system.
 *
 * This is a quick and dirty workaround that has to be cleaned up, but demonstrates
 * the concept of how to integrate a HDR bloom filter into the system.
 *
 * HDR Bloom is desirable for the animation system over the integrated PIXI.js bloom filters
 * for the simple reason that it is a bit more stable in motion, only one post processing pass
 * is required for the whole canvas and it has a more natural look than the integrated bloom filter,
 * allowing for pure white objects that exhibit a colorful glow or bloom.
 *
 * This implementation is inspired by the CoD Modern Warfare Advanced Postprocessing paper with and some
 * other useful resources like this video from The Cherno (https://www.youtube.com/watch?v=tI70-HIc5ro).
 *
 * As a quick overview, this system (as implemented in hdr-bloom-effect.mjs and bloom-passes.mjs) utilizes
 * a few stages, though not every step required a separate shader passes as some can be combined:
 * 1. Threshold pass: This pass is used to determine which pixels are bright enough to bloom.
 * 2. Downsample passes (8 per default): Downsample the current image buffer to 1/2 the resolution, 1/4 the size,
 *    using the GPUs linear interpolation hardware to blur the image
 * 3. Upsample passes (8 per default): Upsample the downsampled image buffer to 2x the resolution, 4x the size,
 *    using a 4-tap tent upsampling filter (essentially interpolating beetween 16 pixel values similar to
 *    a gaussian blur), adding the result (as in additive blending) to the previous downsampled image buffer.
 * 4. Tone mapping pass: This pass is used to convert the HDR color values to LDR color values. The current implementation
 *    uses a quick ACES approximation. In contrast to a fully fledged HDR rendering pipeline, this pass is only applied to
 *    the final bloom image, NOT the original image. This ensures that the original image is not affected by tone mapping,
 *    which would probably be undesireable at this point in time.
 * 5. Final pass: This pass is used to additively combine the original image with the bloom image.
 *
 * @extends PIXI.Container
 */
export class BloomRoot extends PIXI.Container {
  /**
   * @type {{renderTexture: PIXI.RenderTexture | null; sourceFrame: PIXI.Rectangle; destinationFrame: PIXI.Rectangle}}
   */
  #renderTargetBackup = {
    renderTexture: null,
    sourceFrame: canvas.app.renderer.screen.clone(),
    destinationFrame: canvas.app.renderer.screen.clone(),
  }

  /** @type {PIXI.RenderTexture} */
  #renderTexture

  /** @type {HdrBloomEffect} */
  #bloomEffect

  /**
   * Texture options for the render texture.
   * We have to specify a HDR capable texture format here.
   * 10/11/11 bit float RGB would be optimal here to save memory AND it is
   * supported by practically all webgl2 capable systems
   * (99,91% as of writing this: https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_float/)
   * but this format is not supported for debugging purposes in the specter.js devtools.
   *
   * RGBA Half Float is also somewhat widely supported https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_half_float
   * and is supported by specter.js devtools, but uses twice the memory.
   *
   * @type {IBaseTextureOptions}
   */
  #textureOptions = {
    wrapMode: PIXI.WRAP_MODES.CLAMP,
    // optimized texture options for 32bit RGB hdr rendering (no alpha)
    // format: PIXI.FORMATS.RGB,
    // type: PIXI.TYPES.UNSIGNED_INT_10F_11F_11F_REV,
    // debug options for half float textures (visible in specter.js devtools)
    format: PIXI.FORMATS.RGBA,
    type: PIXI.TYPES.HALF_FLOAT,
  }

  constructor() {
    super()
    this.#renderTexture = this.#createRenderTexture()
    this.#bloomEffect = new HdrBloomEffect({
      textureOptions: this.#textureOptions,
    })
  }

  /**
   * @param {PIXI.Renderer} renderer
   * @returns {void}
   */
  render(renderer) {
    // bind hdr render texture
    this.#setHdrRenderTexture(renderer)

    // render regular content
    super.render(renderer)
    renderer.batch.flush()

    // apply bloom effect
    this.#bloomEffect.apply(
      renderer,
      this.#renderTexture,
      this.#renderTargetBackup.renderTexture,
    )

    // restore previous state
    this.#restoreRenderTexture(renderer)
  }

  /**
   * @param {PIXI.Renderer} renderer
   */
  #setHdrRenderTexture(renderer) {
    const renderTexture = this.#renderTexture
    const rts = renderer.renderTexture

    // backup the current render target
    this.#renderTargetBackup.renderTexture = rts.current
    this.#renderTargetBackup.sourceFrame.copyFrom(rts.sourceFrame)
    this.#renderTargetBackup.destinationFrame.copyFrom(rts.destinationFrame)

    this.#bind(renderer, renderTexture)
  }

  /**
   * @param {PIXI.Renderer} renderer
   */
  #restoreRenderTexture(renderer) {
    const rts = renderer.renderTexture
    const renderTexture = this.#renderTargetBackup.renderTexture
    const sourceFrame = this.#renderTargetBackup.sourceFrame
    const destinationFrame = this.#renderTargetBackup.destinationFrame
    rts.bind(renderTexture, sourceFrame, destinationFrame)
    this.#renderTargetBackup.renderTexture = null
  }

  /**
   *
   * @param {PIXI.Renderer} renderer
   * @param {PIXI.RenderTexture} [renderTexture]
   * @param {PIXI.Rectangle} [sourceFrame]
   */
  #bind(renderer, renderTexture, sourceFrame) {
    const rts = renderer.renderTexture
    const fbs = renderer.framebuffer
    const gl = renderer.gl

    const previousFramebuffer = fbs.current.glFramebuffers[fbs.CONTEXT_UID]

    // Bind our texture to the renderer
    renderer.batch.flush()
    rts.bind(renderTexture, sourceFrame, undefined)

    // blit old framebuffer (most likely scene background etc) to our render texture
    const currentFramebuffer = fbs.current.glFramebuffers[fbs.CONTEXT_UID]
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousFramebuffer?.framebuffer)

    const res = renderer.resolution
    const source = rts.sourceFrame
    const dest = rts.destinationFrame
    gl.blitFramebuffer(
      source.left * res,
      source.bottom * res,
      source.right * res,
      source.top * res,
      dest.left * res,
      dest.bottom * res,
      dest.right * res,
      dest.top * res,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    )
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, currentFramebuffer?.framebuffer)
    // note: regular filters are currently not supported on this special container
  }

  #createRenderTexture() {
    const renderer = game.canvas.app.renderer
    const renderTexture = PIXI.RenderTexture.create({
      width: renderer.screen.width,
      height: renderer.screen.height,
      resolution: renderer.resolution,
      multisample: renderer.multisample,
      ...this.#textureOptions,
    })

    // Return a reference to the render texture
    return renderTexture
  }
}
