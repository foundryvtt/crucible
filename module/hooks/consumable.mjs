const HOOKS = {};

/* -------------------------------------------- */

// TODO: Come up with a more reusable & robust mechanism for "X thing temporarily grants Y Talent"
HOOKS.potionOfGliding = {
  _EFFECT_ID: "potionGliding000",
  _FALL_GLIDE_ACTION: {
    description: "<p>@ref[actor.name] glides rather than falls, flying downward under control. The movement must descend and suffers no falling damage. If the creature ends its glide while still aloft it gains the @Condition[flying] condition.</p>",
    id: "fallGlide",
    img: "icons/svg/wing.svg",
    name: "Glide",
    tags: ["fly"],
    target: {
      type: "self",
      number: 0,
      scope: 1
    }
  },
  prepareActions(item, actions) {
    if ( !this.effects.has(HOOKS.potionOfGliding._EFFECT_ID) ) return;
    actions.fallGlide ??= (new crucible.api.models.CrucibleAction(HOOKS.potionOfGliding._FALL_GLIDE_ACTION)).bind(this);
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
