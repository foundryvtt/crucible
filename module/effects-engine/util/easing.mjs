// TODO / FIXME: this is currently borrowed from sequencer. Trim it down and maybe re-implement for copyright reasons?

export const easingFunctions = {
  linear: linear,
  easeInSine: easeInSine,
  easeOutSine: easeOutSine,
  easeInOutSine: easeInOutSine,
  easeInQuad: easeInQuad,
  easeOutQuad: easeOutQuad,
  easeInOutQuad: easeInOutQuad,
  easeInCubic: easeInCubic,
  easeOutCubic: easeOutCubic,
  easeInOutCubic: easeInOutCubic,
  easeInQuart: easeInQuart,
  easeOutQuart: easeOutQuart,
  easeInOutQuart: easeInOutQuart,
  easeInQuint: easeInQuint,
  easeOutQuint: easeOutQuint,
  easeInOutQuint: easeInOutQuint,
  easeInExpo: easeInExpo,
  easeOutExpo: easeOutExpo,
  easeInOutExpo: easeInOutExpo,
  easeInCirc: easeInCirc,
  easeOutCirc: easeOutCirc,
  easeInOutCirc: easeInOutCirc,
  easeInBack: easeInBack,
  easeOutBack: easeOutBack,
  easeInOutBack: easeInOutBack,
  easeInElastic: easeInElastic,
  easeOutElastic: easeOutElastic,
  easeInOutElastic: easeInOutElastic,
  easeInBounce: easeInBounce,
  easeOutBounce: easeOutBounce,
  easeInOutBounce: easeInOutBounce,
}
/**
 * @param {number} x
 * @returns {number}
 */
function linear(x) {
  return x
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInSine(x) {
  return 1 - Math.cos((x * Math.PI) / 2)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutSine(x) {
  return Math.sin((x * Math.PI) / 2)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInQuad(x) {
  return x * x
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutQuad(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInCubic(x) {
  return x * x * x
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInQuart(x) {
  return x * x * x * x
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutQuart(x) {
  return 1 - Math.pow(1 - x, 4)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutQuart(x) {
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInQuint(x) {
  return x * x * x * x * x
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutQuint(x) {
  return 1 - Math.pow(1 - x, 5)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutQuint(x) {
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInExpo(x) {
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutExpo(x) {
  return x === 0
    ? 0
    : x === 1
    ? 1
    : x < 0.5
    ? Math.pow(2, 20 * x - 10) / 2
    : (2 - Math.pow(2, -20 * x + 10)) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInCirc(x) {
  return 1 - Math.sqrt(1 - Math.pow(x, 2))
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutCirc(x) {
  return Math.sqrt(1 - Math.pow(x - 1, 2))
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutCirc(x) {
  return x < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInBack(x) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return c3 * x * x * x - c1 * x * x
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutBack(x) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutBack(x) {
  const c1 = 1.70158
  const c2 = c1 * 1.525
  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInElastic(x) {
  const c4 = (2 * Math.PI) / 3
  return x === 0
    ? 0
    : x === 1
    ? 1
    : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutElastic(x) {
  const c4 = (2 * Math.PI) / 3
  return x === 0
    ? 0
    : x === 1
    ? 1
    : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutElastic(x) {
  const c5 = (2 * Math.PI) / 4.5
  return x === 0
    ? 0
    : x === 1
    ? 1
    : x < 0.5
    ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
    : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInBounce(x) {
  return 1 - easeOutBounce(1 - x)
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeOutBounce(x) {
  const n1 = 7.5625
  const d1 = 2.75
  if (x < 1 / d1) {
    return n1 * x * x
  } else if (x < 2 / d1) {
    return n1 * (x -= 1.5 / d1) * x + 0.75
  } else if (x < 2.5 / d1) {
    return n1 * (x -= 2.25 / d1) * x + 0.9375
  } else {
    return n1 * (x -= 2.625 / d1) * x + 0.984375
  }
}
/**
 * @param {number} x
 * @returns {number}
 */
function easeInOutBounce(x) {
  return x < 0.5
    ? (1 - easeOutBounce(1 - 2 * x)) / 2
    : (1 + easeOutBounce(2 * x - 1)) / 2
}
/** @typedef {(value: number) => number} EasingFunction */
/** @typedef {keyof typeof easingFunctions} EasingFunctionName */
