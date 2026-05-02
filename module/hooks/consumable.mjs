const HOOKS = {};

/* -------------------------------------------- */

/**
 * Default Token light configuration applied by a lit Torch when the token has no custom light source.
 */
const TORCH_LIGHT = Object.freeze({alpha: 0.75, angle: 360, bright: 15, color: "#ff8800", coloration: 101, dim: 30,
  attenuation: 0.6, luminosity: 0.5, saturation: 0, contrast: 0, shadows: 0, negative: false, priority: 0,
  animation: {type: "flame", speed: 2, intensity: 2, reverse: false}, darkness: {min: 0, max: 1}});

/* -------------------------------------------- */

HOOKS.torch = {
  prepareToken(_item, token) {
    if ( !this.effects.has("torchBurning0000") ) return;
    if ( (token.light.bright !== 0) || (token.light.dim !== 0) ) return; // Don't override manually configured light
    foundry.utils.mergeObject(token.light, TORCH_LIGHT);
  }
};

/* -------------------------------------------- */

export default HOOKS;
