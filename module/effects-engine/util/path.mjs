import { lerp, lerpRotation } from "./interpolation.mjs"

/** @import { IPointData } from 'pixi.js' */
/** @import { VariableValue } from '../util/variables.mjs' */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {(VariableValue<'linear', Resolved> | PathLinearConfig<Resolved> | PathBezierQuadraticConfig<Resolved> | PathBezierCubicConfig<Resolved> | PathCustomConfig<Resolved>) & PathCommonConfig<Resolved>} PathConfig
 */

/**
 * @typedef {Object} PathConfigProps
 * @property {PathConfig<true>} config
 * @property {IPointData} start
 * @property {IPointData} end
 */

const DATA_PACKAGES = 4
export class Path {
  // TODO: store distance in a separate array for faster searching?

  /** distance,x,y, rotation values saved as a packed data stream */
  #pointData

  /** @type number */
  straightDistance

  /** @type number */
  pathDistance = 0

  /**
   * @param {PathConfigProps} props
   */
  constructor({ config, start, end }) {
    if (start.x === end.x && start.y === end.y) {
      throw new Error(
        `target and source must be different in path ${JSON.stringify(config)}`,
      )
    }
    this.straightDistance = calcDistance(start.x, start.y, end.x, end.y)
    if (config === "linear" || config.type === "linear") {
      this.#pointData = this.#discretizePathLinear(start, end)
    } else if (config.type === "quadratic") {
      this.#pointData = this.#discretizePathQuadratic(config, start, end)
    } else if (config.type === "cubic") {
      this.#pointData = this.#discretizePathCubic(config, start, end)
    } else {
      this.#pointData = this.#transformPathCustom(config.points, start, end)
    }
    this.#updatePathRotation()
    this.pathDistance = this.#getLastPoint().d
  }
  // TODO: binary search?
  /**
   * @param {number} distance
   * @returns {PathPoint}
   */
  pointAtDistance(distance) {
    if (distance >= this.pathDistance) {
      return this.#getLastPoint()
    }
    if (distance <= 0) {
      return this.#getPoint(0)
    }
    for (
      let i = DATA_PACKAGES;
      i < this.#pointData.length;
      i += DATA_PACKAGES
    ) {
      if (this.#pointData[i] >= distance) {
        const d1 = this.#pointData[i - 4]
        const x1 = this.#pointData[i - 3]
        const y1 = this.#pointData[i - 2]
        const rot1 = this.#pointData[i - 1]
        const d2 = this.#pointData[i]
        const x2 = this.#pointData[i + 1]
        const y2 = this.#pointData[i + 2]
        const rot2 = this.#pointData[i + 3]
        const t = (distance - d1) / (d2 - d1)
        return {
          d: distance,
          x: lerp(x1, x2, t),
          y: lerp(y1, y2, t),
          r: lerpRotation(rot1, rot2, t),
        }
      }
    }
    return this.#getPoint(0)
  }
  /**
   * @param {number} index
   * @returns {PathPoint}
   */
  #getPoint(index) {
    if (index >= this.#pointData.length) {
      return this.#getLastPoint()
    }
    return {
      d: this.#pointData[index++],
      x: this.#pointData[index++],
      y: this.#pointData[index++],
      r: this.#pointData[index++],
    }
  }
  /**
   * @returns {PathPoint}
   */
  #getLastPoint() {
    return this.#getPoint(this.#pointData.length - DATA_PACKAGES)
  }
  /**
   * @param {IPointData} start
   * @param {IPointData} end
   * @returns {Float32Array}
   */
  #discretizePathLinear(start, end) {
    return new Float32Array([
      0, // d0
      start.x, // x0
      start.y, // y0
      0, // r0
      this.straightDistance, // d1
      end.x, // x1
      end.y, // y1
      0, // r1
    ])
  }
  /**
   * @param {PathBezierQuadraticConfig<true>} path
   * @param {IPointData} start
   * @param {IPointData} end
   * @returns {Float32Array}
   */
  #discretizePathQuadratic(path, start, end) {
    const step = 1 / this.straightDistance
    const pointCount = Math.ceil(this.straightDistance)
    const pointData = new Float32Array(pointCount)
    const { x: x0, y: y0 } = start
    const [x1, y1] = normalizeBezierPoint(path.control, start, end)
    const { x: x2, y: y2 } = end
    const t1x = 2 * x1 - 2 * x0
    const t2x = x0 - 2 * x1 + x2
    const t1y = 2 * y1 - 2 * y0
    const t2y = y0 - 2 * y1 + y2
    let prevX = 0
    let prevY = 0
    let d = 0
    for (let i = 0; i <= pointCount; i++) {
      const t = i * step
      const t2 = Math.pow(t, 2)
      const x = x0 + t * t1x + t2 * t2x
      const y = y0 + t * t1y + t2 * t2y
      let idx = i * DATA_PACKAGES
      if (i > 0) {
        prevX = pointData[idx - 3]
        prevY = pointData[idx - 2]
        d += calcDistance(x, y, prevX, prevY)
      }
      pointData[idx++] = d
      pointData[idx++] = x
      pointData[idx++] = y
      pointData[idx++] = calcRotation(x, y, prevX, prevY)
    }
    return pointData
  }
  /**
   * @param {PathBezierCubicConfig<true>} path
   * @param {IPointData} start
   * @param {IPointData} end
   * @returns {Float32Array}
   */
  #discretizePathCubic(path, start, end) {
    const pointCount = Math.ceil(this.straightDistance)
    const step = 1 / pointCount
    const pointData = new Float32Array(pointCount * DATA_PACKAGES)
    const { x: x0, y: y0 } = start
    const [x1, y1] = normalizeBezierPoint(path.controlA, start, end)
    const [x2, y2] = normalizeBezierPoint(path.controlB, start, end)
    const { x: x3, y: y3 } = end
    const t1x = -3 * x0 + 3 * x1
    const t2x = 3 * x0 - 6 * x1 + 3 * x2
    const t3x = -x0 + 3 * x1 - 3 * x2 + x3
    const t1y = -3 * y0 + 3 * y1
    const t2y = 3 * y0 - 6 * y1 + 3 * y2
    const t3y = -y0 + 3 * y1 - 3 * y2 + y3
    let prevX = 0
    let prevY = 0
    let d = 0
    for (let i = 0; i <= pointCount; i++) {
      const t = i * step
      const t2 = Math.pow(t, 2)
      const t3 = Math.pow(t, 3)
      const x = x0 + t * t1x + t2 * t2x + t3 * t3x
      const y = y0 + t * t1y + t2 * t2y + t3 * t3y
      let idx = i * DATA_PACKAGES
      if (i > 0) {
        prevX = pointData[idx - 3]
        prevY = pointData[idx - 2]
        d += Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2))
      }
      pointData[idx++] = d
      pointData[idx++] = x
      pointData[idx++] = y
      // rotation is calculated as a post-processing step
      pointData[idx++] = 0
    }
    return pointData
  }
  /**
   * @param {PathControlPointConfig<true>[]} points
   * @param {IPointData} start
   * @param {IPointData} end
   * @returns {Float32Array}
   */
  #transformPathCustom(points, start, end) {
    const pointData = new Float32Array(points.length * DATA_PACKAGES)
    let d = 0
    let prevX = 0
    let prevY = 0
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const x = p.shift * this.straightDistance
      const y = p.offset
      let idx = i * DATA_PACKAGES
      if (i > 0) {
        prevX = pointData[idx - 3]
        prevY = pointData[idx - 2]
        d += calcDistance(x, y, prevX, prevY)
      }
      pointData[idx++] = d
      pointData[idx++] = x
      pointData[idx++] = y
      // rotation is calculated as a post-processing step
      pointData[idx++] = 0
    }
    return pointData
  }
  /**
   * @returns {void}
   */
  #updatePathRotation() {
    for (let i = 0; i < this.#pointData.length; i += DATA_PACKAGES) {
      // for last entry, just copy the previous rotation
      if (i + DATA_PACKAGES >= this.#pointData.length) {
        this.#pointData[i + 3] = this.#pointData[i - DATA_PACKAGES + 3]
        continue
      }
      const x0 = this.#pointData[i + 1]
      const y0 = this.#pointData[i + 2]
      const x1 = this.#pointData[i + 5]
      const y1 = this.#pointData[i + 6]
      this.#pointData[i + 3] = calcRotation(x1, y1, x0, y0)
    }
  }
}
/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
function calcDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
}
/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
function calcRotation(x1, y1, x2, y2) {
  return Math.atan2(y1 - y2, x1 - x2)
}
/**
 * @param {PathControlPointConfig<true>} point
 * @param {IPointData} start
 * @param {IPointData} end
 * @returns {[number, number]}
 */
