const HOOKS = {};

/* -------------------------------------------- */

/**
 * Keen: Reduce the critical success threshold for attack rolls made with this weapon.
 * The threshold decreases by 1 per tier (default 6, tier 1 = 5, tier 2 = 4, tier 3 = 3).
 */
HOOKS.keen = {
  prepareAttack(item, action, target, rollData) {
    const tier = item.system.affixes.keen.system.tier.value;
    rollData.criticalSuccessThreshold = 6 - tier;
  }
};

/* -------------------------------------------- */

/**
 * Tenacity: Increase Fortitude defense by the affix tier.
 */
HOOKS.tenacity = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.tenacity.system.tier.value;
    defenses.fortitude.bonus += tier;
  }
};

/* -------------------------------------------- */

HOOKS.reach = {
  prepareWeapons(item, weapons) {
    const tier = item.system.affixes.reach.system.tier.value;
    const category = item.system.config.category;
    item.system.range += category.ranged ? (10 * tier) : tier;
  }
};

/* -------------------------------------------- */

HOOKS.reliable = {
  prepareAttack(item, action, target, rollData) {
    const tier = item.system.affixes.reliable.system.tier.value;
    rollData.criticalFailureThreshold = 6 - tier;
  }
};

/* -------------------------------------------- */

HOOKS.returning = {
  preActivateAction(item, action, _targets) {
    const updates = action.usage.actorUpdates.items;
    if ( !updates ) return;
    const update = updates.find(u => (u._id === item.id) && u.system?.dropped);
    if ( update ) delete update.system.dropped;
  }
};

/* -------------------------------------------- */

HOOKS.weaponPotency = {
  prepareWeapons(item, weapons) {
    const tier = item.system.affixes.weaponPotency.system.tier.value;
    item.system.actionBonuses.enchantment += tier;
  }
};

/* -------------------------------------------- */

export default HOOKS;
