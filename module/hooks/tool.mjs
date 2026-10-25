const HOOKS = {};

/* -------------------------------------------- */

/**
 * Default Token light configuration applied by an equipped Lantern when the token has no custom light source.
 * @param {Readonly<LightData>}
 */
const LANTERN_LIGHT = Object.freeze({alpha: 0.75, angle: 360, bright: 20, color: "#ffaa33", coloration: 100, dim: 40,
  attenuation: 0.75, luminosity: 0.5, saturation: 0, contrast: 0, shadows: 0, negative: false, priority: 0,
  animation: {type: "torch", speed: 4, intensity: 3, reverse: false}, darkness: {min: 0, max: 1}});

/* -------------------------------------------- */

HOOKS.lantern = {
  prepareToken(_item, token) {
    if ( !this.effects.has("lanternBurning00") ) return;
    if ( (token.light.bright !== 0) || (token.light.dim !== 0) ) return;
    foundry.utils.mergeObject(token.light, LANTERN_LIGHT);
  }
};

/* -------------------------------------------- */

export default HOOKS;
