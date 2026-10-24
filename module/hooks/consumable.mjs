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

export default HOOKS;