function normalizeBezierPoint(point, start, end) {
  // calculate normals
  const oneOverDistance = 1 / calcDistance(start.x, start.y, end.x, end.y)
  const normalX = (end.y - start.y) * oneOverDistance
  const normalY = (end.x - start.x) * oneOverDistance
  const x = (start.x + end.x) * point.shift + normalX * point.offset
  const y = (start.y + end.y) * point.shift + normalY * point.offset
  return [x, y]
}

/**
 * @typedef {Object} PathPoint
 * @property {number} x - x coordinate
 * @property {number} y - y coordinate
 * @property {number} d - distance
 * @property {number} r - rotation
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} PathControlPointConfig
 * @property {VariableValue<number, Resolved>} shift forward/backward position of control point between 0 and 1 for percentage of distance
 * @property {VariableValue<number, Resolved>} offset up/down offset in px
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} PathCommonConfig
 * @property {VariableValue<IPointData, Resolved>} [start]
 * @property {VariableValue<IPointData, Resolved>} [end]
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} PathLinearConfig
 * @property {'linear'} type
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} PathBezierQuadraticConfig
 * @property {'quadratic'} type
 * @property {PathControlPointConfig<Resolved>} control
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} PathBezierCubicConfig
 * @property {'cubic'} type
 * @property {PathControlPointConfig<Resolved>} controlA
 * @property {PathControlPointConfig<Resolved>} controlB
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} PathCustomConfig
 * @property {'custom'} type
 * @property {VariableValue<PathControlPointConfig<Resolved>[], Resolved>} points
 */
