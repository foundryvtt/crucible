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
  async _placeLight(action, weapon, {scene, x, y, elevation, levels}) {
    const effect = action.selfEvents?.all.flatMap(e => e.effects).find(f => f._id === weapon.id);
    if ( !effect ) return;
    const lightData = {_id: weapon.id, x, y, elevation, levels, config: foundry.utils.deepClone(THROWN_TORCH_LIGHT)};
    const [light] = await scene.createEmbeddedDocuments("AmbientLight", [lightData], {keepId: true});
    effect.system.lights.push(light.uuid);
  },
  _recordDeployment(action, weapon) {
    action.recordEvent({type: "effect", target: action.actor, effects: [{
      _id: weapon.id,
      name: weapon.name,
      img: weapon.img,
      origin: weapon.uuid,
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER,
      system: {properties: ["deployed"], lights: []}
    }]});
  },
  async confirmAction(item, action, {reverse}) {
    if ( reverse || !action.tags.has("thrown") ) return;

    // Land at the center of a placed region, or otherwise at the creature it was thrown at
    const region = action.region;
    if ( region ) {
      const {x, y} = region.shapes[0];
      const {bottom, top} = region.elevation;
      await HOOKS.burningTorch._placeLight(action, item, {scene: region.parent, x, y, elevation: (bottom + top) / 2,
        levels: Array.from(region.levels)});
      return;
    }
    const token = action.targets.values().next().value?.token;
    if ( !token ) return;
    const {x, y} = token.getCenterPoint();
    await HOOKS.burningTorch._placeLight(action, item, {scene: token.parent, x, y, elevation: token.elevation,
      levels: [token.level]});
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
