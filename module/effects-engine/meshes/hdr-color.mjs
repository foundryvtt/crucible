/**
 * @typedef {Float32Array | Uint8Array | Uint8ClampedArray} ColorSourceTypedArray
 */

/**
 * @typedef {Object} HdrColorOptions
 * @property {number} minValue
 * @property {number} maxValue
 * @property {number} maxAlpha
 */

const defaultOptions = {
  minValue: 0,
  maxValue: 256,
  maxAlpha: 1, // don't allow alpha values larger than 1
}

/**
 * PIXI.Color extension that supports high dynamic range color values.
 */
export class HdrColor extends PIXI.Color {
  /** @type HdrColorOptions */
  _options

  /**
   * Default Color object for static uses
   * @override
   * @example
   * import { Color } from 'pixi.js';
   * Color.shared.setValue(0xffffff).toHex(); // '#ffffff'
   *
   * @type {HdrColor}
   */
  static shared = new HdrColor()

  /**
   *
   * @param {PIXI.ColorSource} [value]
   * @param {Partial<HdrColorOptions>} [options]
   */
  constructor(value, options) {
    super(value)
    this._options = { ...defaultOptions, ...options }
  }

  /**
   * @type {Float32Array}
   */
  get components() {
    return this._components
  }

  /**
   * Checks another color for equality with this color
   * @param {HdrColor | PIXI.ColorSource} other
   * @returns {boolean}
   */
  equals(other) {
    if (other instanceof HdrColor) {
      for (let i = 0; i < 4; i++) {
        if (this.components[i] !== other.components[i]) {
          return false
        }
      }
      return true
    }
    return this.equals(new HdrColor(other))
  }

  /**
   * @returns {number} value
   */
  get minValue() {
    return this._options?.minValue ?? defaultOptions.minValue
  }

  /**
   * @returns {number} value
   */
  get maxValue() {
    return this._options?.maxValue ?? defaultOptions.maxValue
  }

  /**
   * @returns {number} value
   */
  get maxAlpha() {
    return this._options?.maxAlpha ?? defaultOptions.maxAlpha
  }

  /**
   * Set alpha, suitable for chaining.
   * @override
   * @param {number} alpha
   * @returns {this}
   */
  setAlpha(alpha) {
    this._components[3] = this._clamp(alpha, this.minValue, this.maxAlpha)

    return this
  }

  /**
   * @param {HdrColorOptions} options
   * @returns {HdrColor}
   */
  withOptions(options) {
    this._options = options
    return this
  }

  /**
   * Convert to a hexadecimal number in little endian format (e.g., BBGGRR).
   * @example
   * import { Color } from 'pixi.js';
   * new Color(0xffcc99).toLittleEndianNumber(); // returns 0x99ccff
   * @returns {number} - The color as a number in little endian format.
   */
  toLittleEndianNumber() {
    const [r, g, b] = this._components

    return (
      this._clamp(b) * 255 * 4294967296 +
      ((this._clamp(g) * 255) << 16) +
      ((this._clamp(r) * 255) | 0)
    )
  }

  /**
   * @override
   * @returns {void}
   */
  refreshInt() {
    const [r, g, b] = this._components

    this._int =
      this._clamp(r) * 255 * 4294967296 +
      ((this._clamp(g) * 255) << 16) +
      ((this._clamp(b) * 255) | 0)
  }

  /**
   * @override
   * @private
   * @template {number | number[] | ColorSourceTypedArray} T
   *
   * @param {T} value
   * @param {number} [min]
   * @param {number} [max]
   * @param {number} [maxAlpha]
   * @returns {T}
   */
  _clamp(
    value,
    min = this.minValue,
    max = this.maxValue,
    maxAlpha = this.maxAlpha,
  ) {
    if (typeof value === "number") {
      return Math.min(Math.max(value, min), max)
    }

    value[0] = Math.min(Math.max(value[0], min), max)
    value[1] = Math.min(Math.max(value[1], min), max)
    value[2] = Math.min(Math.max(value[2], min), max)
    value[3] = Math.min(Math.max(value[3], min), maxAlpha)

    return value
  }
}
