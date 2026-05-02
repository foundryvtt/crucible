const HOOKS = {};

/* -------------------------------------------- */

/**
 * Default Token light configuration applied by an equipped Lantern when the token has no custom light source.
 * @param {Readonly<LightData>}
 */
const LANTERN_LIGHT = Object.freeze({alpha: 0.8, angle: 360, bright: 20, color: "#ffb24e", coloration: 100, dim: 40,
  attenuation: 0.6, luminosity: 0.5, saturation: 0, contrast: 0, shadows: 0, negative: false, priority: 0,
  animation: {type: "flame", speed: 2, intensity: 1, reverse: false}, darkness: {min: 0, max: 1}});

/* -------------------------------------------- */

HOOKS.lantern = {
  prepareToken(_item, token) {
    // Avoid overriding any light source that has been explicitly configured on the token
    if ( (token.light.bright !== 0) || (token.light.dim !== 0) ) return;
    foundry.utils.mergeObject(token.light, LANTERN_LIGHT);
  }
};

/* -------------------------------------------- */

export default HOOKS;
