const HOOKS = {};

/* -------------------------------------------- */

/**
 * Light configuration of a lit Burning Torch, whether held by a Token or thrown as an AmbientLight.
 */
const TORCH_LIGHT = Object.freeze({alpha: 0.75, angle: 360, bright: 15, color: "#ff6d1f", coloration: 100, dim: 30,
  attenuation: 0.75, luminosity: 0.5, saturation: 0, contrast: 0, shadows: 0, negative: false, priority: 0,
  animation: {type: "torch", speed: 7, intensity: 5, reverse: false}, darkness: {min: 0, max: 1}});

/**
 * AmbientLight configuration of a thrown Burning Torch, which flickers more gently than one held aloft.
 */
const THROWN_TORCH_LIGHT = Object.freeze({...TORCH_LIGHT,
  animation: Object.freeze({...TORCH_LIGHT.animation, type: "flame", speed: 4, intensity: 1})});

/* -------------------------------------------- */

HOOKS.burningTorch = {
  // Land at the center of a placed region, or otherwise at the creature it was thrown at
  _getLanding(action) {
    const region = action.region;
    if ( region ) {
      const {x, y} = region.shapes[0];
      return {scene: region.parent, x, y, elevation: region.elevation.bottom, levels: Array.from(region.levels)};
    }
    const token = action.targets?.values().next().value?.token;
    if ( !token ) return null;
    const {x, y} = token.getCenterPoint();
    return {scene: token.parent, x, y, elevation: token.elevation, levels: [token.level]};
  },
  async _placeLight(action, weapon, {scene, x, y, elevation, levels}) {
    const effect = action.selfEvents?.all.flatMap(e => e.effects).find(f => f._id === weapon.id);
    const uuid = effect?.system.lights[0];
    if ( !uuid ) return;
    const lightData = {_id: uuid.split(".").pop(), name: _loc("ACTIONS.ThrowTorch.LightName", {actor: action.actor.name}),
      x, y, elevation, levels, config: foundry.utils.deepClone(THROWN_TORCH_LIGHT)};
    await scene.createEmbeddedDocuments("AmbientLight", [lightData], {keepId: true});
  },
  // Record the planned light now with a unique ID so its animation can be planned
  _recordDeployment(action, weapon) {
    const scene = HOOKS.burningTorch._getLanding(action)?.scene;
    const lights = scene ? [`${scene.uuid}.AmbientLight.torch${foundry.utils.randomID(11)}`] : [];
    action.recordEvent({type: "effect", target: action.actor, effects: [{
      _id: weapon.id,
      name: weapon.name,
      img: weapon.img,
      origin: weapon.uuid,
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER,
      system: {properties: ["deployed"], lights}
    }]});
  },
  async confirmAction(item, action, {reverse}) {
    if ( reverse || !action.tags.has("thrown") ) return;
    const landing = HOOKS.burningTorch._getLanding(action);
    if ( landing ) await HOOKS.burningTorch._placeLight(action, item, landing);
  },
  preActivateAction(item, action) {
    if ( !action.tags.has("thrown") || !action.usage.strikes?.some(w => w.id === item.id) ) return;
    HOOKS.burningTorch._recordDeployment(action, item);
  },
  prepareToken(_item, token) {
    if ( (token.light.bright !== 0) || (token.light.dim !== 0) ) return; // Don't override manually configured light
    foundry.utils.mergeObject(token.light, TORCH_LIGHT);
  }
};

/* -------------------------------------------- */

HOOKS.chainHook = {
  preActivateAction(...args) {
    crucible.api.hooks.affix.returning.preActivateAction(...args);
  }
};

/* -------------------------------------------- */

HOOKS.javelin = {
  prepareAction(item, action) {
    if ( !action.tags.has("thrown") ) return;
    const thrownWeapon = action.usage.weapon ?? action.usage.strikes?.[0];
    if ( thrownWeapon?.id !== item.id ) return;
    action.range.maximum += 30;
  }
};

/* -------------------------------------------- */

export default HOOKS;
