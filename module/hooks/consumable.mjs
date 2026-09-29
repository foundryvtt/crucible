const HOOKS = {};

/* -------------------------------------------- */

// TODO: Come up with a more reusable & robust mechanism for "X thing temporarily grants Y Talent"
// Shares this Glider talent bridge with HOOKS.gliding in affix.mjs
HOOKS.potionOfGliding = {
  get _EFFECT_ID() {
    return SYSTEM.EFFECTS.getEffectId("potionGliding");
  },
  prepareActions(item, actions) {

    // Consumable actions are registered under an item-qualified key which the Glider talent hook does not recognize
    const key = `fallGlide.${item.id}`;
    const glide = actions[key];
    delete actions[key];
    if ( !glide || !this.effects.has(HOOKS.potionOfGliding._EFFECT_ID) ) return;
    actions.fallGlide ??= glide;
    return crucible.api.hooks.talent.glider0000000000.prepareActions.call(this, item, actions);
  },
  prepareMovement(item, movement) {
    if ( !this.effects.has(HOOKS.potionOfGliding._EFFECT_ID) ) return;
    return crucible.api.hooks.talent.glider0000000000.prepareMovement.call(this, item, movement);
  }
};

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
